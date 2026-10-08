import { headers } from "next/headers";

/** Prefer the configured public origin for Auth emails and provider callbacks. */
export async function getRequestOrigin() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    const origin = httpOrigin(configuredSiteUrl);
    if (origin) return origin;
    throw new Error("NEXT_PUBLIC_SITE_URL musi być poprawnym adresem HTTP lub HTTPS.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL jest wymagane w środowisku produkcyjnym.");
  }

  const headerStore = await headers();
  const requestOrigin = httpOrigin(headerStore.get("origin"));
  if (requestOrigin) return requestOrigin;

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) return "http://localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ??
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  const origin = httpOrigin(`${protocol}://${host}`);
  if (!origin) throw new Error("Nie można ustalić adresu strony dla logowania.");
  return origin;
}

function httpOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.origin : null;
  } catch { return null; }
}
