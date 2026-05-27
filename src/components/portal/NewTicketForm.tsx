import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortalTicket, listPortalDevices } from "@/lib/portal-tickets";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";

export function NewTicketForm({ token, categories }: { token: string; categories: string[] }) {
  const createTicket = useServerFn(createPortalTicket);
  const loadDevices = useServerFn(listPortalDevices);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] || "Assistenza tecnica");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [requestType, setRequestType] = useState<"technical_issue" | "request" | "device_fault">(
    "technical_issue",
  );
  const [deviceId, setDeviceId] = useState("");
  const [devices, setDevices] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<
    Array<{ fileName: string; mimeType?: string; dataUrl: string }>
  >([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadDevices({ data: { token } })
      .then((result) => {
        const rows = (result.devices as any[]) || [];
        setDevices(rows);
        const prefill = new URLSearchParams(window.location.search).get("device");
        if (prefill && rows.some((device) => device.id === prefill)) setDeviceId(prefill);
      })
      .catch(() => setDevices([]));
  }, [loadDevices, token]);

  async function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, 3);
    const converted = await Promise.all(
      selected.map(
        (file) =>
          new Promise<{ fileName: string; mimeType?: string; dataUrl: string }>(
            (resolve, reject) => {
              if (file.size > 5 * 1024 * 1024) {
                reject(new Error(`${file.name}: massimo 5MB`));
                return;
              }
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  fileName: file.name,
                  mimeType: file.type,
                  dataUrl: String(reader.result),
                });
              reader.onerror = () => reject(new Error(`Impossibile leggere ${file.name}`));
              reader.readAsDataURL(file);
            },
          ),
      ),
    );
    setAttachments(converted);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createTicket({
        data: {
          token,
          title,
          description,
          category,
          urgency,
          requestType,
          deviceId: deviceId || null,
          attachments,
        },
      });
      toast.success(`Ticket ${result.ticketCode || ""} aperto correttamente`);
      window.location.href = `/portal/tickets/${result.ticketId}`;
    } catch (error) {
      toast.error(formatServerFnErrorForToast(error, "Errore apertura ticket"));
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
          aria-label="Titolo"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Descrizione</label>
        <textarea
          className="pc-input mt-1 min-h-32 w-full"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-label="Descrizione"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Tipo</label>
          <select
            className="pc-input mt-1 w-full"
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as typeof requestType)}
            aria-label="Tipo"
          >
            <option value="technical_issue">Problema tecnico</option>
            <option value="request">Richiesta</option>
            <option value="device_fault">Guasto dispositivo</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Categoria</label>
          <select
            className="pc-input mt-1 w-full"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Categoria"
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
            onChange={(event) =>
              setUrgency(event.target.value as "low" | "normal" | "high" | "urgent")
            }
            aria-label="Urgenza"
          >
            <option value="low">Bassa</option>
            <option value="normal">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Dispositivo coinvolto</label>
        <select
          className="pc-input mt-1 w-full"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          aria-label="Dispositivo coinvolto"
        >
          <option value="">Nessuno / non so</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.model} · {device.serial || device.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Allegati opzionali</label>
        <input
          className="pc-input mt-1 w-full"
          type="file"
          multiple
          accept="image/*,.log,.txt,.pdf"
          aria-label="Allegati opzionali"
          onChange={(event) =>
            void handleFiles(event.target.files).catch((error) => toast.error(error.message))
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">Massimo 3 file, 5MB ciascuno.</p>
        {attachments.length ? (
          <p className="mt-1 text-xs text-muted-foreground">{attachments.length} allegati pronti</p>
        ) : null}
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Apertura..." : "Apri ticket"}
      </Button>
    </form>
  );
}
