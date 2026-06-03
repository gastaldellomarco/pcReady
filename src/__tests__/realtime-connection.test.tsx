import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { queryClient } from "@/lib/queries/queryClient";

let channelSubscribeCallback: ((status: string) => void) | undefined;

const realtimeMock = {
  channel: vi.fn(() => ({
    subscribe: vi.fn((cb: (status: string) => void) => {
      channelSubscribeCallback = cb;
      return { unsubscribe: vi.fn() };
    }),
  })),
  connect: vi.fn(),
  onHeartbeat: vi.fn(),
  setAuth: vi.fn(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    realtime: realtimeMock,
  })),
}));

describe("Realtime connection monitoring", () => {
  beforeEach(async () => {
    channelSubscribeCallback = undefined;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    realtimeMock.connect.mockReset();
    realtimeMock.setAuth.mockReset();
    vi.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);

    const client = await import("@/integrations/supabase/client");
    client.setRealtimeConnectionStatus("connected");
  });

  it("shows the banner while realtime is disconnected", async () => {
    const client = await import("@/integrations/supabase/client");
    client.setRealtimeConnectionStatus("disconnected");

    const html = renderToString(<ConnectionBanner />);

    expect(html).toContain("Connessione persa. Riconnessione in corso...");
  });

  it("registers realtime status listeners and refetches active queries after reconnection", async () => {
    const client = await import("@/integrations/supabase/client");
    void client.supabase.realtime;

    client.setRealtimeConnectionStatus("disconnected");
    channelSubscribeCallback?.("SUBSCRIBED");

    expect(client.getRealtimeConnectionStatus()).toBe("connected");
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ type: "active" });
  });

  it("marks realtime as disconnected and explicitly reconnects on heartbeat loss", async () => {
    const client = await import("@/integrations/supabase/client");
    void client.supabase.realtime;

    const heartbeatCallback = realtimeMock.onHeartbeat.mock.calls[0][0];
    heartbeatCallback("disconnected");

    expect(client.getRealtimeConnectionStatus()).toBe("disconnected");
    expect(realtimeMock.connect).toHaveBeenCalled();
  });
});
