export const GOOGLE_OAUTH_COOKIE = "eventmap_google_oauth";
export const GOOGLE_ONBOARDING_COOKIE = "eventmap_google_onboarding";

export type GoogleOAuthRegistration = {
  intent: "login" | "register";
  role: "user" | "organizer";
  organizerName: string | null;
  next: string;
};
