/**
 * TESTS - TRIGGER PROCESSOR
 *
 * Tests para validar el procesamiento de triggers y actualizaciones a la base de datos.
 */

import { BehaviorType } from "@prisma/client";
import { calculateTriggerImpact } from "../trigger-processor";
import type { TriggerDetectionResult } from "../types";

// Mock triggers para testing
const mockTriggers: TriggerDetectionResult[] = [
  {
    triggerType: "abandonment_signal",
    behaviorTypes: [BehaviorType.YANDERE_OBSESSIVE, BehaviorType.ANXIOUS_ATTACHMENT],
    weight: 0.7,
    detectedIn: "necesito espacio",
    confidence: 0.85,
    timestamp: new Date(),
  },
  {
    triggerType: "mention_other_person",
    behaviorTypes: [BehaviorType.YANDERE_OBSESSIVE],
    weight: 0.65,
    detectedIn: "con María",
    confidence: 0.9,
    timestamp: new Date(),
    metadata: {
      detectedName: "María",
    },
  },
];

describe("TriggerProcessor", () => {
  describe("calculateTriggerImpact", () => {
    test("debería calcular impacto correcto para comportamiento afectado", () => {
      const impact = calculateTriggerImpact(mockTriggers, BehaviorType.YANDERE_OBSESSIVE);

      // Abandonment: 0.7 × 0.85 + Mention other: 0.65 × 0.9 = 0.595 + 0.585 = 1.18
      expect(impact).toBeCloseTo(1.18, 2);
    });

    test("debería retornar 0 para comportamiento no afectado", () => {
      const impact = calculateTriggerImpact(mockTriggers, BehaviorType.NARCISSISTIC_PD);

      expect(impact).toBe(0);
    });

    test("debería manejar triggers negativos (reassurance)", () => {
      const reassuranceTrigger: TriggerDetectionResult = {
        triggerType: "reassurance",
        behaviorTypes: [BehaviorType.ANXIOUS_ATTACHMENT],
        weight: -0.3,
        detectedIn: "te quiero",
        confidence: 0.9,
        timestamp: new Date(),
      };

      const impact = calculateTriggerImpact([reassuranceTrigger], BehaviorType.ANXIOUS_ATTACHMENT);

      // -0.3 × 0.9 = -0.27
      expect(impact).toBeCloseTo(-0.27, 2);
    });

    test("debería manejar array vacío de triggers", () => {
      const impact = calculateTriggerImpact([], BehaviorType.YANDERE_OBSESSIVE);

      expect(impact).toBe(0);
    });
  });

  // TODO: Tests de processTriggers() requieren mocking de Prisma
  // Por ahora nos enfocamos en las funciones puras calculateTriggerImpact()
});