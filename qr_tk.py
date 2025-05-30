import os
import threading
import re
import sys
import codecs

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
from tkinter import StringVar, IntVar, ttk

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageTk

# --- Enable high-DPI awareness on Windows ---
if sys.platform == 'win32':
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass


def read_input_file(path):
    """
    Read a text or CSV file and return its lines as a list of strings.

    Supports UTF-8 with optional BOM (utf-8-sig), UTF-16, and falls back to latin-1 encoding.
    Strips trailing carriage returns and newlines from each line.
    """
    # Try common encodings
    for enc in ('utf-8-sig', 'utf-16'):
        try:
            with codecs.open(path, encoding=enc) as f:
                return f.read().splitlines()
        except Exception:
            pass
    # Fallback to latin-1
    with open(path, encoding='latin-1') as f:
        return [line.rstrip('\r\n') for line in f]


def create_qr_image(data, size=300, qr_margin=0,
                    font_size=14, font_path=None,
                    text_margin_bottom=10):
    qr = qrcode.QRCode(border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color='black', back_color='white').convert('RGB')
    img_qr = img_qr.resize((size, size), Image.NEAREST)
    try:
        font = ImageFont.truetype(font_path or 'arial.ttf', font_size)
    except Exception:
        font = ImageFont.load_default()
    # measure text size using textbbox
    temp_img = Image.new('RGB', (1, 1))
    temp_draw = ImageDraw.Draw(temp_img)
    bbox = temp_draw.textbbox((0, 0), data, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    # calculate canvas size
    canvas_w = size + qr_margin * 2
    canvas_h = size + qr_margin * 2 + text_h + text_margin_bottom
    canvas = Image.new('RGB', (canvas_w, canvas_h), 'white')
    canvas.paste(img_qr, (qr_margin, qr_margin))
    draw = ImageDraw.Draw(canvas)
    text_x = (canvas_w - text_w) // 2
    text_y = size + qr_margin * 2
    draw.text((text_x, text_y), data, font=font, fill='black')
    return canvas


def make_qr_with_label(data, out_path, fmt='JPG', size=300,
                       qr_margin=0, font_size=14, font_path=None,
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
        root.title('QR Magic')
        root.resizable(True, True)

        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        w, h = min(900, sw), min(1300, sh)
        root.geometry(f'{w}x{h}')

        # Main PanedWindow
        paned = ttk.PanedWindow(root, orient='horizontal')
        paned.pack(fill='both', expand=True)

        # Left (config) pane
        self.left = ttk.Frame(paned)
        paned.add(self.left, weight=1)

        # Right (preview/log) pane
        self.right = ttk.Frame(paned)
        paned.add(self.right, weight=3)

        # Ensure left pane minimum width
        def config_sash(event=None):
            left_min = self.left.winfo_reqwidth()
            paned.sashpos(0, left_min)
        root.after(100, config_sash)
        root.bind('<Configure>', lambda e: root.after(0, config_sash))

        # --- Source Frame ---
        src = ttk.LabelFrame(self.left, text='Source')
        src.grid(row=0, column=0, sticky='ew', padx=5, pady=5)
        src.columnconfigure(1, weight=1)

        ttk.Label(src, text='Data file:').grid(row=0, column=0, sticky='e', padx=5)
        self.inp = ttk.Entry(src)
        self.inp.grid(row=0, column=1, sticky='ew', padx=5)
        self.inp.bind('<KeyRelease>', self.on_datafile_change)
        ttk.Button(src, text='Browse…', command=self.browse_file).grid(row=0, column=2, padx=5)

        self.skip_header = tk.BooleanVar()
        ttk.Checkbutton(src, text='Skip header row', variable=self.skip_header,
                        command=self.on_datafile_change).grid(row=1, column=1, sticky='w', pady=2)

        ttk.Label(src, text='Output folder:').grid(row=2, column=0, sticky='e', padx=5)
        self.outd = ttk.Entry(src)
        self.outd.grid(row=2, column=1, sticky='ew', padx=5)
        ttk.Button(src, text='Browse…', command=self.browse_folder).grid(row=2, column=2, padx=5)

        # Background image option
        ttk.Label(src, text='Background image:').grid(row=3, column=0, sticky='e', padx=5)
        self.bg_path_var = StringVar()
        self.bg_path = ttk.Entry(src, textvariable=self.bg_path_var)
        self.bg_path.grid(row=3, column=1, sticky='ew', padx=5)
        self.bg_path_var.trace_add('write', lambda *_: self.update_preview())
        ttk.Button(src, text='Browse…', command=self.browse_background).grid(row=3, column=2, padx=5)
        # QR offset on background
        ttk.Label(src, text='QR X offset:').grid(row=4, column=0, sticky='e', padx=5)
        self.bg_x = IntVar(value=0)
        ttk.Spinbox(src, from_=0, to=10000, textvariable=self.bg_x, width=7,
                    command=self.update_preview).grid(row=4, column=1, sticky='w', padx=5, pady=2)
        ttk.Label(src, text='QR Y offset:').grid(row=5, column=0, sticky='e', padx=5)
        self.bg_y = IntVar(value=0)
        ttk.Spinbox(src, from_=0, to=10000, textvariable=self.bg_y, width=7,
                    command=self.update_preview).grid(row=5, column=1, sticky='w', padx=5, pady=2)

        # --- Naming Frame ---
        naming = ttk.LabelFrame(self.left, text='Naming')
        naming.grid(row=1, column=0, sticky='ew', padx=5, pady=5)
        naming.columnconfigure(1, weight=1)

        ttk.Label(naming, text='File name prefix:').grid(row=0, column=0, sticky='e', padx=5)
        self.prefix = ttk.Entry(naming)
        self.prefix.grid(row=0, column=1, sticky='ew', padx=5, pady=2)
        self.prefix.bind('<KeyRelease>', lambda e: self.update_preview())

        ttk.Label(naming, text='File name suffix:').grid(row=1, column=0, sticky='e', padx=5)
        self.suffix = ttk.Entry(naming)
        self.suffix.grid(row=1, column=1, sticky='ew', padx=5, pady=2)
        self.suffix.bind('<KeyRelease>', lambda e: self.update_preview())

        ttk.Label(naming, text='Quantity:').grid(row=2, column=0, sticky='e', padx=5)
        self.quantity = ttk.Spinbox(naming, from_=1, to=1000000, width=7)
        self.quantity.grid(row=2, column=1, sticky='w', padx=5)
        self.quantity.bind('<KeyRelease>', lambda e: self.update_preview())

        self.pad_zeros = tk.BooleanVar()
        ttk.Checkbutton(naming, text='Pad with leading zeros', variable=self.pad_zeros,
                        command=self.update_preview).grid(row=3, column=1, sticky='w', padx=5)

        self.use_data = tk.BooleanVar()
        ttk.Checkbutton(naming, text='Use data as filename', variable=self.use_data,
                        command=self.update_preview).grid(row=4, column=1, sticky='w', padx=5)

        ttk.Label(naming, text='Format:').grid(row=5, column=0, sticky='e', padx=5)
        self.fmt = StringVar(value='JPG')
        fmt_menu = ttk.Combobox(naming, textvariable=self.fmt, state='readonly',
                                values=['JPG', 'PNG', 'PDF'], width=8)
        fmt_menu.grid(row=5, column=1, sticky='w', padx=5)
        fmt_menu.bind('<<ComboboxSelected>>', lambda e: self.update_preview())

        ttk.Label(naming, text='Filename preview:').grid(row=6, column=0, sticky='e', padx=5)
        self.filename_preview = ttk.Entry(naming, state='readonly')
        self.filename_preview.grid(row=6, column=1, sticky='ew', padx=5)

        # --- Styling Frame ---
        stylef = ttk.LabelFrame(self.left, text='Styling')
        stylef.grid(row=2, column=0, sticky='ew', padx=5, pady=5)
        stylef.columnconfigure(1, weight=1)

        # QR size in pixels
        ttk.Label(stylef, text='QR size (px):').grid(row=0, column=0, sticky='e', padx=5)
        self.qr_size = IntVar(value=300)
        sb_size = ttk.Spinbox(stylef, from_=100, to=800, textvariable=self.qr_size, width=7,
                               command=self.update_preview)
        sb_size.grid(row=0, column=1, sticky='w', padx=5, pady=2)

        ttk.Label(stylef, text='Font size (px):').grid(row=1, column=0, sticky='e', padx=5)
        self.font_size = IntVar(value=20)
        sb_font = ttk.Spinbox(stylef, from_=4, to=96, textvariable=self.font_size, width=7,
                               command=self.update_preview)
        sb_font.grid(row=1, column=1, sticky='w', padx=5, pady=2)

        ttk.Label(stylef, text='QR margin (px):').grid(row=2, column=0, sticky='e', padx=5)
        self.qr_margin = IntVar(value=0)
        sb_qr = ttk.Spinbox(stylef, from_=-20, to=100, textvariable=self.qr_margin, width=7,
                             command=self.update_preview)
        sb_qr.grid(row=2, column=1, sticky='w', padx=5, pady=2)

        ttk.Label(stylef, text='Text bottom margin (px):').grid(row=3, column=0, sticky='e', padx=5)
        self.text_margin = IntVar(value=20)
        sb_txt = ttk.Spinbox(stylef, from_=0, to=100, textvariable=self.text_margin, width=7,
                              command=self.update_preview)
        sb_txt.grid(row=3, column=1, sticky='w', padx=5, pady=2)

        # --- Actions Frame ---
        actf = ttk.Frame(self.left)
        actf.grid(row=3, column=0, sticky='ew', padx=5, pady=5)
        ttk.Button(actf, text='Generate', command=self.start_generate).pack(side='left', padx=5)
        self.cancel_btn = ttk.Button(actf, text='Stop', command=self.cancel_generate, state='disabled')
        self.cancel_btn.pack(side='left', padx=5)

        # --- Preview Frame ---
        prevf = ttk.LabelFrame(self.right, text='Preview')
        prevf.grid(row=0, column=0, sticky='nsew', padx=5, pady=5)
        self.right.rowconfigure(0, weight=3)
        self.right.rowconfigure(1, weight=1)
        self.right.columnconfigure(0, weight=1)

        self.preview_canvas = ttk.Label(prevf, relief='sunken', anchor='center', justify='center')
        self.preview_canvas.pack(fill='both', expand=True, padx=5, pady=5)

        # --- Log Frame ---
        logf = ttk.LabelFrame(self.right, text='Log')
        logf.grid(row=1, column=0, sticky='nsew', padx=5, pady=5)
        self.log = scrolledtext.ScrolledText(logf, height=8, state='disabled')
        self.log.pack(fill='both', expand=True, padx=5, pady=5)

        self.cancel_flag = False
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

    def browse_file(self):
        path = filedialog.askopenfilename(filetypes=[('Text/CSV','*.txt;*.csv')])
        if path:
            self.inp.delete(0, tk.END)
            self.inp.insert(0, path)
            self.on_datafile_change()

    def browse_folder(self):
        path = filedialog.askdirectory()
        if path:
            self.outd.delete(0, tk.END)
            self.outd.insert(0, path)

    def browse_background(self):
        """
        Open a file dialog to select a background image (PNG, JPG, JPEG) and store its path.
        """
        path = filedialog.askopenfilename(
            filetypes=[('Image Files', '*.png;*.jpg;*.jpeg')]
        )
        if path:
            self.bg_path_var.set(path)

    def start_generate(self):
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
            self.root.after(0, lambda: messagebox.showerror('Error','Output folder not found.'))
            return
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
                base = re.sub(r'[\/:*?"<>|]','_', val)
            else:
                idx_str = str(i).zfill(width) if pad else str(i)
                base = f"{self.prefix.get()}{idx_str}{self.suffix.get()}"
                val = base
            filename = f"{base}.{('jpg' if fmt=='JPG' else fmt.lower())}"
            out_path = os.path.join(outdir, filename)
            try:
                # generate QR canvas
                qr_img = create_qr_image(val, size=300,
                                          qr_margin=qr_m, font_size=fs,
                                          text_margin_bottom=txt_m)
                # composite onto background
                bg_file = self.bg_path_var.get().strip()
                if bg_file and os.path.isfile(bg_file):
                    try:
                        bg = Image.open(bg_file).convert('RGB')
                        bg.paste(qr_img, (self.bg_x.get(), self.bg_y.get()))
                        to_save = bg
                    except Exception:
                        to_save = qr_img
                else:
                    to_save = qr_img
                save_fmt = 'JPEG' if fmt == 'JPG' else fmt.lower()
                to_save.save(out_path, save_fmt)
                self.root.after(0, lambda f=filename: self.log_print(f'✓ {f}'))
            except Exception as e:
                self.root.after(0, lambda i=i,e=e: self.log_print(f'✗ {i}: {e}'))
        if not self.cancel_flag:
            self.root.after(0, lambda: self.log_print('Done!'))
        self.cancel_btn.config(state='disabled')

    def update_preview(self):
        infile = self.inp.get().strip()
        # Determine display text
        if os.path.isfile(infile):
            lines = read_input_file(infile)
            start = 1 if self.skip_header.get() else 0
            data_lines = lines[start:]
            display = data_lines[0].strip() if data_lines else ''
        else:
            total = int(self.quantity.get()) if self.quantity.get().isdigit() else 1
            idx_str = str(1).zfill(len(str(total))) if self.pad_zeros.get() else '1'
            display = f"{self.prefix.get()}{idx_str}{self.suffix.get()}"
        # Update filename preview
        fmt = self.fmt.get().upper()
        if os.path.isfile(infile) and self.use_data.get():
            base = re.sub(r'[\/\:*?"<>|]', '_', display)
        else:
            base = display
        ext = 'jpg' if fmt == 'JPG' else fmt.lower()
        preview_fname = f"{base}.{ext}"
        self.filename_preview.config(state='normal')
        self.filename_preview.delete(0, tk.END)
        self.filename_preview.insert(0, preview_fname)
        self.filename_preview.config(state='readonly')

        # Generate QR image with dynamic size
        qr_img = create_qr_image(
            display or ' ',
            size=self.qr_size.get(),
            qr_margin=self.qr_margin.get(),
            font_size=self.font_size.get(),
            text_margin_bottom=self.text_margin.get()
        )
        # Composite onto background if provided
        bg_file = self.bg_path_var.get().strip()
        if bg_file and os.path.isfile(bg_file):
            try:
                bg = Image.open(bg_file).convert('RGB')
                bg.paste(qr_img, (self.bg_x.get(), self.bg_y.get()))
                final_img = bg
            except Exception:
                final_img = qr_img
        else:
            final_img = qr_img
        # Update Tkinter preview
        tkimg = ImageTk.PhotoImage(final_img)
        self.preview_canvas.config(image=tkimg)
        self.preview_canvas.image = tkimg

    def _log_clear(self):
        self.log.config(state='normal')
        self.log.delete('1.0', tk.END)
        self.log.config(state='disabled')

    def log_print(self, msg):
        self.log.config(state='normal')
        self.log.insert(tk.END, msg + '\n')
        self.log.see(tk.END)
        self.log.config(state='disabled')


if __name__ == '__main__':
    root = tk.Tk()
    app = QRApp(root)
    root.mainloop()
