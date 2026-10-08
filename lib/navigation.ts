/** Only local paths are allowed for navigation after authentication. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f\u007f]/.test(value) || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return "/";
    const url = new URL(value, "https://eventmap.invalid");
    return url.origin === "https://eventmap.invalid" ? value : "/";
  } catch { return "/"; }
}
