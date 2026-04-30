
-- Roles enum and tables
CREATE TYPE public.app_role AS ENUM ('admin', 'tech', 'viewer');
CREATE TYPE public.ticket_status AS ENUM ('pending', 'in-progress', 'testing', 'ready');
CREATE TYPE public.ticket_priority AS ENUM ('high', 'med', 'low');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default viewer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _name TEXT;
  _ini TEXT;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  _ini := UPPER(LEFT(_name, 1) || COALESCE(SUBSTRING(_name FROM ' (.)'), ''));
  IF length(_ini) < 2 THEN _ini := UPPER(LEFT(_name, 2)); END IF;

  INSERT INTO public.profiles (id, full_name, initials)
  VALUES (NEW.id, _name, _ini);

  -- First user becomes admin, rest become tech by default (admin can demote)
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tech');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT NOT NULL UNIQUE,
  client TEXT NOT NULL,
  model TEXT NOT NULL,
  serial TEXT,
  requester TEXT NOT NULL,
  end_user TEXT,
  priority ticket_priority NOT NULL DEFAULT 'med',
  status ticket_status NOT NULL DEFAULT 'pending',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  os TEXT,
  software TEXT,
  notes TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "All authed read tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tech/admin insert tickets" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Tech/admin update tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Admin delete tickets" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Ticket code sequence
CREATE SEQUENCE IF NOT EXISTS public.ticket_seq START 1;

-- Automation rules
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_text TEXT NOT NULL,
  action_text TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  count INT NOT NULL DEFAULT 0,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authed read rules" ON public.automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage rules" ON public.automation_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'sys',
  message TEXT NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authed read log" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authed insert log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Seed automation rules
INSERT INTO public.automation_rules (trigger_text, action_text, active, count, sort) VALUES
  ('Checklist OS completata al 100%', 'Stato → "In lavorazione"', true, 4, 1),
  ('Checklist Software completata al 100%', 'Stato → "Testing"', true, 3, 2),
  ('QA approvato dal tecnico', 'Stato → "Pronto"', true, 7, 3),
  ('Nessuna attività da 48h', 'Notifica a team lead', true, 2, 4),
  ('Priorità Alta + nessun assegnatario', 'Notifica immediata al team', true, 1, 5),
  ('Ticket in "Pronto" da 5+ giorni', 'Promemoria consegna', false, 0, 6);
