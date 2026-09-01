import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  role: z.enum(["ADMIN", "MANAGER", "ANALYST"]),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["ADMIN", "MANAGER", "ANALYST"]).optional(),
  isActive: z.boolean().optional(),
});

// The 200-char ceiling is not cosmetic: bcrypt silently truncates past 72 bytes,
// so accepting an unbounded string would let someone believe a 500-character
// passphrase is protecting them when only its first 72 bytes are.
const newPassword = z.string().min(10).max(200);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword,
});
