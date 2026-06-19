# QR Magic Project Model

## Purpose

The project model describes everything needed to reopen, edit, preview, and export a QR Magic job. It should be stable, portable, and readable enough to become the foundation for saved templates and public examples.

This document is a first draft. Implementation can evolve it, but changes should be intentional.

## File Shape

A QR Magic project should eventually be stored as JSON.

Suggested extension:

```text
.qrmagic.json
```

High-level shape:

```json
{
  "version": 1,
  "document": {},
  "assets": [],
  "layers": [],
  "data": {},
  "export": {},
  "metadata": {}
}
```

## Document

The document defines the design surface.

```json
{
  "document": {
    "name": "Festival Parking Decal",
    "unit": "in",
    "width": 4,
    "height": 3,
    "dpi": 300,
    "bleed": {
      "top": 0.125,
      "right": 0.125,
      "bottom": 0.125,
      "left": 0.125
    },
    "safeArea": {
      "top": 0.125,
      "right": 0.125,
      "bottom": 0.125,
      "left": 0.125
    },
    "backgroundColor": "#ffffff"
  }
}
```

Initial supported units should probably be:

- `px`
- `in`
- `mm`

The renderer should normalize document units to pixels internally using DPI.

## Assets

Assets represent imported files such as background artwork or logos.

```json
{
  "assets": [
    {
      "id": "asset_background",
      "type": "image",
      "name": "background.png",
      "source": {
        "kind": "embedded",
        "mimeType": "image/png",
        "data": "base64..."
      }
    }
  ]
}
```

Possible source kinds:

- `embedded`: stored inside the project file or project bundle.
- `relative`: stored next to the project file.
- `runtime`: available only in the current browser session.

For the first prototype, runtime browser assets are acceptable. For saved projects, embedded or relative assets will be needed.

## Layers

Layers are ordered from back to front.

Common fields:

```json
{
  "id": "layer_1",
  "type": "image",
  "name": "Artwork",
  "visible": true,
  "locked": false,
  "x": 0,
  "y": 0,
  "width": 1200,
  "height": 900,
  "rotation": 0,
  "opacity": 1
}
```

Coordinates should be stored in document units or normalized pixels. The implementation should choose one approach and use it consistently. For predictable rendering, normalized pixels may be simpler internally; the UI can display inches or millimeters.

## Image Layer

```json
{
  "id": "layer_background",
  "type": "image",
  "name": "Artwork",
  "assetId": "asset_background",
  "x": 0,
  "y": 0,
  "width": 1200,
  "height": 900,
  "rotation": 0,
  "opacity": 1,
  "fit": "stretch"
}
```

Possible `fit` values:

- `stretch`
- `contain`
- `cover`
- `original`

## QR Layer

```json
{
  "id": "layer_qr",
  "type": "qr",
  "name": "QR Code",
  "x": 800,
  "y": 420,
  "width": 260,
  "height": 260,
  "rotation": 0,
  "opacity": 1,
  "payload": {
    "kind": "field",
    "field": "qr_payload"
  },
  "qr": {
    "errorCorrection": "M",
    "quietZone": 4,
    "foreground": "#000000",
    "background": "#ffffff"
  }
}
```

Possible payload kinds:

- `field`: use a mapped imported data field.
- `serial`: use generated serial value.
- `template`: compose a value from text and fields.
- `static`: use a fixed value.

## Text Layer

```json
{
  "id": "layer_serial_text",
  "type": "text",
  "name": "Serial Text",
  "x": 760,
  "y": 700,
  "width": 340,
  "height": 60,
  "rotation": 0,
  "opacity": 1,
  "text": {
    "kind": "template",
    "value": "{{serial}}"
  },
  "style": {
    "fontFamily": "Arial",
    "fontSize": 28,
    "fontWeight": "700",
    "fill": "#000000",
    "align": "center",
    "verticalAlign": "middle",
    "letterSpacing": 0,
    "lineHeight": 1.1
  }
}
```

Possible text kinds:

- `field`
- `serial`
- `template`
- `static`

## Data

The data section describes how records are produced.

Manual serial mode:

```json
{
  "data": {
    "mode": "serial",
    "serial": {
      "prefix": "PARK-",
      "suffix": "",
      "start": 1,
      "quantity": 500,
      "step": 1,
      "padding": 4,
      "skip": []
    }
  }
}
```

CSV mode:

```json
{
  "data": {
    "mode": "csv",
    "csv": {
      "hasHeader": true,
      "columns": ["guest_name", "qr_payload", "sku", "zone"],
      "mappings": {
        "serial": "decal_number",
        "qr_payload": "qr_payload",
        "filename": "decal_number"
      }
    }
  }
}
```

The actual CSV rows may be stored in the browser session, embedded in a project file, or imported at export time. The first prototype can keep rows in memory.

## Export

```json
{
  "export": {
    "filename": {
      "kind": "template",
      "value": "{{serial}}"
    },
    "formats": ["png"],
    "renderMode": "flattened",
    "image": {
      "transparentBackground": false
    },
    "vector": {
      "enabled": false,
      "formats": []
    },
    "pdf": {
      "enabled": false,
      "layout": "single",
      "preserveLayers": false,
      "includeBleed": true
    },
    "native": {
      "enabled": false,
      "targets": []
    },
    "manifest": {
      "enabled": true,
      "format": "csv"
    }
  }
}
```

Possible `renderMode` values:

- `flattened`: render a final production image or document.
- `layered`: preserve editable layers where the selected export format supports it.

Likely export families:

- Raster: `png`, `jpg`, `bmp`
- Vector: `svg`, `eps`
- Document: `pdf`
- Native/design-tool oriented: Photoshop or Illustrator-compatible outputs, if practical support is found

Layered exports should be treated as format-specific capabilities, not a guarantee. The app should clearly explain when an export is flattened because the target format or selected library does not preserve layers.

Filename templates should be sanitized before export and checked for duplicates.

## Metadata

```json
{
  "metadata": {
    "createdWith": "QR Magic",
    "createdAt": "2026-06-18T00:00:00Z",
    "updatedAt": "2026-06-18T00:00:00Z",
    "notes": ""
  }
}
```

Metadata should not be required for rendering.

## Minimum Viable Project

The first web prototype only needs:

- Document width, height, unit, and DPI.
- One image background layer.
- One QR layer.
- One serial text layer.
- Serial data mode.
- PNG export.

CSV mapping, PDF, ZIP, manifests, and reusable templates can build on the same shape later.
