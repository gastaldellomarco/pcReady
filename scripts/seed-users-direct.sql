-- ============================================================================
-- Crea/fissa utenti seed direttamente in auth.users
-- Disabilita momentaneamente il trigger per evitare conflitti
-- Esegui nel SQL Editor: https://supabase.com/dashboard/project/ocviyztvmooqhsfssybg/sql/new
-- ============================================================================

-- 1. Disabilita il trigger per evitare errori durante l'inserimento manuale
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Inserisci/aggiorna utenti seed
DO $$
DECLARE
    v_pwhash  text := '$2b$10$37nWWKsJaF3SveZ0/cuy5ezu7ty0RngRCj0xmnCwayAlHegZpcTY.';
    v_now     timestamptz := now();
    v_ids     uuid[] := ARRAY[
        'a0000001-0000-4000-8000-000000000001'::uuid,
        'a0000001-0000-4000-8000-000000000002'::uuid,
        'a0000001-0000-4000-8000-000000000003'::uuid,
        'a0000001-0000-4000-8000-000000000004'::uuid,
        'a0000001-0000-4000-8000-000000000005'::uuid
    ];
    v_emails  text[] := ARRAY['marco.villa@pcready.test','laura.bianchi@pcready.test','diego.ferraris@pcready.test','sara.moretti@pcready.test','valerio.neri@pcready.test'];
    v_names   text[] := ARRAY['Marco Villa','Laura Bianchi','Diego Ferraris','Sara Moretti','Valerio Neri'];
    v_inits   text[] := ARRAY['MV','LB','DF','SM','VN'];
    v_roles   text[] := ARRAY['admin','tech','tech','tech','viewer'];
    i int;
BEGIN
    FOR i IN 1..5 LOOP
        -- Prova insert diretto in auth.users
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
        VALUES (v_ids[i], v_emails[i], v_pwhash, v_now, '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', v_names[i]), v_now, v_now, '', '', '', '')
        ON CONFLICT (id) DO UPDATE SET encrypted_password = v_pwhash, email_confirmed_at = v_now, updated_at = v_now, raw_user_meta_data = jsonb_build_object('full_name', v_names[i]);

        RAISE NOTICE 'auth.users: % (%) OK', v_emails[i], v_ids[i];
    END LOOP;

    -- 3. Inserisci profili e ruoli
    FOR i IN 1..5 LOOP
        INSERT INTO public.profiles (id, full_name, initials, created_at) VALUES (v_ids[i], v_names[i], v_inits[i], v_now::date)
        ON CONFLICT (id) DO UPDATE SET full_name = v_names[i], initials = v_inits[i];

        INSERT INTO public.user_profiles (id, display_name, password_set) VALUES (v_ids[i], v_names[i], true)
        ON CONFLICT (id) DO UPDATE SET display_name = v_names[i], password_set = true;

        INSERT INTO public.user_roles (user_id, role) VALUES (v_ids[i], v_roles[i]::public.app_role)
        ON CONFLICT (user_id) DO UPDATE SET role = v_roles[i]::public.app_role;

        RAISE NOTICE 'Profile+role: % as %', v_emails[i], v_roles[i];
    END LOOP;

    RAISE NOTICE '=== Seed users created successfully ===';
END $$;

-- 4. Riabilita il trigger con la versione aggiornata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _name TEXT;
  _ini TEXT;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  _ini := UPPER(LEFT(_name, 1) || COALESCE(SUBSTRING(_name FROM ' (.)'), ''));
  IF length(_ini) < 2 THEN _ini := UPPER(LEFT(_name, 2)); END IF;

  INSERT INTO public.profiles (id, full_name, initials)
  VALUES (NEW.id, _name, _ini)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, _name)
  ON CONFLICT (id) DO NOTHING;

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tech')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- Trigger riabilitato con ON CONFLICT (user_id)
