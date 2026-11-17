"""Active runtime asset builder for the B/C desktop pet.

Run with the image environment at D:/FORDS/hermestools/wb40-luna-venv.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source"
V2 = ROOT / "assets" / "generated" / "v2"
SPRITES = ROOT / "assets" / "sprites"
ASSETS = ROOT / "assets"


def remove_connected_white(image):
    if image.mode != "RGB":
        image = image.convert("RGB")
    pixels = np.array(image)
    low = pixels.min(axis=2)
    spread = pixels.max(axis=2) - pixels.min(axis=2)
    candidate = (low >= 236) & (spread <= 18)
    labels, _ = ndimage.label(candidate, structure=np.ones((3, 3), dtype=np.uint8))
    border_labels = np.unique(np.concatenate((labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1])))
    border_labels = border_labels[border_labels != 0]
    background_mask = np.isin(labels, border_labels)
    background = Image.fromarray((background_mask * 255).astype("uint8"), "L")
    background = background.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(0.7))
    alpha = Image.eval(background, lambda value: 255 - value)
    if "A" in image.getbands():
        original_alpha = image.getchannel("A")
        alpha = Image.composite(alpha, Image.new("L", image.size, 0), original_alpha)
    result = image.convert("RGBA")
    result.putalpha(alpha)
    return result


def trim(image, padding=8):
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("No visible pixels")
    image = image.crop(bbox)
    result = Image.new("RGBA", (image.width + padding * 2, image.height + padding * 2))
    result.alpha_composite(image, (padding, padding))
    return result


def normalize(image, size=(400, 400), max_size=(360, 350), bottom=390):
    image = trim(image, 0)
    ratio = min(max_size[0] / image.width, max_size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size)
    result.alpha_composite(resized, ((size[0] - resized.width) // 2, bottom - resized.height))
    return result


def active_runs(image, minimum=20):
    alpha = np.array(image.getchannel("A"))
    active = (alpha > 8).sum(axis=1) > 2
    runs = []
    start = 0
    value = bool(active[0]) if len(active) else False
    for index in range(1, len(active) + 1):
        current = bool(active[index]) if index < len(active) else not value
        if current != value:
            if value and index - start >= minimum:
                runs.append((start, index))
            start = index
            value = current
    return runs


def build_icon(bighead):
    content = trim(bighead, 0)
    size = 256
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gradient = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(gradient)
    for y in range(size):
        mix = y / (size - 1)
        draw.line((0, y, size, y), fill=(round(64 + 53 * mix), round(48 + 36 * mix), round(84 + 63 * mix), 255))
    circle = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle).ellipse((7, 7, size - 7, size - 7), fill=255)
    icon.alpha_composite(Image.composite(gradient, Image.new("RGBA", (size, size)), circle))
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((7, 7, size - 7, size - 7), outline=(230, 213, 248, 245), width=7)
    icon = Image.alpha_composite(icon, ring)

    width, height = content.size
    crop_width = round(min(width * 0.76, height * 0.82))
    crop_height = round(crop_width * 0.92)
    left = round((width - crop_width) / 2)
    top = round(height * 0.025)
    head = content.crop((left, top, left + crop_width, top + crop_height))
    head = head.resize((214, 214), Image.Resampling.LANCZOS)
    head_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    head_layer.alpha_composite(head, (21, 25))
    clip = Image.new("L", (size, size), 0)
    ImageDraw.Draw(clip).ellipse((21, 21, size - 21, size - 21), fill=255)
    head_layer.putalpha(Image.composite(head_layer.getchannel("A"), Image.new("L", (size, size), 0), clip))
    icon = Image.alpha_composite(icon, head_layer)
    icon.save(ASSETS / "app-icon.png", optimize=True)
    icon.save(ASSETS / "tray-icon.png", optimize=True)
    icon.save(ASSETS / "tray-icon.ico", format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def clean_center_c(image):
    data = np.array(image.convert("RGBA"))
    height, width = data.shape[:2]
    red, green, blue = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    blue_fragment = (np.indices((height, width))[1] >= width - 42) & (blue > red + 42) & (blue > green + 24) & (red < 170)
    data[blue_fragment, 3] = 0
    return Image.fromarray(data, "RGBA")


def main():
    V2.mkdir(parents=True, exist_ok=True)
    SPRITES.mkdir(parents=True, exist_ok=True)

    bighead = remove_connected_white(Image.open(SOURCE / "form-b-bighead.jpg"))
    bighead.save(V2 / "b-bighead-matting.png", optimize=True)
    bighead_sprite = normalize(bighead)
    bighead_sprite.save(SPRITES / "b-idle.png", optimize=True)
    build_icon(bighead)

    action_sheet = remove_connected_white(Image.open(V2 / "Use_BOTH_supplied_character_re_2026-11-16T05-52-03.png"))
    action_sheet.save(V2 / "b-actions-matting.png", optimize=True)
    runs = active_runs(action_sheet)
    if len(runs) != 3:
        raise ValueError(f"Expected three B action rows, found {len(runs)}: {runs}")
    action_names = ["b-wings", "b-scratch", "b-sleep"]
    for name, (top, bottom) in zip(action_names, runs):
        sprite = action_sheet.crop((0, max(0, top - 6), action_sheet.width, min(action_sheet.height, bottom + 6)))
        normalize(sprite).save(SPRITES / f"{name}.png", optimize=True)
        print(name, "row", top, bottom, "sprite", trim(sprite, 0).size)

    center = normalize(clean_center_c(Image.open(ASSETS / "generated" / "c-matting.png")))
    center.save(SPRITES / "c-center.png", optimize=True)

    left_source = remove_connected_white(Image.open(V2 / "Using_the_supplied_cup_noodle__2026-11-16T06-06-51.png"))
    right_source = remove_connected_white(Image.open(V2 / "Using_the_supplied_cup_noodle__2026-11-16T06-07-03.png"))
    left = normalize(left_source)
    right = normalize(right_source)
    left.save(SPRITES / "c-left.png", optimize=True)
    right.save(SPRITES / "c-right.png", optimize=True)

    contact = Image.new("RGBA", (1200, 430), (35, 29, 48, 255))
    for index, image in enumerate([left, center, right]):
        contact.alpha_composite(image, (index * 400, 15))
    contact.convert("RGB").save(V2 / "c-orientation-sheet.jpg", quality=94)
    print("Built B idle + 3 B actions + 3 C orientations and big-head application icons")


if __name__ == "__main__":
    main()
