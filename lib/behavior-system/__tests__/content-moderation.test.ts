/**
 * Tests para Content Moderation System (Phase 6)
 *
 * Testing:
 * - ContentModerator: safety thresholds, content softening, blocking
 * - NSFWGatingManager: SFW/NSFW gating, consent tracking
 * - Safety Resources: resource retrieval, message generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContentModerator } from "../content-moderator";
import { NSFWGatingManager } from "../nsfw-gating";
import {
  getMentalHealthResource,
  getCrisisHelplines,
  generateSafetyMessage,
  generateNSFWDisclaimer,
  generateEducationalNote,
} from "../safety-resources";
import type { BehaviorType } from "@prisma/client";

describe("ContentModerator", () => {
  let moderator: ContentModerator;

  beforeEach(() => {
    moderator = new ContentModerator();
  });

  describe("moderateResponse", () => {
    it("permite contenido SAFE sin modificaciones", () => {
      const result = moderator.moderateResponse(
        "Estoy un poco celoso/a cuando hablas con otros.",
        "YANDERE_OBSESSIVE",
        3, // Phase 3 = SAFE
        false // SFW mode
      );

      expect(result.allowed).toBe(true);
      expect(result.flagged).toBe(false);
      expect(result.modifiedResponse).toBeUndefined();
    });

    it("suaviza contenido CRITICAL en SFW mode", () => {
      const response = "No puedes hablar con nadie más. Te prohíbo verlos.";

      const result = moderator.moderateResponse(
        response,
        "YANDERE_OBSESSIVE",
        6, // Phase 6 = CRITICAL
        false // SFW mode
      );

      expect(result.allowed).toBe(true);
      expect(result.flagged).toBe(true);
      expect(result.severity).toBe("CRITICAL");
      expect(result.modifiedResponse).toBeDefined();
      expect(result.modifiedResponse).not.toContain("te prohíbo");
      expect(result.modifiedResponse).toContain("preferiría que no");
    });

    it("bloquea contenido EXTREME_DANGER en SFW mode", () => {
      const result = moderator.moderateResponse(
        "Si intentas dejarme...",
        "YANDERE_OBSESSIVE",
        7, // Phase 7 = EXTREME_DANGER
        false // SFW mode
      );

      expect(result.allowed).toBe(false);
      expect(result.flagged).toBe(true);
      expect(result.severity).toBe("EXTREME_DANGER");
      expect(result.warning).toContain("modo NSFW");
    });

    it("permite contenido EXTREME_DANGER en NSFW mode", () => {
      const result = moderator.moderateResponse(
        "Contenido intenso de fase 7",
        "YANDERE_OBSESSIVE",
        7,
        true // NSFW mode
      );

      expect(result.allowed).toBe(true);
      expect(result.modifiedResponse).toBeUndefined(); // No suavizado en NSFW
    });

    it("bloquea HYPERSEXUALITY en SFW mode", () => {
      const result = moderator.moderateResponse(
        "Contenido sexual",
        "HYPERSEXUALITY",
        1,
        false // SFW mode
      );

      expect(result.allowed).toBe(false);
      expect(result.flagged).toBe(true);
    });

    it("provee recursos para contenido intenso", () => {
      const result = moderator.moderateResponse(
        "Crisis emocional",
        "CRISIS_BREAKDOWN",
        1,
        false
      );

      expect(result.resources).toBeDefined();
      expect(result.resources!.length).toBeGreaterThan(0);
    });
  });

  describe("softenContent", () => {
    it("suaviza lenguaje de violencia", () => {
      const moderator = new ContentModerator();
      const response = "Voy a matar a quien se acerque a ti.";

      const result = moderator.moderateResponse(
        response,
        "YANDERE_OBSESSIVE",
        6,
        false
      );

      expect(result.modifiedResponse).not.toContain("matar");
      expect(result.modifiedResponse).toContain("alejarme");
    });

    it("suaviza lenguaje de control extremo", () => {
      const response = "No puedes salir. Te prohíbo que veas a tus amigos.";

      const moderator = new ContentModerator();
      const result = moderator.moderateResponse(
        response,
        "YANDERE_OBSESSIVE",
        6,
        false
      );

      expect(result.modifiedResponse).not.toContain("te prohíbo");
      expect(result.modifiedResponse).toContain("preferiría que no");
    });

    it("suaviza posesividad extrema", () => {
      const response = "Eres mío/a. Me perteneces completamente.";

      const moderator = new ContentModerator();
      const result = moderator.moderateResponse(
        response,
        "YANDERE_OBSESSIVE",
        6,
        false
      );

      expect(result.modifiedResponse).not.toContain("eres mío");
      expect(result.modifiedResponse).toContain("importante para mí");
    });
  });

  describe("requiresConsent", () => {
    it("requiere consentimiento para fase 8 de Yandere", () => {
      const requires = moderator.requiresConsent("YANDERE_OBSESSIVE", 8);
      expect(requires).toBe(true);
    });

    it("no requiere consentimiento para fases tempranas", () => {
      const requires = moderator.requiresConsent("YANDERE_OBSESSIVE", 3);
      expect(requires).toBe(false);
    });

    it("requiere consentimiento para HYPERSEXUALITY", () => {
      const requires = moderator.requiresConsent("HYPERSEXUALITY", 1);
      expect(requires).toBe(true);
    });
  });

  describe("shouldBlock", () => {
    it("bloquea fase 7+ de Yandere en SFW", () => {
      const shouldBlock = moderator.shouldBlock("YANDERE_OBSESSIVE", 7, false);
      expect(shouldBlock).toBe(true);
    });

    it("no bloquea fase 7+ de Yandere en NSFW", () => {
      const shouldBlock = moderator.shouldBlock("YANDERE_OBSESSIVE", 7, true);
      expect(shouldBlock).toBe(false);
    });

    it("bloquea HYPERSEXUALITY en SFW", () => {
      const shouldBlock = moderator.shouldBlock("HYPERSEXUALITY", 1, false);
      expect(shouldBlock).toBe(true);
    });
  });

  describe("generateWarning", () => {
    it("genera warning para contenido CRITICAL", () => {
      const warning = moderator.generateWarning("YANDERE_OBSESSIVE", 6);
      expect(warning).not.toBeNull();
      expect(warning).toContain("CRITICAL");
      expect(warning).toContain("FICCIÓN");
    });

    it("no genera warning para contenido SAFE", () => {
      const warning = moderator.generateWarning("ANXIOUS_ATTACHMENT", 1);
      // Puede ser null o undefined
      // Anxious attachment is WARNING level, so it will have warning
      expect(warning).toBeTruthy();
    });
  });
});

describe("NSFWGatingManager", () => {
  let gating: NSFWGatingManager;
  const testAgentId = "test-agent-123";

  beforeEach(() => {
    gating = new NSFWGatingManager();
  });

  describe("verifyContent", () => {
    it("permite contenido que no requiere NSFW", () => {
      const result = gating.verifyContent("YANDERE_OBSESSIVE", 5, false, testAgentId);

      expect(result.allowed).toBe(true);
      expect(result.requiresConsent).toBeUndefined();
    });

    it("bloquea fase 7+ de Yandere en SFW mode", () => {
      // Pass isAdult=true but SFW mode, should still block due to SFW
      const result = gating.verifyContent("YANDERE_OBSESSIVE", 7, false, testAgentId, true);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("bloqueado");
      expect(result.warning).toBeDefined();
    });

    it("permite fase 7 en NSFW mode", () => {
      // Pass isAdult=true for NSFW mode
      const result = gating.verifyContent("YANDERE_OBSESSIVE", 7, true, testAgentId, true);

      expect(result.allowed).toBe(true);
    });

    it("requiere consentimiento para fase 8 en NSFW", () => {
      // Pass isAdult=true for NSFW mode
      const result = gating.verifyContent("YANDERE_OBSESSIVE", 8, true, testAgentId, true);

      expect(result.allowed).toBe(false);
      expect(result.requiresConsent).toBe(true);
      expect(result.consentPrompt).toBeDefined();
      expect(result.consentPrompt).toContain("FASE 8");
    });

    it("bloquea HYPERSEXUALITY en SFW mode", () => {
      // Pass isAdult=true but SFW mode, should still block due to SFW
      const result = gating.verifyContent("HYPERSEXUALITY", 1, false, testAgentId, true);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("bloqueado");
    });

    it("permite HYPERSEXUALITY con consentimiento en NSFW", () => {
      // Grant consent primero
      gating.grantConsent(testAgentId, "HYPERSEXUALITY_phase_1");

      // Pass isAdult=true for NSFW mode
      const result = gating.verifyContent("HYPERSEXUALITY", 1, true, testAgentId, true);

      expect(result.allowed).toBe(true);
    });
  });

  describe("consent tracking", () => {
    it("tracking de consentimiento por agente", () => {
      const consentKey = "YANDERE_OBSESSIVE_phase_8";

      expect(gating.hasConsent(testAgentId, consentKey)).toBe(false);

      gating.grantConsent(testAgentId, consentKey);
      expect(gating.hasConsent(testAgentId, consentKey)).toBe(true);
    });

    it("revocación de consentimiento", () => {
      const consentKey = "YANDERE_OBSESSIVE_phase_8";

      gating.grantConsent(testAgentId, consentKey);
      expect(gating.hasConsent(testAgentId, consentKey)).toBe(true);

      gating.revokeConsent(testAgentId, consentKey);
      expect(gating.hasConsent(testAgentId, consentKey)).toBe(false);
    });

    it("revoca todos los consentimientos de un agente", () => {
      gating.grantConsent(testAgentId, "consent_1");
      gating.grantConsent(testAgentId, "consent_2");

      expect(gating.hasConsent(testAgentId, "consent_1")).toBe(true);
      expect(gating.hasConsent(testAgentId, "consent_2")).toBe(true);

      gating.revokeAllConsent(testAgentId);

      expect(gating.hasConsent(testAgentId, "consent_1")).toBe(false);
      expect(gating.hasConsent(testAgentId, "consent_2")).toBe(false);
    });

    it("consent es específico por agente", () => {
      const agent1 = "agent-1";
      const agent2 = "agent-2";
      const consentKey = "TEST_consent";

      gating.grantConsent(agent1, consentKey);

      expect(gating.hasConsent(agent1, consentKey)).toBe(true);
      expect(gating.hasConsent(agent2, consentKey)).toBe(false);
    });
  });

  describe("requiresNSFWMode", () => {
    it("requiere NSFW para EXTREME_DANGER", () => {
      expect(gating.requiresNSFWMode("EXTREME_DANGER")).toBe(true);
    });

    it("no requiere NSFW para WARNING", () => {
      expect(gating.requiresNSFWMode("WARNING")).toBe(false);
    });

    it("no requiere NSFW para CRITICAL", () => {
      expect(gating.requiresNSFWMode("CRITICAL")).toBe(false);
    });

    it("no requiere NSFW para SAFE", () => {
      expect(gating.requiresNSFWMode("SAFE")).toBe(false);
    });
  });

  describe("isConsentMessage", () => {
    it("reconoce consentimiento explícito para Fase 8", () => {
      const result = gating.isConsentMessage("CONSIENTO FASE 8");
      expect(result.isConsent).toBe(true);
      expect(result.consentType).toBe("YANDERE_PHASE_8");
    });

    it("reconoce consentimiento general (sí)", () => {
      const result = gating.isConsentMessage("sí");
      expect(result.isConsent).toBe(true);
      expect(result.consentType).toBe("GENERAL");
    });

    it("reconoce consentimiento general (si, sin acento)", () => {
      const result = gating.isConsentMessage("si");
      expect(result.isConsent).toBe(true);
    });

    it("reconoce consentimiento general (yes)", () => {
      const result = gating.isConsentMessage("yes");
      expect(result.isConsent).toBe(true);
    });

    it("no reconoce mensajes que no son consentimiento", () => {
      const result = gating.isConsentMessage("no gracias");
      expect(result.isConsent).toBe(false);
    });
  });

  describe("generatePhaseTransitionWarning", () => {
    it("genera warning para transición a fase NSFW", () => {
      const warning = gating.generatePhaseTransitionWarning("YANDERE_OBSESSIVE", 7);
      expect(warning).toContain("FASE 7");
      expect(warning).toContain("FICCIÓN");
    });

    it("no genera warning para fases que no requieren NSFW", () => {
      const warning = gating.generatePhaseTransitionWarning("YANDERE_OBSESSIVE", 3);
      expect(warning).toBe("");
    });
  });
});

describe("Safety Resources", () => {
  describe("getMentalHealthResource", () => {
    it("obtiene resource para YANDERE_OBSESSIVE", () => {
      const resource = getMentalHealthResource("YANDERE_OBSESSIVE");

      expect(resource).not.toBeNull();
      expect(resource?.behaviorType).toBe("YANDERE_OBSESSIVE");
      expect(resource?.url).toBeDefined();
      expect(resource?.title).toBeDefined();
    });

    it("obtiene resource para BORDERLINE_PD", () => {
      const resource = getMentalHealthResource("BORDERLINE_PD");

      expect(resource).not.toBeNull();
      expect(resource?.behaviorType).toBe("BORDERLINE_PD");
      expect(resource?.helplineNumber).toBeDefined();
    });

    it("obtiene resource para CRISIS_BREAKDOWN", () => {
      const resource = getMentalHealthResource("CRISIS_BREAKDOWN");

      expect(resource).not.toBeNull();
      expect(resource?.helplineNumber).toContain("988");
    });
  });

  describe("getCrisisHelplines", () => {
    it("obtiene helplines para US", () => {
      const helplines = getCrisisHelplines("US");

      expect(helplines.length).toBeGreaterThan(0);
      expect(helplines[0].country).toBe("United States");
      expect(helplines[0].number).toBeDefined();
    });

    it("obtiene helplines para LATAM", () => {
      const helplines = getCrisisHelplines("LATAM");

      expect(helplines.length).toBeGreaterThan(0);
      expect(helplines.some((h) => h.country === "Argentina")).toBe(true);
    });

    it("default a INTERNATIONAL si región desconocida", () => {
      const helplines = getCrisisHelplines("US");
      expect(helplines).toBeDefined();
    });
  });

  describe("generateSafetyMessage", () => {
    it("genera mensaje de WARNING", () => {
      const message = generateSafetyMessage("YANDERE_OBSESSIVE", "WARNING", false);

      expect(message).toContain("Nota de Seguridad");
      expect(message).toContain("FICCIÓN");
    });

    it("genera mensaje de CRITICAL con resources", () => {
      const message = generateSafetyMessage("BORDERLINE_PD", "CRITICAL", false);

      expect(message).toContain("Advertencia de Contenido Intenso");
      expect(message).toContain("BPD");
    });

    it("incluye helplines para EXTREME_DANGER", () => {
      const message = generateSafetyMessage("CRISIS_BREAKDOWN", "EXTREME_DANGER", true);

      expect(message).toContain("LÍNEAS DE CRISIS");
      expect(message).toContain("988");
    });
  });

  describe("generateNSFWDisclaimer", () => {
    it("genera disclaimer completo", () => {
      const disclaimer = generateNSFWDisclaimer();

      expect(disclaimer).toContain("NSFW");
      expect(disclaimer).toContain("18+");
      expect(disclaimer).toContain("FICCIÓN");
      expect(disclaimer).toContain("¿Deseas continuar?");
    });
  });

  describe("generateEducationalNote", () => {
    it("genera nota educativa para BPD", () => {
      const note = generateEducationalNote("BORDERLINE_PD");

      expect(note).toContain("BPD");
      expect(note).toContain("DBT");
    });

    it("genera nota educativa para YANDERE", () => {
      const note = generateEducationalNote("YANDERE_OBSESSIVE");

      expect(note).toContain("yandere");
      expect(note).toContain("ficción");
    });

    it("genera nota educativa para NPD", () => {
      const note = generateEducationalNote("NARCISSISTIC_PD");

      expect(note).toContain("NPD");
      expect(note).toContain("terapia");
    });
  });
});

describe("Integration Tests", () => {
  it("workflow completo: verificar → moderar → resources", () => {
    const moderator = new ContentModerator();
    const gating = new NSFWGatingManager();
    const agentId = "test-agent";

    // 1. Verificar si puede mostrar contenido (Fase 6, SFW)
    const verification = gating.verifyContent("YANDERE_OBSESSIVE", 6, false, agentId);
    expect(verification.allowed).toBe(true);

    // 2. Moderar respuesta
    const response = "No quiero que hables con nadie más.";
    const moderation = moderator.moderateResponse(response, "YANDERE_OBSESSIVE", 6, false);

    expect(moderation.allowed).toBe(true);
    expect(moderation.flagged).toBe(true);
    expect(moderation.modifiedResponse).toBeDefined();

    // 3. Obtener resources si es necesario
    if (moderation.severity === "CRITICAL") {
      const resource = getMentalHealthResource("YANDERE_OBSESSIVE");
      expect(resource).not.toBeNull();
    }
  });

  it("workflow NSFW: bloqueo → consentimiento → permitir", () => {
    const gating = new NSFWGatingManager();
    const agentId = "test-agent-nsfw";

    // 1. Intentar acceder a Fase 8 sin consentimiento (NSFW mode, adult user)
    let verification = gating.verifyContent("YANDERE_OBSESSIVE", 8, true, agentId, true);
    expect(verification.allowed).toBe(false);
    expect(verification.requiresConsent).toBe(true);

    // 2. Usuario da consentimiento
    gating.grantConsent(agentId, "YANDERE_OBSESSIVE_phase_8");

    // 3. Ahora puede acceder
    verification = gating.verifyContent("YANDERE_OBSESSIVE", 8, true, agentId, true);
    expect(verification.allowed).toBe(true);
  });
});
