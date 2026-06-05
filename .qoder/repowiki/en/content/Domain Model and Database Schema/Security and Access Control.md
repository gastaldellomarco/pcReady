# Security and Access Control

<cite>
**Referenced Files in This Document**
- [auth-middleware.ts](file://src/integrations/supabase/auth-middleware.ts)
- [auth-context.tsx](file://src/lib/auth-context.tsx)
- [admin-users.server.ts](file://src/lib/admin-users.server.ts)
- [admin-users.ts](file://src/lib/admin-users.ts)
- [technicians.ts](file://src/lib/technicians.ts)
- [tickets.ts](file://src/lib/tickets.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [database.types.ts](file://src/types/database.types.ts)
- [staff-auth.server.ts](file://src/lib/server/staff-auth.server.ts)
- [20260430143000_admin_user_management_rls.sql](file://supabase/migrations/20260430143000_admin_user_management_rls.sql)
- [20260504170000_add_rls_policies_automation_flows.sql](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql)
- [20260514210000_tickets_tech_delete_policy.sql](file://supabase/migrations/20260514210000_tickets_tech_delete_policy.sql)
- [20260514182000_realtime_replica_identity_core_tables.sql](file://supabase/migrations/20260514182000_realtime_replica_identity_core_tables.sql)
- [20260515160000_automation_runs_view.sql](file://supabase/migrations/20260515160000_automation_runs_view.sql)
- [20260521205713_auth_failed_attempts.sql](file://supabase/migrations/20260521205713_auth_failed_attempts.sql)
- [20260505000000_patch_idempotent.sql](file://supabase/migrations/20260505000000_patch_idempotent.sql)
</cite>

## Update Summary

**Changes Made**

- Added comprehensive authentication audit trail system documentation
- Documented new auth_failed_attempts table with failed login tracking capabilities
- Updated security monitoring and threat detection procedures
- Enhanced authentication failure handling and logging mechanisms
- Added database schema and RLS policy coverage for audit trail system

## Table of Contents

1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Authentication Audit Trail System](#authentication-audit-trail-system)
7. [Dependency Analysis](#dependency-analysis)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)
11. [Appendices](#appendices)

## Introduction

This document explains PCReady's security model and access control mechanisms. It covers:

- Role-based access control (RBAC) with roles used in the frontend and backend
- Supabase Row Level Security (RLS) policies across key tables
- Customer isolation and data access boundaries
- Authentication middleware, session management, and token validation
- Integration between user roles, customer associations, and permissions
- **NEW**: Comprehensive authentication audit trail system with failed login tracking
- Practical policy configurations and common access control scenarios
- Security best practices and compliance considerations

## Project Structure

PCReady integrates Supabase for authentication and authorization, with client-side React components and server-side TanStack Start server functions. The security model spans:

- Frontend authentication context and role-aware UI
- Backend authentication middleware and admin enforcement
- Supabase RLS policies on tables and views
- RPC functions and views that enforce access rules
- **NEW**: Authentication audit trail system for monitoring and detecting suspicious activities

```mermaid
graph TB
subgraph "Frontend"
AC["AuthContext<br/>roles, profile, session"]
MW["Auth Middleware<br/>Bearer token validation"]
end
subgraph "Backend"
SF["Server Functions<br/>createServerFn handlers"]
ADM["Admin Enforcer<br/>requireAdmin"]
AUTH["Staff Auth<br/>Login with audit trail"]
end
subgraph "Supabase"
RLS["RLS Policies<br/>tables & views"]
RPC["RPC Functions<br/>has_role, get_user_role"]
VIEWS["Views<br/>automation_runs"]
AUDIT["Auth Audit Trail<br/>auth_failed_attempts"]
end
AC --> MW
MW --> SF
SF --> RLS
ADM --> RLS
AUTH --> AUDIT
RLS --> RPC
VIEWS --> RLS
```

**Diagram sources**

- [auth-context.tsx:1-173](file://src/lib/auth-context.tsx#L1-L173)
- [auth-middleware.ts:1-74](file://src/integrations/supabase/auth-middleware.ts#L1-L74)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [admin-users.ts:1-279](file://src/lib/admin-users.ts#L1-L279)
- [staff-auth.server.ts:1-87](file://src/lib/server/staff-auth.server.ts#L1-L87)
- [20260430143000_admin_user_management_rls.sql:1-13](file://supabase/migrations/20260430143000_admin_user_management_rls.sql#L1-L13)
- [20260504170000_add_rls_policies_automation_flows.sql:1-30](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L1-L30)
- [20260515160000_automation_runs_view.sql:1-30](file://supabase/migrations/20260515160000_automation_runs_view.sql#L1-L30)
- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)

**Section sources**

- [auth-context.tsx:1-173](file://src/lib/auth-context.tsx#L1-L173)
- [auth-middleware.ts:1-74](file://src/integrations/supabase/auth-middleware.ts#L1-L74)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [admin-users.ts:1-279](file://src/lib/admin-users.ts#L1-L279)
- [staff-auth.server.ts:1-87](file://src/lib/server/staff-auth.server.ts#L1-L87)
- [20260430143000_admin_user_management_rls.sql:1-13](file://supabase/migrations/20260430143000_admin_user_management_rls.sql#L1-L13)
- [20260504170000_add_rls_policies_automation_flows.sql:1-30](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L1-L30)
- [20260515160000_automation_runs_view.sql:1-30](file://supabase/migrations/20260515160000_automation_runs_view.sql#L1-L30)
- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)

## Core Components

- Authentication middleware validates Bearer tokens and injects user claims and user ID into server contexts.
- Auth context loads user profile, resolves app role via RPC, and exposes role-aware booleans for UI rendering.
- Admin server functions enforce admin-only access and delegate role checks to RPC functions.
- Supabase RLS policies govern table-level access for authenticated users, with explicit "own" rules and staff/admin allowances.
- Views encapsulate read-only access to operational logs with security invoker to enforce caller policies.
- **NEW**: Authentication audit trail system tracks failed login attempts with comprehensive metadata for security monitoring.

**Section sources**

- [auth-middleware.ts:7-74](file://src/integrations/supabase/auth-middleware.ts#L7-L74)
- [auth-context.tsx:52-94](file://src/lib/auth-context.tsx#L52-L94)
- [admin-users.server.ts:3-17](file://src/lib/admin-users.server.ts#L3-L17)
- [admin-users.ts:137-167](file://src/lib/admin-users.ts#L137-L167)
- [20260504170000_add_rls_policies_automation_flows.sql:6-25](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L6-L25)
- [20260515160000_automation_runs_view.sql:4-29](file://supabase/migrations/20260515160000_automation_runs_view.sql#L4-L29)
- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)

## Architecture Overview

The security architecture combines client-side session management, server-side middleware, and Supabase RLS. The flow below shows how a request moves from UI to database with enforced policies, including the new authentication audit trail system.

```mermaid
sequenceDiagram
participant UI as "Frontend UI"
participant Ctx as "AuthContext"
participant MW as "Auth Middleware"
participant SF as "Server Function"
participant AUTH as "Staff Auth Server"
participant SB as "Supabase"
participant RLS as "RLS Policies"
participant AUDIT as "Auth Audit Trail"
UI->>Ctx : "Load session and profile"
Ctx-->>UI : "Provide role-aware state"
UI->>MW : "Call protected route/handler"
MW->>SB : "Validate Bearer token"
SB-->>MW : "Claims with user_id"
MW->>SF : "Invoke handler with context"
SF->>SB : "Execute DB ops (RPC/SELECT/INSERT)"
SB->>RLS : "Enforce policies"
RLS-->>SB : "Allow/Deny"
SB-->>SF : "Result"
Note over AUTH,AUDIT : "Authentication Flow with Audit Trail"
AUTH->>SB : "Attempt login"
SB-->>AUTH : "Auth response"
ALT Login Failed
AUTH->>AUDIT : "Insert failed attempt record"
else Login Success
AUTH->>AUDIT : "Insert success record"
end
```

**Diagram sources**

- [auth-context.tsx:114-146](file://src/lib/auth-context.tsx#L114-L146)
- [auth-middleware.ts:7-74](file://src/integrations/supabase/auth-middleware.ts#L7-L74)
- [admin-users.ts:137-167](file://src/lib/admin-users.ts#L137-L167)
- [staff-auth.server.ts:29-77](file://src/lib/server/staff-auth.server.ts#L29-L77)
- [20260504170000_add_rls_policies_automation_flows.sql:6-25](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L6-L25)

## Detailed Component Analysis

### Authentication Middleware and Token Validation

- Validates presence of Supabase URL and publishable key
- Requires Authorization header with Bearer token
- Creates a Supabase client configured with the provided token
- Calls a claims endpoint to extract user ID and claims
- Injects user ID and claims into the server context for downstream handlers

```mermaid
flowchart TD
Start(["Enter Middleware"]) --> CheckEnv["Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY"]
CheckEnv --> EnvOK{"Both present?"}
EnvOK --> |No| Err500["Throw 500"]
EnvOK --> |Yes| GetHeader["Read Authorization header"]
GetHeader --> HasHeader{"Has Bearer token?"}
HasHeader --> |No| Err401a["Throw 401 Unauthorized"]
HasHeader --> |Yes| CreateClient["Create Supabase client with Bearer token"]
CreateClient --> Claims["Fetch claims for token"]
Claims --> ValidClaims{"Claims valid and include sub?"}
ValidClaims --> |No| Err401b["Throw 401 Invalid token"]
ValidClaims --> |Yes| Next["Call next with context (userId, claims)"]
```

**Diagram sources**

- [auth-middleware.ts:7-74](file://src/integrations/supabase/auth-middleware.ts#L7-L74)

**Section sources**

- [auth-middleware.ts:7-74](file://src/integrations/supabase/auth-middleware.ts#L7-L74)

### Session Management and Role Resolution

- Loads session and user from Supabase auth
- Concurrently fetches profile, user profile, and app role via RPC
- Normalizes display name and initials
- Exposes role-aware booleans for UI decisions (canEdit, isAdmin)

```mermaid
sequenceDiagram
participant S as "Supabase Auth"
participant C as "AuthContext"
participant DB as "Supabase DB"
S-->>C : "onAuthStateChange(session)"
C->>DB : "Select profiles WHERE id=uid"
C->>DB : "Select user_profiles WHERE id=uid"
C->>DB : "RPC get_user_role(_user_id=uid)"
DB-->>C : "Profile, user_profile, role"
C-->>S : "Set session, user, profile, role"
```

**Diagram sources**

- [auth-context.tsx:52-94](file://src/lib/auth-context.tsx#L52-L94)

**Section sources**

- [auth-context.tsx:43-166](file://src/lib/auth-context.tsx#L43-L166)

### Admin Access Control and Enforcement

- Admin-only server functions validate access tokens and enforce admin role via RPC
- Enforces constraints such as preventing removal of the last admin
- Provides user listing, updates, invitations, resends, disabling, and deletion

```mermaid
flowchart TD
Start(["Admin Server Fn"]) --> GetUser["Get user by access token"]
GetUser --> ValidUser{"User found?"}
ValidUser --> |No| Err401["Throw 401"]
ValidUser --> |Yes| HasRole["RPC has_role(uid, 'admin')"]
HasRole --> IsAdmin{"Is admin?"}
IsAdmin --> |No| Err403["Throw 403"]
IsAdmin --> |Yes| Proceed["Proceed with operation"]
```

**Diagram sources**

- [admin-users.server.ts:3-17](file://src/lib/admin-users.server.ts#L3-L17)
- [admin-users.ts:137-167](file://src/lib/admin-users.ts#L137-L167)

**Section sources**

- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [admin-users.ts:88-135](file://src/lib/admin-users.ts#L88-L135)
- [admin-users.ts:169-225](file://src/lib/admin-users.ts#L169-L225)
- [admin-users.ts:250-279](file://src/lib/admin-users.ts#L250-L279)

### RBAC Roles and Scope

- App roles surfaced in the frontend include admin, tech, and viewer
- Role resolution occurs via RPC and is used to gate UI and server operations
- Technician listing filters to users with roles admin or tech

**Section sources**

- [auth-context.tsx:13-35](file://src/lib/auth-context.tsx#L13-L35)
- [technicians.ts:10-33](file://src/lib/technicians.ts#L10-L33)
- [admin-users.ts:53](file://src/lib/admin-users.ts#L53)

### Supabase RLS Policies and Data Access Boundaries

- Profiles: Admins can read and update profiles
- Automation flows: Select allowed broadly; insert/update/delete restricted to owner (created_by/updated_by)
- Tickets: Deletion allowed for admins and techs
- Realtime: Core tables configured for full replica identity and realtime publication
- View automation_runs: Security invoker ensures caller policies apply when accessing run logs
- **NEW**: Activity log: Authenticated users can read logs; insert allowed for authenticated users

```mermaid
erDiagram
AUTOMATION_FLOWS {
uuid id PK
string name
string created_by
string updated_by
}
TICKETS {
uuid id PK
string client_id
string created_by
string assignee_id
}
CLIENTS {
uuid id PK
string name
}
ACTIVITY_LOG {
uuid id PK
string actor_id
string ticket_id
}
AUTH_FAILED_ATTEMPTS {
uuid id PK
string email
boolean success
jsonb payload
timestamptz created_at
}
AUTOMATION_RUNS_VIEW {
uuid id PK
uuid flow_id
string trigger
string status
}
CLIENTS ||--o{ TICKETS : "owns"
ACTIVITY_LOG }o--|| TICKETS : "references"
AUTOMATION_RUNS_VIEW ||--o{ AUTOMATION_FLOWS : "maps to"
AUTH_FAILED_ATTEMPTS ||--o{ ACTIVITY_LOG : "monitors"
```

**Diagram sources**

- [20260504170000_add_rls_policies_automation_flows.sql:6-25](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L6-L25)
- [20260514210000_tickets_tech_delete_policy.sql:4-7](file://supabase/migrations/20260514210000_tickets_tech_delete_policy.sql#L4-L7)
- [20260515160000_automation_runs_view.sql:4-29](file://supabase/migrations/20260515160000_automation_runs_view.sql#L4-L29)
- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)
- [20260505000000_patch_idempotent.sql:42-62](file://supabase/migrations/20260505000000_patch_idempotent.sql#L42-L62)

**Section sources**

- [20260430143000_admin_user_management_rls.sql:5-12](file://supabase/migrations/20260430143000_admin_user_management_rls.sql#L5-L12)
- [20260504170000_add_rls_policies_automation_flows.sql:6-25](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L6-L25)
- [20260514210000_tickets_tech_delete_policy.sql:4-7](file://supabase/migrations/20260514210000_tickets_tech_delete_policy.sql#L4-L7)
- [20260514182000_realtime_replica_identity_core_tables.sql:4-7](file://supabase/migrations/20260514182000_realtime_replica_identity_core_tables.sql#L4-L7)
- [20260515160000_automation_runs_view.sql:4-29](file://supabase/migrations/20260515160000_automation_runs_view.sql#L4-L29)
- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)
- [20260505000000_patch_idempotent.sql:42-62](file://supabase/migrations/20260505000000_patch_idempotent.sql#L42-L62)

### Customer Isolation and Data Access Boundaries

- Clients and related entities (e.g., devices, tickets) are linked via foreign keys
- RLS policies on tables and views enforce access based on authenticated user and ownership/role
- Realtime configuration ensures clients see only relevant events filtered by RLS

**Section sources**

- [20260514182000_realtime_replica_identity_core_tables.sql:4-7](file://supabase/migrations/20260514182000_realtime_replica_identity_core_tables.sql#L4-L7)

### Integration Between Roles, Associations, and Permissions

- Role RPC functions resolve effective app roles for users
- UI components conditionally render based on role booleans
- Server functions enforce admin-only operations and ownership constraints

**Section sources**

- [auth-context.tsx:155-156](file://src/lib/auth-context.tsx#L155-L156)
- [admin-users.server.ts:10-14](file://src/lib/admin-users.server.ts#L10-L14)
- [technicians.ts:16-20](file://src/lib/technicians.ts#L16-L20)

### Example Policy Configurations

- Profiles: Admins can read and update profiles
- Automation flows: Select allowed; insert/update/delete restricted to owner
- Tickets: Deletion allowed for admins and techs
- View automation_runs: Security invoker applies caller policies
- **NEW**: Activity log: Authenticated users can read; insert allowed for authenticated users

**Section sources**

- [20260430143000_admin_user_management_rls.sql:5-12](file://supabase/migrations/20260430143000_admin_user_management_rls.sql#L5-L12)
- [20260504170000_add_rls_policies_automation_flows.sql:9-23](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L9-L23)
- [20260514210000_tickets_tech_delete_policy.sql:6-7](file://supabase/migrations/20260514210000_tickets_tech_delete_policy.sql#L6-L7)
- [20260515160000_automation_runs_view.sql:4-29](file://supabase/migrations/20260515160000_automation_runs_view.sql#L4-L29)
- [20260505000000_patch_idempotent.sql:42-62](file://supabase/migrations/20260505000000_patch_idempotent.sql#L42-L62)

### Common Access Control Scenarios

- Creating a ticket: Requires authenticated user; inserts with created_by set; rate-limited
- Listing technicians: Filters to users with roles admin or tech
- Admin user management: Requires admin role; enforces constraints like preventing removal of the last admin

**Section sources**

- [tickets.ts:50-111](file://src/lib/tickets.ts#L50-L111)
- [technicians.ts:10-33](file://src/lib/technicians.ts#L10-L33)
- [admin-users.ts:69-86](file://src/lib/admin-users.ts#L69-L86)

## Authentication Audit Trail System

### Overview

The authentication audit trail system provides comprehensive monitoring of authentication events, specifically tracking failed login attempts to detect and prevent brute force attacks and suspicious activities. This system enhances security by providing real-time visibility into authentication patterns and enabling automated threat detection.

### Database Schema

The system introduces a dedicated table for tracking authentication events:

```mermaid
erDiagram
AUTH_FAILED_ATTEMPTS {
uuid id PK
string email
boolean success
jsonb payload
timestamptz created_at
}
INDEXES {
string email_created_at_idx
}
POLICIES {
string auth_failed_attempts_rls
}
```

**Diagram sources**

- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)

### Table Structure and Columns

- **id**: Unique identifier for each audit entry (UUID, auto-generated)
- **email**: Email address associated with the authentication attempt (text, not null)
- **success**: Boolean flag indicating whether the authentication attempt succeeded (boolean, default false)
- **payload**: JSONB field containing detailed information about the authentication attempt (JSONB, default empty JSON)
- **created_at**: Timestamp with timezone for when the attempt was recorded (timestamptz, default current timestamp)

### Indexing Strategy

- Composite index on `(email, created_at DESC)` for efficient querying of recent attempts per user
- Optimized for common security monitoring patterns: recent activity per user and time-based analysis

### RLS Policy Implementation

- Row Level Security is enabled on the table to ensure proper access control
- Policies restrict access to authenticated users who have legitimate reasons to view audit data
- Supports both read and write operations for authorized administrative functions

### Implementation Details

The audit trail is populated automatically during the authentication process:

```mermaid
flowchart TD
Login["Staff Login Attempt"] --> AuthRequest["Send Auth Request"]
AuthRequest --> Response{"Auth Response OK?"}
Response --> |No| FailedAttempt["Record Failed Attempt"]
Response --> |Yes| SuccessAttempt["Record Success Attempt"]
FailedAttempt --> AuditInsert["Insert into auth_failed_attempts"]
SuccessAttempt --> AuditInsert
AuditInsert --> BestEffort["Best-effort logging"]
```

**Diagram sources**

- [staff-auth.server.ts:58-70](file://src/lib/server/staff-auth.server.ts#L58-L70)

### Key Features

- **Comprehensive Tracking**: Captures both successful and failed authentication attempts
- **Metadata Preservation**: Stores detailed payload information for forensic analysis
- **Performance Optimization**: Uses efficient indexing for high-volume authentication monitoring
- **Security Integration**: Seamlessly integrated with existing authentication flow
- **Non-blocking Design**: Uses best-effort insertion to avoid impacting primary authentication flow

### Security Monitoring Capabilities

- **Brute Force Detection**: Monitor rapid successive failed attempts per user
- **Pattern Recognition**: Identify suspicious authentication patterns across time periods
- **Geographic Analysis**: Correlate authentication attempts with IP addresses and geographic locations
- **Account Takeover Prevention**: Detect unusual authentication patterns that may indicate compromised accounts

**Section sources**

- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)
- [staff-auth.server.ts:58-70](file://src/lib/server/staff-auth.server.ts#L58-L70)
- [types.ts:77-100](file://src/integrations/supabase/types.ts#L77-L100)

## Dependency Analysis

The following diagram maps key dependencies among authentication, server functions, RLS policies, and the new audit trail system.

```mermaid
graph LR
AC["AuthContext"] --> RPC["RPC get_user_role"]
AC --> MW["Auth Middleware"]
MW --> SF["Server Functions"]
SF --> RLS["RLS Policies"]
ADM["Admin Enforcer"] --> RLS
AUTH["Staff Auth Server"] --> AUDIT["Auth Audit Trail"]
AUDIT --> RLS
V["automation_runs view"] --> RLS
```

**Diagram sources**

- [auth-context.tsx:69](file://src/lib/auth-context.tsx#L69)
- [auth-middleware.ts:56](file://src/integrations/supabase/auth-middleware.ts#L56)
- [admin-users.server.ts:10](file://src/lib/admin-users.server.ts#L10)
- [staff-auth.server.ts:58](file://src/lib/server/staff-auth.server.ts#L58)
- [20260504170000_add_rls_policies_automation_flows.sql:6](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L6)
- [20260515160000_automation_runs_view.sql:4](file://supabase/migrations/20260515160000_automation_runs_view.sql#L4)

**Section sources**

- [auth-context.tsx:69](file://src/lib/auth-context.tsx#L69)
- [auth-middleware.ts:56](file://src/integrations/supabase/auth-middleware.ts#L56)
- [admin-users.server.ts:10](file://src/lib/admin-users.server.ts#L10)
- [staff-auth.server.ts:58](file://src/lib/server/staff-auth.server.ts#L58)
- [20260504170000_add_rls_policies_automation_flows.sql:6](file://supabase/migrations/20260504170000_add_rls_policies_automation_flows.sql#L6)
- [20260515160000_automation_runs_view.sql:4](file://supabase/migrations/20260515160000_automation_runs_view.sql#L4)

## Performance Considerations

- Minimize concurrent DB calls in auth context; current implementation uses Promise.all for profile, user profile, and role resolution
- Prefer server-side RLS to avoid redundant client-side filtering
- Use views with security invoker to centralize permission logic and reduce repeated checks
- Enable full replica identity for tables participating in realtime to ensure efficient diffs and reduced payload sizes
- **NEW**: The auth_failed_attempts table uses efficient indexing strategy optimized for high-volume authentication monitoring
- **NEW**: Best-effort logging approach prevents audit trail system from blocking primary authentication flow

## Troubleshooting Guide

- Missing environment variables: Middleware throws 500 when Supabase URL or publishable key are not set
- Missing or invalid Authorization header: Middleware throws 401 for missing or unsupported headers
- Invalid token: Claims retrieval failure leads to 401
- Admin enforcement failures: requireAdmin throws 401 for invalid tokens and 403 for insufficient roles
- Rate limiting: Ticket creation and admin invites are rate-limited; errors surface as server errors
- **NEW**: Authentication audit trail failures: The system uses best-effort logging, so failures are logged but don't block authentication flow

**Section sources**

- [auth-middleware.ts:9-41](file://src/integrations/supabase/auth-middleware.ts#L9-L41)
- [admin-users.server.ts:7-8](file://src/lib/admin-users.server.ts#L7-L8)
- [admin-users.ts:172-174](file://src/lib/admin-users.ts#L172-L174)
- [tickets.ts:62](file://src/lib/tickets.ts#L62)
- [staff-auth.server.ts:58-70](file://src/lib/server/staff-auth.server.ts#L58-L70)

## Conclusion

PCReady's security model leverages Supabase authentication and RLS to enforce role-based access control, ownership constraints, and customer isolation. The addition of the comprehensive authentication audit trail system significantly enhances security monitoring capabilities by providing detailed tracking of authentication events, enabling detection of suspicious activities, and supporting compliance requirements. The frontend auth context and middleware provide robust token validation and role-aware UI, while server functions enforce admin-only operations and ownership rules. RLS policies on tables and views ensure consistent access boundaries, and views with security invoker centralize permission logic. The new audit trail system maintains non-blocking performance characteristics while providing essential security monitoring functionality. Adhering to the best practices outlined here will help maintain a secure and compliant system.

## Appendices

### Appendix A: Supabase Types and Database Types

- Supabase-generated types define tables, enums, and relationships used across the application
- Database types re-export Supabase types for consistent typing
- **NEW**: auth_failed_attempts table types included in generated TypeScript definitions

**Section sources**

- [types.ts:1-800](file://src/integrations/supabase/types.ts#L1-L800)
- [database.types.ts:1-2](file://src/types/database.types.ts#L1-L2)
- [types.ts:77-100](file://src/integrations/supabase/types.ts#L77-L100)

### Appendix B: Authentication Audit Trail Configuration

- Table creation with appropriate constraints and defaults
- Index optimization for common query patterns
- RLS policy implementation for access control
- Integration with staff authentication server functions

**Section sources**

- [20260521205713_auth_failed_attempts.sql:1-13](file://supabase/migrations/20260521205713_auth_failed_attempts.sql#L1-L13)
- [staff-auth.server.ts:58-70](file://src/lib/server/staff-auth.server.ts#L58-L70)
- [types.ts:77-100](file://src/integrations/supabase/types.ts#L77-L100)
