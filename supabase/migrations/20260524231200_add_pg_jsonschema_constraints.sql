-- Migration: Add JSON validation to automation_flows using native CHECK constraints
-- Created: 2026-05-24
-- Alternative approach: Uses native JSONB operators instead of pg_jsonschema extension

-- Add check constraint for trigger_definition type validation
-- Supports both DSL types (sla_due, warranty_due) and legacy types (sla_warning, warranty_expiring_soon)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_trigger_definition_type' 
        AND conrelid = 'automation_flows'::regclass
    ) THEN
        ALTER TABLE automation_flows
        ADD CONSTRAINT chk_trigger_definition_type
        CHECK (
            trigger_definition IS NULL OR
            (
                trigger_definition ? 'type' AND
                trigger_definition->>'type' IN (
                    'ticket_created',
                    'ticket_updated',
                    'sla_warning',
                    'sla_due',
                    'warranty_expiring_soon',
                    'warranty_due',
                    'scheduled'
                )
            )
        );
    END IF;
END $$;

-- Add check constraint for actions_definition type validation
-- Validates that each action in the array has a valid type
-- Supports both DSL types (update_ticket) and legacy types (update_ticket_status)
-- Uses a custom validation function
CREATE OR REPLACE FUNCTION validate_action_types(actions jsonb)
RETURNS boolean AS $$
DECLARE
    action jsonb;
    action_type text;
    valid_types text[] := ARRAY[
        'send_email',
        'update_ticket_status',
        'update_ticket',
        'add_comment',
        'create_ticket',
        'create_notification',
        'assign_ticket',
        'update_device_status',
        'update_device'
    ];
BEGIN
    -- Check if array has at least one item
    IF jsonb_array_length(actions) < 1 THEN
        RETURN false;
    END IF;
    
    -- Validate each action has a valid type
    FOR action IN SELECT * FROM jsonb_array_elements(actions)
    LOOP
        action_type := action->>'type';
        IF action_type IS NULL OR NOT (action_type = ANY(valid_types)) THEN
            RETURN false;
        END IF;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_actions_definition_types' 
        AND conrelid = 'automation_flows'::regclass
    ) THEN
        ALTER TABLE automation_flows
        ADD CONSTRAINT chk_actions_definition_types
        CHECK (
            actions_definition IS NULL OR
            validate_action_types(actions_definition)
        );
    END IF;
END $$;

-- Add helpful comments explaining constraints (only if constraints exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_trigger_definition_type' 
        AND conrelid = 'automation_flows'::regclass
    ) THEN
        COMMENT ON CONSTRAINT chk_trigger_definition_type ON automation_flows IS 
            'Validates that trigger_definition.type is one of the allowed trigger types (DSL: sla_due, warranty_due; Legacy: sla_warning, warranty_expiring_soon)';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_actions_definition_types' 
        AND conrelid = 'automation_flows'::regclass
    ) THEN
        COMMENT ON CONSTRAINT chk_actions_definition_types ON automation_flows IS 
            'Validates that all actions in actions_definition have valid action types (DSL: update_ticket; Legacy: update_ticket_status)';
    END IF;
END $$;

-- NOTES:
-- 1) Extension pg_jsonschema must be enabled via Supabase Dashboard (Database > Extensions) or SQL
-- 2) Constraints accept NULL values for backward compatibility with existing records
-- 3) Both DSL and legacy type names are supported for smooth migration
-- 4) jsonb_matches_schema returns true if schema is valid, false otherwise
-- 5) Violations will raise: ERROR: new row for relation "automation_flows" violates check constraint "chk_..."
