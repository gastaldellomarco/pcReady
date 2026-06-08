import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CheckAdminSchema = z.object({ accessToken: z.string() });

export const checkAdmin = createServerFn({ method: "POST" })
  .validator(CheckAdminSchema)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-users.server");
    try {
      await requireAdmin(data.accessToken);
      return { isAdmin: true };
    } catch (_err) {
      return { isAdmin: false };
    }
  });

export default checkAdmin;
