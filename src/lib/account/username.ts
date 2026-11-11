/** Usernames: 3–20 letters, numbers or underscores (matches the profiles table rule). */
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export function usernameError(name: string): string | null {
  if (!USERNAME_RE.test(name.trim())) return "Username must be 3–20 letters, numbers or underscores.";
  return null;
}
