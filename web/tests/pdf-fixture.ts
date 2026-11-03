import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist/build/pdf.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import decodeQr from "jsqr";

GlobalWorkerOptions.workerSrc = workerUrl;
export { getDocument, OPS, decodeQr };
export { default as JSZip } from "jszip";
