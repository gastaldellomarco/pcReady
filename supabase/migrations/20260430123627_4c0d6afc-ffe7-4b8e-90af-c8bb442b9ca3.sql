
CREATE TABLE public.scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Generale',
  description TEXT,
  language TEXT NOT NULL DEFAULT 'powershell',
  content TEXT NOT NULL DEFAULT '',
  icon TEXT,
  color TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authed read scripts" ON public.scripts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tech/admin insert scripts" ON public.scripts
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tech'::app_role));

CREATE POLICY "Tech/admin update scripts" ON public.scripts
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tech'::app_role));

CREATE POLICY "Admin delete scripts" ON public.scripts
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER scripts_set_updated_at
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_scripts_category ON public.scripts(category);
