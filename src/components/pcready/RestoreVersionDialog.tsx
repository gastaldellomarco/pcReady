import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Version } from "@/lib/versioning";
import { AlertTriangle } from "lucide-react";

interface RestoreVersionDialogProps {
  version: Version;
  open: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}

export function RestoreVersionDialog({ version, open, onClose, onConfirm }: RestoreVersionDialogProps) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(note || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Ripristina Versione v{version.version_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Stai per ripristinare questa versione. Verrà creata una nuova versione con il contenuto ripristinato.
              L'operazione non può essere annullata.
            </p>
          </div>

          <div>
            <Label htmlFor="restore-note">Nota ripristino (opzionale)</Label>
            <Textarea
              id="restore-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo del ripristino..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Ripristino..." : "Conferma Ripristino"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}