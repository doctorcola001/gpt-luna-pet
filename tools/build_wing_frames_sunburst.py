"""Prepare the Sunburst eight-frame wing sheet as candidate animation frames."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "assets" / "generated" / "wings-sunburst" / "wing-sheet.png"
OUT = ROOT / "assets" / "candidates" / "wings-sunburst"
FRAMES = OUT / "frames"


def remove_white(image):
    pixels = np.array(image.convert("RGB"))
    low = pixels.min(axis=2)
    spread = pixels.max(axis=2) - pixels.min(axis=2)
    candidate = (low >= 243) & (spread <= 14)
    barrier = Image.fromarray(((~candidate) * 255).astype("uint8"), "L").filter(ImageFilter.MaxFilter(7))
    reachable = candidate & ~(np.array(barrier) > 0)
    labels, _ = ndimage.label(reachable, structure=np.ones((3, 3), dtype=np.uint8))
    border = np.unique(np.concatenate((labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1])))
    border = border[border != 0]
    background = np.isin(labels, border)
    mask = Image.fromarray((background * 255).astype("uint8"), "L")
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.55))
    alpha = Image.eval(mask, lambda value: 255 - value)
    filled = ndimage.binary_fill_holes(np.array(alpha) > 24)
    alpha = Image.fromarray((filled * 255).astype("uint8"), "L").filter(ImageFilter.GaussianBlur(0.35))
    result = image.convert("RGBA")
    result.putalpha(alpha)
    return result


def remove_specks(image):
    alpha = np.array(image.getchannel("A"))
    labels, count = ndimage.label(alpha > 20, structure=np.ones((3, 3), dtype=np.uint8))
    if not count:
        return image
    sizes = np.bincount(labels.ravel())
    keep = np.isin(labels, np.where(sizes >= 160)[0])
    image.putalpha(Image.fromarray(np.where(keep, alpha, 0).astype("uint8"), "L"))
    return image


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    sheet = remove_white(Image.open(SHEET))
    x_cuts = [
        [0, 380, 763, 1152, 1536],
        [0, 376, 758, 1152, 1536],
    ]
    y_cuts = [0, 512, 1024]
    cells = []
    for row in range(2):
        for column in range(4):
            cell = sheet.crop((x_cuts[row][column], y_cuts[row], x_cuts[row][column + 1], y_cuts[row + 1]))
            cell = remove_specks(cell)
            bbox = cell.getchannel("A").getbbox()
            if not bbox:
                raise RuntimeError(f"empty cell {row},{column}")
            cell = cell.crop(bbox)
            alpha = np.array(cell.getchannel("A"))
            rows = np.where((alpha > 20).any(axis=1))[0]
            foot_rows = rows[-max(3, int(len(rows) * 0.06)):]
            xs = np.where((alpha[foot_rows] > 20).any(axis=0))[0]
            foot_center = (xs.min() + xs.max()) / 2 if len(xs) else cell.width / 2
            cells.append({
                "image": cell,
                "footCenter": foot_center,
                "left": max(1, foot_center),
                "right": max(1, cell.width - foot_center),
            })

    max_left = max(cell["left"] for cell in cells)
    max_right = max(cell["right"] for cell in cells)
    max_height = max(cell["image"].height for cell in cells)
    scale = min(185 / max_left, 185 / max_right, 350 / max_height)

    rendered = []
    for index, cell in enumerate(cells, 1):
        image = cell["image"]
        resized = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (400, 400))
        canvas.alpha_composite(resized, (round(200 - cell["footCenter"] * scale), 390 - resized.height))
        canvas.save(FRAMES / f"b-wing-{index:02d}.png", optimize=True)
        rendered.append(canvas)

    contact = Image.new("RGBA", (1600, 850), (35, 29, 48, 255))
    for i, frame in enumerate(rendered):
        contact.alpha_composite(frame, ((i % 4) * 400, (i // 4) * 410 + 10))
    contact.convert("RGB").save(OUT / "contact.jpg", quality=95)

    loop = []
    for frame in rendered:
        for _ in range(3):
            bg = Image.new("RGBA", (400, 400), (35, 29, 48, 255))
            bg.alpha_composite(frame)
            loop.append(bg.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
    loop[0].save(
        OUT / "preview.gif",
        save_all=True,
        append_images=loop[1:],
        duration=42,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"Built 8 candidate frames with shared scale {scale:.4f}; max height {max_height}; sides {max_left:.0f}/{max_right:.0f}")


if __name__ == "__main__":
    main()
