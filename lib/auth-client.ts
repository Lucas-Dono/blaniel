import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  // IMPORTANT: Enable cookies for session
  fetchOptions: {
    credentials: "include", // Include cookies in all requests
  },
  plugins: [
    twoFactorClient({
      // Redirect when 2FA verification is required
      onTwoFactorRedirect() {
        if (typeof window !== "undefined") {
          window.location.href = "/login/verify-2fa";
        }
      },
    }),
  ],
});

export const { useSession, signIn, signOut, signUp } = authClient;
