import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { BRAND_BACKGROUND, BRAND_TERRACOTTA } from "@/lib/app-icon";
import { sharedMacros, type SharedRecipe } from "@/lib/domain/shared-recipe";
import { formatNumber } from "@/lib/format";
import { formatMinutes, formatQuantity } from "@/lib/format-quantity";
import { STORY, STORY_PHOTO_HEIGHT, STORY_WIDTH, storyHeight } from "@/lib/domain/story-layout";
import { CATEGORY_LABELS, METHOD_LABELS, servingsLabel } from "@/lib/labels";

// Bilder zur geteilten Rezeptkarte (Phase 14), gerendert mit ImageResponse (Satori → PNG):
// Link-Vorschau (Open Graph, 1200×630) und Rezeptkarte als Bild (1080 breit, ab 1920 hoch, z. B. für Stories).
// Farben wie im Designsystem (globals.css, hier als Hex, weil Satori kein oklch kennt).

const FG = "#2a1f18";
const MUTED = "#6e6058";
const CARD = "#fffcf7";
const BORDER = "#e4ddd3";
const MACRO = { protein: "#3067b8", carbs: "#da950b", fat: "#4e822c" } as const;

/** Oberzeile: Kategorie, bei Cocktails „Cocktail · geshaked“ */
function kicker(recipe: SharedRecipe): string | null {
  if (recipe.recipe_type === "cocktail") {
    return ["Cocktail", recipe.cocktail?.method ? METHOD_LABELS[recipe.cocktail.method] : null].filter(Boolean).join(" · ");
  }
  return recipe.category ? CATEGORY_LABELS[recipe.category] : null;
}

/**
 * ImageResponse liefert PNG; mit Foto wird das schnell 1–2 MB groß. Messenger zeigen große Vorschaubilder
 * oft gar nicht an (WhatsApp ab ca. 300 KB), daher als JPEG ausliefern.
 */
export async function asJpeg(image: ImageResponse, quality = 80): Promise<Uint8Array<ArrayBuffer>> {
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
  return new Uint8Array(jpeg);
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function timeLabel(recipe: SharedRecipe): string | null {
  return formatMinutes((recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0));
}

function Macros({ recipe, scale }: { recipe: SharedRecipe; scale: number }) {
  const m = sharedMacros(recipe);
  const a = recipe.recipe_type === "cocktail" ? recipe.alcohol : null;
  if (!m && !a) return null;
  // Cocktails: Alkoholgehalt, Gramm Alkohol und kcal pro Drink statt Makros
  const items = a
    ? [
        { label: "% vol", value: formatNumber(a.abv_percent, 1), color: BRAND_TERRACOTTA },
        { label: "Alkohol", value: `${formatNumber(a.alcohol_g, 0)} g`, color: MUTED },
        ...(m ? [{ label: "kcal", value: formatNumber(Math.round(m.kcal), 0), color: BRAND_TERRACOTTA }] : []),
      ]
    : m
      ? [
          { label: "kcal", value: formatNumber(Math.round(m.kcal), 0), color: BRAND_TERRACOTTA },
          { label: "Eiweiß", value: `${formatNumber(m.protein, 0)} g`, color: MACRO.protein },
          { label: "Kohlenh.", value: `${formatNumber(m.carbs, 0)} g`, color: MACRO.carbs },
          { label: "Fett", value: `${formatNumber(m.fat, 0)} g`, color: MACRO.fat },
        ]
      : [];
  return (
    <div style={{ display: "flex", gap: 14 * scale }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: `${12 * scale}px ${18 * scale}px`,
            borderRadius: 18 * scale,
            background: CARD,
            border: `${2 * scale}px solid ${BORDER}`,
            borderTop: `${6 * scale}px solid ${item.color}`,
          }}
        >
          <span style={{ fontSize: 30 * scale, color: FG }}>{item.value}</span>
          <span style={{ fontSize: 18 * scale, color: MUTED }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Brand({ scale }: { scale: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 * scale, color: MUTED, fontSize: 22 * scale }}>
      <div style={{ display: "flex", width: 18 * scale, height: 18 * scale, borderRadius: 6 * scale, background: BRAND_TERRACOTTA }} />
      Rezeptbuch
    </div>
  );
}

/** Link-Vorschau für Messenger: Foto links (falls vorhanden), rechts Titel, Autor und Makros. */
export function sharedOgImage(recipe: SharedRecipe, photo: string | null, size: { width: number; height: number }) {
  const meta = [
    `${recipe.servings} ${servingsLabel(recipe.servings, recipe.recipe_type)}`,
    timeLabel(recipe),
    recipe.author ? `von ${recipe.author}` : null,
  ].filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: BRAND_BACKGROUND }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori rendert nur <img>
          <img src={photo} alt="" width={size.height} height={size.height} style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: 36, height: "100%", background: BRAND_TERRACOTTA }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: 56 }}>
          <Brand scale={1} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {kicker(recipe) ? (
              <span style={{ fontSize: 24, color: BRAND_TERRACOTTA, textTransform: "uppercase", letterSpacing: 2 }}>
                {kicker(recipe)}
              </span>
            ) : null}
            <span style={{ fontSize: photo ? 56 : 68, lineHeight: 1.1, color: FG }}>{clip(recipe.title, photo ? 60 : 80)}</span>
            <span style={{ fontSize: 26, color: MUTED }}>{meta.join(" · ")}</span>
          </div>
          <Macros recipe={recipe} scale={photo ? 0.85 : 1} />
        </div>
      </div>
    ),
    size,
  );
}

export const STORY_PHOTO = { width: STORY_WIDTH, height: STORY_PHOTO_HEIGHT };

const MAX_STEP_CHARS = 900;
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Rezeptkarte als Bild (1080 px breit, mindestens 1920 hoch wie eine Story): Foto oben, darunter Karte mit
 * Makros, allen Zutaten, der Zubereitung und Beilagen. Bei langen Rezepten wird das Bild länger (storyHeight).
 */
export function sharedStoryImage(recipe: SharedRecipe, photo: string | null) {
  const width = STORY_WIDTH;
  const meta = [
    `${recipe.servings} ${servingsLabel(recipe.servings, recipe.recipe_type)}`,
    timeLabel(recipe),
    recipe.author ? `von ${recipe.author}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const title = clip(recipe.title, 90);
  const ingredients = recipe.ingredients.map((line) => ({
    key: line.position,
    quantity: formatQuantity(line.amount, line.unit) || "–",
    text: oneLine(line.name + (line.note ? `, ${line.note}` : "") + (line.is_optional ? " (optional)" : "")),
  }));
  const steps = recipe.steps.map((step) => ({ key: step.position, text: clip(oneLine(step.text), MAX_STEP_CHARS) }));
  const sides = recipe.side_dishes.length ? `Passt dazu: ${recipe.side_dishes.join(", ")}` : null;
  const height = storyHeight({
    hasPhoto: Boolean(photo),
    hasKicker: Boolean(kicker(recipe)),
    title,
    meta,
    hasMacros: Boolean(sharedMacros(recipe) || (recipe.recipe_type === "cocktail" && recipe.alcohol)),
    ingredients: ingredients.map((i) => i.text),
    steps: steps.map((st) => st.text),
    sides,
  });
  const heading = { fontSize: STORY.heading.size, lineHeight: STORY.heading.lineHeight, color: FG };

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BRAND_BACKGROUND }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori rendert nur <img>
          <img src={photo} alt="" width={width} height={STORY_PHOTO_HEIGHT} style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", height: STORY.band, background: BRAND_TERRACOTTA }} />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            margin: photo ? `-${STORY.photoOverlap}px ${STORY.margin}px ${STORY.margin}px` : `${STORY.margin}px`,
            padding: STORY.padding,
            gap: STORY.gap,
            borderRadius: 48,
            background: CARD,
            border: `2px solid ${BORDER}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {kicker(recipe) ? (
              <span
                style={{
                  fontSize: STORY.kicker.size,
                  lineHeight: STORY.kicker.lineHeight,
                  color: BRAND_TERRACOTTA,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                }}
              >
                {kicker(recipe)}
              </span>
            ) : null}
            <span style={{ fontSize: STORY.title.size, lineHeight: STORY.title.lineHeight, color: FG }}>{title}</span>
            {meta ? <span style={{ fontSize: STORY.meta.size, lineHeight: STORY.meta.lineHeight, color: MUTED }}>{meta}</span> : null}
          </div>
          <Macros recipe={recipe} scale={1.2} />
          {ingredients.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: STORY.ingredient.rowGap }}>
              <span style={heading}>Zutaten</span>
              {ingredients.map((line) => (
                <div
                  key={line.key}
                  style={{
                    display: "flex",
                    gap: STORY.ingredient.gap,
                    fontSize: STORY.ingredient.size,
                    lineHeight: STORY.ingredient.lineHeight,
                    color: FG,
                  }}
                >
                  <span style={{ width: STORY.ingredient.quantityWidth, flexShrink: 0, color: MUTED }}>{line.quantity}</span>
                  <span style={{ flex: 1 }}>{line.text}</span>
                </div>
              ))}
            </div>
          ) : null}
          {steps.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: STORY.step.rowGap }}>
              <span style={heading}>Zubereitung</span>
              {steps.map((step, i) => (
                <div key={step.key} style={{ display: "flex", gap: STORY.step.gap }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      width: STORY.step.badge,
                      height: STORY.step.badge,
                      borderRadius: STORY.step.badge / 2,
                      background: BRAND_TERRACOTTA,
                      color: CARD,
                      fontSize: 22,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span style={{ flex: 1, fontSize: STORY.step.size, lineHeight: STORY.step.lineHeight, color: FG }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {sides ? (
            <span style={{ fontSize: STORY.sides.size, lineHeight: STORY.sides.lineHeight, color: MUTED }}>{sides}</span>
          ) : null}
          <div style={{ display: "flex", marginTop: "auto" }}>
            <Brand scale={1.4} />
          </div>
        </div>
      </div>
    ),
    { width, height },
  );
}
