import { Monitor, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  html: string;
  sampleValues: Record<string, string>;
}

/**
 *
 */
export function EmailPreviewDialog({
  open,
  onOpenChange,
  subject,
  html,
  sampleValues,
}: EmailPreviewDialogProps) {
  const { t } = useTranslation("admin");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const renderedSubject = useMemo(
    () => renderTemplate(subject, sampleValues),
    [sampleValues, subject],
  );
  const renderedHtml = useMemo(() => renderTemplate(html, sampleValues), [html, sampleValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl xs:fixed xs:inset-0 xs:m-0 xs:max-w-full xs:h-full xs:rounded-none xs:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("emailPreview.title", "Anteprima email")}</DialogTitle>
          <DialogDescription>{renderedSubject}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewport === "desktop" ? "default" : "outline"}
            onClick={() => setViewport("desktop")}
          >
            <Monitor className="mr-2 size-4" />
            {t("emailPreview.desktop", "Desktop")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewport === "mobile" ? "default" : "outline"}
            onClick={() => setViewport("mobile")}
          >
            <Smartphone className="mr-2 size-4" />
            {t("emailPreview.mobile", "Mobile")}
          </Button>
        </div>
        <div className="flex justify-center rounded-md border bg-muted/40 p-4">
          <iframe
            title={t("emailPreview.iframeTitle", "Anteprima template email")}
            className="h-[560px] rounded-md border bg-background"
            style={{ width: viewport === "desktop" ? 720 : 390 }}
            srcDoc={renderedHtml}
            sandbox="allow-same-origin allow-popups"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{[a-z0-9_]+\}\}/gi, (token) => values[token] ?? token);
}
