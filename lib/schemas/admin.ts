import { z } from "zod";

export const AdminUserInviteSchema = z.object({
  email: z.string().email("Inserisci un'email valida"),
  fullName: z.string().min(1, "Inserisci il nome").optional(),
  role: z.enum(["admin", "tech", "viewer"]),
});

export type AdminUserInviteInput = z.infer<typeof AdminUserInviteSchema>;
