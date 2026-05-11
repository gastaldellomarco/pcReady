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
  AUTOMATION_TRIGGERED: "automation.triggered",
  AUTOMATION_FAILED: "automation.failed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_OPTIONS = Object.values(AUDIT_ACTIONS);
