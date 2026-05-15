# Deployment and DevOps

<cite>
**Referenced Files in This Document**
- [ci.yml](file://.github/workflows/ci.yml)
- [deploy.yml](file://.github/workflows/deploy.yml)
- [release.yml](file://.github/workflows/release.yml)
- [test.yml](file://.github/workflows/test.yml)
- [wrangler.jsonc](file://wrangler.jsonc)
- [config.toml](file://supabase/config.toml)
- [package.json](file://package.json)
- [README.md](file://README.md)
- [bump.sh](file://scripts/bump.sh)
- [validate-migrations.mjs](file://scripts/validate-migrations.mjs)
- [BACKUP.md](file://docs/BACKUP.md)
- [20260430154500_ticket_code_sequence_trigger.sql](file://supabase/migrations/20260430154500_ticket_code_sequence_trigger.sql)
- [20260430143000_admin_user_management_rls.sql](file://supabase/migrations/20260430143000_admin_user_management_rls.sql)
- [seed.sql](file://supabase/seed.sql)
</cite>

## Update Summary
**Changes Made**
- Updated CI workflow to use Node.js 20 and Bun 1.3.13 with frozen lockfile
- Enhanced deploy workflow with explicit Node.js 22 requirement and improved secret validation
- Updated release workflow to use Node.js 22 and Bun 1.3.13 with semantic versioning
- Added comprehensive Supabase migration validation and database seeding documentation
- Expanded backup and disaster recovery procedures with manual export capabilities
- Enhanced troubleshooting section with specific error scenarios and resolutions

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
10. [Appendices](#appendices)

## Introduction
This document describes PCReady's production deployment and DevOps practices. It covers CI/CD via GitHub Actions, environment configuration, Cloudflare Workers deployment with Wrangler, Supabase database and RLS requirements, optional containerization and Kubernetes patterns, monitoring and logging approaches, backup and disaster recovery, security considerations, troubleshooting, and release management with version tagging.

## Project Structure
PCReady is a frontend-heavy application built with React, TypeScript, TanStack Router/Start, Vite, and Supabase. The runtime is deployed to Cloudflare Workers using Wrangler. CI/CD is implemented with GitHub Actions workflows. Supabase manages the Postgres database, migrations, and Row Level Security (RLS) policies. The repository includes:
- GitHub Actions workflows for CI, tests, and deployment
- Wrangler configuration for Workers
- Supabase project configuration and migrations
- Scripts for version bumping and migration validation
- Documentation for backup and recovery

```mermaid
graph TB
subgraph "Repository"
GH[".github/workflows/*.yml"]
WJ["wrangler.jsonc"]
ST["supabase/config.toml"]
PKG["package.json"]
DOC["docs/BACKUP.md"]
end
subgraph "Cloudflare Workers"
CF["Workers Runtime"]
end
subgraph "Supabase"
PG["PostgreSQL Database"]
MIG["Migrations"]
RLS["RLS Policies"]
SEED["Seed Data"]
end
GH --> CF
WJ --> CF
GH --> PG
ST --> PG
MIG --> PG
RLS --> PG
SEED --> PG
PKG --> GH
DOC --> GH
```

**Diagram sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)
- [wrangler.jsonc:1-8](file://wrangler.jsonc#L1-L8)
- [config.toml:1-1](file://supabase/config.toml#L1-L1)
- [package.json:1-110](file://package.json#L1-L110)
- [BACKUP.md:1-73](file://docs/BACKUP.md#L1-L73)

**Section sources**
- [README.md:1-159](file://README.md#L1-L159)
- [package.json:1-110](file://package.json#L1-L110)

## Core Components
- CI/CD with GitHub Actions:
  - Pull Request quality gate with typecheck, lint, migration validation, and build
  - Push-to-main deployment to Cloudflare Workers with secret validation
  - Test workflow applying Supabase migrations before running tests
  - Release workflow supporting manual bumps and tag-based releases
- Cloudflare Workers deployment:
  - Wrangler configuration for compatibility date and server entry
- Supabase:
  - Project configuration and migrations under supabase/migrations
  - RLS policies and triggers enforced by migrations
  - Seed data for email templates and initial configuration
- Release management:
  - Version bumping script and migration validation
  - Automated GitHub Releases with changelogs

**Section sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)
- [release.yml:1-96](file://.github/workflows/release.yml#L1-L96)
- [wrangler.jsonc:1-8](file://wrangler.jsonc#L1-L8)
- [config.toml:1-1](file://supabase/config.toml#L1-L1)
- [bump.sh:1-21](file://scripts/bump.sh#L1-L21)
- [validate-migrations.mjs:1-43](file://scripts/validate-migrations.mjs#L1-L43)

## Architecture Overview
The deployment pipeline integrates GitHub Actions, Supabase, and Cloudflare Workers. The CI workflow validates code quality and builds artifacts. The test workflow ensures database state matches migrations before running tests. The deploy workflow pushes the built application to Cloudflare Workers after validating required secrets. The release workflow manages versioning and GitHub Releases.

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant GH as "GitHub Actions"
participant SB as "Supabase"
participant CF as "Cloudflare Workers"
Dev->>GH : Open Pull Request / Push to main
GH->>GH : Run CI (typecheck, lint, migrations : check, build)
GH->>SB : Apply migrations (test workflow)
GH->>GH : Run tests
GH->>CF : Deploy Worker (deploy workflow)
Note over GH,CF : Secrets validated before deployment
```

**Diagram sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)

## Detailed Component Analysis

### CI Workflow
Purpose: Gate pull requests with quality checks and build verification.
- Triggers: Pull requests to main and develop
- Steps:
  - Setup Node.js 20 and Bun 1.3.13
  - Install dependencies with frozen lockfile
  - Typecheck, lint, migration validation, and build
- Environment: Exposes Supabase keys for migration checks and build-time validation

```mermaid
flowchart TD
Start(["PR opened"]) --> Setup["Setup Node.js 20 and Bun 1.3.13"]
Setup --> Install["Install dependencies with frozen lockfile"]
Install --> Quality["Typecheck + Lint + Migrations Check + Build"]
Quality --> Pass{"All checks pass?"}
Pass --> |Yes| Ready["Ready for review"]
Pass --> |No| Fail["Fail PR checks"]
```

**Diagram sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)

**Section sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)

### Test Workflow
Purpose: Ensure database state is current before running tests.
- Triggers: Pushes to main/develop and pull requests
- Steps:
  - Setup Node.js 20 and Bun 1.3.13
  - Install dependencies
  - Resolve Supabase DB host IP and push migrations
  - Run test suite

```mermaid
flowchart TD
TStart(["Push/Pull Request"]) --> TSetup["Setup Node.js 20 and Bun 1.3.13"]
TSetup --> TInstall["Install dependencies"]
TInstall --> TResolve["Resolve Supabase DB host IPv4"]
TResolve --> TPush["supabase db push"]
TPush --> TTest["Run tests"]
TTest --> TEnd(["Tests complete"])
```

**Diagram sources**
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)

**Section sources**
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)

### Deploy Workflow
Purpose: Deploy the built application to Cloudflare Workers on main branch pushes.
- Triggers: Pushes to main
- Steps:
  - Setup Node.js 22 and Bun 1.3.13
  - Install dependencies and build
  - Validate required secrets (Cloudflare API token and Supabase DB URL)
  - Deploy using Wrangler

```mermaid
sequenceDiagram
participant Repo as "Repository"
participant GA as "GitHub Actions"
participant CF as "Cloudflare Workers"
participant SB as "Supabase"
Repo->>GA : Push to main
GA->>GA : Setup Node.js 22 + Bun 1.3.13 + Install + Build
GA->>GA : Validate secrets (CLOUDFLARE_API_TOKEN, SUPABASE_DB_URL)
GA->>CF : wrangler deploy
CF-->>GA : Deployment result
GA->>SB : Keep DB state current (external process)
```

**Diagram sources**
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)

**Section sources**
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)

### Release Workflow
Purpose: Automate version bumping, tagging, and GitHub Releases.
- Triggers: Manual dispatch or push to semantic version tags
- Steps:
  - Configure Git user
  - Optional manual bump (patch/minor/major)
  - Commit and tag version
  - Push commit and tag
  - Generate changelog
  - Create GitHub Release

```mermaid
flowchart TD
RStart(["Trigger: Dispatch or Tag"]) --> RBump{"Manual bump?"}
RBump --> |Yes| Bump["npm version <bump>"]
RBump --> |No| Skip["Use existing tag ref"]
Bump --> Commit["Commit + Tag"]
Skip --> Commit
Commit --> Push["Push commit + tag"]
Push --> Changelog["Generate changelog"]
Changelog --> Release["Create GitHub Release"]
Release --> REnd(["Release complete"])
```

**Diagram sources**
- [release.yml:1-96](file://.github/workflows/release.yml#L1-L96)
- [bump.sh:1-21](file://scripts/bump.sh#L1-L21)

**Section sources**
- [release.yml:1-96](file://.github/workflows/release.yml#L1-L96)
- [bump.sh:1-21](file://scripts/bump.sh#L1-L21)

### Wrangler Configuration
Purpose: Define Cloudflare Workers runtime settings for the application.
- Name, compatibility date, compatibility flags, and server entry point
- Integrates with TanStack Start server entry

```mermaid
classDiagram
class WranglerConfig {
+string name
+string compatibility_date
+string[] compatibility_flags
+string main
}
```

**Diagram sources**
- [wrangler.jsonc:1-8](file://wrangler.jsonc#L1-L8)

**Section sources**
- [wrangler.jsonc:1-8](file://wrangler.jsonc#L1-L8)

### Supabase Configuration and Migrations
Purpose: Manage database schema, policies, and data consistency.
- Project identifier configured
- Migrations stored under supabase/migrations with strict validation
- Validation script enforces naming, emptiness, merge conflict markers, and dollar-quoted blocks balance
- Seed data provides initial email templates and configuration
- README documents migration requirements and client behavior expectations

```mermaid
flowchart TD
SStart(["Schema change"]) --> Plan["Create migration in supabase/migrations"]
Plan --> Validate["Run migration validation"]
Validate --> Valid{"Valid?"}
Valid --> |Yes| Apply["Apply to Supabase (CI/CD or locally)"]
Valid --> |No| Fix["Fix migration issues"]
Apply --> Seed["Apply seed data"]
Seed --> Test["Run tests with migrations applied"]
Test --> Deploy["Deploy to production"]
```

**Diagram sources**
- [config.toml:1-1](file://supabase/config.toml#L1-L1)
- [validate-migrations.mjs:1-43](file://scripts/validate-migrations.mjs#L1-L43)
- [README.md:104-111](file://README.md#L104-L111)
- [seed.sql:1-44](file://supabase/seed.sql#L1-L44)

**Section sources**
- [config.toml:1-1](file://supabase/config.toml#L1-L1)
- [validate-migrations.mjs:1-43](file://scripts/validate-migrations.mjs#L1-L43)
- [README.md:104-111](file://README.md#L104-L111)
- [seed.sql:1-44](file://supabase/seed.sql#L1-L44)

### Environment Configuration Management
- Local development uses Bun and environment variables for Supabase client/server keys
- CI exposes Supabase secrets for migration checks and build-time validations
- Production deployment requires Cloudflare API token and account ID, plus Supabase DB URL

Key environment variables observed in workflows:
- SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_DB_URL
- CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

**Section sources**
- [ci.yml:10-16](file://.github/workflows/ci.yml#L10-L16)
- [test.yml:11-17](file://.github/workflows/test.yml#L11-L17)
- [deploy.yml:10-16](file://.github/workflows/deploy.yml#L10-L16)

### Containerization and Kubernetes Deployment Patterns
- Current deployment targets Cloudflare Workers via Wrangler
- No Docker/Kubernetes manifests are present in the repository
- Recommendation: For Kubernetes, define a minimal container image with built assets and expose a health check endpoint; mount configuration via ConfigMaps/Secrets; use a Deployment with readiness/liveness probes; and a Service/Ingress for exposure

### Monitoring and Logging
- Error tracking: Integrate an external error tracking service (e.g., Sentry) in the application entrypoint
- Performance monitoring: Use a CDN-level analytics solution (e.g., Cloudflare Analytics) and application-level metrics via a telemetry library
- User analytics: Track page views and key events; ensure compliance with privacy regulations

### Backup and Disaster Recovery
- Supabase-managed backups: Daily automated backups, PITR on higher tiers, WAL replication, and geo-redundant storage
- Operational targets: RPO < 24 hours, RTO < 4 hours (provider-dependent)
- Manual exports: Admin UI provides a ZIP export of primary datasets; useful for audits and offline copies
- Recovery procedure: Identify incident, collect details, contact support, verify available restore point, validate restored data, promote or reimport, and document

**Section sources**
- [BACKUP.md:1-73](file://docs/BACKUP.md#L1-L73)
- [README.md:119-124](file://README.md#L119-L124)

### Security Considerations
- Secrets management: Store all secrets in GitHub Actions and Cloudflare/Supabase secret managers; avoid committing secrets to the repository
- Access control: Enforce Supabase RLS policies; restrict Cloudflare Worker access to necessary APIs; rotate tokens regularly
- SSL/TLS: Cloudflare terminates TLS at the edge; ensure backend APIs use HTTPS; configure appropriate headers and security policies
- Least privilege: Limit Supabase service role usage; prefer client credentials for user-facing operations

### Troubleshooting Guide
Common deployment issues and resolutions:
- Missing secrets during deploy:
  - Verify CLOUDFLARE_API_TOKEN and SUPABASE_DB_URL are set in repository secrets
  - Confirm environment variables are correctly referenced in the deploy workflow
- Migration failures:
  - Run migration validation locally to catch invalid filenames, empty files, merge conflicts, or unbalanced dollar-quoted blocks
  - Ensure migrations are applied before running tests
- Build failures:
  - Confirm Node.js and Bun versions match CI; use frozen lockfile installs
- Rollback procedures:
  - Cloudflare Workers: Use Wrangler to redeploy a previous version or rollback traffic routing
  - Supabase: Use point-in-time recovery to revert to a known good state
- Performance optimization:
  - Minimize payload sizes; leverage CDN caching; optimize database queries and indexes

**Section sources**
- [deploy.yml:34-46](file://.github/workflows/deploy.yml#L34-L46)
- [validate-migrations.mjs:1-43](file://scripts/validate-migrations.mjs#L1-L43)
- [test.yml:35-44](file://.github/workflows/test.yml#L35-L44)

### Release Management and Version Tagging
- Version bumping: Use the release workflow to bump patch/minor/major versions and create annotated tags
- Changelog generation: Automatically generated from git history for the release range
- GitHub Releases: Created with release notes and tags for traceability

**Section sources**
- [release.yml:1-96](file://.github/workflows/release.yml#L1-L96)
- [bump.sh:1-21](file://scripts/bump.sh#L1-L21)

## Dependency Analysis
The deployment pipeline depends on:
- GitHub Actions for orchestration
- Supabase for database and migrations
- Cloudflare Workers for hosting
- Bun and Node.js for build/runtime

```mermaid
graph LR
CI[".github/workflows/ci.yml"] --> Build["Build artifacts"]
TestW[".github/workflows/test.yml"] --> Migrate["Supabase migrations"]
DeployW[".github/workflows/deploy.yml"] --> Workers["Cloudflare Workers"]
Migrate --> Supabase["Supabase"]
Build --> Workers
SupabaseCfg["supabase/config.toml"] --> Supabase
WranglerCfg["wrangler.jsonc"] --> Workers
PKG["package.json"] --> CI
PKG --> TestW
PKG --> DeployW
Seed["supabase/seed.sql"] --> Supabase
```

**Diagram sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)
- [config.toml:1-1](file://supabase/config.toml#L1-L1)
- [wrangler.jsonc:1-8](file://wrangler.jsonc#L1-L8)
- [package.json:1-110](file://package.json#L1-L110)
- [seed.sql:1-44](file://supabase/seed.sql#L1-L44)

**Section sources**
- [ci.yml:1-32](file://.github/workflows/ci.yml#L1-L32)
- [test.yml:1-47](file://.github/workflows/test.yml#L1-L47)
- [deploy.yml:1-53](file://.github/workflows/deploy.yml#L1-L53)
- [config.toml:1-1](file://supabase/config.toml#L1-L1)
- [wrangler.jsonc:1-8](file://wrangler.jsonc#L1-L8)
- [package.json:1-110](file://package.json#L1-L110)

## Performance Considerations
- Optimize build times by caching dependencies and using parallel jobs where appropriate
- Minimize Worker bundle size; enable compression and cache headers
- Use Supabase query optimization and indexes; avoid N+1 queries
- Monitor Worker execution time and cold starts; consider warm-up strategies if needed

## Troubleshooting Guide
- CI fails on migration validation:
  - Inspect migration filenames and content; fix invalid timestamps, empty files, merge conflicts, or unbalanced dollar-quoted blocks
- Tests fail due to missing migrations:
  - Ensure migrations are applied before running tests; verify DB URL resolution and connectivity
- Deployment blocked by missing secrets:
  - Add CLOUDFLARE_API_TOKEN and SUPABASE_DB_URL to repository secrets; confirm environment variable names in the deploy workflow
- Rollback:
  - Re-deploy a known-good Worker version; use Supabase point-in-time recovery

**Section sources**
- [validate-migrations.mjs:1-43](file://scripts/validate-migrations.mjs#L1-L43)
- [test.yml:35-44](file://.github/workflows/test.yml#L35-L44)
- [deploy.yml:34-46](file://.github/workflows/deploy.yml#L34-L46)

## Conclusion
PCReady's deployment pipeline leverages GitHub Actions for CI/CD, Supabase for database operations, and Cloudflare Workers for hosting. The workflows enforce quality gates, validate migrations, and automate releases. For production hardening, complement the existing setup with robust error tracking, performance monitoring, and security best practices. Disaster recovery relies on Supabase-managed backups with manual export capabilities for audits.

## Appendices

### Appendix A: Environment Variables Reference
- Supabase:
  - SUPABASE_URL
  - SUPABASE_PUBLISHABLE_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_PUBLISHABLE_KEY
  - SUPABASE_DB_URL
- Cloudflare:
  - CLOUDFLARE_API_TOKEN
  - CLOUDFLARE_ACCOUNT_ID

**Section sources**
- [ci.yml:10-16](file://.github/workflows/ci.yml#L10-L16)
- [test.yml:11-17](file://.github/workflows/test.yml#L11-L17)
- [deploy.yml:10-16](file://.github/workflows/deploy.yml#L10-L16)

### Appendix B: Supabase Migration Examples
Key migration patterns and examples:

**Ticket Code Generation**
- Uses PostgreSQL sequences and triggers for unique ticket codes
- Prevents race conditions in concurrent insert operations
- Generates codes in format PCT-NNNNN

**Admin RLS Policies**
- Enforces role-based access control for admin users
- Provides selective read/update permissions based on user roles
- Uses custom has_role function for role checking

**Section sources**
- [20260430154500_ticket_code_sequence_trigger.sql:1-42](file://supabase/migrations/20260430154500_ticket_code_sequence_trigger.sql#L1-L42)
- [20260430143000_admin_user_management_rls.sql:1-13](file://supabase/migrations/20260430143000_admin_user_management_rls.sql#L1-L13)

### Appendix C: Database Seeding
Initial data setup for development and testing:
- Email templates for user invitations, password resets, and notifications
- Predefined email template variables and content
- Idempotent seed operations with conflict handling

**Section sources**
- [seed.sql:1-44](file://supabase/seed.sql#L1-L44)