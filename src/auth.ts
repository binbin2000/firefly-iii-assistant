import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import {
  getGroupsClaimName,
  getRequiredGroup,
  hasRequiredGroup,
  isOidcConfigured,
} from "@/lib/auth-status";

const oidcConfigured = isOidcConfigured();

const providers: Provider[] = oidcConfigured
  ? [
      {
        id: "oidc",
        name: process.env.OIDC_PROVIDER_NAME || "Single Sign-On",
        type: "oidc",
        issuer: process.env.OIDC_ISSUER,
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
      },
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  trustHost: true,
  // Auth.js validates every request before our proxy callback runs. It still
  // requires a secret when OIDC is disabled, even though no session is used.
  // This fallback is only reachable while there are no configured providers;
  // a complete OIDC configuration always uses the deployment's AUTH_SECRET.
  secret: oidcConfigured
    ? process.env.AUTH_SECRET
    : "firefly-iii-assistant-auth-disabled",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const requiredGroup = getRequiredGroup();

      if (!requiredGroup) {
        return true;
      }

      const claimValue = (profile as Record<string, unknown> | undefined)?.[getGroupsClaimName()];

      return hasRequiredGroup(claimValue, requiredGroup) ? true : "/login?error=AccessDenied";
    },
  },
});
