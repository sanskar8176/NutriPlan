// Allergen / exclusion matching shared by the AI pipeline, the DB fallback
// and the static fallback.
//
// The plan form offers coarse categories ("Nuts", "Dairy", ...). A food name
// never literally contains "Dairy", so matching has to go through a keyword
// map. Matching is deliberately conservative: a false positive (dropping a
// safe food) is far cheaper than a false negative for someone with an allergy.

export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  nuts: [
    "nut", "almond", "badam", "peanut", "cashew", "kaju", "walnut", "akhrot",
    "pistachio", "pista", "hazelnut", "pecan", "macadamia", "praline",
  ],
  dairy: [
    "milk", "yogurt", "yoghurt", "curd", "dahi", "paneer", "cheese", "ghee",
    "butter", "lassi", "whey", "cream", "kheer", "raita", "cottage", "chaas",
    "buttermilk", "shrikhand", "rabri", "khoya", "mawa", "malai",
  ],
  gluten: [
    "wheat", "atta", "maida", "roti", "chapati", "phulka", "bread", "naan",
    "paratha", "puri", "poori", "kulcha", "pasta", "noodle", "semolina", "sooji",
    "suji", "rava", "upma", "toast", "wrap", "sandwich", "samosa", "halwa",
    "barley", "seitan", "biscuit", "cookie", "cracker", "dalia", "couscous",
  ],
  soy: ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "bhurji soya"],
  shellfish: [
    "prawn", "shrimp", "crab", "lobster", "shellfish", "clam", "mussel",
    "oyster", "squid", "scallop", "crayfish",
  ],
  eggs: ["egg", "omelette", "omelet", "anda", "frittata", "meringue"],
};

/**
 * Phrases that contain an allergen keyword but are NOT that allergen. They are
 * removed from the text before keyword matching so "Coconut Milk Kheer" is still
 * caught (kheer) while "Oats with Almond Milk" is not flagged for dairy.
 */
export const ALLERGEN_EXCEPTIONS: Record<string, string[]> = {
  dairy: [
    "coconut milk", "almond milk", "soy milk", "soya milk", "oat milk", "cashew milk",
    "rice milk", "peanut butter", "almond butter", "nut butter", "cocoa butter",
    "vegan cheese", "vegan butter", "plant-based", "plant based", "dairy-free", "dairy free",
    "coconut cream", "cashew cream", "buttermilk substitute",
  ],
  nuts: ["coconut", "nutmeg", "donut", "doughnut", "nutrition", "nutritious", "butternut", "nut-free", "nut free"],
  gluten: ["gluten-free", "gluten free", "rice flour", "besan", "buckwheat", "ragi roti", "jowar roti", "bajra roti", "makki roti", "rice bread"],
  eggs: ["eggplant", "egg-free", "egg free", "eggless"],
  soy: ["soy-free", "soy free"],
  shellfish: [],
};

/** Lower-cases, trims, de-duplicates and drops empty allergy strings. */
export function normalizeAllergies(raw: readonly string[] | undefined | null): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const a of raw) {
    const v = String(a).trim().toLowerCase();
    if (v) out.add(v);
  }
  return [...out];
}

/** Keywords to exclude for a given list of allergies (known categories expand, unknown strings match literally). */
export function allergenKeywordsFor(allergies: readonly string[]): string[] {
  const out = new Set<string>();
  for (const a of normalizeAllergies(allergies)) {
    const mapped = ALLERGEN_KEYWORDS[a];
    if (mapped) mapped.forEach((k) => out.add(k));
    else out.add(a);
  }
  return [...out];
}

/** True when the food's name or description mentions any excluded ingredient. */
export function foodMatchesAllergy(
  food: { name: string; description?: string | null },
  allergies: readonly string[],
): boolean {
  const normalized = normalizeAllergies(allergies);
  if (normalized.length === 0) return false;
  const text = `${food.name} ${food.description ?? ""}`.toLowerCase();
  // Exceptions are per allergy: "peanut butter" is not dairy, but it IS nuts.
  return normalized.some((a) => {
    let haystack = text;
    for (const phrase of ALLERGEN_EXCEPTIONS[a] ?? []) haystack = haystack.split(phrase).join(" ");
    return allergenKeywordsFor([a]).some((k) => haystack.includes(k));
  });
}

/** Removes every item that matches one of the user's allergies. */
export function excludeAllergens<T extends { name: string; description?: string | null }>(
  items: readonly T[],
  allergies: readonly string[],
): T[] {
  if (normalizeAllergies(allergies).length === 0) return [...items];
  return items.filter((item) => !foodMatchesAllergy(item, allergies));
}
