import regular from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import bold from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import extraBold from "@fontsource/inter/files/inter-latin-800-normal.woff?url";

export const productionFontUrls: Record<number, string> = { 400: regular, 700: bold, 800: extraBold };
let loaded: Promise<void> | undefined;

export function loadProductionFonts() {
  loaded ??= Promise.all(Object.entries(productionFontUrls).map(async ([weight, url]) => {
    const face = await new FontFace("Inter", `url("${url}")`, { weight }).load();
    document.fonts.add(face);
  })).then(() => undefined);
  return loaded;
}
