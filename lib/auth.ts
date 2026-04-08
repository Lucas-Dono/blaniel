import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    expo(), // Enable Expo/React Native support
    twoFactor({
      issuer: "Blaniel",
      totpOptions: {
        // Validity period of the TOTP code (30 seconds is standard)
        period: 30,
        // Number of digits of the code
        digits: 6,
      },
      backupCodeOptions: {
        // Number of backup codes
        amount: 10,
        // Length of each code
        length: 10,
      },
    }),
  ],
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    // Expo scheme
    "blaniel://",
    // Development mode - Expo's exp:// scheme with local IP ranges
    ...(process.env.NODE_ENV === "development" ? [
      "exp://",
      "exp://**",
      "exp://192.168.*.*:*/**",
    ] : [])
  ].filter(Boolean) as string[],
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
    // Fix state_mismatch error in OAuth flow
    cookies: {
      oauth_state: {
        name: "better-auth.oauth_state",
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 10, // 10 minutes
        },
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  // SECURITY: Cookie configuration with security flags
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes in memory
    },
  },
  cookies: {
    sessionToken: {
      name: "better-auth.session_token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
