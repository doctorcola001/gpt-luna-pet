"""Build eight wing drawings from the generated 4x2 contact sheet."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "assets" / "generated" / "wings-v2" / "Use_BOTH_supplied_chibi_charac_2026-11-16T09-37-02.png"
OUT = ROOT / "assets" / "sprites" / "wings"


def remove_white(image):
    pixels = np.array(image.convert("RGB"))
    low = pixels.min(axis=2)
    spread = pixels.max(axis=2) - pixels.min(axis=2)
    candidate = (low >= 236) & (spread <= 18)
    barrier = Image.fromarray(((~candidate) * 255).astype("uint8"), "L")
    barrier = barrier.filter(ImageFilter.MaxFilter(9))
    barrier_array = np.array(barrier) > 0
    reachable = candidate & ~barrier_array
    labels, _ = ndimage.label(reachable, structure=np.ones((3, 3), dtype=np.uint8))
    border = np.unique(np.concatenate((labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1])))
    border = border[border != 0]
    background = np.isin(labels, border)
    mask = Image.fromarray((background * 255).astype("uint8"), "L")
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(0.7))
    alpha = Image.eval(mask, lambda value: 255 - value)
    filled = ndimage.binary_fill_holes(np.array(alpha) > 24)
    alpha = Image.fromarray((filled * 255).astype("uint8"), "L").filter(ImageFilter.GaussianBlur(0.45))
    result = image.convert("RGBA")
    result.putalpha(alpha)
    return result


def trim(image):
    alpha = np.array(image.getchannel("A"))
    labels, count = ndimage.label(alpha > 20, structure=np.ones((3, 3), dtype=np.uint8))
    if count:
        sizes = np.bincount(labels.ravel())
        keep = np.isin(labels, np.where(sizes >= 500)[0])
        alpha = np.where(keep, alpha, 0).astype("uint8")
        image.putalpha(Image.fromarray(alpha, "L"))
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def normalize(image):
    image = trim(image)
    scale = min(360 / image.width, 350 / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (400, 400))
    result.alpha_composite(resized, ((400 - resized.width) // 2, 390 - resized.height))
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = remove_white(Image.open(SHEET))
    x_cuts = [0, 390, 775, 1147, 1536]
    y_cuts = [0, 512, 1024]
    index = 0
    frames = []
    for row in range(2):
        for column in range(4):
            cell = sheet.crop((x_cuts[column], y_cuts[row], x_cuts[column + 1], y_cuts[row + 1]))
            frame = normalize(cell)
            index += 1
            frame.save(OUT / f"b-wing-{index:02d}.png", optimize=True)
            frames.append(frame)

    contact = Image.new("RGBA", (1600, 850), (35, 29, 48, 255))
    for i, frame in enumerate(frames):
        contact.alpha_composite(frame, ((i % 4) * 400, (i // 4) * 410 + 10))
    contact.convert("RGB").save(ROOT / "assets" / "generated" / "wings-v2" / "wings-contact.jpg", quality=94)
    print("Built 8 wing drawings ->", OUT)


if __name__ == "__main__":
    main()
