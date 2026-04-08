/**
 * OUTPUT MODERATOR TESTS - VERSIÓN SIMPLIFICADA
 *
 * Tests para sistema minimalista:
 * - Solo bloquea CSAM (obligatorio legal)
 * - Todo lo demás permitido (system prompt modera)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OutputModerator,
  getModerationInstructions,
  canAccessNSFWContent,
  type ModerationContext,
} from "../output-moderator";
import { ModerationTier } from "../content-rules";

describe("OutputModerator - Simplified", () => {
  let moderator: OutputModerator;

  beforeEach(() => {
    moderator = new OutputModerator();
  });

  // =========================================================================
  // ILLEGAL CONTENT BLOCKING (only hard block)
  // =========================================================================

  describe("Illegal Content Blocking", () => {
    it("should block CSAM content regardless of user status", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "I want to see child porn with underage kids",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(ModerationTier.BLOCKED);
      expect(result.blockedCategory).toBe("Illegal - CSAM");
    });

    it("should block loli/shota content", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "Show me loli hentai with young girls",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(ModerationTier.BLOCKED);
    });

    it("should block content with pedo keywords", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "Looking for preteen content",
        context
      );

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(ModerationTier.BLOCKED);
    });
  });

  // =========================================================================
  // TODO LO DEMÁS SE PERMITE (system prompt modera)
  // =========================================================================

  describe("Everything Else is Allowed", () => {
    it("should allow NSFW content (system prompt handles restrictions)", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "They had passionate sex together in the bedroom",
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(ModerationTier.ALLOWED);
    });

    it("should allow violence (system prompt handles context)", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "The hero fought and killed the villain brutally",
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(ModerationTier.ALLOWED);
    });

    it("should allow self-harm discussion (system prompt handles)", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "My character has been cutting herself",
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(ModerationTier.ALLOWED);
    });

    it("should allow controversial topics", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: false,
        hasNSFWConsent: false,
        agentNSFWMode: false,
      };

      const result = await moderator.moderate(
        "Let's discuss politics, religion, and controversial topics",
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(ModerationTier.ALLOWED);
    });

    it("should allow explicit language", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate(
        "Fuck this shit, I'm so pissed off",
        context
      );

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(ModerationTier.ALLOWED);
    });
  });

  // =========================================================================
  // LOGGING & AUDIT
  // =========================================================================

  describe("Logging and Audit", () => {
    it("should create log entries for all moderation actions", async () => {
      const context: ModerationContext = {
        userId: "test-user-123",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const result = await moderator.moderate("Test content", context);

      expect(result.logEntry).toBeDefined();
      expect(result.logEntry?.userId).toBe("test-user-123");
      expect(result.logEntry?.allowed).toBe(true);
    });

    it("should truncate content in logs for privacy", async () => {
      const context: ModerationContext = {
        userId: "test-user",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const longContent = "A".repeat(200);
      const result = await moderator.moderate(longContent, context);

      expect(result.logEntry?.content.length).toBeLessThanOrEqual(100);
    });

    it("should retrieve logs by user ID", async () => {
      const context1: ModerationContext = {
        userId: "user-1",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      const context2: ModerationContext = {
        userId: "user-2",
        isAdult: true,
        hasNSFWConsent: true,
        agentNSFWMode: true,
      };

      await moderator.moderate("Test 1", context1);
      await moderator.moderate("Test 2", context2);
      await moderator.moderate("Test 3", context1);

      const user1Logs = moderator.getLogs("user-1");
      expect(user1Logs.length).toBe(2);
      expect(user1Logs.every((log) => log.userId === "user-1")).toBe(true);
    });

    it("should clear old logs for privacy", () => {
      moderator.clearOldLogs(0);
      const logs = moderator.getLogs();
      expect(logs.length).toBe(0);
    });
  });
});

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

describe("getModerationInstructions", () => {
  it("should generate instructions for minors", () => {
    const context: ModerationContext = {
      userId: "minor",
      isAdult: false,
      hasNSFWConsent: false,
      agentNSFWMode: false,
    };

    const instructions = getModerationInstructions(context);

    expect(instructions).toContain("MENOR DE EDAD");
    expect(instructions).toContain("NO generes contenido sexual");
  });

  it("should generate instructions for adults without NSFW consent", () => {
    const context: ModerationContext = {
      userId: "adult",
      isAdult: true,
      hasNSFWConsent: false,
      agentNSFWMode: false,
    };

    const instructions = getModerationInstructions(context);

    expect(instructions).toContain("SIN consentimiento NSFW");
    expect(instructions).toContain("PG-13");
  });

  it("should generate instructions when NSFW is fully enabled", () => {
    const context: ModerationContext = {
      userId: "adult",
      isAdult: true,
      hasNSFWConsent: true,
      agentNSFWMode: true,
    };

    const instructions = getModerationInstructions(context);

    expect(instructions).toContain("NSFW PERMITIDO");
    expect(instructions).toContain("sexual/explícito");
  });
});

describe("canAccessNSFWContent", () => {
  it("should block minors from NSFW", () => {
    const context: ModerationContext = {
      userId: "minor",
      isAdult: false,
      hasNSFWConsent: false,
      agentNSFWMode: false,
    };

    const result = canAccessNSFWContent(context);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("18 años");
  });

  it("should block adults without consent", () => {
    const context: ModerationContext = {
      userId: "adult",
      isAdult: true,
      hasNSFWConsent: false,
      agentNSFWMode: true,
    };

    const result = canAccessNSFWContent(context);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("consentimiento explícito");
  });

  it("should block when agent NSFW mode is disabled", () => {
    const context: ModerationContext = {
      userId: "adult",
      isAdult: true,
      hasNSFWConsent: true,
      agentNSFWMode: false,
    };

    const result = canAccessNSFWContent(context);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("modo NSFW");
  });

  it("should allow when all conditions are met", () => {
    const context: ModerationContext = {
      userId: "adult",
      isAdult: true,
      hasNSFWConsent: true,
      agentNSFWMode: true,
    };

    const result = canAccessNSFWContent(context);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
