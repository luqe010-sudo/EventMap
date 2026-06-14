const POLISH_CHAR_MAP: Record<string, string> = {
  "\u0105": "a",
  "\u0107": "c",
  "\u0119": "e",
  "\u0142": "l",
  "\u0144": "n",
  "\u00f3": "o",
  "\u015b": "s",
  "\u017a": "z",
  "\u017c": "z",
  "\u0104": "a",
  "\u0106": "c",
  "\u0118": "e",
  "\u0141": "l",
  "\u0143": "n",
  "\u00d3": "o",
  "\u015a": "s",
  "\u0179": "z",
  "\u017b": "z"
};

export function slugify(text: string) {
  return text
    .trim()
    .replace(/[\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b]/g, (char) => POLISH_CHAR_MAP[char] ?? char)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSearchText(text: string | null | undefined) {
  return slugify(text ?? "").replace(/-/g, " ");
}
