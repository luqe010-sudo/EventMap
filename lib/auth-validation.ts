export type RegistrationRole = "user" | "organizer";

export function parseRegistrationRole(value: unknown): RegistrationRole | null {
  return value === "user" || value === "organizer" ? value : null;
}
