export const ADMIN_EMAIL = "andrewjoyce84@hotmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}
