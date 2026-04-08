/**
 * EMOTIONAL INTEGRATION TESTS
 *
 * Tests de integración bidireccional entre Behavior System y Emotional System.
 */

import { BehaviorType } from "@prisma/client";
import { EmotionalIntegrationCalculator } from "../emotional-integration";
import type { EmotionState } from "@/lib/emotional-system/types";
import type { BehaviorIntensityResult } from "../types";

describe("Emotional Integration", () => {
  let calculator: EmotionalIntegrationCalculator;

  beforeEach(() => {
    calculator = new EmotionalIntegrationCalculator();
  });

  describe("Behaviors → Emotions (Amplification)", () => {
    test("Yandere debe amplificar anger y anxiety", () => {
      const baseEmotions: EmotionState = {
        anger: 0.3,
        anxiety: 0.4,
        joy: 0.2,
      };

      const activeBehaviors: BehaviorIntensityResult[] = [
        {
          behaviorType: BehaviorType.YANDERE_OBSESSIVE,
          finalIntensity: 0.8, // Alta intensidad
          components: {
            baseIntensity: 0.5,
            phaseMultiplier: 1.5,
            triggerAmplification: 0.2,
            emotionalModulation: 1.0,
            decayFactor: 0.9,
            inertiaFactor: 1.0,
          },
          shouldDisplay: true,
        },
      ];

      const amplified = calculator.amplifyEmotionsFromBehaviors(
        baseEmotions,
        activeBehaviors
      );

      // Anger must be amplified (×2.0 according to config)
      expect(amplified.anger).toBeGreaterThan(baseEmotions.anger!);
      expect(amplified.anger).toBeCloseTo(0.3 + 0.3 * 1.0 * 0.8, 1); // base + (base × (mult-1) × intensity)

      // Anxiety debe amplificarse (×1.8)
      expect(amplified.anxiety).toBeGreaterThan(baseEmotions.anxiety!);

      // Joy no debe cambiar (no tiene amplificador para yandere)
      expect(amplified.joy).toBe(baseEmotions.joy);
    });

    test("BPD debe amplificar distress y fear extremadamente", () => {
      const baseEmotions: EmotionState = {
        distress: 0.4,
        fear: 0.3,
        affection: 0.5,
      };

      const activeBehaviors: BehaviorIntensityResult[] = [
        {
          behaviorType: BehaviorType.BORDERLINE_PD,
          finalIntensity: 1.0, // Intensidad máxima
          components: {
            baseIntensity: 0.6,
            phaseMultiplier: 1.5,
            triggerAmplification: 0.3,
            emotionalModulation: 1.0,
            decayFactor: 0.9,
            inertiaFactor: 1.1,
          },
          shouldDisplay: true,
        },
      ];

      const amplified = calculator.amplifyEmotionsFromBehaviors(
        baseEmotions,
        activeBehaviors
      );

      // Distress amplificado (×2.2)
      expect(amplified.distress).toBeGreaterThan(0.6); // Debe subir significativamente

      // Fear amplificado (×2.0)
      expect(amplified.fear).toBeGreaterThan(0.5);

      // Affection also amplified (idealization in BPD)
      expect(amplified.affection).toBeGreaterThan(baseEmotions.affection!);
    });

    test("Anxious Attachment debe amplificar fear y anxiety", () => {
      const baseEmotions: EmotionState = {
        fear: 0.2,
        anxiety: 0.3,
      };

      const activeBehaviors: BehaviorIntensityResult[] = [
        {
          behaviorType: BehaviorType.ANXIOUS_ATTACHMENT,
          finalIntensity: 0.7,
          components: {
            baseIntensity: 0.5,
            phaseMultiplier: 1.2,
            triggerAmplification: 0.15,
            emotionalModulation: 1.0,
            decayFactor: 0.95,
            inertiaFactor: 1.0,
          },
          shouldDisplay: true,
        },
      ];

      const amplified = calculator.amplifyEmotionsFromBehaviors(
        baseEmotions,
        activeBehaviors
      );

      // Fear amplificado (×2.0)
      expect(amplified.fear).toBeGreaterThan(baseEmotions.fear!);

      // Anxiety amplificado (×2.2)
      expect(amplified.anxiety).toBeGreaterThan(baseEmotions.anxiety!);
    });

    test("Sin behaviors activos, no debe amplificar", () => {
      const baseEmotions: EmotionState = {
        joy: 0.5,
        interest: 0.4,
      };

      const amplified = calculator.amplifyEmotionsFromBehaviors(baseEmotions, []);

      expect(amplified).toEqual(baseEmotions);
    });

    test("Behaviors bajo threshold no deben amplificar", () => {
      const baseEmotions: EmotionState = {
        anger: 0.3,
      };

      const activeBehaviors: BehaviorIntensityResult[] = [
        {
          behaviorType: BehaviorType.YANDERE_OBSESSIVE,
          finalIntensity: 0.2,
          components: {
            baseIntensity: 0.2,
            phaseMultiplier: 1.0,
            triggerAmplification: 0.0,
            emotionalModulation: 1.0,
            decayFactor: 1.0,
            inertiaFactor: 1.0,
          },
          shouldDisplay: false, // Bajo threshold
        },
      ];

      const amplified = calculator.amplifyEmotionsFromBehaviors(
        baseEmotions,
        activeBehaviors
      );

      expect(amplified).toEqual(baseEmotions);
    });
  });

  describe("Emotions → Behaviors (Adjustment)", () => {
    test("fear alto debe reforzar ANXIOUS_ATTACHMENT", () => {
      const currentEmotions: EmotionState = {
        fear: 0.8, // Fear alto
        anxiety: 0.6,
      };

      const behaviorTypes = [
        BehaviorType.ANXIOUS_ATTACHMENT,
        BehaviorType.BORDERLINE_PD,
      ];

      const adjustments =
        calculator.calculateBehaviorAdjustmentsFromEmotions(
          currentEmotions,
          behaviorTypes
        );

      // Anxious attachment debe recibir boost positivo (+0.2 × 0.8)
      expect(adjustments[BehaviorType.ANXIOUS_ATTACHMENT]).toBeGreaterThan(0.15);

      // BPD also receives fear boost (+0.15 × 0.8)
      expect(adjustments[BehaviorType.BORDERLINE_PD]).toBeGreaterThan(0.1);

      // Anxiety also reinforces both
      const anxietyBoost = adjustments[BehaviorType.ANXIOUS_ATTACHMENT];
      expect(anxietyBoost).toBeGreaterThan(0.25); // fear + anxiety combinados
    });

    test("distress alto debe reforzar BORDERLINE_PD significativamente", () => {
      const currentEmotions: EmotionState = {
        distress: 0.9, // Distress muy alto
      };

      const behaviorTypes = [BehaviorType.BORDERLINE_PD];

      const adjustments =
        calculator.calculateBehaviorAdjustmentsFromEmotions(
          currentEmotions,
          behaviorTypes
        );

      // BPD recibe boost muy alto (+0.3 × 0.9 = +0.27)
      expect(adjustments[BehaviorType.BORDERLINE_PD]).toBeCloseTo(0.27, 1);
    });

    test("anger alto debe reforzar NARCISSISTIC_PD", () => {
      const currentEmotions: EmotionState = {
        anger: 0.7,
      };

      const behaviorTypes = [BehaviorType.NARCISSISTIC_PD];

      const adjustments =
        calculator.calculateBehaviorAdjustmentsFromEmotions(
          currentEmotions,
          behaviorTypes
        );

      // NPD recibe boost significativo (+0.25 × 0.7)
      expect(adjustments[BehaviorType.NARCISSISTIC_PD]).toBeGreaterThan(0.1);
    });

    test("affection debe reducir ANXIOUS_ATTACHMENT (reassurance)", () => {
      const currentEmotions: EmotionState = {
        affection: 0.8,
        love: 0.7,
      };

      const behaviorTypes = [BehaviorType.ANXIOUS_ATTACHMENT];

      const adjustments =
        calculator.calculateBehaviorAdjustmentsFromEmotions(
          currentEmotions,
          behaviorTypes
        );

      // Affection y love reducen anxious (valores negativos)
      expect(adjustments[BehaviorType.ANXIOUS_ATTACHMENT]).toBeLessThan(0);
    });

    test("emociones bajas no deben ajustar behaviors", () => {
      const currentEmotions: EmotionState = {
        joy: 0.1, // Muy bajo, bajo threshold de 0.2
        interest: 0.15,
      };

      const behaviorTypes = [BehaviorType.ANXIOUS_ATTACHMENT];

      const adjustments =
        calculator.calculateBehaviorAdjustmentsFromEmotions(
          currentEmotions,
          behaviorTypes
        );

      // No debe haber ajustes significativos
      expect(adjustments[BehaviorType.ANXIOUS_ATTACHMENT]).toBe(0);
    });
  });

  describe("Bidirectional Influence (Complete Flow)", () => {
    test("debe calcular influencia bidireccional completa", () => {
      const baseEmotions: EmotionState = {
        fear: 0.3,
        anxiety: 0.4,
        distress: 0.5,
      };

      const activeBehaviors: BehaviorIntensityResult[] = [
        {
          behaviorType: BehaviorType.ANXIOUS_ATTACHMENT,
          finalIntensity: 0.7,
          components: {
            baseIntensity: 0.5,
            phaseMultiplier: 1.2,
            triggerAmplification: 0.15,
            emotionalModulation: 1.0,
            decayFactor: 0.95,
            inertiaFactor: 1.0,
          },
          shouldDisplay: true,
        },
      ];

      const influence = calculator.calculateBidirectionalInfluence(
        baseEmotions,
        activeBehaviors
      );

      // Debe tener amplificaciones emocionales
      expect(influence.emotionalAmplifications.length).toBeGreaterThan(0);

      // Debe tener ajustes de behavior
      expect(influence.behaviorAdjustments.length).toBeGreaterThan(0);

      // Fear debe estar amplificado
      const fearAmplification = influence.emotionalAmplifications.find(
        (a) => a.emotionType === "fear"
      );
      expect(fearAmplification).toBeDefined();
      expect(fearAmplification!.finalIntensity).toBeGreaterThan(0.3);
    });

    test("getInfluenceDescription debe generar descripción legible", () => {
      const influence = {
        emotionalAmplifications: [
          {
            emotionType: "fear",
            baseIntensity: 0.3,
            behaviorMultiplier: 1.8,
            finalIntensity: 0.54,
          },
        ],
        behaviorAdjustments: [
          {
            behaviorType: BehaviorType.ANXIOUS_ATTACHMENT,
            intensityDelta: 0.2,
          },
        ],
      };

      const description = calculator.getInfluenceDescription(influence);

      expect(description).toContain("EMOCIONES AMPLIFICADAS");
      expect(description).toContain("fear");
      expect(description).toContain("COMPORTAMIENTOS MODULADOS");
      expect(description).toContain("ANXIOUS_ATTACHMENT");
    });

    test("sin influencias significativas debe retornar mensaje apropiado", () => {
      const influence = {
        emotionalAmplifications: [],
        behaviorAdjustments: [
          {
            behaviorType: BehaviorType.ANXIOUS_ATTACHMENT,
            intensityDelta: 0.05, // Muy bajo
          },
        ],
      };

      const description = calculator.getInfluenceDescription(influence);

      expect(description).toContain("Sin modulación emocional significativa");
    });
  });
});
