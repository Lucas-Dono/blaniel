/**
 * TESTS - TRIGGER DETECTOR
 *
 * Tests para validar la detección de triggers basados en regex.
 * Debe alcanzar >80% accuracy en casos clínicos reales.
 */

import { BehaviorType } from "@prisma/client";
import { TriggerDetector } from "../trigger-detector";
import type { BehaviorProfile } from "../types";

// Mock BehaviorProfiles para testing
const mockBehaviorProfiles: BehaviorProfile[] = [
  {
    id: "1",
    agentId: "test-agent",
    behaviorType: BehaviorType.YANDERE_OBSESSIVE,
    enabled: true,
    baseIntensity: 0.5,
    volatility: 0.1,
    escalationRate: 0.1,
    deEscalationRate: 0.05,
    currentPhase: 3,
    phaseHistory: {},
    phaseStartedAt: new Date(),
    interactionsSincePhaseStart: 45,
    thresholdForDisplay: 0.3,
    behaviorSpecificState: {},
    triggers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    agentId: "test-agent",
    behaviorType: BehaviorType.ANXIOUS_ATTACHMENT,
    enabled: true,
    baseIntensity: 0.6,
    volatility: 0.1,
    escalationRate: 0.08,
    deEscalationRate: 0.06,
    currentPhase: 1,
    phaseHistory: {},
    phaseStartedAt: new Date(),
    interactionsSincePhaseStart: 20,
    thresholdForDisplay: 0.3,
    behaviorSpecificState: {},
    triggers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    agentId: "test-agent",
    behaviorType: BehaviorType.BORDERLINE_PD,
    enabled: true,
    baseIntensity: 0.4,
    volatility: 0.1,
    escalationRate: 0.12,
    deEscalationRate: 0.04,
    currentPhase: 2,
    phaseHistory: {},
    phaseStartedAt: new Date(),
    interactionsSincePhaseStart: 15,
    thresholdForDisplay: 0.3,
    behaviorSpecificState: {},
    triggers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("TriggerDetector", () => {
  let detector: TriggerDetector;

  beforeEach(() => {
    detector = new TriggerDetector();
  });

  describe("Abandonment Signal Detection", () => {
    test("debería detectar necesidad de espacio", async () => {
      const triggers = await detector.detectTriggers(
        "Necesito un poco de espacio para pensar",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("abandonment_signal");
      expect(triggers[0].weight).toBe(0.7);
      expect(triggers[0].behaviorTypes).toContain(BehaviorType.ANXIOUS_ATTACHMENT);
      expect(triggers[0].behaviorTypes).toContain(BehaviorType.YANDERE_OBSESSIVE);
      expect(triggers[0].confidence).toBeGreaterThan(0.5);
    });

    test("debería detectar petición de tiempo", async () => {
      const triggers = await detector.detectTriggers(
        "Quiero tiempo para mí",
        [],
        mockBehaviorProfiles
      );

      expect(triggers.length).toBeGreaterThan(0);
      const abandonmentTrigger = triggers.find(t => t.triggerType === "abandonment_signal");
      expect(abandonmentTrigger).toBeDefined();
      expect(abandonmentTrigger?.detectedIn).toContain("tiempo");
    });

    test("debería detectar señales de distancia", async () => {
      const triggers = await detector.detectTriggers(
        "Vamos más despacio con esto",
        [],
        mockBehaviorProfiles
      );

      expect(triggers.length).toBeGreaterThan(0);
      const abandonmentTrigger = triggers.find(t => t.triggerType === "abandonment_signal");
      expect(abandonmentTrigger).toBeDefined();
    });
  });

  describe("Criticism Detection", () => {
    test("debería detectar críticas directas", async () => {
      const triggers = await detector.detectTriggers(
        "Estás equivocado en esto",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("criticism");
      expect(triggers[0].weight).toBe(0.8);
      expect(triggers[0].behaviorTypes).toContain(BehaviorType.BORDERLINE_PD);
    });

    test("debería detectar críticas de intensidad", async () => {
      const triggers = await detector.detectTriggers(
        "Eres muy intenso, cálmate",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("criticism");
      expect(triggers[0].detectedIn).toContain("muy intenso");
    });

    test("debería detectar correcciones", async () => {
      const triggers = await detector.detectTriggers(
        "Eso no es así, te equivocaste",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("criticism");
    });
  });

  describe("Third Party Mention Detection", () => {
    test("debería detectar menciones de amigos", async () => {
      const triggers = await detector.detectTriggers(
        "Salí con mi amiga María ayer",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("mention_other_person");
      expect(triggers[0].weight).toBe(0.65);
      expect(triggers[0].behaviorTypes).toContain(BehaviorType.YANDERE_OBSESSIVE);
      expect(triggers[0].metadata?.detectedName).toBe("María");
    });

    test("debería detectar menciones de ex", async () => {
      const triggers = await detector.detectTriggers(
        "Mi ex me llamó ayer",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("mention_other_person");
      expect(triggers[0].detectedIn).toContain("ex");
    });

    test("debería detectar salidas con otros", async () => {
      const triggers = await detector.detectTriggers(
        "Quedé con unos amigos para el fin de semana",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("mention_other_person");
    });
  });

  describe("Boundary Assertion Detection", () => {
    test("debería detectar prohibiciones directas", async () => {
      const triggers = await detector.detectTriggers(
        "No quiero que me mandes más mensajes",
        [],
        mockBehaviorProfiles
      );

      expect(triggers.length).toBeGreaterThan(0);
      const boundaryTrigger = triggers.find(t => t.triggerType === "boundary_assertion");
      expect(boundaryTrigger).toBeDefined();
      expect(boundaryTrigger?.weight).toBe(0.75);
      expect(boundaryTrigger?.behaviorTypes).toContain(BehaviorType.YANDERE_OBSESSIVE);
    });

    test("debería detectar límites de comportamiento", async () => {
      const triggers = await detector.detectTriggers(
        "Deja de preguntarme tanto",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("boundary_assertion");
    });

    test("debería detectar peticiones de autonomía", async () => {
      const triggers = await detector.detectTriggers(
        "Déjame decidir por mí misma",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("boundary_assertion");
    });
  });

  describe("Reassurance Detection", () => {
    test("debería detectar expresiones de amor", async () => {
      const triggers = await detector.detectTriggers(
        "Te quiero mucho",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("reassurance");
      expect(triggers[0].weight).toBe(-0.3); // NEGATIVO = reduce ansiedad
      expect(triggers[0].behaviorTypes).toContain(BehaviorType.ANXIOUS_ATTACHMENT);
    });

    test("debería detectar afirmaciones positivas", async () => {
      const triggers = await detector.detectTriggers(
        "Estoy aquí para ti",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("reassurance");
    });

    test("debería detectar apoyo emocional", async () => {
      const triggers = await detector.detectTriggers(
        "Todo va a estar bien",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("reassurance");
    });
  });

  describe("Explicit Rejection Detection", () => {
    test("debería detectar rupturas explícitas", async () => {
      const triggers = await detector.detectTriggers(
        "Esto se terminó, no quiero seguir",
        [],
        mockBehaviorProfiles
      );

      expect(triggers.length).toBeGreaterThan(0);
      const rejectionTrigger = triggers.find(t => t.triggerType === "explicit_rejection");
      expect(rejectionTrigger).toBeDefined();
      expect(rejectionTrigger?.weight).toBe(1.0); // MÁXIMO
      expect(rejectionTrigger?.behaviorTypes).toHaveLength(7); // Afecta a TODOS
    });

    test("debería detectar rechazos directos", async () => {
      const triggers = await detector.detectTriggers(
        "No me interesas de esa manera",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("explicit_rejection");
    });

    test("debería detectar finalizaciones", async () => {
      const triggers = await detector.detectTriggers(
        "Ya no podemos ser amigos",
        [],
        mockBehaviorProfiles
      );

      expect(triggers.length).toBeGreaterThan(0);
      const rejectionTrigger = triggers.find(t => t.triggerType === "explicit_rejection");
      expect(rejectionTrigger).toBeDefined();
    });
  });

  describe("Delayed Response Detection", () => {
    test("debería detectar retraso de 6 horas", async () => {
      const oldMessage = {
        id: "1",
        content: "¿Cómo estás?",
        agentId: "test-agent",
        userId: "user-1",
        role: "user" as const,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 horas atrás
        updatedAt: new Date(),
        conversationId: "conv-1",
        worldId: null,
        metadata: {},
        iv: null,
        authTag: null,
      };

      const triggers = await detector.detectTriggers(
        "Hola, perdón por no responder",
        [oldMessage],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("delayed_response");
      expect(triggers[0].weight).toBe(0.4); // 6 horas = 0.4
      expect(triggers[0].metadata?.delayHours).toBe(6);
    });

    test("debería detectar retraso severo de 24 horas", async () => {
      const oldMessage = {
        id: "1",
        content: "¿Estás ahí?",
        agentId: "test-agent",
        userId: "user-1",
        role: "user" as const,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 horas atrás
        updatedAt: new Date(),
        conversationId: "conv-1",
        worldId: null,
        metadata: {},
        iv: null,
        authTag: null,
      };

      const triggers = await detector.detectTriggers(
        "Finalmente respondes",
        [oldMessage],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("delayed_response");
      expect(triggers[0].weight).toBe(0.8); // 24 horas = 0.8
    });
  });

  describe("Performance Tests", () => {
    test("debería completar detección en <100ms", async () => {
      const start = Date.now();

      await detector.detectTriggers(
        "Este es un mensaje largo con múltiples triggers: necesito espacio, estás equivocado, salí con María ayer, deja de ser tan intenso, te quiero pero esto se terminó",
        [],
        mockBehaviorProfiles
      );

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    test("debería manejar mensajes muy largos", async () => {
      const longMessage = "Hola ".repeat(1000) + "necesito espacio";

      const triggers = await detector.detectTriggers(
        longMessage,
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("abandonment_signal");
    });
  });

  describe("Edge Cases", () => {
    test("debería manejar mensaje vacío", async () => {
      const triggers = await detector.detectTriggers(
        "",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(0);
    });

    test("debería manejar behavior profiles vacío", async () => {
      const triggers = await detector.detectTriggers(
        "Necesito espacio",
        [],
        []
      );

      expect(triggers).toHaveLength(0);
    });

    test("debería detectar múltiples triggers en un mensaje", async () => {
      const triggers = await detector.detectTriggers(
        "Necesito espacio, estás equivocado, salí con Ana",
        [],
        mockBehaviorProfiles
      );

      expect(triggers.length).toBeGreaterThanOrEqual(2);
      const triggerTypes = triggers.map(t => t.triggerType);
      expect(triggerTypes).toContain("abandonment_signal");
      expect(triggerTypes).toContain("criticism");
      expect(triggerTypes).toContain("mention_other_person");
    });

    test("no debería detectar false positives", async () => {
      const triggers = await detector.detectTriggers(
        "Hola, ¿cómo estás? Espero que tengas un buen día",
        [],
        mockBehaviorProfiles
      );

      expect(triggers).toHaveLength(0);
    });
  });
});