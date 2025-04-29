from setuptools import setup

APP = ['qr_tk.py']
DATA_FILES = []  # Add any additional resource files here (e.g., your .icns icon)
OPTIONS = {
    'argv_emulation': True,
    'iconfile': 'qrmagic.icns',  # replace with your .icns file name
    'plist': {
        'CFBundleName': 'QR Magic',
        'CFBundleShortVersionString': '1.0',
        'CFBundleIdentifier': 'com.yourcompany.qrmagic',
    },
}

setup(
    app=APP,
    name='QR Magic',
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
