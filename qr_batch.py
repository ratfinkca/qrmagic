import os
import qrcode
from PIL import Image, ImageDraw, ImageFont

def read_input_file(path):
    """
    Reads a text file, auto-detecting BOMs for UTF-8 with BOM or UTF-16.
    Falls back to Latin-1 if those fail.
    Returns a list of lines without newline chars.
    """
    import codecs

    # Try UTF-8 (with BOM)
    try:
        with codecs.open(path, encoding='utf-8-sig') as f:
            return f.read().splitlines()
    except UnicodeError:
        pass

    # Try UTF-16 (LE or BE)
    try:
        with codecs.open(path, encoding='utf-16') as f:
            return f.read().splitlines()
    except UnicodeError:
        pass

    # Fallback
    with open(path, encoding='latin-1') as f:
        return [line.rstrip('\r\n') for line in f]

def make_qr_with_label(data, out_path, fmt='JPEG', size=300, font_path=None):
    # Generate the QR
    qr = qrcode.QRCode(border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img_qr = img_qr.resize((size, size))

    # Prepare canvas with space for text
    font = ImageFont.load_default() if not font_path else ImageFont.truetype(font_path, 14)
    mask = font.getmask(data)
    text_w, text_h = mask.size
    canvas = Image.new("RGB", (size, size + text_h + 10), "white")
    canvas.paste(img_qr, (0, 0))

    # Draw the label
    draw = ImageDraw.Draw(canvas)
    x = (size - text_w) // 2
    y = size + 5
    draw.text((x, y), data, font=font, fill="black")

    # Save
    canvas.save(out_path, fmt)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Batch-generate QR codes with labels")
    parser.add_argument("input_file", help="TXT or CSV (one value per line)")
    parser.add_argument("output_dir", help="Where to write images")
    parser.add_argument("--format", choices=["JPEG","PNG","PDF"], default="JPEG")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    lines = read_input_file(args.input_file)

    for i, data in enumerate(lines):
        data = data.strip()
        if not data:
            continue
        filename = f"qr_{i}.{args.format.lower()}"
        out_path = os.path.join(args.output_dir, filename)
        make_qr_with_label(data, out_path, fmt=args.format)
        print(f"Generated {filename}")
