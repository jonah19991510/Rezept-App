import { describe, expect, it } from "vitest";
import { checkPhotoFile, fitWithin, isOwnPhotoPath, parsePhotoPath, photoPaths, photoUrl, staleFilesInFolder, thumbPathOf } from "./photo";

const U = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";

describe("fitWithin", () => {
  it("verkleinert auf die längste Kante und behält das Seitenverhältnis", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 1816, 480)).toEqual({ width: 480, height: 216 });
  });

  it("vergrößert kleine Bilder nicht", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("fängt kaputte Maße ab", () => {
    expect(fitWithin(0, 100, 1600)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(10000, 1, 480)).toEqual({ width: 480, height: 1 });
  });
});

describe("Pfade", () => {
  it("legt Foto und Vorschaubild im Ordner Owner/Rezept ab", () => {
    expect(photoPaths(U, R, P, "webp")).toEqual({ full: `${U}/${R}/${P}.webp`, thumb: `${U}/${R}/${P}-klein.webp` });
    expect(thumbPathOf(`${U}/${R}/${P}.jpg`)).toBe(`${U}/${R}/${P}-klein.jpg`);
  });

  it("zerlegt gültige Pfade und lehnt alles andere ab", () => {
    expect(parsePhotoPath(`${U}/${R}/${P}-klein.webp`)).toEqual({ ownerId: U, recipeId: R, photoId: P, isThumb: true, ext: "webp" });
    expect(parsePhotoPath(`${U}/${R}/${P}.png`)).toBeNull();
    expect(parsePhotoPath(`../${R}/${P}.webp`)).toBeNull();
    expect(parsePhotoPath(`${U}/${R}/../${P}.webp`)).toBeNull();
    expect(parsePhotoPath(`${U}/${R}/${P}.webp?x=1`)).toBeNull();
  });

  it("akzeptiert als Rezeptfoto nur das große Foto im eigenen Ordner", () => {
    const { full, thumb } = photoPaths(U, R, P, "webp");
    expect(isOwnPhotoPath(full, U, R)).toBe(true);
    expect(isOwnPhotoPath(thumb, U, R)).toBe(false);
    expect(isOwnPhotoPath(full, R, R)).toBe(false);
    expect(isOwnPhotoPath(full, U, U)).toBe(false);
  });

  it("baut die Adressen der Foto-Route", () => {
    const { full } = photoPaths(U, R, P, "webp");
    expect(photoUrl(full)).toBe(`/foto/${full}`);
    expect(photoUrl(full, "klein")).toBe(`/foto/${U}/${R}/${P}-klein.webp`);
  });
});

describe("staleFilesInFolder", () => {
  const folder = `${U}/${R}`;
  const neu = "33333333-3333-4333-8333-333333333333";
  const alt = "44444444-4444-4444-8444-444444444444";
  const abgebrochen = "55555555-5555-4555-8555-555555555555";

  it("behält das aktuelle Foto samt Vorschaubild, alles andere kann weg", () => {
    const names = [`${neu}.webp`, `${neu}-klein.webp`, `${alt}.jpg`, `${alt}-klein.jpg`, `${abgebrochen}.webp`];
    expect(staleFilesInFolder(folder, names, `${folder}/${neu}.webp`)).toEqual([
      `${folder}/${alt}.jpg`,
      `${folder}/${alt}-klein.jpg`,
      `${folder}/${abgebrochen}.webp`,
    ]);
  });

  it("ohne aktuelles Foto alles, bei leerem Ordner nichts", () => {
    expect(staleFilesInFolder(folder, [`${alt}.webp`, `${alt}-klein.webp`], null)).toEqual([
      `${folder}/${alt}.webp`,
      `${folder}/${alt}-klein.webp`,
    ]);
    expect(staleFilesInFolder(folder, [], `${folder}/${neu}.webp`)).toEqual([]);
  });
});

describe("checkPhotoFile", () => {
  it("nimmt übliche Fotos an", () => {
    expect(checkPhotoFile({ type: "image/jpeg", size: 4_000_000 })).toBeNull();
    expect(checkPhotoFile({ type: "image/png", size: 100 })).toBeNull();
    // manche Android-Galerien liefern keinen Typ
    expect(checkPhotoFile({ type: "", size: 100, name: "IMG_1.jpg" })).toBeNull();
  });

  it("lehnt HEIC, andere Dateien, zu große und leere Dateien mit Hinweis ab", () => {
    expect(checkPhotoFile({ type: "image/heic", size: 100 })).toMatch(/HEIC/);
    expect(checkPhotoFile({ type: "", size: 100, name: "IMG_2.HEIC" })).toMatch(/HEIC/);
    expect(checkPhotoFile({ type: "application/pdf", size: 100 })).toMatch(/Foto/);
    expect(checkPhotoFile({ type: "image/jpeg", size: 30 * 1024 * 1024 })).toMatch(/zu groß/);
    expect(checkPhotoFile({ type: "image/jpeg", size: 0 })).toMatch(/leer/);
  });
});
