-- Migration: Add server-side validation for automation_flows
-- Created: 2026-05-04

BEGIN;

-- Function to validate flow_definition JSON
CREATE OR REPLACE FUNCTION validate_automation_flow_json() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fd jsonb := NEW.flow_definition;
  has_wizard boolean := (fd ? 'wizard');
  has_nodes boolean := (fd ? 'nodes');
  trigger_exists boolean := false;
  action_exists boolean := false;
  node jsonb;
BEGIN
  IF has_wizard THEN
    IF NOT (fd -> 'wizard' ? 'trigger_definition') THEN
      RAISE EXCEPTION 'validation_error: wizard.trigger_definition missing';
    END IF;
    IF NOT (fd -> 'wizard' ? 'actions_definition') OR jsonb_array_length(fd -> 'wizard' -> 'actions_definition') = 0 THEN
      RAISE EXCEPTION 'validation_error: wizard.actions_definition missing or empty';
    END IF;
    RETURN NEW;
  END IF;

  IF has_nodes THEN
    FOR node IN SELECT * FROM jsonb_array_elements(fd -> 'nodes') LOOP
      IF (node ->> 'type') = 'trigger' THEN
        trigger_exists := true;
      END IF;
      IF (node ->> 'type') = 'action' THEN
        action_exists := true;
      END IF;
    END LOOP;
    IF NOT trigger_exists THEN
      RAISE EXCEPTION 'validation_error: no trigger node found in nodes';
    END IF;
    IF NOT action_exists THEN
      RAISE EXCEPTION 'validation_error: no action node found in nodes';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'validation_error: flow_definition must contain either wizard or nodes';
END;
$$;

-- Trigger that calls validation on insert/update
CREATE TRIGGER trg_validate_automation_flow BEFORE INSERT OR UPDATE ON automation_flows
FOR EACH ROW EXECUTE FUNCTION validate_automation_flow_json();

COMMIT;
