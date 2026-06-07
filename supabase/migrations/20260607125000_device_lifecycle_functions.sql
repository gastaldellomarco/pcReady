-- Migration: Postgres functions for device lifecycle automation and warranty alerts
-- Includes: evaluate_device_deprecation(), send_warranty_expiry_alerts(), sync_azure_ad_device()
-- Also inserts new app_settings for deprecation thresholds

-- ── App Settings for deprecation thresholds ──

INSERT INTO public.app_settings (key, value)
VALUES
  ('device_deprecation_max_age_years', '3'),
  ('device_deprecation_max_tickets_12m', '5')
ON CONFLICT (key) DO NOTHING;

-- ── Function: evaluate_device_deprecation ──

CREATE OR REPLACE FUNCTION public.evaluate_device_deprecation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_age_years int;
  max_tickets_12m int;
  d record;
  ticket_count int;
  age_date date;
  age_years int;
  admin_ids uuid[];
BEGIN
  -- Read thresholds from app_settings
  SELECT COALESCE((value#>>'{}')::int, 3) INTO max_age_years
    FROM public.app_settings WHERE key = 'device_deprecation_max_age_years';

  SELECT COALESCE((value#>>'{}')::int, 5) INTO max_tickets_12m
    FROM public.app_settings WHERE key = 'device_deprecation_max_tickets_12m';

  -- Collect admin user IDs for notifications
  SELECT array_agg(user_id) INTO admin_ids
    FROM public.user_roles WHERE role = 'admin';

  -- Iterate over eligible devices
  FOR d IN
    SELECT id, model, purchase_date, created_at, status
    FROM public.devices
    WHERE status NOT IN ('retired', 'maintenance')
  LOOP
    age_date := COALESCE(d.purchase_date, d.created_at::date);
    age_years := EXTRACT(YEAR FROM age(CURRENT_DATE, age_date))::int;

    IF age_years >= max_age_years THEN
      -- Count tickets in last 12 months
      SELECT COUNT(*) INTO ticket_count
      FROM public.tickets
      WHERE device_id = d.id
        AND created_at >= CURRENT_DATE - INTERVAL '12 months';

      IF ticket_count >= max_tickets_12m THEN
        -- Mark device as retired
        UPDATE public.devices
        SET status = 'retired', updated_at = now()
        WHERE id = d.id;

        -- Record in lifecycle history
        INSERT INTO public.device_lifecycle_history
          (device_id, phase, previous_phase, notes)
        VALUES (
          d.id,
          'decommissioned',
          NULL,
          format(
            'Deprecazione automatica: età %s anni, %s ticket in 12 mesi (stato precedente: %s)',
            age_years, ticket_count, d.status
          )
        );

        -- Notify all admins
        IF admin_ids IS NOT NULL THEN
          FOR i IN 1..array_length(admin_ids, 1) LOOP
            INSERT INTO public.notifications
              (user_id, type, title, body, payload, link)
            VALUES (
              admin_ids[i],
              'device_status_changed',
              'Device deprecato: ' || d.model,
              format(
                'Il device %s è stato automaticamente dismesso (età %s anni, %s ticket in 12 mesi).',
                d.model, age_years, ticket_count
              ),
              jsonb_build_object(
                'device_id', d.id,
                'reason', 'deprecation',
                'age_years', age_years,
                'ticket_count', ticket_count
              ),
              '/inventory?device=' || d.id
            );
          END LOOP;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_device_deprecation() FROM public, anon, authenticated;

-- ── Function: send_warranty_expiry_alerts ──

CREATE OR REPLACE FUNCTION public.send_warranty_expiry_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d record;
  client_contact record;
  admin_ids uuid[];
BEGIN
  -- Collect admin user IDs
  SELECT array_agg(user_id) INTO admin_ids
    FROM public.user_roles WHERE role = 'admin';

  FOR d IN
    SELECT dev.id, dev.model, dev.serial, dev.asset_tag, dev.warranty_expiry_date,
           dev.warranty_expiry_notified_for, dev.client_id,
           c.name AS client_name
    FROM public.devices dev
    JOIN public.clients c ON c.id = dev.client_id
    WHERE dev.warranty_expiry_date BETWEEN CURRENT_DATE + 60 AND CURRENT_DATE + 67
      AND (
        dev.warranty_expiry_notified_for IS NULL
        OR dev.warranty_expiry_notified_for <> dev.warranty_expiry_date
      )
      AND dev.status != 'retired'
  LOOP
    -- Notify admins (in-app)
    IF admin_ids IS NOT NULL THEN
      FOR i IN 1..array_length(admin_ids, 1) LOOP
        INSERT INTO public.notifications
          (user_id, type, title, body, payload, link)
        VALUES (
          admin_ids[i],
          'device_status_changed',
          'Garanzia in scadenza: ' || d.model,
          format(
            'La garanzia del device %s (%s) scade il %s.',
            d.model,
            COALESCE(d.serial, d.asset_tag),
            d.warranty_expiry_date
          ),
          jsonb_build_object(
            'device_id', d.id,
            'warranty_expiry', d.warranty_expiry_date
          ),
          '/inventory?device=' || d.id
        );
      END LOOP;
    END IF;

    -- Find primary client contact for email notification
    SELECT * INTO client_contact
    FROM public.client_contacts
    WHERE client_id = d.client_id
    ORDER BY
      CASE WHEN role = 'Principal' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1;

    -- Note: actual email sending is handled by the application layer
    -- This function records the notification intent; the email system
    -- picks up notifications of type 'device_status_changed' with warranty context

    -- Mark as notified for this expiry date
    UPDATE public.devices
    SET warranty_expiry_notified_for = d.warranty_expiry_date
    WHERE id = d.id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_warranty_expiry_alerts() FROM public, anon, authenticated;

-- ── Function: sync_azure_ad_device ──

CREATE OR REPLACE FUNCTION public.sync_azure_ad_device(
  _azure_ad_device_id text,
  _hostname text,
  _os text,
  _assigned_to text
)
RETURNS SETOF public.devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  matched_device devices%ROWTYPE;
BEGIN
  -- Try matching by azure_ad_device_id first
  SELECT * INTO matched_device
  FROM public.devices
  WHERE azure_ad_device_id = _azure_ad_device_id
    AND _azure_ad_device_id IS NOT NULL;

  -- Fallback: match by hostname
  IF matched_device.id IS NULL AND _hostname IS NOT NULL THEN
    SELECT * INTO matched_device
    FROM public.devices
    WHERE hostname = _hostname;
  END IF;

  -- If found, update sync data
  IF matched_device.id IS NOT NULL THEN
    UPDATE public.devices
    SET os = COALESCE(NULLIF(_os, ''), devices.os),
        assigned_to = COALESCE(NULLIF(_assigned_to, ''), devices.assigned_to),
        hostname = COALESCE(NULLIF(_hostname, ''), devices.hostname),
        azure_ad_device_id = COALESCE(_azure_ad_device_id, devices.azure_ad_device_id),
        last_ad_sync_at = now(),
        updated_at = now()
    WHERE id = matched_device.id;

    -- Return updated device
    RETURN QUERY SELECT * FROM public.devices WHERE id = matched_device.id;
  END IF;

  -- If no match, return empty set (no auto-creation)
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_azure_ad_device(text, text, text, text) FROM public, anon, authenticated;

-- ── pg_cron scheduling ──

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    -- Weekly deprecation check (every Monday at 7:00)
    PERFORM cron.unschedule('device-deprecation-weekly');
    PERFORM cron.schedule(
      'device-deprecation-weekly',
      '0 7 * * 1',
      'SELECT public.evaluate_device_deprecation();'
    );

    -- Weekly warranty expiry alerts (every Monday at 8:00, after deprecation)
    PERFORM cron.unschedule('warranty-expiry-alerts-weekly');
    PERFORM cron.schedule(
      'warranty-expiry-alerts-weekly',
      '0 8 * * 1',
      'SELECT public.send_warranty_expiry_alerts();'
    );
  END IF;
END;
$$;
