import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { config } from "dotenv";

// Load test environment variables
config({ path: ".env.test" });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts", "./__tests__/setup.ts"],
    testTimeout: 10000, // 10 seconds for slow tests
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "coverage/",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    env: {
      // Test environment variables (loaded from .env.test)
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/creador_inteligencias_test",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "test-secret-min-32-chars-long-123456",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
