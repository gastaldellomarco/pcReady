-- Tabella per checklist personalizzate
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- struttura: { tabKey: { label: "...", items: [{ id, text }] } }
  structure JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authed read templates" ON public.checklist_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tech/admin insert templates" ON public.checklist_templates
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech')
  );

CREATE POLICY "Tech/admin update templates" ON public.checklist_templates
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech')
  );

CREATE POLICY "Admin delete templates" ON public.checklist_templates
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_checklist_templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Aggiungi riferimento al template usato sul ticket (opzionale)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checklist_structure JSONB;
