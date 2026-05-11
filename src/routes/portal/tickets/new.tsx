import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { NewTicketForm } from "@/components/portal/NewTicketForm";
import { getPortalTicketCategories } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/tickets/new")({
  component: PortalNewTicketPage,
});

function PortalNewTicketPage() {
  const loadCategories = useServerFn(getPortalTicketCategories);
  const [token, setToken] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("pcready_portal_token") || "";
    if (!stored) {
      window.location.href = "/portal";
      return;
    }
    setToken(stored);
    loadCategories({ data: { token: stored } }).then((result) => setCategories(result.categories));
  }, [loadCategories]);

  if (!token) return <p className="text-sm text-muted-foreground">Caricamento...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Apri nuovo ticket</h1>
        <p className="text-sm text-muted-foreground">Descrivi il problema: il team tecnico prenderà in carico la richiesta.</p>
      </div>
      <NewTicketForm token={token} categories={categories} />
    </div>
  );
}
