# QR Magic

A cross-platform batch QR code generator with a simple GUI, built in Python/Tkinter.

> Next-edition work is underway on `codex/convert_2_web_00`.
> The original Python/Tkinter app remains the working reference implementation, while the new `web/` app is a local-first browser prototype for a more flexible visual designer.

**Features**

* Import data from a text/CSV file (optional)
* Auto-numbering or data-based filenames
* Customizable prefix, suffix, and zero-padding
* Live QR preview with adjustable font size, margins, and format (JPG, PNG, PDF)
* Export individual QR images with embedded labels
* Stop/cancel processing mid-batch

---

## Getting Started

### Web Prototype

The next-edition web app lives in `web/`.

```bash
cd web
pnpm install
pnpm dev
```

Common checks:

```bash
pnpm build
```

### GitHub Pages Demo

The `web/` app is configured for GitHub Pages at:

```text
https://ratfinkca.github.io/qrmagic/
```

Publishing happens through `.github/workflows/deploy-pages.yml` on every push to `main`, or manually from the workflow's **Run workflow** button.

Before the first deploy, open the repository on GitHub, go to **Settings > Pages**, and set **Build and deployment > Source** to **GitHub Actions**.

Current prototype capabilities include:

* Visual canvas editor with select, pan, zoom, lasso, and multi-select.
* DPI-aware document setup with page color, transparency, trim, bleed, and safe-area guides.
* Layer management for shape/color, image, QR, and text layers.
* Shape layers for rectangles, circles/ovals, pills, polygon presets, and custom polygon/star shapes.
* Layer visibility, deletion, drag ordering, opacity, shadows, solid fills, gradients, and sizing controls.
* Multiple serial or fixed data groups, with fixed-only jobs able to repeat one value across a set quantity.
* Styled QR codes with dot/corner styles, quiet-zone control, error correction, and embedded logos.
* Alignment tools for single layers, selected groups, and document guide targets.
* Document shape controls shared by trim, bleed, and safe-area guide rendering.
* Save/open `.qrmagic.json` project files.
* Flattened PNG export for a single record and zipped PNG batch export.

Known prototype limits:

* Layered/vector/design-tool exports are planned but not implemented.
* CSV import and manifest export are still planned.
* The production build currently emits a large-bundle warning because canvas, QR, ZIP, and export libraries are all loaded in the main client bundle.

See [docs/next-edition-plan.md](docs/next-edition-plan.md), [docs/project-model.md](docs/project-model.md), and [docs/engineering-guardrails.md](docs/engineering-guardrails.md) for the current rewrite direction.

### Prerequisites

* Python 3.8+ (tested on Windows, macOS, Ubuntu)
* Git (for cloning the repo)

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
pip install -r requirements.txt
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

```bash
pip install py2app
python setup.py py2app
```

The bundle appears in `dist/QR Magic.app`.

> **Note:** macOS packaging requires a Mac environment.

### Linux (AppImage)

```bash
pyinstaller --onefile --windowed --icon "qrmagic-64.ico" --name "qr-magic" qr_tk.py
# then use appimagetool to create an AppImage from the AppDir
```

---

## Contributing

Pull requests and issues are welcome! Please fork the repository and submit a PR with your enhancements.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Roadmap

This is a high-level roadmap of upcoming enhancements and features for QR Magic:

#### 1. Responsive UI (In Progress)

* **Two-pane layout** for wide screens: configuration panel on the left, live QR preview (and log) on the right.
* **Scrollable fallback** for narrow or small viewports (<900×1300), with vertical (and conditional horizontal) scroll bars.
* **Dynamic resizing**: controls expand horizontally; preview pane scales QR image to fill available space.

#### 2. High-DPI Support (Planned)

* Enable Windows DPI awareness so UI elements and fonts render crisply at 150%+, 200% scaling.
* Test and tune font sizes, padding, and canvas geometry across common DPI settings.

#### 3. Fullscreen/Minimal Mode (Backlog)

* Toggle F11 to hide panels and show only the QR preview with a floating toolbar.
* Restore to normal view to access settings and log.

#### 4. Packaging and Distribution

* **Windows:** finalize EXE with PyInstaller, test on clean Windows 10/11 VMs.
* **macOS:** complete `.app` bundle creation on macOS system, code-sign and notarize.
* **Linux:** build AppImage for Ubuntu, add desktop integration files (`.desktop`, icons).

#### 5. Advanced Features (Future)

* **Batch QR templates:** allow overlaying logos or custom backgrounds behind the QR.
* **CSV export:** automatically generate a spreadsheet listing filenames, input data, and any errors.
* **Localization:** support multiple UI languages via resource files.

Feel free to pick an item and submit a pull request! Contributions are welcome.
