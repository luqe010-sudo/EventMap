const POLISH_CHAR_MAP: Record<string, string> = {
  "ą": "a",
  "ć": "c",
  "ę": "e",
  "ł": "l",
  "ń": "n",
  "ó": "o",
  "ś": "s",
  "ź": "z",
  "ż": "z"
};

export function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => POLISH_CHAR_MAP[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSearchText(text: string | null | undefined) {
  return slugify(text ?? "").replace(/-/g, " ");
}
