import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CompleteTicketSchema = z.object({
  ticketId: z.string().uuid(),
  changedBy: z.string().uuid(),
  accessToken: z.string(),
});

export const completeTicketServer = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof CompleteTicketSchema>) => data)
  .handler(async ({ data }) => {
    const { completeTicket } = await import("./ticket-completion.server");
    return completeTicket(CompleteTicketSchema.parse(data));
  });
