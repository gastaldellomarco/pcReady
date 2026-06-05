import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/2fa-challenge")({
  head: () => ({
    meta: [
      { title: "Verifica 2FA - PCReady" },
      { name: "description", content: "Verifica il secondo fattore di autenticazione." },
    ],
  }),
});
