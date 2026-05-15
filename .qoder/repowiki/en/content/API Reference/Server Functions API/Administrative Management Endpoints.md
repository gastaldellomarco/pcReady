# Administrative Management Endpoints

<cite>
**Referenced Files in This Document**
- [admin-users.ts](file://src/lib/admin-users.ts)
- [admin-users.server.ts](file://src/lib/admin-users.server.ts)
- [admin.ts](file://lib/schemas/admin.ts)
- [AdminUsersTab.tsx](file://src/components/admin/AdminUsersTab.tsx)
- [useAdminUsers.ts](file://src/hooks/useAdminUsers.ts)
- [auth-middleware.ts](file://src/integrations/supabase/auth-middleware.ts)
- [audit-log.ts](file://src/lib/audit-log.ts)
- [audit-log-actions.ts](file://src/lib/audit-log-actions.ts)
- [rate-limit.ts](file://src/lib/rate-limit.ts)
- [rate-limit-config.ts](file://src/lib/rate-limit-config.ts)
- [admin-error-message.ts](file://src/lib/admin/admin-error-message.ts)
- [admin-constants.ts](file://src/lib/admin/admin-constants.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document describes the administrative management server functions for user lifecycle operations and role management. It covers user creation (invitation), updates, disabling/enabling, deletion, and role management. It also documents authentication and authorization requirements, access control, input validation and sanitization, database operations, rate limiting, and audit logging integration.

## Project Structure
Administrative user management is implemented as server functions backed by Supabase Auth and Postgres. The frontend integrates with these server functions via React hooks and components.

```mermaid
graph TB
subgraph "Frontend"
UI_AdminUsers["AdminUsersTab.tsx"]
Hook_useAdminUsers["useAdminUsers.ts"]
Schema_AdminInvite["admin.ts"]
end
subgraph "Server Functions"
SF_List["listAdminUsers"]
SF_Update["updateAdminUser"]
SF_Invite["inviteAdminUser"]
SF_Resend["resendAdminUserInvite"]
SF_Disable["setAdminUserDisabled"]
SF_Delete["deleteAdminUser"]
RequireAdmin["requireAdmin"]
end
subgraph "Auth & DB"
SupabaseAdmin["Supabase Admin Client"]
AuthMiddleware["auth-middleware.ts"]
end
subgraph "Supporting"
RL["rate-limit.ts"]
RLConfig["rate-limit-config.ts"]
Audit["audit-log.ts"]
AuditActions["audit-log-actions.ts"]
end
UI_AdminUsers --> Hook_useAdminUsers
Hook_useAdminUsers --> Schema_AdminInvite
Hook_useAdminUsers --> SF_List
Hook_useAdminUsers --> SF_Update
Hook_useAdminUsers --> SF_Invite
Hook_useAdminUsers --> SF_Resend
Hook_useAdminUsers --> SF_Disable
Hook_useAdminUsers --> SF_Delete
SF_List --> RequireAdmin
SF_Update --> RequireAdmin
SF_Invite --> RequireAdmin
SF_Resend --> RequireAdmin
SF_Disable --> RequireAdmin
SF_Delete --> RequireAdmin
RequireAdmin --> SupabaseAdmin
SF_Invite --> RL
RL --> RLConfig
SF_Invite --> Audit
Audit --> AuditActions
```

**Diagram sources**
- [AdminUsersTab.tsx:1-497](file://src/components/admin/AdminUsersTab.tsx#L1-L497)
- [useAdminUsers.ts:1-213](file://src/hooks/useAdminUsers.ts#L1-L213)
- [admin.ts:1-10](file://lib/schemas/admin.ts#L1-L10)
- [admin-users.ts:88-279](file://src/lib/admin-users.ts#L88-L279)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [auth-middleware.ts:1-74](file://src/integrations/supabase/auth-middleware.ts#L1-L74)
- [rate-limit.ts:1-104](file://src/lib/rate-limit.ts#L1-L104)
- [rate-limit-config.ts:1-31](file://src/lib/rate-limit-config.ts#L1-L31)
- [audit-log.ts:1-183](file://src/lib/audit-log.ts#L1-L183)
- [audit-log-actions.ts:1-28](file://src/lib/audit-log-actions.ts#L1-L28)

**Section sources**
- [AdminUsersTab.tsx:1-497](file://src/components/admin/AdminUsersTab.tsx#L1-L497)
- [useAdminUsers.ts:1-213](file://src/hooks/useAdminUsers.ts#L1-L213)
- [admin-users.ts:1-279](file://src/lib/admin-users.ts#L1-L279)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [auth-middleware.ts:1-74](file://src/integrations/supabase/auth-middleware.ts#L1-L74)

## Core Components
- Admin user server functions:
  - List users, update roles/full name, invite users, resend invitations, disable/enable users, delete users.
- Authentication and authorization:
  - Access token validation and admin role check via RPC.
- Input validation and sanitization:
  - Zod schema for invitations; trimming and normalization for names and initials.
- Rate limiting:
  - Dedicated presets and enforcement for admin user invitation.
- Audit logging:
  - Notifications and audit log retrieval/export for admin actions.

**Section sources**
- [admin-users.ts:88-279](file://src/lib/admin-users.ts#L88-L279)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [admin.ts:1-10](file://lib/schemas/admin.ts#L1-L10)
- [rate-limit.ts:1-104](file://src/lib/rate-limit.ts#L1-L104)
- [rate-limit-config.ts:1-31](file://src/lib/rate-limit-config.ts#L1-L31)
- [audit-log.ts:1-183](file://src/lib/audit-log.ts#L1-L183)

## Architecture Overview
Administrative actions are executed as server functions invoked from the admin UI. Each function validates the caller’s admin privileges and performs database operations against Supabase. Some operations enforce rate limits and trigger notifications for audit purposes.

```mermaid
sequenceDiagram
participant UI as "AdminUsersTab.tsx"
participant Hook as "useAdminUsers.ts"
participant SF as "admin-users.ts (Server Fn)"
participant Auth as "admin-users.server.ts"
participant DB as "Supabase Admin Client"
UI->>Hook : "User clicks action (e.g., invite/update/disable/delete)"
Hook->>SF : "Invoke server function with {accessToken, params}"
SF->>Auth : "requireAdmin(accessToken)"
Auth->>DB : "getUser + has_role('admin')"
DB-->>Auth : "User + role result"
Auth-->>SF : "Actor user_id"
SF->>DB : "Perform DB operation (auth.admin, profiles, user_roles)"
DB-->>SF : "Operation result"
SF-->>Hook : "Success or error"
Hook-->>UI : "Show toast + refresh list"
```

**Diagram sources**
- [AdminUsersTab.tsx:1-497](file://src/components/admin/AdminUsersTab.tsx#L1-L497)
- [useAdminUsers.ts:1-213](file://src/hooks/useAdminUsers.ts#L1-L213)
- [admin-users.ts:88-279](file://src/lib/admin-users.ts#L88-L279)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)

## Detailed Component Analysis

### Authentication and Authorization
- Access token validation:
  - Extracts user from access token and verifies admin role via RPC.
  - Returns actor user ID or throws unauthorized/unauthorized messages.
- Frontend middleware:
  - Provides a reusable middleware pattern for bearer token validation and claims extraction.

```mermaid
flowchart TD
Start(["Call requireAdmin"]) --> GetUser["Get user by access token"]
GetUser --> TokenValid{"Token valid?"}
TokenValid --> |No| Throw401["Throw 401 Unauthorized"]
TokenValid --> |Yes| CheckRole["RPC has_role('admin')"]
CheckRole --> RoleValid{"Has admin role?"}
RoleValid --> |No| Throw403["Throw 403 Forbidden"]
RoleValid --> |Yes| ReturnId["Return actor user_id"]
```

**Diagram sources**
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)

**Section sources**
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [auth-middleware.ts:1-74](file://src/integrations/supabase/auth-middleware.ts#L1-L74)

### Admin User Invitation Workflow
- Validates role and enforces rate limit per actor.
- Sanitizes email and full name.
- Invites via Supabase Auth admin API and upserts profile and user profile records.
- Assigns initial role and notifies admins.

```mermaid
sequenceDiagram
participant UI as "AdminUsersTab.tsx"
participant Hook as "useAdminUsers.ts"
participant Invite as "inviteAdminUser"
participant Auth as "requireAdmin"
participant RL as "throwIfRateLimited"
participant Supa as "Supabase Admin Client"
UI->>Hook : "Submit invite form"
Hook->>Invite : "{accessToken, email, fullName, role}"
Invite->>Auth : "requireAdmin"
Auth-->>Invite : "actorId"
Invite->>RL : "INVITE_ADMIN_USER preset"
RL-->>Invite : "allowed"
Invite->>Supa : "auth.admin.inviteUserByEmail"
Supa-->>Invite : "inviteData.user.id"
Invite->>Supa : "upsert profiles + user_profiles"
Invite->>Supa : "delete+insert user_roles"
Invite-->>Hook : "{ok : true}"
Hook-->>UI : "Toast success + reload"
```

**Diagram sources**
- [admin-users.ts:169-225](file://src/lib/admin-users.ts#L169-L225)
- [rate-limit.ts:92-103](file://src/lib/rate-limit.ts#L92-L103)
- [rate-limit-config.ts:5-15](file://src/lib/rate-limit-config.ts#L5-L15)

**Section sources**
- [admin-users.ts:169-225](file://src/lib/admin-users.ts#L169-L225)
- [rate-limit.ts:92-103](file://src/lib/rate-limit.ts#L92-L103)
- [rate-limit-config.ts:5-15](file://src/lib/rate-limit-config.ts#L5-L15)

### User Listing and Status Computation
- Lists users via Supabase Auth admin API and enriches with profiles and roles.
- Computes status based on email confirmation, bans, and timestamps.

```mermaid
flowchart TD
Start(["listAdminUsers"]) --> Require["requireAdmin"]
Require --> FetchAuth["auth.admin.listUsers"]
Require --> FetchProfiles["select profiles"]
Require --> FetchRoles["select user_roles"]
FetchAuth --> Merge["Map users + profiles + roles"]
Merge --> Compute["Compute status:<br/>invited/disabled/active"]
Compute --> Return["Return enriched user list"]
```

**Diagram sources**
- [admin-users.ts:88-135](file://src/lib/admin-users.ts#L88-L135)

**Section sources**
- [admin-users.ts:88-135](file://src/lib/admin-users.ts#L88-L135)

### Role Updates and Name/Initials Normalization
- Validates role, prevents removal of sole admin, and normalizes initials.
- Updates profile full name and initials, then replaces user roles.

```mermaid
flowchart TD
Start(["updateAdminUser"]) --> Require["requireAdmin"]
Require --> ValidateRole{"Role valid?"}
ValidateRole --> |No| Throw400["Throw 400"]
ValidateRole --> |Yes| CheckAdmin["assertCanRemoveAdmin(target, role)"]
CheckAdmin --> UpdateProfile["Upsert profiles.full_name + initials"]
UpdateProfile --> ClearRoles["Delete existing user_roles"]
ClearRoles --> InsertRole["Insert new role"]
InsertRole --> Done["Return {ok:true}"]
```

**Diagram sources**
- [admin-users.ts:137-167](file://src/lib/admin-users.ts#L137-L167)
- [admin-users.ts:69-86](file://src/lib/admin-users.ts#L69-L86)

**Section sources**
- [admin-users.ts:137-167](file://src/lib/admin-users.ts#L137-L167)
- [admin-users.ts:55-67](file://src/lib/admin-users.ts#L55-L67)

### Disable/Enable Users and Self-Protection
- Prevents actor from banning themselves.
- Enforces minimum admin count when downgrading roles.
- Uses Supabase auth admin update to ban/unban.

```mermaid
flowchart TD
Start(["setAdminUserDisabled"]) --> Require["requireAdmin"]
Require --> SelfCheck{"Is actor target?"}
SelfCheck --> |Yes| Throw400Self["Throw 400"]
SelfCheck --> |No| Downgrade{"Disabling target?"}
Downgrade --> |Yes| Assert["assertCanRemoveAdmin(target,'viewer')"]
Assert --> Ban["auth.admin.updateUser ban_duration='876000h' or 'none'"]
Ban --> Done["Return {ok:true}"]
```

**Diagram sources**
- [admin-users.ts:250-264](file://src/lib/admin-users.ts#L250-L264)
- [admin-users.ts:69-86](file://src/lib/admin-users.ts#L69-L86)

**Section sources**
- [admin-users.ts:250-264](file://src/lib/admin-users.ts#L250-L264)
- [admin-users.ts:69-86](file://src/lib/admin-users.ts#L69-L86)

### User Deletion and Self-Protection
- Prevents actor from deleting themselves.
- Enforces minimum admin count before deletion.

```mermaid
flowchart TD
Start(["deleteAdminUser"]) --> Require["requireAdmin"]
Require --> SelfCheck{"Is actor target?"}
SelfCheck --> |Yes| Throw400Self["Throw 400"]
SelfCheck --> |No| Assert["assertCanRemoveAdmin(target,'viewer')"]
Assert --> Delete["auth.admin.deleteUser"]
Delete --> Done["Return {ok:true}"]
```

**Diagram sources**
- [admin-users.ts:266-279](file://src/lib/admin-users.ts#L266-L279)
- [admin-users.ts:69-86](file://src/lib/admin-users.ts#L69-L86)

**Section sources**
- [admin-users.ts:266-279](file://src/lib/admin-users.ts#L266-L279)
- [admin-users.ts:69-86](file://src/lib/admin-users.ts#L69-L86)

### Resend Invitation
- Ensures user exists, has no confirmed email, and resends invite with redirect.

```mermaid
flowchart TD
Start(["resendAdminUserInvite"]) --> Require["requireAdmin"]
Require --> GetUser["getUserById(userId)"]
GetUser --> HasEmail{"Has email?"}
HasEmail --> |No| Throw400["Throw 400"]
HasEmail --> |Yes| Confirmed{"Email confirmed?"}
Confirmed --> |Yes| Throw400["Throw 400"]
Confirmed --> |No| Resend["inviteUserByEmail(email)"]
Resend --> Done["Return {ok:true}"]
```

**Diagram sources**
- [admin-users.ts:227-248](file://src/lib/admin-users.ts#L227-L248)

**Section sources**
- [admin-users.ts:227-248](file://src/lib/admin-users.ts#L227-L248)

### Input Validation and Sanitization
- Invitation form schema enforces email format and role enum.
- Full name and initials are trimmed and normalized.
- Email is lowercased and validated before inviting.

```mermaid
flowchart TD
Start(["Invite Form"]) --> Zod["Zod schema validation"]
Zod --> Trim["Trim inputs"]
Trim --> Normalize["Normalize initials"]
Normalize --> Lower["Lowercase email"]
Lower --> Invite["Proceed to invite"]
```

**Diagram sources**
- [admin.ts:1-10](file://lib/schemas/admin.ts#L1-L10)
- [admin-users.ts:169-225](file://src/lib/admin-users.ts#L169-L225)
- [admin-users.ts:55-67](file://src/lib/admin-users.ts#L55-L67)

**Section sources**
- [admin.ts:1-10](file://lib/schemas/admin.ts#L1-L10)
- [admin-users.ts:55-67](file://src/lib/admin-users.ts#L55-L67)
- [admin-users.ts:169-225](file://src/lib/admin-users.ts#L169-L225)

### Rate Limiting for Admin Operations
- Dedicated preset for admin user invitation.
- Enforced per actor user ID to prevent spam.

```mermaid
flowchart TD
Start(["inviteAdminUser"]) --> RL["throwIfRateLimited(actorId, INVITE_ADMIN_USER)"]
RL --> Allowed{"Allowed?"}
Allowed --> |No| BuildResp["Build 429 response"]
Allowed --> |Yes| Proceed["Proceed to invite"]
```

**Diagram sources**
- [admin-users.ts:169-174](file://src/lib/admin-users.ts#L169-L174)
- [rate-limit.ts:92-103](file://src/lib/rate-limit.ts#L92-L103)
- [rate-limit-config.ts:5-15](file://src/lib/rate-limit-config.ts#L5-L15)

**Section sources**
- [admin-users.ts:169-174](file://src/lib/admin-users.ts#L169-L174)
- [rate-limit.ts:92-103](file://src/lib/rate-limit.ts#L92-L103)
- [rate-limit-config.ts:5-15](file://src/lib/rate-limit-config.ts#L5-L15)

### Audit Logging and Notifications
- On successful invite, a notification is sent to admins.
- Audit log retrieval supports filtering and deduplication.
- Audit action constants enumerate logged events.

```mermaid
sequenceDiagram
participant SF as "inviteAdminUser"
participant Notify as "Notifications"
participant Audit as "audit-log.ts"
SF->>Notify : "createNotificationForAdmins(...)"
SF->>Audit : "Optional : log action"
Notify-->>SF : "OK"
```

**Diagram sources**
- [admin-users.ts:216-222](file://src/lib/admin-users.ts#L216-L222)
- [audit-log.ts:1-183](file://src/lib/audit-log.ts#L1-L183)
- [audit-log-actions.ts:1-28](file://src/lib/audit-log-actions.ts#L1-L28)

**Section sources**
- [admin-users.ts:216-222](file://src/lib/admin-users.ts#L216-L222)
- [audit-log.ts:1-183](file://src/lib/audit-log.ts#L1-L183)
- [audit-log-actions.ts:1-28](file://src/lib/audit-log-actions.ts#L1-L28)

## Dependency Analysis
- Cohesion:
  - Admin user operations are cohesive within a single module.
- Coupling:
  - Server functions depend on requireAdmin and Supabase admin client.
  - UI depends on server functions via TanStack Start server functions.
- External dependencies:
  - Supabase Auth and Postgres for identity and roles.
  - In-memory rate limiter with optional Redis backend.

```mermaid
graph LR
AdminUsersTS["admin-users.ts"] --> RequireAdmin["admin-users.server.ts"]
AdminUsersTS --> SupabaseAdmin["Supabase Admin Client"]
AdminUsersTS --> RL["rate-limit.ts"]
RL --> RLConfig["rate-limit-config.ts"]
AdminUsersTS --> Audit["audit-log.ts"]
Audit --> AuditActions["audit-log-actions.ts"]
UI["AdminUsersTab.tsx"] --> Hook["useAdminUsers.ts"]
Hook --> AdminUsersTS
```

**Diagram sources**
- [admin-users.ts:1-279](file://src/lib/admin-users.ts#L1-L279)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [rate-limit.ts:1-104](file://src/lib/rate-limit.ts#L1-L104)
- [rate-limit-config.ts:1-31](file://src/lib/rate-limit-config.ts#L1-L31)
- [audit-log.ts:1-183](file://src/lib/audit-log.ts#L1-L183)
- [audit-log-actions.ts:1-28](file://src/lib/audit-log-actions.ts#L1-L28)
- [AdminUsersTab.tsx:1-497](file://src/components/admin/AdminUsersTab.tsx#L1-L497)
- [useAdminUsers.ts:1-213](file://src/hooks/useAdminUsers.ts#L1-L213)

**Section sources**
- [admin-users.ts:1-279](file://src/lib/admin-users.ts#L1-L279)
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [rate-limit.ts:1-104](file://src/lib/rate-limit.ts#L1-L104)
- [rate-limit-config.ts:1-31](file://src/lib/rate-limit-config.ts#L1-L31)
- [audit-log.ts:1-183](file://src/lib/audit-log.ts#L1-L183)
- [audit-log-actions.ts:1-28](file://src/lib/audit-log-actions.ts#L1-L28)
- [AdminUsersTab.tsx:1-497](file://src/components/admin/AdminUsersTab.tsx#L1-L497)
- [useAdminUsers.ts:1-213](file://src/hooks/useAdminUsers.ts#L1-L213)

## Performance Considerations
- Batch operations:
  - Bulk role updates and invites are executed concurrently with settled promises to reduce latency.
- Deduplication:
  - Audit log retrieval deduplicates entries by message and second to avoid noisy logs.
- Pagination:
  - Audit log supports server-side pagination after deduplication.
- Rate limiting:
  - Per-user sliding window prevents abuse during mass invitations.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication failures:
  - Missing or invalid bearer token leads to 401; ensure the frontend passes a valid access token.
- Authorization failures:
  - Non-admin users receive 403; verify the actor has the admin role.
- Rate limit exceeded:
  - Exceeding the admin user invitation limit returns 429 with Retry-After and X-RateLimit headers.
- Common validation errors:
  - Invalid role, invalid email, self-disable/self-delete protection, last admin constraint violations.
- Error messaging:
  - UI surfaces friendly messages derived from server errors; inspect toast messages and network responses.

**Section sources**
- [admin-users.server.ts:1-18](file://src/lib/admin-users.server.ts#L1-L18)
- [admin-users.ts:137-167](file://src/lib/admin-users.ts#L137-L167)
- [admin-users.ts:169-225](file://src/lib/admin-users.ts#L169-L225)
- [admin-users.ts:250-279](file://src/lib/admin-users.ts#L250-L279)
- [rate-limit.ts:74-90](file://src/lib/rate-limit.ts#L74-L90)
- [admin-error-message.ts:1-21](file://src/lib/admin/admin-error-message.ts#L1-L21)

## Conclusion
The administrative management endpoints provide a secure, rate-limited, and auditable suite of operations for managing users and roles. They enforce strict authorization, sanitize inputs, and integrate with Supabase for identity and database operations. The UI binds to server functions to deliver a responsive admin experience with robust error handling and notifications.