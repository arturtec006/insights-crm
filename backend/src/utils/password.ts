import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Baseline strength check enforced server-side (never trust client-only validation).
export function isPasswordStrongEnough(plain: string): boolean {
  if (plain.length < 10) return false;
  const hasLower = /[a-z]/.test(plain);
  const hasUpper = /[A-Z]/.test(plain);
  const hasDigit = /\d/.test(plain);
  return hasLower && hasUpper && hasDigit;
}
