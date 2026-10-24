import type { SsoProvider, SsoSettings } from "@passbox/api-client";

/**
 * Presets for common identity providers: the issuer format to type and the
 * claim settings that work out of the box. Every provider uses the same
 * generic OpenID Connect code; see docs/self-hosting.md for step-by-step
 * setup per provider.
 */
export interface ProviderPreset {
  id: SsoProvider;
  label: string;
  issuerPlaceholder: string;
  defaults: Partial<SsoSettings>;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "entra",
    label: "Microsoft Entra ID",
    issuerPlaceholder: "https://login.microsoftonline.com/<tenant-id>/v2.0",
    // Entra ID sends no email_verified claim; the tenant vouches for the address.
    defaults: { emailClaim: "email", requireVerifiedEmail: false, groupsClaim: "groups" },
  },
  {
    id: "google",
    label: "Google Workspace",
    issuerPlaceholder: "https://accounts.google.com",
    defaults: { emailClaim: "email", requireVerifiedEmail: true, groupsClaim: "groups" },
  },
  {
    id: "okta",
    label: "Okta",
    issuerPlaceholder: "https://<your-org>.okta.com/oauth2/default",
    defaults: { emailClaim: "email", requireVerifiedEmail: true, groupsClaim: "groups" },
  },
  {
    id: "keycloak",
    label: "Keycloak",
    issuerPlaceholder: "https://<host>/realms/<realm>",
    defaults: { emailClaim: "email", requireVerifiedEmail: true, groupsClaim: "groups" },
  },
  {
    id: "authentik",
    label: "authentik",
    issuerPlaceholder: "https://<host>/application/o/<slug>/",
    defaults: { emailClaim: "email", requireVerifiedEmail: true, groupsClaim: "groups" },
  },
  {
    id: "zitadel",
    label: "ZITADEL",
    issuerPlaceholder: "https://<instance>.zitadel.cloud",
    defaults: { emailClaim: "email", requireVerifiedEmail: true, groupsClaim: "groups" },
  },
  {
    id: "generic",
    label: "OpenID Connect",
    issuerPlaceholder: "https://idp.example.com",
    defaults: { emailClaim: "email", requireVerifiedEmail: true, groupsClaim: "groups" },
  },
];

export function preset(id: SsoProvider): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? (PROVIDERS[PROVIDERS.length - 1] as ProviderPreset);
}

export const EMPTY_SETTINGS: SsoSettings = {
  enabled: false,
  required: false,
  allowDeviceUnlock: false,
  provider: "generic",
  displayName: "",
  issuer: "",
  clientId: "",
  tokenAuthMethod: "client_secret_basic",
  scopes: "openid email profile",
  emailClaim: "email",
  requireVerifiedEmail: true,
  nameClaim: "name",
  groupsClaim: "groups",
  allowedDomains: [],
  reauthHours: 12,
};
