import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Version } from "@/lib/versioning";

interface RestoreVersionDialogProps {
  version: Version;
  open: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}

/**
 *
 */
export function RestoreVersionDialog({
  version,
  open,
  onClose,
  onConfirm,
}: RestoreVersionDialogProps) {
  const { t } = useTranslation("checklist");
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
            {t("restoreDialog.title", "Ripristina Versione v{{number}}", { number: version.version_number })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              {t("restoreDialog.warning", "Stai per ripristinare questa versione. Verra' creata una nuova versione con il contenuto ripristinato. L'operazione non puo' essere annullata.")}
            </p>
          </div>

          <div>
            <Label htmlFor="restore-note">{t("restoreDialog.noteLabel", "Nota ripristino (opzionale)")}</Label>
            <Textarea
              id="restore-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("restoreDialog.notePlaceholder", "Motivo del ripristino...")}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("restoreDialog.cancel", "Annulla")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? t("restoreDialog.loading", "Ripristino...") : t("restoreDialog.confirm", "Conferma Ripristino")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
