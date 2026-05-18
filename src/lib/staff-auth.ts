import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: any) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    const { staffLoginServer } = await import("@/lib/server/staff-auth.server");
    return staffLoginServer(data as any);
  });

export default staffLogin;
