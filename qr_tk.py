import os
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageTk
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
from tkinter import StringVar, IntVar
from tkinter import ttk
import threading
import re

# --- Tooltip helper class ---
class ToolTip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tipwindow = None
        widget.bind("<Enter>", self.show)
        widget.bind("<Leave>", self.hide)

    def show(self, event=None):
        if self.tipwindow or not self.text:
            return
        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 1
        tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = tk.Label(tw, text=self.text, background="#ffffe0", relief="solid", borderwidth=1,
                         font=("tahoma", "8", "normal"))
        label.pack(ipadx=1)
        self.tipwindow = tw

    def hide(self, event=None):
        tw = self.tipwindow
        self.tipwindow = None
        if tw:
            tw.destroy()

# --- Utility functions ---
def read_input_file(path):
    import codecs
    try:
        with codecs.open(path, encoding='utf-8-sig') as f:
            return f.read().splitlines()
    except Exception:
        pass
    try:
        with codecs.open(path, encoding='utf-16') as f:
            return f.read().splitlines()
    except Exception:
        pass
    with open(path, encoding='latin-1') as f:
        return [line.rstrip('\r\n') for line in f]


def create_qr_image(data,
                    size=300,
                    qr_margin=10,
                    font_size=14,
                    font_path=None,
                    text_margin_bottom=10):
    qr = qrcode.QRCode(border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img_qr = img_qr.resize((size, size))
    try:
        font_file = font_path or "arial.ttf"
        font = ImageFont.truetype(font_file, font_size)
    except Exception:
        font = ImageFont.load_default()
    mask = font.getmask(data)
    text_w, text_h = mask.size
    canvas_w = size + qr_margin * 2
    canvas_h = size + qr_margin * 2 + text_h + text_margin_bottom
    canvas = Image.new("RGB", (canvas_w, canvas_h), "white")
    canvas.paste(img_qr, (qr_margin, qr_margin))
    draw = ImageDraw.Draw(canvas)
    text_x = (canvas_w - text_w) // 2
    text_y = qr_margin * 2 + size
    draw.text((text_x, text_y), data, font=font, fill="black")
    return canvas


def make_qr_with_label(data, out_path, fmt='JPG', size=300,
                       qr_margin=10, font_size=14, font_path=None,
                       text_margin_bottom=10):
    img = create_qr_image(data, size, qr_margin,
                           font_size, font_path,
                           text_margin_bottom)
    save_fmt = 'JPEG' if fmt.upper() in ('JPG', 'JPEG') else fmt.upper()
    ext = 'jpg' if fmt.upper() in ('JPG', 'JPEG') else fmt.lower()
    out_path = os.path.splitext(out_path)[0] + f'.{ext}'
    img.save(out_path, save_fmt)


class QRApp:
    def __init__(self, root):
        self.root = root
        root.title("QR Batch Generator")
        root.columnconfigure(0, weight=1)

        # --- Source frame ---
        src = ttk.LabelFrame(root, text="Source")
        src.grid(row=0, column=0, padx=10, pady=5, sticky="ew")
        src.columnconfigure(1, weight=1)
        ttk.Label(src, text="Data file (optional):").grid(row=0, column=0, sticky="e", padx=5, pady=2)
        self.inp = ttk.Entry(src)
        self.inp.grid(row=0, column=1, sticky="ew", padx=5, pady=2)
        ToolTip(self.inp, "Optional: leave blank to use Quantity")
        self.inp.bind('<KeyRelease>', self.on_datafile_change)
        ttk.Button(src, text="Browse…", command=self.browse_file).grid(row=0, column=2, padx=5)

        self.skip_header = tk.BooleanVar()
        ttk.Checkbutton(src, text="Skip header row", variable=self.skip_header,
                        command=self.on_datafile_change).grid(row=1, column=1, sticky="w", pady=2)

        ttk.Label(src, text="Output folder (required):").grid(row=2, column=0, sticky="e", padx=5, pady=2)
        self.outd = ttk.Entry(src)
        self.outd.grid(row=2, column=1, sticky="ew", padx=5, pady=2)
        ToolTip(self.outd, "Required: folder where QR images will be saved")
        ttk.Button(src, text="Browse…", command=self.browse_folder).grid(row=2, column=2, padx=5)

        # --- Naming frame ---
        naming = ttk.LabelFrame(root, text="Naming")
        naming.grid(row=1, column=0, padx=10, pady=5, sticky="ew")
        naming.columnconfigure(1, weight=1)
        ttk.Label(naming, text="File name prefix:").grid(row=0, column=0, sticky="e", padx=5, pady=2)
        self.prefix = ttk.Entry(naming)
        self.prefix.grid(row=0, column=1, columnspan=2, sticky="ew", padx=5, pady=2)
        self.prefix.bind('<KeyRelease>', lambda e: self.update_preview())

        ttk.Label(naming, text="File name suffix:").grid(row=1, column=0, sticky="e", padx=5, pady=2)
        self.suffix = ttk.Entry(naming)
        self.suffix.grid(row=1, column=1, columnspan=2, sticky="ew", padx=5, pady=2)
        self.suffix.bind('<KeyRelease>', lambda e: self.update_preview())

        ttk.Label(naming, text="Quantity:").grid(row=2, column=0, sticky="e", padx=5, pady=2)
        self.quantity = ttk.Spinbox(naming, from_=1, to=1000000, width=7)
        self.quantity.set(1)
        self.quantity.grid(row=2, column=1, sticky="w", padx=5, pady=2)
        self.quantity.bind('<KeyRelease>', lambda e: self.update_preview())

        self.pad_zeros = tk.BooleanVar()
        self.pad_zeros_cb = ttk.Checkbutton(naming, text="Pad with leading zeros", variable=self.pad_zeros,
                                           command=self.update_preview)
        self.pad_zeros_cb.grid(row=3, column=1, sticky="w", padx=5, pady=2)

        self.use_data = tk.BooleanVar()
        ttk.Checkbutton(naming, text="Use data as filename", variable=self.use_data,
                        command=self.toggle_use_data).grid(row=4, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(naming, text="Format:").grid(row=5, column=0, sticky="e", padx=5, pady=2)
        self.fmt = StringVar(value="JPG")
        fmt_menu = ttk.Combobox(naming, textvariable=self.fmt, state="readonly",
                                values=["JPG", "PNG", "PDF"], width=8)
        fmt_menu.grid(row=5, column=1, sticky="w", padx=5, pady=2)
        fmt_menu.bind('<<ComboboxSelected>>', lambda e: self.update_preview())

        ttk.Label(naming, text="Filename preview:").grid(row=6, column=0, sticky="e", padx=5, pady=2)
        self.filename_preview = ttk.Entry(naming, state='readonly')
        self.filename_preview.grid(row=6, column=1, columnspan=2, sticky="ew", padx=5, pady=2)

        # --- Styling frame ---
        stylef = ttk.LabelFrame(root, text="Styling")
        stylef.grid(row=2, column=0, padx=10, pady=5, sticky="ew")
        stylef.columnconfigure(1, weight=1)
        ttk.Label(stylef, text="Font size (px):").grid(row=0, column=0, sticky="e", padx=5, pady=2)
        self.font_size = IntVar(value=14)
        sb_font = ttk.Spinbox(stylef, from_=1, to=100, textvariable=self.font_size, width=7,
                               command=self.update_preview)
        sb_font.grid(row=0, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(stylef, text="QR margin (px):").grid(row=1, column=0, sticky="e", padx=5, pady=2)
        self.qr_margin = IntVar(value=10)
        sb_qr = ttk.Spinbox(stylef, from_=0, to=100, textvariable=self.qr_margin, width=7,
                             command=self.update_preview)
        sb_qr.grid(row=1, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(stylef, text="Text bottom margin (px):").grid(row=2, column=0, sticky="e", padx=5, pady=2)
        self.text_margin = IntVar(value=10)
        sb_txt = ttk.Spinbox(stylef, from_=0, to=100, textvariable=self.text_margin, width=7,
                              command=self.update_preview)
        sb_txt.grid(row=2, column=1, sticky="w", padx=5, pady=2)

        # --- Preview frame ---
        prevf = ttk.LabelFrame(root, text="Preview")
        prevf.grid(row=3, column=0, padx=10, pady=5, sticky="ew")
        self.preview_canvas = ttk.Label(prevf, relief='sunken')
        self.preview_canvas.grid(padx=5, pady=5)

        # --- Action buttons ---
        actf = ttk.Frame(root)
        actf.grid(row=4, column=0, pady=(5,0))
        self.gen_btn = ttk.Button(actf, text="Generate", command=self.start_generate)
        self.gen_btn.pack(side="left", padx=5)
        self.cancel_btn = ttk.Button(actf, text="Stop", command=self.cancel_generate, state='disabled')
        self.cancel_btn.pack(side="left", padx=5)
        ttk.Button(actf, text="Exit", command=root.quit).pack(side="left", padx=5)

        # --- Log frame ---
        logf = ttk.LabelFrame(root, text="Log")
        logf.grid(row=5, column=0, padx=10, pady=5, sticky="ew")
        self.log = scrolledtext.ScrolledText(logf, width=70, height=10, state="disabled")
        self.log.grid(padx=5, pady=5)

        # Thread control
        self.cancel_flag = False

        # Finalize
        self.on_datafile_change()

    def on_datafile_change(self, event=None):
        path = self.inp.get().strip()
        if os.path.isfile(path):
            self.quantity.config(state='normal')
            lines = read_input_file(path)
            start = 1 if self.skip_header.get() else 0
            count = len(lines) - start
            self.quantity.set(count)
            self.quantity.config(state='disabled')
        else:
            self.quantity.config(state='normal')
        self.update_preview()

    def toggle_use_data(self):
        if self.use_data.get():
            self.pad_zeros.set(False)
        self.update_preview()

    def browse_file(self):
        path = filedialog.askopenfilename(filetypes=[("Text/CSV","*.txt;*.csv")])
        if path:
            self.inp.delete(0, tk.END)
            self.inp.insert(0, path)
            self.on_datafile_change()

    def browse_folder(self):
        path = filedialog.askdirectory()
        if path:
            self.outd.delete(0, tk.END)
            self.outd.insert(0, path)

    def start_generate(self):
        self.gen_btn.config(state='disabled')
        self.cancel_btn.config(state='normal')
        self.cancel_flag = False
        threading.Thread(target=self._generate_worker, daemon=True).start()

    def cancel_generate(self):
        self.cancel_flag = True

    def _generate_worker(self):
        infile = self.inp.get().strip()
        outdir = self.outd.get().strip()
        fmt = self.fmt.get().upper()
        skip = self.skip_header.get()
        use_data = self.use_data.get()
        pad = self.pad_zeros.get()
        fs = self.font_size.get()
        qr_m = self.qr_margin.get()
        txt_m = self.text_margin.get()

        self._log_clear()
        if not os.path.isdir(outdir):
            self.root.after(0, lambda: messagebox.showerror("Error","Output folder not found."))
        else:
            if os.path.isfile(infile):
                lines = read_input_file(infile)
                data_lines = lines[1:] if skip else lines
            else:
                qty = int(self.quantity.get()) if self.quantity.get().isdigit() else 1
                data_lines = [None] * qty

            total = len(data_lines)
            width = len(str(total)) if pad else 0
            for i, item in enumerate(data_lines, start=1):
                if self.cancel_flag:
                    break
                if item is not None and use_data:
                    val = item.strip()
                    base = re.sub(r'[\\/:*?"<>|]', '_', val)
                else:
                    idx_str = str(i).zfill(width) if pad else str(i)
                    base = f"{self.prefix.get()}{idx_str}{self.suffix.get()}"
                    val = base

                filename = f"{base}.{('jpg' if fmt=='JPG' else fmt.lower())}"
                out_path = os.path.join(outdir, filename)
                try:
                    make_qr_with_label(val, out_path, fmt=fmt, size=300,
                                       qr_margin=qr_m, font_size=fs,
                                       text_margin_bottom=txt_m)
                    self.root.after(0, lambda f=filename: self.log_print(f"✓ {f}"))
                except Exception as e:
                    self.root.after(0, lambda e=e, i=i: self.log_print(f"✗ {i}: {e}"))
            if not self.cancel_flag:
                self.root.after(0, lambda: self.log_print("Done!"))
        self.root.after(0, lambda: (self.gen_btn.config(state='normal'),
                                     self.cancel_btn.config(state='disabled')))

    def update_preview(self):
        infile = self.inp.get().strip()
        # determine QR data to display
        if os.path.isfile(infile):
            lines = read_input_file(infile)
            start = 1 if self.skip_header.get() else 0
            data_lines = lines[start:]
            qr_data = data_lines[0].strip() if data_lines else ""
        else:
            total = int(self.quantity.get()) if self.quantity.get().isdigit() else 1
            idx_str = str(1).zfill(len(str(total))) if self.pad_zeros.get() else "1"
            qr_data = f"{self.prefix.get()}{idx_str}{self.suffix.get()}"

        # compute filename preview
        fmt = self.fmt.get().upper()
        if os.path.isfile(infile) and self.use_data.get():
            base = re.sub(r'[\\/:*?"<>|]', '_', qr_data)
        else:
            total = int(self.quantity.get()) if self.quantity.get().isdigit() else 1
            idx_str = str(1).zfill(len(str(total))) if self.pad_zeros.get() else "1"
            base = f"{self.prefix.get()}{idx_str}{self.suffix.get()}"
        ext = 'jpg' if fmt == 'JPG' else fmt.lower()
        preview_fname = f"{base}.{ext}"
        self.filename_preview.config(state='normal')
        self.filename_preview.delete(0, tk.END)
        self.filename_preview.insert(0, preview_fname)
        self.filename_preview.config(state='readonly')

        # update the QR preview image
        fs = self.font_size.get()
        qr_m = self.qr_margin.get()
        txt_m = self.text_margin.get()
        img = create_qr_image(qr_data or " ", size=300,
                              qr_margin=qr_m, font_size=fs,
                              text_margin_bottom=txt_m)
        tkimg = ImageTk.PhotoImage(img)
        self.preview_canvas.config(image=tkimg)
        self.preview_canvas.image = tkimg

    def _log_clear(self):
        self.log.config(state="normal")
        self.log.delete("1.0", tk.END)
        self.log.config(state="disabled")

    def log_print(self, msg):
        self.log.config(state="normal")
        self.log.insert(tk.END, msg + "\n")
        self.log.see(tk.END)
        self.log.config(state="disabled")

if __name__ == "__main__":
    root = tk.Tk()
    app = QRApp(root)
    root.mainloop()
