"""Legacy v1 archive builder for A/B transition assets.

The active B/C runtime is built by build_v2_assets.py. Do not run this script
to refresh the current B sprites or tray icon.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "assets" / "generated"
SPRITES = ROOT / "assets" / "sprites"
TRANSITION = ROOT / "assets" / "transition"
AUDIO = ROOT / "assets" / "audio"


def region(image, index, count):
    left = round(image.width * index / count)
    right = round(image.width * (index + 1) / count)
    return image.crop((left, 0, right, image.height))


def vertical_region(image, index, count):
    top = round(image.height * index / count)
    bottom = round(image.height * (index + 1) / count)
    return image.crop((0, top, image.width, bottom))


def trim(image, padding=10):
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Image has no visible pixels")
    image = image.crop(bbox)
    result = Image.new("RGBA", (image.width + padding * 2, image.height + padding * 2))
    result.alpha_composite(image, (padding, padding))
    return result


def normalize(image, size=(400, 400), max_size=(350, 350), bottom=390):
    image = trim(image, 0)
    ratio = min(max_size[0] / image.width, max_size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size)
    result.alpha_composite(resized, ((size[0] - resized.width) // 2, bottom - resized.height))
    return result


def sparkle(draw, x, y, radius, alpha):
    color = (211, 185, 255, alpha)
    draw.polygon([(x, y - radius), (x + radius * 0.25, y - radius * 0.25),
                  (x + radius, y), (x + radius * 0.25, y + radius * 0.25),
                  (x, y + radius), (x - radius * 0.25, y + radius * 0.25),
                  (x - radius, y), (x - radius * 0.25, y - radius * 0.25)], fill=color)


def build_transition(keyframes):
    frames = []
    rng = random.Random(40)
    stars = [(rng.randint(55, 345), rng.randint(55, 340), rng.randint(4, 10), rng.random() * math.tau) for _ in range(14)]
    for index in range(30):
        progress = index / 29
        position = progress * (len(keyframes) - 1)
        stage = min(len(keyframes) - 1, int(position + 0.5))
        source = keyframes[stage]
        pulse = math.sin(progress * math.tau * 2)
        scale_x = 1 + pulse * 0.018
        scale_y = 1 - pulse * 0.014
        resized = source.resize((round(source.width * scale_x), round(source.height * scale_y)), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", source.size)
        frame.alpha_composite(resized, ((source.width - resized.width) // 2, (source.height - resized.height) // 2))
        flash = max(math.exp(-((progress - boundary / (len(keyframes) - 1)) / 0.045) ** 2) for boundary in range(1, len(keyframes)))
        glow_strength = 0.2 * math.sin(progress * math.pi) + 0.8 * flash
        if flash > 0.15:
            white = Image.new("RGBA", frame.size, (246, 241, 255, 255))
            white.putalpha(frame.getchannel("A"))
            frame = Image.blend(frame, white, flash * 0.2)
        if glow_strength > 0.01:
            alpha = frame.getchannel("A")
            glow_mask = alpha.filter(ImageFilter.GaussianBlur(16))
            glow_mask = glow_mask.point(lambda value: round(value * glow_strength * 0.38))
            glow = Image.new("RGBA", frame.size, (177, 133, 255, 0))
            glow.putalpha(glow_mask)
            frame = Image.alpha_composite(glow, frame)
            overlay = Image.new("RGBA", frame.size)
            draw = ImageDraw.Draw(overlay)
            for x, y, radius, phase in stars:
                pulse = max(0, math.sin(phase + progress * math.tau * 2))
                sparkle(draw, x, y, radius * (0.65 + pulse * 0.35), round(210 * glow_strength * pulse))
            frame = Image.alpha_composite(frame, overlay)
        frames.append(frame)
        frame.save(TRANSITION / f"ab-{index:02d}.png", optimize=True)

    frames[0].save(TRANSITION / "ab-transition.webp", save_all=True, append_images=frames[1:],
                   duration=33, loop=0, quality=82, method=0)

    thumb_size = 160
    sheet = Image.new("RGBA", (thumb_size * 6, (thumb_size + 24) * 5), (35, 29, 48, 255))
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        thumb = frame.resize((thumb_size, thumb_size), Image.Resampling.LANCZOS)
        x = (index % 6) * thumb_size
        y = (index // 6) * (thumb_size + 24)
        sheet.alpha_composite(thumb, (x, y))
        draw.text((x + 8, y + thumb_size + 4), f"{index + 1:02d} / 30", fill=(222, 210, 240, 255))
    sheet.convert("RGB").save(TRANSITION / "contact-sheet.jpg", quality=92)


def build_tray_icon(chibi):
    size = 256
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gradient = Image.new("RGBA", (size, size))
    grad_draw = ImageDraw.Draw(gradient)
    for y in range(size):
        mix = y / (size - 1)
        color = (
            round(58 + (126 - 58) * mix),
            round(45 + (94 - 45) * mix),
            round(76 + (154 - 76) * mix),
            255
        )
        grad_draw.line((0, y, size, y), fill=color)
    circle_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle_mask).ellipse((7, 7, size - 7, size - 7), fill=255)
    icon.alpha_composite(Image.composite(gradient, Image.new("RGBA", (size, size)), circle_mask))
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((7, 7, size - 7, size - 7), outline=(226, 207, 245, 235), width=7)
    icon = Image.alpha_composite(icon, ring)

    head = trim(region(chibi, 0, 3), 0).crop((70, 10, 445, 385))
    head = head.resize((204, 204), Image.Resampling.LANCZOS)
    head_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(head_mask).ellipse((24, 24, size - 24, size - 24), fill=255)
    head_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    head_layer.alpha_composite(head, (26, 30))
    inner_mask = Image.composite(head_layer.getchannel("A"), Image.new("L", (size, size), 0), head_mask)
    head_layer.putalpha(inner_mask)
    icon = Image.alpha_composite(icon, head_layer)
    icon.save(AUDIO.parent / "tray-icon.png", optimize=True)
    icon.save(AUDIO.parent / "tray-icon.ico", format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def build_squeak():
    sample_rate = 44100
    duration = 0.24
    samples = bytearray()
    phase = 0.0
    rng = random.Random(7)
    for index in range(round(sample_rate * duration)):
        t = index / sample_rate
        p = t / duration
        frequency = 560 + 690 * math.sin(math.pi * min(1, p * 1.25)) - 170 * p
        phase += math.tau * frequency / sample_rate
        envelope = math.sin(math.pi * p) ** 0.65
        attack = min(1.0, t / 0.008)
        value = (math.sin(phase) * 0.72 + math.sin(phase * 2.03) * 0.2 + rng.uniform(-1, 1) * 0.025)
        sample = round(max(-1, min(1, value * envelope * attack * 0.72)) * 32767)
        samples.extend(struct.pack("<h", sample))
    with wave.open(str(AUDIO / "squeak.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(samples)


def main():
    SPRITES.mkdir(parents=True, exist_ok=True)
    TRANSITION.mkdir(parents=True, exist_ok=True)
    AUDIO.mkdir(parents=True, exist_ok=True)

    adult = Image.open(GENERATED / "a-matting.png").convert("RGBA")
    chibi = Image.open(GENERATED / "b-matting.png").convert("RGBA")
    noodle = Image.open(GENERATED / "c-matting.png").convert("RGBA")
    transition = Image.open(GENERATED / "transition-vertical-matting.png").convert("RGBA")

    names_a = ["a-office", "a-reading", "a-wine"]
    names_b = ["b-wings", "b-scratch", "b-sleep"]
    for index, name in enumerate(names_a):
        trim(region(adult, index, 3)).save(SPRITES / f"{name}.png", optimize=True)
    for index, name in enumerate(names_b):
        trim(region(chibi, index, 3)).save(SPRITES / f"{name}.png", optimize=True)
    trim(noodle).save(SPRITES / "c-noodle.png", optimize=True)

    row_bounds = [0, 606, 1050, transition.height]
    keyframes = [normalize(transition.crop((0, row_bounds[index], transition.width, row_bounds[index + 1]))) for index in range(3)]
    build_transition(keyframes)
    build_squeak()
    print("Built 7 state sprites, 30 transition frames, animated WebP, contact sheet and squeak.wav")


if __name__ == "__main__":
    main()
