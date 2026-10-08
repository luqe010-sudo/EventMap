export type OrganizerEventActionState = {
  error: string | null;
  success: string | null;
};

export const initialOrganizerEventActionState: OrganizerEventActionState = {
  error: null,
  success: null
};
