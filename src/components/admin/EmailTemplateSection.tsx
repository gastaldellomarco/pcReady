import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listEmailTemplates, sendTestEmail, updateEmailTemplate } from "@/lib/email-templates";
import {
  EMAIL_EVENT_LABELS,
  EMAIL_EVENT_TYPES,
  type EmailEventType,
  type EmailTemplate,
} from "@/types/email";

interface EmailTemplateSectionProps {
  accessToken: string;
  adminEmail: string;
  organizationName: string;
  supportEmail: string;
}

export function EmailTemplateSection({
  accessToken,
  adminEmail,
  organizationName,
  supportEmail,
}: EmailTemplateSectionProps) {
  const loadTemplates = useServerFn(listEmailTemplates);
  const saveTemplate = useServerFn(updateEmailTemplate);
  const sendTemplateTest = useServerFn(sendTestEmail);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [eventType, setEventType] = useState<EmailEventType>("invite");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadTemplates({ data: { accessToken } })
      .then((data) => {
        if (!active) return;
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i template email")))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, loadTemplates]);

  const selected = useMemo(
    () => templates.find((template) => template.event_type === eventType) ?? null,
    [eventType, templates],
  );

  async function handleSave(payload: {
    eventType: EmailEventType;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    isActive: boolean;
  }) {
    setSaving(true);
    try {
      const saved = await saveTemplate({
        data: {
          accessToken,
          eventType: payload.eventType,
          subject: payload.subject,
          bodyHtml: payload.bodyHtml,
          bodyText: payload.bodyText,
          isActive: payload.isActive,
        },
      });
      setTemplates((current) =>
        current.map((template) => (template.event_type === saved.event_type ? saved : template)),
      );
      toast.success("Template email salvato");
    } catch (error) {
      toast.error(errorMessage(error, "Salvataggio template non riuscito"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest(nextEventType: EmailEventType, recipientEmail: string) {
    setSending(true);
    try {
      const result = await sendTemplateTest({
        data: { accessToken, eventType: nextEventType, recipientEmail },
      });
      toast.success(
        result.delivered
          ? "Email di test inviata"
          : "Test preparato. Configura EMAIL_TEST_WEBHOOK_URL per inviare via SMTP.",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Invio email di test non riuscito"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Email</CardTitle>
        <CardDescription>
          Personalizza oggetto, HTML, testo e variabili delle email transazionali.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Select
            value={eventType}
            onValueChange={(value) => setEventType(value as EmailEventType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona template" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {EMAIL_EVENT_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[360px] w-full" />
          </div>
        ) : selected ? (
          <EmailTemplateEditor
            key={selected.id}
            template={selected}
            adminEmail={adminEmail}
            organizationName={organizationName}
            supportEmail={supportEmail}
            saving={saving}
            sending={sending}
            onSave={handleSave}
            onSendTest={handleSendTest}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Template non trovato.</p>
        )}
      </CardContent>
    </Card>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
