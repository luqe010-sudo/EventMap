import { permanentRedirect } from "next/navigation";

export function redirectLowercasePath(segments: string[], params: Record<string, string | string[] | undefined>) {
  const normalized = segments.map(segment => segment.toLowerCase());
  if (segments.every((segment, index) => segment === normalized[index])) return;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value == null ? [] : [value]) query.append(key, item);
  }
  permanentRedirect(`/${normalized.map(encodeURIComponent).join("/")}${query.size ? `?${query}` : ""}`);
}
