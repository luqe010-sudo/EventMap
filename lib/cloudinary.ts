import { createHash } from "crypto";

const MAX_EVENT_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif"
]);

type CloudinaryUploadResult = {
  secure_url?: string;
  public_id?: string;
  error?: {
    message?: string;
  };
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export async function uploadEventImageToCloudinary(file: File | null) {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_EVENT_IMAGE_TYPES.has(file.type)) {
    throw new Error("Obraz wydarzenia musi byc plikiem JPG, PNG, WebP, GIF albo AVIF.");
  }

  if (file.size > MAX_EVENT_IMAGE_BYTES) {
    throw new Error("Obraz wydarzenia moze miec maksymalnie 5 MB.");
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const folder = process.env.CLOUDINARY_EVENT_FOLDER ?? "eventmap/events";

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = {
    folder,
    timestamp
  };
  const signature = signCloudinaryParams(signedParams, apiSecret);
  const body = new FormData();

  body.set("file", file);
  body.set("api_key", apiKey);
  body.set("timestamp", timestamp);
  body.set("folder", folder);
  body.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body
  });
  const result = (await response.json()) as CloudinaryUploadResult;

  if (!response.ok || !result.secure_url) {
    throw new Error(`Nie udalo sie wgrac obrazu do Cloudinary: ${result.error?.message ?? response.statusText}`);
  }

  return result.secure_url;
}

function getCloudinaryConfig(): CloudinaryConfig {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      if (parsed.protocol !== "cloudinary:") {
        throw new Error("Nieprawidlowy protokol CLOUDINARY_URL.");
      }

      const apiKey = cleanCloudinaryCredential(decodeURIComponent(parsed.username));
      const apiSecret = cleanCloudinaryCredential(decodeURIComponent(parsed.password));
      const cloudName = cleanCloudinaryCredential(parsed.hostname);

      if (cloudName && apiKey && apiSecret) {
        return { cloudName, apiKey, apiSecret };
      }
    } catch {
      throw new Error("Nie udalo sie odczytac CLOUDINARY_URL. Uzyj formatu cloudinary://API_KEY:API_SECRET@CLOUD_NAME.");
    }
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Brakuje konfiguracji Cloudinary: ustaw CLOUDINARY_URL albo CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY i CLOUDINARY_API_SECRET.");
  }

  return { cloudName, apiKey, apiSecret };
}

function cleanCloudinaryCredential(value: string) {
  return value.trim().replace(/^<|>$/g, "");
}

function signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}
