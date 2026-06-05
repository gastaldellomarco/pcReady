# SLA Tracking System

<cite>
**Referenced Files in This Document**
- [20260516120000_ticket_sla_tracking.sql](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql)
- [pcready.ts](file://src/lib/pcready.ts)
- [tickets.tsx](file://src/routes/_app/tickets.tsx)
- [AdminSettingsTab.tsx](file://src/components/admin/AdminSettingsTab.tsx)
- [app-settings.ts](file://src/lib/app-settings.ts)
- [TicketTimeTracking.tsx](file://src/components/tickets/TicketTimeTracking.tsx)
- [CriticalEventsWidget.tsx](file://src/components/dashboard/CriticalEventsWidget.tsx)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Core SLA Components](#core-sla-components)
5. [Frontend Implementation](#frontend-implementation)
6. [Administration Interface](#administration-interface)
7. [SLA Calculation Logic](#sla-calculation-logic)
8. [Integration Points](#integration-points)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Conclusion](#conclusion)

## Introduction

The SLA (Service Level Agreement) Tracking System is a comprehensive solution integrated into the ticketing platform that monitors and manages service level compliance for customer support tickets. This system automatically calculates deadlines, tracks response times, and provides real-time visibility into SLA compliance across different ticket priorities.

The system consists of three main components: database-level triggers and functions that handle automatic SLA calculations, backend logic for managing SLA configurations, and frontend components that display SLA status to users. It supports configurable SLA policies with different response and resolution targets for high, medium, and low priority tickets.

## System Architecture

The SLA Tracking System follows a multi-layered architecture with clear separation of concerns:

```mermaid
graph TB
subgraph "Database Layer"
DB[(PostgreSQL Database)]
TRIG[SLA Trigger Functions]
IDX[SLA Indexes]
CFG[SLA Configuration]
end
subgraph "Application Layer"
API[Ticket API]
SRV[SLA Computation Service]
CFGM[Configuration Manager]
end
subgraph "Frontend Layer"
UI[SLA Badge Component]
WIDGET[Critical Events Widget]
SETTINGS[Admin Settings Panel]
end
subgraph "External Services"
CRON[Scheduled Jobs]
EMAIL[Email Notifications]
end
DB --> TRIG
TRIG --> IDX
DB --> CFG
API --> SRV
SRV --> DB
CFGM --> DB
UI --> SRV
WIDGET --> DB
SETTINGS --> CFGM
CRON --> DB
EMAIL --> DB
```

**Diagram sources**

- [20260516120000_ticket_sla_tracking.sql:1-146](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L1-L146)
- [pcready.ts:307-333](file://src/lib/pcready.ts#L307-L333)
- [tickets.tsx:1081-1127](file://src/routes/_app/tickets.tsx#L1081-L1127)

## Database Schema

The SLA tracking system extends the tickets table with several key columns that enable automated SLA monitoring:

```mermaid
erDiagram
TICKETS {
uuid id PK
string ticket_code UK
uuid client_id FK
uuid device_id FK
enum priority
enum status
timestamptz created_at
timestamptz updated_at
timestamptz due_date
timestamptz sla_deadline
boolean sla_breached
timestamptz sla_response_at
}
APP_SETTINGS {
string key PK
jsonb value
}
TICKETS ||--o{ CLIENTS : "client_id"
TICKETS ||--o{ DEVICES : "device_id"
APP_SETTINGS ||--|| APP_SETTINGS : "sla_config"
APP_SETTINGS ||--|| APP_SETTINGS : "sla_limits"
```

**Diagram sources**

- [20260516120000_ticket_sla_tracking.sql:3-7](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L3-L7)
- [20260516120000_ticket_sla_tracking.sql:17-21](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L17-L21)

The database schema includes:

- **due_date**: Manual override for SLA deadlines set by staff/administrators
- **sla_deadline**: Automatic calculation of resolution deadlines based on priority and configuration
- **sla_breached**: Boolean flag indicating SLA violations
- **sla_response_at**: Timestamp of first response or assignment
- **Indexes**: Optimized queries for active tickets and breach detection

**Section sources**

- [20260516120000_ticket_sla_tracking.sql:3-15](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L3-L15)

## Core SLA Components

### SLA Configuration Management

The system maintains SLA configurations through the application settings table, supporting both legacy and modern configuration formats:

```mermaid
classDiagram
class SlaConfig {
+high : SlaPriorityConfig
+med : SlaPriorityConfig
+low : SlaPriorityConfig
}
class SlaPriorityConfig {
+responseHours : number
+resolutionHours : number
}
class AppSettings {
+sla_config : SlaConfig
+sla_limits : SlaLimits
+getAppSettings()
+updateAppSettings()
}
class SlaComputation {
+computeSlaStatus()
+formatSlaCountdown()
+slaConfigToLimits()
}
AppSettings --> SlaConfig : "manages"
SlaComputation --> SlaConfig : "uses"
SlaComputation --> SlaPriorityConfig : "calculates"
```

**Diagram sources**

- [pcready.ts:13-37](file://src/lib/pcready.ts#L13-L37)
- [app-settings.ts:27-46](file://src/lib/app-settings.ts#L27-L46)

### Database Trigger System

The SLA logic is implemented through PostgreSQL triggers that automatically calculate and update SLA fields:

```mermaid
sequenceDiagram
participant Client as "Client Application"
participant DB as "PostgreSQL Database"
participant Trigger as "set_ticket_sla_fields()"
participant Function as "get_sla_resolution_hours()"
Client->>DB : INSERT/UPDATE tickets
DB->>Trigger : BEFORE INSERT/UPDATE
Trigger->>Function : Calculate resolution hours
Function-->>Trigger : Return hours based on priority
Trigger->>Trigger : Calculate sla_deadline
Trigger->>Trigger : Check response conditions
Trigger->>Trigger : Set sla_breached flag
Trigger-->>DB : Updated ticket record
DB-->>Client : Operation complete
```

**Diagram sources**

- [20260516120000_ticket_sla_tracking.sql:61-104](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L61-L104)

**Section sources**

- [20260516120000_ticket_sla_tracking.sql:23-97](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L23-L97)

## Frontend Implementation

### SLA Badge Component

The frontend displays SLA status through a comprehensive badge component that shows real-time SLA information:

```mermaid
classDiagram
class SlaBadge {
+created_at : string
+priority : TicketPriority
+slaLimits? : SlaLimits
+deadline? : string | null
+breached? : boolean | null
+computeSlaStatus()
+renderBadge()
}
class SlaStatus {
+status : "ok" | "warning" | "overdue"
+limitHours : number
+deadline : Date
+remainingMs : number
}
class TimeOpenBadge {
+created_at : string
+priority : TicketPriority
+slaLimits? : SlaLimits
+formatOpenDuration()
}
SlaBadge --> SlaStatus : "computes"
TimeOpenBadge --> SlaStatus : "formats"
```

**Diagram sources**

- [tickets.tsx:1081-1127](file://src/routes/_app/tickets.tsx#L1081-L1127)
- [pcready.ts:307-333](file://src/lib/pcready.ts#L307-L333)

The SLA badge component provides three visual states:

- **Green (OK)**: SLA within acceptable limits
- **Yellow (Warning)**: SLA approaching deadline (20% of total SLA time remaining)
- **Red (Overdue)**: SLA violation detected

**Section sources**

- [tickets.tsx:1081-1187](file://src/routes/_app/tickets.tsx#L1081-L1187)
- [pcready.ts:307-364](file://src/lib/pcready.ts#L307-L364)

## Administration Interface

### SLA Configuration Panel

Administrators can configure SLA parameters through an intuitive settings interface:

| Priority Level | Response Hours | Resolution Hours |
| -------------- | -------------- | ---------------- |
| High           | 1 hour         | 4 hours          |
| Medium         | 4 hours        | 24 hours         |
| Low            | 24 hours       | 72 hours         |

The configuration panel allows administrators to:

- Set response time targets for first response
- Configure resolution time targets for ticket completion
- Override default SLA values per priority level
- Apply changes immediately to new tickets

**Section sources**

- [AdminSettingsTab.tsx:390-430](file://src/components/admin/AdminSettingsTab.tsx#L390-L430)
- [app-settings.ts:302-328](file://src/lib/app-settings.ts#L302-L328)

## SLA Calculation Logic

### Core Algorithm

The SLA computation follows a sophisticated algorithm that considers multiple factors:

```mermaid
flowchart TD
Start([SLA Computation Start]) --> GetConfig["Get SLA Configuration"]
GetConfig --> CalcDeadline["Calculate Deadline"]
CalcDeadline --> CheckOverride{"Due Date Override?"}
CheckOverride --> |Yes| UseDueDate["Use Manual Due Date"]
CheckOverride --> |No| UseAutoCalc["Use Auto-Calculation"]
UseAutoCalc --> CalcFromPriority["Calculate from Priority + Created At"]
UseDueDate --> ValidateDueDate["Validate Due Date"]
CalcFromPriority --> CompareTimes["Compare with Current Time"]
ValidateDueDate --> CompareTimes
CompareTimes --> CheckStatus{"Remaining Time < 0?"}
CheckStatus --> |Yes| MarkOverdue["Mark as Overdue"]
CheckStatus --> |No| CheckWarning{"Remaining < 20% SLA?"}
CheckWarning --> |Yes| MarkWarning["Mark as Warning"]
CheckWarning --> |No| MarkOK["Mark as OK"]
MarkOverdue --> End([SLA Status Returned])
MarkWarning --> End
MarkOK --> End
```

**Diagram sources**

- [pcready.ts:307-333](file://src/lib/pcready.ts#L307-L333)

### Database-Level Calculations

The PostgreSQL functions handle critical SLA calculations:

1. **get_sla_resolution_hours()**: Retrieves resolution hours from configuration
2. **set_ticket_sla_fields()**: Trigger function that updates SLA fields
3. **refresh_ticket_sla_breaches()**: Batch job for updating breach status

**Section sources**

- [20260516120000_ticket_sla_tracking.sql:23-125](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L23-L125)

## Integration Points

### Real-Time Updates

The system integrates with various platform components:

```mermaid
graph LR
subgraph "Real-Time Components"
BADGE[SLA Badge]
WIDGET[Critical Events Widget]
TIME[Time Tracking]
DASHBOARD[Dashboard Widgets]
end
subgraph "Background Processes"
TRIGGER[Database Triggers]
CRON[Scheduled Jobs]
AUDIT[Audit Logging]
end
subgraph "External Systems"
EMAIL[Email Templates]
NOTIFICATIONS[Notification System]
end
BADGE --> TRIGGER
WIDGET --> TRIGGER
TIME --> TRIGGER
DASHBOARD --> TRIGGER
TRIGGER --> CRON
TRIGGER --> AUDIT
CRON --> EMAIL
CRON --> NOTIFICATIONS
```

**Diagram sources**

- [CriticalEventsWidget.tsx:69-95](file://src/components/dashboard/CriticalEventsWidget.tsx#L69-L95)
- [TicketTimeTracking.tsx:1-231](file://src/components/tickets/TicketTimeTracking.tsx#L1-L231)

### Dashboard Integration

SLA status is prominently featured in dashboard widgets:

- **Critical Events Widget**: Highlights tickets with SLA violations
- **Overdue Tickets Widget**: Shows tickets exceeding SLA deadlines
- **SLA Compliance Metrics**: Provides organization-wide SLA performance indicators

**Section sources**

- [CriticalEventsWidget.tsx:69-95](file://src/components/dashboard/CriticalEventsWidget.tsx#L69-L95)

## Performance Considerations

### Database Optimization

The SLA system includes several performance optimizations:

- **Index Strategy**: Separate indexes for active tickets and breach detection
- **Trigger Efficiency**: Minimal computational overhead during insert/update operations
- **Batch Processing**: Scheduled jobs for bulk SLA breach updates
- **Caching**: Client-side caching of SLA configurations

### Scalability Features

- **Partitioning**: Active vs. archived tickets separated for query optimization
- **Asynchronous Processing**: Background jobs for heavy computations
- **Configuration Caching**: Reduced database load through client-side caching
- **Efficient Queries**: Optimized indexes for common SLA-related queries

## Troubleshooting Guide

### Common Issues

**SLA Not Updating**

- Verify database trigger is active
- Check application settings configuration
- Ensure proper indexing exists

**Incorrect SLA Calculations**

- Validate SLA configuration values
- Check timezone settings
- Review ticket creation timestamps

**Performance Issues**

- Monitor database query performance
- Check index utilization
- Review scheduled job execution

### Diagnostic Commands

```sql
-- Check SLA trigger status
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'tickets_sla_fields';

-- Verify SLA configuration
SELECT key, value FROM app_settings WHERE key LIKE 'sla%';

-- Test SLA calculation
SELECT get_sla_resolution_hours('high'::ticket_priority);
```

**Section sources**

- [20260516120000_ticket_sla_tracking.sql:106-125](file://supabase/migrations/20260516120000_ticket_sla_tracking.sql#L106-L125)

## Conclusion

The SLA Tracking System provides a robust, configurable solution for monitoring and managing service level agreements within the ticketing platform. Its multi-layered architecture ensures reliable SLA enforcement while maintaining excellent performance and user experience.

Key benefits include:

- **Automated SLA Management**: Reduces manual oversight requirements
- **Flexible Configuration**: Supports various SLA policies across different ticket types
- **Real-Time Visibility**: Provides immediate feedback on SLA compliance
- **Administrative Control**: Allows fine-tuned SLA policy management
- **Performance Optimization**: Minimizes impact on system performance

The system successfully balances automation with flexibility, providing administrators with powerful tools to maintain high service standards while ensuring operational efficiency.
