import { createServerFn } from "@tanstack/react-start";

interface Input {
  accessToken: string;
}

export const checkAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-users.server");
    try {
      await requireAdmin(data.accessToken);
      return { isAdmin: true };
    } catch (err) {
      return { isAdmin: false };
    }
  });

export default checkAdmin;
