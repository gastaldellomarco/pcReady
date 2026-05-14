import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortalTicket } from "@/lib/portal-tickets";

export function NewTicketForm({ token, categories }: { token: string; categories: string[] }) {
  const createTicket = useServerFn(createPortalTicket);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] || "Assistenza tecnica");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high">("normal");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createTicket({ data: { token, title, description, category, urgency } });
      toast.success("Ticket aperto correttamente");
      window.location.href = `/portal/tickets/${result.ticketId}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore apertura ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <label className="text-sm font-medium">Titolo</label>
        <input
          className="pc-input mt-1 w-full"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Descrizione</label>
        <textarea
          className="pc-input mt-1 min-h-32 w-full"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Categoria</label>
          <select
            className="pc-input mt-1 w-full"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {(categories.length ? categories : ["Assistenza tecnica"]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Urgenza</label>
          <select
            className="pc-input mt-1 w-full"
            value={urgency}
            onChange={(event) => setUrgency(event.target.value as "low" | "normal" | "high")}
          >
            <option value="low">Bassa</option>
            <option value="normal">Normale</option>
            <option value="high">Alta</option>
          </select>
        </div>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Apertura..." : "Apri ticket"}
      </Button>
    </form>
  );
}
