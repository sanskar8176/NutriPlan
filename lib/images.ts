// Food image helpers.
//
// `next/image` refuses (and in dev throws for) any host that is not listed in
// next.config.ts `images.remotePatterns`. Food rows can come from the AI
// pipeline, the USDA seed or a future import, so every image URL that reaches
// the UI goes through `safeImageUrl` first.

export const ALLOWED_IMAGE_HOSTS = ["images.unsplash.com", "plus.unsplash.com"] as const;

export const CATEGORY_IMAGES: Record<string, string> = {
  dal:        "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80",
  chickpea:   "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
  legume:     "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",
  bread:      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80",
  rice:       "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
  grain:      "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&q=80",
  paneer:     "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80",
  dairy:      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
  fat:        "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
  vegetable:  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  chicken:    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
  meat:       "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80",
  fish:       "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
  egg:        "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80",
  snack:      "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
  oats:       "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&q=80",
  fruit:      "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
  tofu:       "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  supplement: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&q=80",
  nuts:       "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
  default:    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
};

export const DEFAULT_FOOD_IMAGE = CATEGORY_IMAGES.default;

export function imageForCategory(category: string | undefined | null): string {
  if (!category) return DEFAULT_FOOD_IMAGE;
  return CATEGORY_IMAGES[category.toLowerCase()] ?? DEFAULT_FOOD_IMAGE;
}

export function isAllowedImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0 || url.length > 2048) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}

/** Returns the URL when it is on an allow-listed https host, otherwise a safe category fallback. */
export function safeImageUrl(url: unknown, category?: string | null): string {
  return isAllowedImageUrl(url) ? url : imageForCategory(category);
}
