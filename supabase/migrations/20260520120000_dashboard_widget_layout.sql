-- Migration: Add dashboard_layout JSONB column to user_profiles
-- Created: 2026-05-20

alter table public.user_profiles
add column if not exists dashboard_layout jsonb;

-- Set default layout for existing rows
update public.user_profiles
set dashboard_layout = '{
  "widgets": [
    {"id": "stat-cards", "order": 0, "visible": true},
    {"id": "analytics-card", "order": 1, "visible": true},
    {"id": "devices-without-ticket", "order": 2, "visible": true},
    {"id": "tickets-without-device", "order": 3, "visible": true},
    {"id": "trend-chart", "order": 4, "visible": true},
    {"id": "recent-tickets", "order": 5, "visible": true},
    {"id": "status-distribution", "order": 6, "visible": true},
    {"id": "technician-heatmap", "order": 7, "visible": true},
    {"id": "recent-activity", "order": 8, "visible": true},
    {"id": "overdue-tickets", "order": 9, "visible": true},
    {"id": "team-activity", "order": 10, "visible": true},
    {"id": "technician-stats", "order": 11, "visible": false},
    {"id": "critical-events", "order": 12, "visible": true}
  ]
}'::jsonb
where dashboard_layout is null;
