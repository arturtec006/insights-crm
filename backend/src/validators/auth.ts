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
