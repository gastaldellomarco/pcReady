/**
 * Portal auth barrel — re-exports from domain-split sub-modules.
 *
 * Sub-modules:
 *   - portal-sessions.server.ts    session lifecycle, validation, types
 *   - portal-password.server.ts    password hashing & verification
 *   - portal-login.server.ts       magic-link, password login, login 2FA
 *   - portal-contacts.server.ts    contact listing for portal sessions
 *   - portal-operator.server.ts    admin/tech guard for link generation
 *   - portal-auth-2fa.server.ts    2FA setup & verification (standalone)
 *   - portal-auth-links.server.ts  access link generation & revocation
 *   - portal-auth-profile.server.ts  profile update, language, history
 *
 * All existing imports from "@/lib/portal-auth.server" continue to work
 * unchanged thanks to this re-export barrel.
 */

export type { PortalBranding, PortalSessionContext } from "./portal-sessions.server";
export {
  portalLoginUrl,
  createPortalSession,
  getPortalSession,
  validatePortalSessionServer,
  logoutPortalSessionServer,
} from "./portal-sessions.server";

export { hashPortalPassword, verifyPortalPassword } from "./portal-password.server";

export {
  requestPortalLoginServer,
  loginPortalWithPasswordServer,
  verifyPortalLogin2FAServer,
} from "./portal-login.server";

export { getPortalClientContactsServer } from "./portal-contacts.server";

export { assertPortalLinkOperator } from "./portal-operator.server";
