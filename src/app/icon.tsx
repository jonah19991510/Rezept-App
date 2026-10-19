import { appIconResponse } from "@/lib/app-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon (Browser-Tab). */
export default function Icon() {
  return appIconResponse(64, { rounded: true, glyph: 0.7 });
}
