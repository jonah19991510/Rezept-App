import { appIconResponse } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icon für „Zum Home-Bildschirm“ auf iPhone/iPad (iOS rundet die Ecken selbst). */
export default function AppleIcon() {
  return appIconResponse(180, { rounded: false, glyph: 0.58 });
}
