-- Add tags column to checklist_templates for free-form template categorization
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
