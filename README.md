# QR Magic

A cross-platform batch QR code generator with a simple GUI, built in Python/Tkinter.

**Features**

- Import data from a text/CSV file (optional)
- Auto-numbering or data-based filenames
- Customizable prefix, suffix, and zero-padding
- Live QR preview with adjustable font size, margins, and format (JPG, PNG, PDF)
- Export individual QR images with embedded labels
- Stop/cancel processing mid-batch

---

## Getting Started

### Prerequisites

- Python 3.8+ (tested on Windows, macOS, Ubuntu)
- Git (for cloning the repo)

### Installation

```bash
# Clone this repository
git clone https://github.com/yourusername/qr-magic.git
cd qr-magic

# Create & activate a virtual environment
python -m venv qr_env
# Windows:
qr_env\Scripts\activate
# macOS/Linux:
# source qr_env/bin/activate

# Install dependencies
pip install --upgrade pip setuptools wheel
pip install qrcode[pil] pillow
```  

### Running

```bash
# With GUI
python qr_tk.py

# Command-line batch mode (no GUI)
python qr_batch.py <input.txt> <output_folder> --format JPG
```

---

## Packaging

### Windows (.exe)

```powershell
pyinstaller --onefile --windowed --icon "qrmagic-64.ico" --name "QR Magic" qr_tk.py
```

The executable appears in `dist/QR Magic.exe`.

### macOS (.app)

On macOS, install `py2app` and build:

```bash
pip install py2app
python setup.py py2app
```

The bundle appears in `dist/QR Magic.app`.

> **Note:** macOS packaging requires a Mac environment.

### Linux (AppImage)

1. Build a one-file binary with PyInstaller:
   ```bash
   pyinstaller --onefile --windowed --icon "qrmagic-64.ico" --name "qr-magic" qr_tk.py
   ```
2. Create an AppDir and use `appimagetool` to package it into an AppImage.

---

## Contributing

Pull requests and issues are welcome! Please fork the repository and submit a PR with your enhancements.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

