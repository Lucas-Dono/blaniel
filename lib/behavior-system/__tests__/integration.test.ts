/**
 * INTEGRATION TESTS - BEHAVIOR SYSTEM
 *
 * Tests de integración que validan que todo el sistema de triggers funciona junto.
 */

import { BehaviorType } from "@prisma/client";
import { TriggerDetector } from "../trigger-detector";
import { calculateTriggerImpact } from "../trigger-processor";
import type { BehaviorProfile } from "../types";

describe("Behavior System Integration", () => {
  let detector: TriggerDetector;

  beforeEach(() => {
    detector = new TriggerDetector();
  });

  // Mock BehaviorProfile para tests de integración
  const mockProfile = {
    id: "profile-1",
    agentId: "test-agent",
    behaviorType: BehaviorType.YANDERE_OBSESSIVE,
    enabled: true,
    baseIntensity: 0.5,
    escalationRate: 0.1,
    deEscalationRate: 0.05,
    volatility: 0.5,
    currentPhase: 3,
    phaseStartedAt: new Date(),
    phaseHistory: [],
    triggers: {},
    thresholdForDisplay: 0.3,
    behaviorSpecificState: null,
    interactionsSincePhaseStart: 45,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("Flujo completo de detección y procesamiento", () => {
    test("debería detectar y procesar abandonment signal correctamente", async () => {
      // 1. DETECTION: User sends message with abandonment signal
      const triggers = await detector.detectTriggers(
        "Necesito un poco de espacio para pensar",
        [],
        [mockProfile]
      );

      // 2. VERIFICACIÓN: Trigger detectado correctamente
      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("abandonment_signal");
      expect(triggers[0].weight).toBe(0.7);
      expect(triggers[0].behaviorTypes).toContain(BehaviorType.YANDERE_OBSESSIVE);
      expect(triggers[0].confidence).toBeGreaterThan(0.5);

      // 3. PROCESAMIENTO: Calcular impacto en intensidad
      const impact = calculateTriggerImpact(triggers, BehaviorType.YANDERE_OBSESSIVE);
      expect(impact).toBeGreaterThan(0); // Debe incrementar intensidad

      // 4. RESULTADO: Nueva intensidad calculada
      const newIntensity = Math.min(1.0, mockProfile.baseIntensity + (impact * mockProfile.escalationRate));
      expect(newIntensity).toBeGreaterThan(mockProfile.baseIntensity);
    });

    test("debería manejar múltiples triggers en un mensaje", async () => {
      // Mensaje con múltiples triggers
      const message = "Necesito espacio, estás equivocado, salí con María ayer";

      const triggers = await detector.detectTriggers(message, [], [mockProfile]);

      // Debe detectar múltiples triggers
      expect(triggers.length).toBeGreaterThan(1);

      const triggerTypes = triggers.map(t => t.triggerType);
      expect(triggerTypes).toContain("abandonment_signal");

      // Puede contener criticism o mention_other_person dependiendo del orden de detección
      const hasRelevantTriggers = triggerTypes.some(t =>
        ["criticism", "mention_other_person"].includes(t)
      );
      expect(hasRelevantTriggers).toBe(true);

      // Impacto total debe ser acumulativo
      const totalImpact = calculateTriggerImpact(triggers, BehaviorType.YANDERE_OBSESSIVE);
      expect(totalImpact).toBeGreaterThan(0.5); // Múltiples triggers = mayor impacto
    });

    test("debería manejar trigger de reassurance (positivo)", async () => {
      const triggers = await detector.detectTriggers(
        "Te quiero mucho, eres muy importante para mí",
        [],
        [{ ...mockProfile, behaviorType: BehaviorType.ANXIOUS_ATTACHMENT }]
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("reassurance");
      expect(triggers[0].weight).toBe(-0.3); // Negativo

      // Impacto debe ser negativo (reduce intensidad)
      const impact = calculateTriggerImpact(triggers, BehaviorType.ANXIOUS_ATTACHMENT);
      expect(impact).toBeLessThan(0);
    });

    test("debería responder a delayed response con contexto temporal", async () => {
      const oldMessage = {
        id: "1",
        worldId: null,
        content: "¿Estás ahí?",
        agentId: "test-agent",
        userId: "user-1",
        role: "user" as const,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 horas atrás
        metadata: {},
        iv: null,
        authTag: null,
      };

      const triggers = await detector.detectTriggers(
        "Perdón por tardar en responder",
        [oldMessage],
        [{ ...mockProfile, behaviorType: BehaviorType.ANXIOUS_ATTACHMENT }]
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("delayed_response");
      expect(triggers[0].weight).toBe(0.6); // 12 horas = 0.6 según thresholds
      expect(triggers[0].metadata?.delayHours).toBe(12);

      const impact = calculateTriggerImpact(triggers, BehaviorType.ANXIOUS_ATTACHMENT);
      expect(impact).toBeGreaterThan(0);
    });

    test("debería manejar comportamiento no afectado por trigger", async () => {
      // NPD no se ve afectado por abandonment_signal
      const npdProfile = { ...mockProfile, behaviorType: BehaviorType.NARCISSISTIC_PD };

      const triggers = await detector.detectTriggers(
        "Necesito espacio",
        [],
        [npdProfile]
      );

      // No debe detectar triggers para NPD con este mensaje
      expect(triggers).toHaveLength(0);

      // Impacto debe ser 0
      const impact = calculateTriggerImpact(triggers, BehaviorType.NARCISSISTIC_PD);
      expect(impact).toBe(0);
    });

    test("debería detectar mention_other_person con metadata de nombre", async () => {
      const triggers = await detector.detectTriggers(
        "Ayer salí con María",
        [],
        [mockProfile]
      );

      expect(triggers).toHaveLength(1);
      expect(triggers[0].triggerType).toBe("mention_other_person");
      expect(triggers[0].metadata?.detectedName).toBe("María");

      const impact = calculateTriggerImpact(triggers, BehaviorType.YANDERE_OBSESSIVE);
      expect(impact).toBeGreaterThan(0);
    });

    test("debería priorizar explicit_rejection sobre otros triggers", async () => {
      const triggers = await detector.detectTriggers(
        "Ya no podemos ser amigos, esto se terminó",
        [],
        [mockProfile]
      );

      // Debe detectar explicit_rejection
      const rejectionTrigger = triggers.find(t => t.triggerType === "explicit_rejection");
      expect(rejectionTrigger).toBeDefined();
      expect(rejectionTrigger?.weight).toBe(1.0); // Peso máximo

      const impact = calculateTriggerImpact(triggers, BehaviorType.YANDERE_OBSESSIVE);
      expect(impact).toBeGreaterThan(0.5); // Alto impacto
    });
  });

  describe("Performance y robustez", () => {
    test("debería mantener performance <100ms con mensaje complejo", async () => {
      const complexMessage = `
        Hola, necesito hablarte sobre algo importante. He estado pensando mucho y creo que
        necesito un poco de espacio para aclarar mis ideas. Ayer estuve con mi amiga María
        y me dijo que tal vez estás siendo demasiado intenso. No es que no te quiera, pero
        siento que vamos muy rápido. ¿Podemos tomarnos un tiempo? Espero que lo entiendas.
      `;

      const start = Date.now();
      const triggers = await detector.detectTriggers(complexMessage, [], [mockProfile]);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(triggers.length).toBeGreaterThan(0);
    });

    test("debería manejar mensajes vacíos sin errores", async () => {
      const triggers = await detector.detectTriggers("", [], [mockProfile]);
      expect(triggers).toHaveLength(0);

      const impact = calculateTriggerImpact(triggers, BehaviorType.YANDERE_OBSESSIVE);
      expect(impact).toBe(0);
    });

    test("debería manejar profiles vacíos sin errores", async () => {
      const triggers = await detector.detectTriggers("Necesito espacio", [], []);
      expect(triggers).toHaveLength(0);
    });
  });

  describe("Escalation matemática", () => {
    test("debería calcular escalación correcta con diferentes rates", async () => {
      const highEscalationProfile = {
        ...mockProfile,
        baseIntensity: 0.3,
        escalationRate: 0.2,
        volatility: 0.5,
        thresholdForDisplay: 0.3,
      };

      const triggers = await detector.detectTriggers(
        "Necesito espacio",
        [],
        [highEscalationProfile]
      );

      const impact = calculateTriggerImpact(triggers, BehaviorType.YANDERE_OBSESSIVE);

      // Nueva intensidad = 0.3 + (impact × 0.2)
      const newIntensity = Math.min(1.0, 0.3 + (impact * 0.2));
      expect(newIntensity).toBeGreaterThan(0.3);
      expect(newIntensity).toBeLessThanOrEqual(1.0);
    });

    test("debería aplicar de-escalación con reassurance", async () => {
      const anxiousProfile = {
        ...mockProfile,
        behaviorType: BehaviorType.ANXIOUS_ATTACHMENT,
        baseIntensity: 0.8,
        deEscalationRate: 0.1,
        volatility: 0.5,
        thresholdForDisplay: 0.3,
      };

      const triggers = await detector.detectTriggers(
        "Te quiero mucho, todo está bien",
        [],
        [anxiousProfile]
      );

      const impact = calculateTriggerImpact(triggers, BehaviorType.ANXIOUS_ATTACHMENT);
      expect(impact).toBeLessThan(0); // Negativo

      // Nueva intensidad = 0.8 + (impact × 0.1) - debe decrecer
      const newIntensity = Math.max(0.0, 0.8 + (impact * 0.1));
      expect(newIntensity).toBeLessThan(0.8);
    });
  });
});