import QRCodeStyling, { type Options } from "qr-code-styling";
import type { QrLayer, RenderRecord } from "../types";
import { renderTemplate } from "./serial";

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function qrStylingOptions(layer: QrLayer, record: RenderRecord): Options {
  const size = Math.max(72, Math.round(Math.max(layer.width, layer.height)));

  return {
    type: "canvas",
    width: size,
    height: size,
    margin: Math.max(0, Math.round(layer.margin)),
    data: renderTemplate(layer.payloadTemplate, record, layer.dataGroupId),
    image: layer.logoEnabled && layer.logoSrc ? layer.logoSrc : undefined,
    qrOptions: {
      errorCorrectionLevel: layer.errorCorrectionLevel,
    },
    imageOptions: {
      hideBackgroundDots: layer.logoHideBackgroundDots,
      imageSize: layer.logoSize,
      margin: layer.logoMargin,
      crossOrigin: "anonymous",
    },
    dotsOptions: {
      type: layer.dotStyle,
      color: layer.foreground,
    },
    cornersSquareOptions: {
      type: layer.cornerSquareStyle,
      color: layer.foreground,
    },
    cornersDotOptions: {
      type: layer.cornerDotStyle,
      color: layer.foreground,
    },
    backgroundOptions: {
      color: layer.background,
    },
  };
}

export async function renderStyledQrDataUrl(layer: QrLayer, record: RenderRecord) {
  const qrCode = new QRCodeStyling(qrStylingOptions(layer, record));
  const blob = await qrCode.getRawData("png");
  if (!blob || !(blob instanceof Blob)) return "";
  return blobToDataUrl(blob);
}
