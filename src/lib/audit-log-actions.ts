export const AUDIT_ACTIONS = {
  TICKET_CREATED: "ticket.created",
  TICKET_STATUS_CHANGED: "ticket.status_changed",
  TICKET_ASSIGNED: "ticket.assigned",
  TICKET_DELETED: "ticket.deleted",
  DEVICE_CREATED: "device.created",
  DEVICE_DELETED: "device.deleted",
  DEVICE_ASSIGNED: "device.assigned",
  CLIENT_CREATED: "client.created",
  CLIENT_DELETED: "client.deleted",
  USER_INVITED: "user.invited",
  USER_DISABLED: "user.disabled",
  SETTINGS_UPDATED: "settings.updated",
  OAUTH_CLIENT_CREATED: "oauth.client_created",
  OAUTH_CLIENT_DISABLED: "oauth.client_disabled",
  OAUTH_CLIENT_ENABLED: "oauth.client_enabled",
  OAUTH_CLIENT_REVOKED: "oauth.client_revoked",
  OAUTH_CLIENT_SECRET_ROTATED: "oauth.client_secret_rotated",
  AUTOMATION_TRIGGERED: "automation.triggered",
  AUTOMATION_FAILED: "automation.failed",
  PORTAL_LINK_GENERATED: "portal.link_generated",
  PORTAL_LINK_REVOKED: "portal.link_revoked",
} as const;

/**
 *
 */
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_OPTIONS = Object.values(AUDIT_ACTIONS);
