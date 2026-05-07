import { Eye, Mail, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmailPreviewDialog } from "@/components/admin/EmailPreviewDialog";
import {
  EMAIL_EVENT_LABELS,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailEventType,
  type EmailTemplate,
} from "@/types/email";

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  adminEmail: string;
  organizationName: string;
  supportEmail: string;
  saving: boolean;
  sending: boolean;
  onSave: (template: {
    eventType: EmailEventType;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    isActive: boolean;
  }) => Promise<void>;
  onSendTest: (eventType: EmailEventType, recipientEmail: string) => Promise<void>;
}

export function EmailTemplateEditor({
  template,
  adminEmail,
  organizationName,
  supportEmail,
  saving,
  sending,
  onSave,
  onSendTest,
}: EmailTemplateEditorProps) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [bodyText, setBodyText] = useState(template.body_text ?? "");
  const [isActive, setIsActive] = useState(template.is_active);
  const [mode, setMode] = useState<"html" | "text">("html");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testEmail, setTestEmail] = useState(adminEmail);
  const htmlRef = useRef<HTMLTextAreaElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setBodyText(template.body_text ?? "");
    setIsActive(template.is_active);
  }, [template]);

  useEffect(() => {
    setTestEmail(adminEmail);
  }, [adminEmail]);

  const variables = EMAIL_TEMPLATE_VARIABLES[template.event_type];
  const sampleValues = useMemo(
    () => ({
      "{{organization_name}}": organizationName || "PCReady",
      "{{support_email}}": supportEmail || "support@pcready.it",
      "{{user_name}}": "Mario Rossi",
      "{{user_email}}": "mario.rossi@example.com",
      "{{invite_link}}": `${window.location.origin}/auth/set-password#access_token=demo&type=invite`,
      "{{reset_link}}": `${window.location.origin}/auth/set-password#access_token=demo&type=recovery`,
      "{{confirm_link}}": `${window.location.origin}/auth/callback#access_token=demo&type=signup`,
      "{{ticket_code}}": "PC-2026-0142",
      "{{ticket_title}}": "Preparazione notebook Lenovo ThinkPad",
      "{{ticket_link}}": `${window.location.origin}/tickets?ticket=PC-2026-0142`,
      "{{checklist_name}}": "Setup Windows 11 Pro",
    }),
    [organizationName, supportEmail],
  );

  function insertVariable(token: string) {
    const ref = mode === "html" ? htmlRef.current : textRef.current;
    const setter = mode === "html" ? setBodyHtml : setBodyText;
    const current = mode === "html" ? bodyHtml : bodyText;

    if (!ref) {
      void navigator.clipboard?.writeText(token);
      toast.success(`${token} copiato`);
      return;
    }

    const start = ref.selectionStart ?? current.length;
    const end = ref.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    setter(next);
    requestAnimationFrame(() => {
      ref.focus();
      ref.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{EMAIL_EVENT_LABELS[template.event_type]}</h3>
            <p className="text-sm text-muted-foreground">
              Ultima modifica: {formatDate(template.last_modified_at)} da{" "}
              {template.last_modified_by_name || "Sistema"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="template-active" className="text-sm">
              Attivo
            </Label>
            <Switch id="template-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-subject">Oggetto</Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="[{{organization_name}}] Oggetto email"
          />
        </div>

        <Tabs value={mode} onValueChange={(value) => setMode(value as "html" | "text")}>
          <TabsList>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="text">Testo puro</TabsTrigger>
          </TabsList>
          <TabsContent value="html" className="mt-3 space-y-2">
            <Label htmlFor="email-body-html">Corpo HTML</Label>
            <Textarea
              ref={htmlRef}
              id="email-body-html"
              className="min-h-[360px] font-mono text-xs"
              value={bodyHtml}
              onChange={(event) => setBodyHtml(event.target.value)}
            />
          </TabsContent>
          <TabsContent value="text" className="mt-3 space-y-2">
            <Label htmlFor="email-body-text">Corpo testo puro</Label>
            <Textarea
              ref={textRef}
              id="email-body-text"
              className="min-h-[260px] font-mono text-xs"
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
            />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() =>
              onSave({
                eventType: template.event_type,
                subject,
                bodyHtml,
                bodyText,
                isActive,
              })
            }
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvataggio..." : "Salva template"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Anteprima
          </Button>
          <div className="flex min-w-[260px] flex-1 items-center gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="email test"
            />
            <Button
              type="button"
              variant="outline"
              disabled={sending || !testEmail}
              onClick={() => onSendTest(template.event_type, testEmail)}
            >
              <Mail className="mr-2 h-4 w-4" />
              {sending ? "Invio..." : "Test"}
            </Button>
          </div>
        </div>
      </div>

      <aside className="space-y-3 rounded-md border p-3">
        <div>
          <div className="text-sm font-semibold">Variabili disponibili</div>
          <p className="text-xs text-muted-foreground">Clicca per inserirle nell'editor attivo.</p>
        </div>
        <div className="space-y-2">
          {variables.map((variable) => (
            <button
              key={variable.token}
              type="button"
              className="w-full rounded-md border p-2 text-left transition-colors hover:bg-muted"
              onClick={() => insertVariable(variable.token)}
            >
              <Badge variant="secondary" className="font-mono">
                {variable.token}
              </Badge>
              <div className="mt-1 text-xs text-muted-foreground">{variable.description}</div>
            </button>
          ))}
        </div>
      </aside>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={subject}
        html={bodyHtml}
        sampleValues={sampleValues}
      />
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
