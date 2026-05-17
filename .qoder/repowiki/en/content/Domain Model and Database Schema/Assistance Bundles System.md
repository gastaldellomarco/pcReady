# Assistance Bundles System

<cite>
**Referenced Files in This Document**
- [bundles.ts](file://src/lib/bundles.ts)
- [BundleForms.tsx](file://src/components/bundles/BundleForms.tsx)
- [BundleBadges.tsx](file://src/components/bundles/BundleBadges.tsx)
- [bundles.tsx](file://src/routes/_app/bundles.tsx)
- [20260526120000_assistance_bundles.sql](file://supabase/migrations/20260526120000_assistance_bundles.sql)
- [routeTree.gen.ts](file://src/routeTree.gen.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Database Schema](#database-schema)
5. [User Interface Components](#user-interface-components)
6. [Business Logic Implementation](#business-logic-implementation)
7. [Integration Points](#integration-points)
8. [Usage Workflows](#usage-workflows)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Conclusion](#conclusion)

## Introduction

The Assistance Bundles System is a comprehensive solution for managing service packages and support contracts within the PCReady platform. This system enables organizations to offer different tiers of technical support services to their clients, track usage consumption, manage billing cycles, and automate SLA enforcement based on purchased service packages.

The system provides four distinct service tiers: Base, Standard, Premium, and Enterprise, each with different capabilities, pricing structures, and service level agreements. It seamlessly integrates with the ticketing system to automatically apply service package benefits when new tickets are created.

## System Architecture

The Assistance Bundles System follows a modern React-based architecture with Supabase backend services:

```mermaid
graph TB
subgraph "Frontend Layer"
UI[User Interface]
Forms[Form Components]
Badges[Badge Components]
Routes[Route Handlers]
end
subgraph "Application Layer"
Hooks[React Query Hooks]
Services[Business Logic Services]
Utils[Utility Functions]
end
subgraph "Data Layer"
Supabase[Supabase Client]
Database[(PostgreSQL Database)]
end
subgraph "Database Layer"
Tables[Core Tables]
Views[Materialized Views]
Functions[Stored Procedures]
Triggers[Database Triggers]
end
UI --> Forms
UI --> Badges
UI --> Routes
Routes --> Hooks
Forms --> Services
Badges --> Services
Hooks --> Supabase
Services --> Supabase
Supabase --> Database
Database --> Tables
Database --> Views
Database --> Functions
Database --> Triggers
```

**Diagram sources**
- [bundles.ts:1-449](file://src/lib/bundles.ts#L1-L449)
- [BundleForms.tsx:1-643](file://src/components/bundles/BundleForms.tsx#L1-L643)
- [BundleBadges.tsx:1-85](file://src/components/bundles/BundleBadges.tsx#L1-L85)
- [bundles.tsx:1-1014](file://src/routes/_app/bundles.tsx#L1-L1014)

## Core Components

### Data Models and Types

The system defines comprehensive TypeScript interfaces for all bundle-related entities:

```mermaid
classDiagram
class AssistanceBundle {
+string id
+string name
+string description
+BundleBillingType billing_type
+number fee
+string currency
+number included_hours
+number extra_hourly_rate
+number sla_response_hours
+number sla_resolution_hours
+number included_onsite_visits
+boolean remote_support
+BundleTicketPriority ticket_priority
+boolean auto_renew
+boolean active
+string created_at
+string updated_at
+string created_by
}
class ClientBundleAssignment {
+string id
+string client_id
+string bundle_id
+BundleStatus status
+string start_date
+string end_date
+boolean auto_renew
+string renewal_mode
+number custom_fee
+number custom_included_hours
+number custom_extra_hourly_rate
+number custom_sla_response_hours
+number custom_sla_resolution_hours
+number custom_included_onsite_visits
+string notes
+string created_at
+string updated_at
+string created_by
+AssistanceBundle bundle
+BundleClient client
}
class BundleUsageSummary {
+string client_bundle_assignment_id
+string assignment_id
+string client_id
+string bundle_id
+BundleStatus status
+string start_date
+string end_date
+number effective_fee
+number effective_included_hours
+number effective_extra_hourly_rate
+number effective_sla_response_hours
+number effective_sla_resolution_hours
+number effective_included_onsite_visits
+number used_hours
+number extra_hours
+number remaining_hours
+number onsite_visits
+number used_onsite_visits
+number remaining_onsite_visits
+number extra_amount
+number usage_percent
+string currency
+string bundle_name
+string client_name
+string company_name
}
class BundlePayment {
+string id
+string client_bundle_assignment_id
+string client_id
+number amount
+string currency
+string period_start
+string period_end
+string paid_at
+string status
+string notes
+string created_at
+string created_by
+ClientBundleAssignment assignment
+BundleClient client
}
class BundleUsageEntry {
+string id
+string client_bundle_assignment_id
+string client_id
+string ticket_id
+string time_entry_id
+string usage_type
+number used_hours
+number onsite_visits
+number extra_hours
+number extra_amount
+string description
+string used_at
+string created_at
+string created_by
}
```

**Diagram sources**
- [bundles.ts:8-128](file://src/lib/bundles.ts#L8-L128)

### Business Logic Services

The system provides comprehensive CRUD operations and business logic through dedicated service functions:

```mermaid
sequenceDiagram
participant Client as "Client Application"
participant Service as "Bundle Service"
participant Supabase as "Supabase Client"
participant Database as "PostgreSQL Database"
Client->>Service : createBundle(data)
Service->>Supabase : from("assistance_bundles").insert(data)
Supabase->>Database : INSERT INTO assistance_bundles
Database-->>Supabase : Inserted row
Supabase-->>Service : Bundle data
Service-->>Client : AssistanceBundle
Client->>Service : listClientBundleAssignments(clientId)
Service->>Supabase : from("client_bundle_assignments")
Supabase->>Database : SELECT with joins
Database-->>Supabase : Assignment data
Supabase-->>Service : ClientBundleAssignment[]
Service-->>Client : Assignment array
```

**Diagram sources**
- [bundles.ts:208-317](file://src/lib/bundles.ts#L208-L317)

**Section sources**
- [bundles.ts:1-449](file://src/lib/bundles.ts#L1-L449)

## Database Schema

The Assistance Bundles System utilizes a sophisticated PostgreSQL schema with multiple interconnected tables and views:

```mermaid
erDiagram
ASSISTANCE_BUNDLES {
uuid id PK
text name
text description
text billing_type
numeric fee
text currency
numeric included_hours
numeric extra_hourly_rate
numeric sla_response_hours
numeric sla_resolution_hours
integer included_onsite_visits
boolean remote_support
text ticket_priority
boolean auto_renew
boolean active
timestamptz created_at
timestamptz updated_at
uuid created_by
}
CLIENT_BUNDLE_ASSIGNMENTS {
uuid id PK
uuid client_id FK
uuid bundle_id FK
text status
date start_date
date end_date
boolean auto_renew
text renewal_mode
numeric custom_fee
numeric custom_included_hours
numeric custom_extra_hourly_rate
numeric custom_sla_response_hours
numeric custom_sla_resolution_hours
integer custom_included_onsite_visits
text notes
timestamptz created_at
timestamptz updated_at
uuid created_by
}
BUNDLE_USAGE_ENTRIES {
uuid id PK
uuid client_bundle_assignment_id FK
uuid client_id FK
uuid ticket_id FK
uuid time_entry_id FK
text usage_type
numeric used_hours
integer onsite_visits
numeric extra_hours
numeric extra_amount
text description
timestamptz used_at
timestamptz created_at
uuid created_by
}
BUNDLE_FEE_PAYMENTS {
uuid id PK
uuid client_bundle_assignment_id FK
uuid client_id FK
numeric amount
text currency
date period_start
date period_end
date paid_at
text status
text notes
timestamptz created_at
uuid created_by
}
TICKETS {
uuid id PK
uuid client_id FK
uuid bundle_assignment_id FK
numeric bundle_extra_hours
numeric bundle_extra_amount
boolean onsite_visit
timestamptz sla_response_due_at
timestamptz sla_resolution_due_at
}
ASSISTANCE_BUNDLES ||--o{ CLIENT_BUNDLE_ASSIGNMENTS : "has"
CLIENT_BUNDLE_ASSIGNMENTS ||--o{ BUNDLE_USAGE_ENTRIES : "generates"
CLIENT_BUNDLE_ASSIGNMENTS ||--o{ BUNDLE_FEE_PAYMENTS : "pays"
CLIENT_BUNDLE_ASSIGNMENTS ||--|| TICKETS : "applies_to"
BUNDLE_USAGE_ENTRIES ||--|| TICKETS : "tracks"
```

**Diagram sources**
- [20260526120000_assistance_bundles.sql:3-77](file://supabase/migrations/20260526120000_assistance_bundles.sql#L3-L77)

### Key Features of the Database Design

1. **Row Level Security**: All tables have RLS enabled with role-based access controls
2. **Active Bundle Management**: Automatic calculation of effective values through views
3. **Usage Tracking**: Comprehensive logging of all bundle consumption activities
4. **SLA Enforcement**: Automated SLA timestamps based on bundle priorities
5. **Trigger-Based Automation**: Real-time synchronization between tickets and usage

**Section sources**
- [20260526120000_assistance_bundles.sql:1-606](file://supabase/migrations/20260526120000_assistance_bundles.sql#L1-L606)

## User Interface Components

### Form Components

The system provides comprehensive form components for managing bundle configurations:

```mermaid
flowchart TD
BundleForm["BundleForm Component"] --> Validation["Form Validation"]
Validation --> StateManagement["State Management"]
StateManagement --> Submission["Submission Handler"]
Submission --> API["API Calls"]
AssignmentForm["AssignmentForm Component"] --> BundleSelection["Bundle Selection"]
BundleSelection --> ClientSelection["Client Selection"]
ClientSelection --> DateCalculation["Date Calculation"]
DateCalculation --> OverrideFields["Override Fields"]
OverrideFields --> Submission
StateManagement --> UnlimittedToggle["Unlimited Toggle"]
UnlimittedToggle --> DisabledField["Disable Field"]
```

**Diagram sources**
- [BundleForms.tsx:135-392](file://src/components/bundles/BundleForms.tsx#L135-L392)
- [BundleForms.tsx:394-642](file://src/components/bundles/BundleForms.tsx#L394-L642)

### Badge Components

Visual indicators for bundle status, priority, and usage:

```mermaid
classDiagram
class BundleStatusBadge {
+BundleStatus status
+render() Badge
}
class BundlePriorityBadge {
+BundleTicketPriority priority
+render() Badge
}
class BundleUsageBar {
+number used
+number total
+string label
+render() Progress Bar
}
class ColorScheme {
+Record~BundleStatus, Colors~ STATUS_COLORS
+Record~BundleTicketPriority, Colors~ PRIORITY_COLORS
+Record~UsageTone, string~ USAGE_COLORS
}
BundleStatusBadge --> ColorScheme
BundlePriorityBadge --> ColorScheme
BundleUsageBar --> ColorScheme
```

**Diagram sources**
- [BundleBadges.tsx:1-85](file://src/components/bundles/BundleBadges.tsx#L1-L85)

**Section sources**
- [BundleForms.tsx:1-643](file://src/components/bundles/BundleForms.tsx#L1-L643)
- [BundleBadges.tsx:1-85](file://src/components/bundles/BundleBadges.tsx#L1-L85)

## Business Logic Implementation

### Bundle Management Functions

The system implements sophisticated business logic for bundle lifecycle management:

```mermaid
flowchart TD
Start([Bundle Operation]) --> Type{"Operation Type"}
Type --> |Create| CreateBundle["createBundle()"]
Type --> |Update| UpdateBundle["updateBundle()"]
Type --> |List| ListBundles["listBundles()"]
Type --> |Deactivate| DeactivateBundle["deactivateBundle()"]
CreateBundle --> Validation["Validate Input"]
Validation --> SupabaseInsert["Supabase Insert"]
SupabaseInsert --> Invalidate["Invalidate Queries"]
UpdateBundle --> FindBundle["Find Existing Bundle"]
FindBundle --> SupabaseUpdate["Supabase Update"]
SupabaseUpdate --> Invalidate
ListBundles --> QueryBundles["Query Assistance Bundles"]
QueryBundles --> FilterInactive["Filter Inactive"]
FilterInactive --> ReturnBundles["Return Bundle Array"]
DeactivateBundle --> UpdateStatus["Set Active = False"]
UpdateStatus --> Invalidate
```

**Diagram sources**
- [bundles.ts:208-243](file://src/lib/bundles.ts#L208-L243)

### Usage Calculation Logic

The system automatically calculates usage metrics and determines consumption alerts:

```mermaid
flowchart TD
UsageEntry["Usage Entry"] --> CalculateUsed["Calculate Used Hours"]
CalculateUsed --> GetEffective["Get Effective Values"]
GetEffective --> CheckUnlimited{"Unlimited Hours?"}
CheckUnlimited --> |Yes| NoOverage["No Overage Calculation"]
CheckUnlimited --> |No| CalculateOverage["Calculate Overage"]
CalculateOverage --> ExtraHours["Calculate Extra Hours"]
ExtraHours --> ExtraAmount["Calculate Extra Amount"]
NoOverage --> SkipCalculation["Skip Overage"]
ExtraAmount --> LogEntry["Log Usage Entry"]
SkipCalculation --> LogEntry
LogEntry --> UpdateTicket["Update Ticket Extra Values"]
UpdateTicket --> RecalculateSummary["Recalculate Usage Summary"]
```

**Diagram sources**
- [20260526120000_assistance_bundles.sql:402-526](file://supabase/migrations/20260526120000_assistance_bundles.sql#L402-L526)

**Section sources**
- [bundles.ts:184-206](file://src/lib/bundles.ts#L184-L206)
- [bundles.ts:329-364](file://src/lib/bundles.ts#L329-L364)

## Integration Points

### Ticket System Integration

The system seamlessly integrates with the ticketing system through database triggers:

```mermaid
sequenceDiagram
participant Ticket as "Ticket Creation"
participant Trigger as "apply_bundle_to_ticket()"
participant Bundle as "Active Bundle Lookup"
participant TicketUpdate as "Ticket Update"
Ticket->>Trigger : INSERT/UPDATE client_id
Trigger->>Bundle : get_active_bundle_for_client()
Bundle-->>Trigger : Active Bundle Details
Trigger->>TicketUpdate : Apply Bundle Settings
TicketUpdate-->>Ticket : Updated Ticket with SLA & Priority
Note over Trigger,TicketUpdate : Automatic bundle application<br/>based on client's active subscription
```

**Diagram sources**
- [20260526120000_assistance_bundles.sql:354-400](file://supabase/migrations/20260526120000_assistance_bundles.sql#L354-L400)

### Route Integration

The bundles system is integrated into the main application routing:

```mermaid
graph LR
RouteTree["Route Tree Generation"] --> AppRoute["/_app Route"]
AppRoute --> BundlesRoute["/bundles Route"]
BundlesRoute --> Component["BundlesPage Component"]
Component --> QueryHooks["React Query Hooks"]
QueryHooks --> SupabaseAPI["Supabase API"]
SupabaseAPI --> Database["PostgreSQL Database"]
```

**Diagram sources**
- [routeTree.gen.ts:171-175](file://src/routeTree.gen.ts#L171-L175)

**Section sources**
- [bundles.tsx:1-1014](file://src/routes/_app/bundles.tsx#L1-L1014)
- [routeTree.gen.ts:1-200](file://src/routeTree.gen.ts#L1-L200)

## Usage Workflows

### Creating a New Bundle

The workflow for creating a new assistance bundle:

```mermaid
flowchart TD
Start([Start]) --> Navigate["Navigate to Bundles Page"]
Navigate --> ClickCreate["Click Create Bundle"]
ClickCreate --> FillForm["Fill Bundle Form"]
FillForm --> ValidateForm["Validate Form Data"]
ValidateForm --> Submit["Submit Form"]
Submit --> CallAPI["Call createBundle()"]
CallAPI --> UpdateUI["Update UI with Success"]
UpdateUI --> End([End])
ValidateForm --> |Invalid| ShowError["Show Error Message"]
ShowError --> FillForm
```

### Assigning Bundle to Client

The process for assigning a bundle to a client:

```mermaid
flowchart TD
Start([Start]) --> SelectClient["Select Client"]
SelectClient --> SelectBundle["Select Bundle"]
SelectBundle --> EnterDates["Enter Start/End Dates"]
EnterDates --> AutoRenew["Configure Auto Renew"]
AutoRenew --> OverrideSettings["Apply Custom Overrides"]
OverrideSettings --> Submit["Submit Assignment"]
Submit --> CallAPI["Call createClientBundleAssignment()"]
CallAPI --> Success["Show Success Message"]
Success --> End([End])
```

### Monitoring Usage

The usage monitoring workflow:

```mermaid
flowchart TD
Start([Start]) --> ViewUsage["View Usage Tab"]
ViewUsage --> LoadData["Load Usage Summaries"]
LoadData --> DisplayBars["Display Usage Bars"]
DisplayBars --> CheckAlerts["Check for Alerts"]
CheckAlerts --> AlertHigh["High Usage Alert"]
CheckAlerts --> AlertNormal["Normal Usage"]
AlertHigh --> ShowWarning["Show Warning Badge"]
AlertNormal --> ShowOK["Show OK Status"]
ShowWarning --> End([End])
ShowOK --> End
```

## Performance Considerations

### Database Optimization

The system implements several performance optimization strategies:

1. **Indexing Strategy**: Strategic indexing on frequently queried columns
2. **Materialized Views**: Pre-calculated views for usage summaries
3. **Trigger-Based Updates**: Real-time calculations without manual refresh
4. **Query Optimization**: Efficient queries with proper filtering

### Frontend Performance

1. **React Query Caching**: Automatic caching and invalidation
2. **Lazy Loading**: Conditional loading of expensive components
3. **Memoization**: Optimized rendering with useMemo and useCallback
4. **Batch Operations**: Efficient bulk data operations

### Scalability Considerations

1. **Database Partitioning**: Potential for partitioning large usage tables
2. **Caching Layers**: Redis caching for frequently accessed bundle data
3. **API Rate Limiting**: Built-in rate limiting for API endpoints
4. **Pagination**: Support for large datasets through pagination

## Troubleshooting Guide

### Common Issues and Solutions

#### Bundle Creation Failures
- **Issue**: Bundle creation fails with validation errors
- **Solution**: Verify required fields are filled and numeric values are positive
- **Prevention**: Implement client-side validation before submission

#### Usage Tracking Not Working
- **Issue**: Bundle usage not updating after time entries
- **Solution**: Check database trigger permissions and function execution
- **Debugging**: Verify `sync_bundle_usage_from_time_entry()` trigger is active

#### SLA Not Applied to Tickets
- **Issue**: New tickets don't inherit bundle SLA settings
- **Solution**: Ensure `apply_bundle_to_ticket()` trigger is functioning
- **Verification**: Check `get_active_bundle_for_client()` function returns results

#### Performance Issues
- **Issue**: Slow loading of bundle data
- **Solution**: Check database indexes and optimize queries
- **Monitoring**: Use database query plans to identify bottlenecks

### Error Handling Patterns

The system implements comprehensive error handling:

```mermaid
flowchart TD
APIError["API Error Occurs"] --> CheckError["Check Error Type"]
CheckError --> |Network| ShowNetworkError["Show Network Error"]
CheckError --> |Validation| ShowValidationError["Show Validation Error"]
CheckError --> |Authorization| ShowAuthError["Show Authorization Error"]
CheckError --> |Server| ShowServerError["Show Server Error"]
ShowNetworkError --> Retry["Offer Retry Option"]
ShowValidationError --> FixForm["Guide User to Fix Form"]
ShowAuthError --> Redirect["Redirect to Login"]
ShowServerError --> ContactSupport["Contact Support"]
Retry --> CheckError
FixForm --> CheckError
Redirect --> CheckError
ContactSupport --> CheckError
```

**Section sources**
- [bundles.ts:366-448](file://src/lib/bundles.ts#L366-L448)
- [bundles.tsx:181-274](file://src/routes/_app/bundles.tsx#L181-L274)

## Conclusion

The Assistance Bundles System represents a comprehensive solution for managing service packages and support contracts within the PCReady platform. Its architecture combines modern frontend development practices with robust backend database design to provide:

1. **Complete Bundle Management**: Full lifecycle management of service packages
2. **Automated SLA Enforcement**: Automatic application of service level agreements
3. **Real-time Usage Tracking**: Live monitoring of bundle consumption
4. **Flexible Billing Integration**: Seamless integration with payment systems
5. **Role-Based Access Control**: Secure multi-user environment
6. **Performance Optimization**: Efficient database design and frontend caching

The system's modular design allows for easy extension and customization while maintaining data integrity and user experience. The combination of database triggers, materialized views, and React Query ensures both real-time responsiveness and optimal performance.

Future enhancements could include advanced reporting capabilities, automated renewal workflows, and integration with external billing systems for expanded functionality.