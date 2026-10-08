export const PASSWORD_RECOVERY_COOKIE = "eventmap-password-recovery";
export const PASSWORD_RECOVERY_SECONDS = 10 * 60;

export function recoveryCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/auth", maxAge: PASSWORD_RECOVERY_SECONDS };
}

export function recoveryCookieValue(userId: string, now = Date.now()) {
  return JSON.stringify({ userId, expiresAt: now + PASSWORD_RECOVERY_SECONDS * 1000 });
}

/** Bind the short-lived reset UI to the account verified by the recovery callback. */
export function hasRecoveryContext(value: string | undefined, userId: string, now = Date.now()) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as { userId?: unknown; expiresAt?: unknown };
    return parsed.userId === userId && typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > now && parsed.expiresAt <= now + PASSWORD_RECOVERY_SECONDS * 1000;
  } catch { return false; }
}

export function validateNewPassword(password: unknown, confirmation: unknown): string | null {
  if (typeof password !== "string" || password.length < 6) return "Hasło musi mieć co najmniej 6 znaków.";
  if (password.length > 128) return "Hasło może mieć najwyżej 128 znaków.";
  if (password !== confirmation) return "Hasła nie są identyczne.";
  return null;
}
