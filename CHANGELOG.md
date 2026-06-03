# Changelog

Tutti i cambiamenti notevoli a questo progetto sono documentati in questo file.
Formato basato su [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

## [1.3.0] - 2026-06-03

### Added
- Refactor activity logging and improve auth profile fetching
- Enhance costs page with date presets and localStorage persistence
- Implement 2FA login flow in portal
- Enhance checklist structure with groups and sections
- Extract reusable Field component for form handling
- Update material_cost precision and add finance extensions
- Implement reusable TicketCard component for Kanban and SwimLane views
- Refactor Kanban components and introduce new features
- Add client detail extensions including notes, tags, documents, and contract alerts
- Enhance event management with client support, recurrence, and reminders
- Add widget annotations feature with CRUD operations
- Update GitHub Actions workflows to use latest action versions and improve accessibility tests
- Enhance ticket navigation and script management
- Add DatePickerInput component and integrate it across various forms
- Add tests for useAutomationRules and flow-builder functionality
- Implement AppShell layout with Sidebar, TopBar, and AuthGuard
- Add hooks for admin audit, settings, and automation management
- Implement virtual list for inventory and tickets pages

### Changed
- Refactor activity logging and improve auth profile fetching
- Enhance costs page with date presets and localStorage persistence
- Reorganize imports and update icon sizes across portal routes
- Implement 2FA login flow in portal
- Enhance checklist structure with groups and sections
- Add UNIQUE constraints to various tables for idempotent seed execution
- Add bundles renewal design spec
- Extract reusable Field component for form handling
- Update material_cost precision and add finance extensions
- Implement reusable TicketCard component for Kanban and SwimLane views
- Refactor Kanban components and introduce new features
- Add client detail extensions including notes, tags, documents, and contract alerts
- Enhance event management with client support, recurrence, and reminders
- Add widget annotations feature with CRUD operations
- Enhance mobile responsiveness and UI improvements across various components
- Update GitHub Actions workflows to use latest action versions and improve accessibility tests
- Enhance ticket navigation and script management
- Add DatePickerInput component and integrate it across various forms
- Add tests for useAutomationRules and flow-builder functionality
- Remove unused runningRuleId state and related logic from useAutomationRules and AutomationsPage
- Reorganize hooks and utilities into src/hooks and src/lib
- Implement AppShell layout with Sidebar, TopBar, and AuthGuard
- Enhance useAdminSettingsForm tests with submit functionality and mocks
- Add hooks for admin audit, settings, and automation management
- Untrack generated routeTree.gen.ts
- Merge branch 'main' of https://github.com/gastaldellomarco/pcReady
- Implement virtual list for inventory and tickets pages

### Fixed
- Enhance costs page with date presets and localStorage persistence

## [1.2.0] - 2026-05-26

### Added

- Enhance localization for bundles and costs with additional assignment management features
- Add delete functionality for client bundle assignments and payments
- Refactor entity label handling and introduce useAssignmentManager hook
- Enhance calendar and input components for Italian locale support
- Add read-only badge to BackupMetric and enhance email validation in AdminUsersTab
- Enhance contract management with editing, validation, and deletion features
- Update ESLint configuration and dependencies, enhance test mocks, and clean up code
- Add MFA policy banners and enhance OAuth consent documentation links
- Enhance localization files with additional error messages and hints for usage and costs
- Enhance AlertDialog component with improved positioning and HTML translation support
- Implement advanced PDF export functionality with support for exporting all filtered results
- Implement infinite scrolling for clients, contacts, tickets, inventory, and scripts

### Changed

- Enhance localization for bundles and costs with additional assignment management features
- Add delete functionality for client bundle assignments and payments
- Refactor entity label handling and introduce useAssignmentManager hook
- Enhance calendar and input components for Italian locale support
- Add read-only badge to BackupMetric and enhance email validation in AdminUsersTab
- Enhance contract management with editing, validation, and deletion features
- Update ESLint configuration and dependencies, enhance test mocks, and clean up code
- Add MFA policy banners and enhance OAuth consent documentation links
- Enhance localization files with additional error messages and hints for usage and costs
- Clear failed test results and remove obsolete error context files
- Enhance AlertDialog component with improved positioning and HTML translation support
- Implement advanced PDF export functionality with support for exporting all filtered results
- Add tests for SwimLaneView component and fix Playwright test issues
- Implement infinite scrolling for clients, contacts, tickets, inventory, and scripts

## [1.1.1] - 2026-05-25

### Added

- Add device management, login, profile, and ticket functionalities
- Add automation form hook and action/condition adapters

### Changed

- Add device management, login, profile, and ticket functionalities
- Add automation form hook and action/condition adapters

## [1.1.0] - 2026-05-24

### Added

- Implement progressive Lighthouse budget strategy with dynamic PDF generation
- Implement post-deploy healthcheck and update Lighthouse CI configuration; add healthcheck script and improve form state management

### Changed

- Add Italian localization for scripts and tickets
- Add comprehensive documentation for Barcode Inventory Management and Device Taxonomy System
- Implement progressive Lighthouse budget strategy with dynamic PDF generation
- Merge branch 'main' of https://github.com/gastaldellomarco/pcReady
- Implement post-deploy healthcheck and update Lighthouse CI configuration; add healthcheck script and improve form state management

## [1.0.0] - 2026-05-21

### Added

- Add caching for Bun dependencies in release and test workflows
- Automate changelog generation and link validation during release process; update scripts for improved functionality
- Implement realtime connection monitoring and UI feedback; add ConnectionBanner component and hooks for connection status
- Enhance mobile responsiveness and accessibility across components; implement break-anywhere utility for better text handling
- Extend device model with asset tag, category, and device type
- Update dependencies and optimize image handling
- Implement OverflowTable component for responsive tables
- Enhance release workflow with changelog updates and version tagging; add update script for changelog management
- Implement maintenance mode configuration and enhance form state management; add deployment documentation and tests
- Enhance file attachment validation and server-side authentication; add role checking and session management improvements
- Add database backup and reset scripts, update config and migrations
- Update project configuration for Cloudflare Workers, add build scripts, and create deployment documentation
- Add assistance bundles feature with tables, triggers, and policies
- Implement month and week views with drag-and-drop functionality
- Enhance Kanban and profile pages with new features and UI improvements
- Add cost management for tickets and client contracts
- Refactor AdminSettingsTab to improve settings organization and add new sections
- Update contact and ticket components with enhanced filtering and display options
- Enhance SLA badge styles with color-mix for better visual feedback
- Implement design system v2 with new color palette and typography
- Implement multi-factor authentication (MFA) support
- Add maintenance scheduling and history management
- Add ticket relations and time tracking features
- Implement bulk ticket operations in Kanban and Tickets pages
- Implement SLA tracking for tickets with configurable thresholds
- Add new widgets and widget management system
- Add device-level activity logging and bulk update features
- Add audit presets for saved filter configurations
- Add validation, risk indicators, and run confirmation dialog
- Upgrade audit logging system to enterprise-grade with retention
- Add email and webhook notification preferences
- Revamp audit logging system with dual views, real-time KPIs, and export features
- Enhance Automation Flow Builder with dual-mode design and advanced UI
- Update and expand deployment and DevOps documentation
- Enhance AutomationBuilder with edge selection and condition/action nodes

### Changed

- Add caching for Bun dependencies in release and test workflows
- Automate changelog generation and link validation during release process; update scripts for improved functionality
- Implement realtime connection monitoring and UI feedback; add ConnectionBanner component and hooks for connection status
- Enhance mobile responsiveness and accessibility across components; implement break-anywhere utility for better text handling
- Extend device model with asset tag, category, and device type
- Update dependencies and optimize image handling
- Implement OverflowTable component for responsive tables
- Use global fetch provided by Node instead of importing node-fetch
- Enhance release workflow with changelog updates and version tagging; add update script for changelog management
- Implement maintenance mode configuration and enhance form state management; add deployment documentation and tests
- Enhance file attachment validation and server-side authentication; add role checking and session management improvements
- Refactor code structure for improved readability and maintainability
- Add database backup and reset scripts, update config and migrations
- Add comprehensive documentation for Cost Management, Maintenance Scheduling, and SLA Tracking Systems
- Update project configuration for Cloudflare Workers, add build scripts, and create deployment documentation
- Refactor notification handling and utility functions; update button and badge components to use variant files; enhance auth provider for better session management; optimize dashboard and checklist components; improve 2FA challenge flow; add utility functions for dashboard and notification icons.
- Update GitHub Actions to use latest action versions and improve error handling
- Merge branch 'main' of https://github.com/gastaldellomarco/pcReady
- Add assistance bundles feature with tables, triggers, and policies
- Update deploy.yml
- Update ci.yml
- Implement month and week views with drag-and-drop functionality
- Enhance Kanban and profile pages with new features and UI improvements
- Add cost management for tickets and client contracts
- Refactor AdminSettingsTab to improve settings organization and add new sections
- Update contact and ticket components with enhanced filtering and display options
- Enhance SLA badge styles with color-mix for better visual feedback
- Implement design system v2 with new color palette and typography
- Implement multi-factor authentication (MFA) support
- Add maintenance scheduling and history management
- Add ticket relations and time tracking features
- Implement bulk ticket operations in Kanban and Tickets pages
- Implement SLA tracking for tickets with configurable thresholds
- Add new widgets and widget management system
- Add device-level activity logging and bulk update features
- Update repowiki metadata file
- Add audit presets for saved filter configurations
- Overhaul audit log tab with new features and improved UX
- Add validation, risk indicators, and run confirmation dialog
- Remove unimplemented enterprise features from docs
- Upgrade audit logging system to enterprise-grade with retention
- Add email and webhook notification preferences
- Revamp audit logging system with dual views, real-time KPIs, and export features
- Filter out retired devices and archived or ready tickets without device
- Enhance Automation Flow Builder with dual-mode design and advanced UI
- Update and expand deployment and DevOps documentation
- Show error message on client list fetch failure
- Add comprehensive Deployment and DevOps guidelines
- Replace download buttons with dropdown menu for export options
- Merge branch 'main' of https://github.com/gastaldellomarco/pcReady
- Enhance AutomationBuilder with edge selection and condition/action nodes

### Fixed

- Show error message on client list fetch failure

## [0.23.0] - 2025-05-19

### Changed

- feat: implement maintenance mode configuration and enhance form state management; add deployment documentation and tests

[0.23.0]: https://github.com/gastaldellomarco/pcReady/compare/vv0.19.0...vv0.23.0
[1.0.0]: https://github.com/gastaldellomarco/pcReady/compare/vv0.23.0...v1.0.0
[1.1.0]: https://github.com/gastaldellomarco/pcReady/compare/v1.0.0...v1.1.0
[1.1.1]: https://github.com/gastaldellomarco/pcReady/compare/v1.1.0...v1.1.1
[1.2.0]: https://github.com/gastaldellomarco/pcReady/compare/v1.1.1...v1.2.0

[Unreleased]: https://github.com/gastaldellomarco/pcReady/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/gastaldellomarco/pcReady/compare/v1.2.0...v1.3.0
