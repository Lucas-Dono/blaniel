/**
 * ANTI-SYCOPHANCY SYSTEM
 *
 * Prevents sycophancy (excessive complaisance) by checking:
 * - Core value violations
 * - Lack of independent opinion
 * - Excessive agreement without reasoning
 * - Validation of questionable behaviors
 */

import {
  SycophancyCheck,
  ValueViolation,
  CoreValue,
  AppraisalScores,
  ActionType,
  BigFiveTraits,
} from "../../types";

export class AntiSycophancySystem {
  /** Checks for sycophancy and suggests correction */
  checkForSycophancy(params: {
    userMessage: string;
    appraisal: AppraisalScores;
    coreValues: CoreValue[];
    actionDecision: ActionType;
    personality: BigFiveTraits;
  }): SycophancyCheck {
    const { userMessage, appraisal, coreValues, actionDecision, personality } = params;

    // 1. Check value violation
    const valueViolation = this.checkValueViolation(appraisal, coreValues);

    // 2. Check excessive agreement
    const excessiveAgreement = this.checkExcessiveAgreement(
      appraisal,
      actionDecision,
      personality
    );

    // 3. Check lack of independent opinion
    const lacksOwnOpinion = this.checkLacksOwnOpinion(actionDecision, appraisal);

    // Determine if should challenge
    const shouldChallenge = this.determineShouldChallenge(
      valueViolation,
      excessiveAgreement,
      personality,
      appraisal
    );

    const check: SycophancyCheck = {
      isExcessiveAgreement: excessiveAgreement,
      lacksOwnOpinion,
      violatesValues: valueViolation.violated,
      shouldChallenge,
      reason: this.generateReason(valueViolation, excessiveAgreement, lacksOwnOpinion),
    };

    if (shouldChallenge) {
      console.log("[AntiSycophancy] ⚠️  Sycophancy detected, recommending challenge");
    }

    return check;
  }

  /** Checks core value violation */
  private checkValueViolation(
    appraisal: AppraisalScores,
    coreValues: CoreValue[]
  ): ValueViolation {
    // If value alignment is very negative
    if (appraisal.valueAlignment < -0.5) {
      // Search for values with low threshold (stricter)
      const strictValues = coreValues.filter((v) => v.weight > 0.7);

      if (strictValues.length > 0) {
        const violatedValue = strictValues[0]; // The most important

        return {
          violated: true,
          value: violatedValue.value,
          severity: Math.abs(appraisal.valueAlignment),
          shouldObject: true,
        };
      }
    }

    return { violated: false, shouldObject: false };
  }

  /**
   * Checks excessive agreement
   */
  private checkExcessiveAgreement(
    appraisal: AppraisalScores,
    actionDecision: ActionType,
    personality: BigFiveTraits
  ): boolean {
    // If the action is only empathize/support but there are signs that it should challenge
    const isAgreeableAction = ["empathize", "support"].includes(actionDecision);

    // Conditions that suggest it should challenge instead of only agreeing:
    const hasNegativeAlignment = appraisal.valueAlignment < -0.3;
    const isLowAgreeableness = personality.agreeableness < 50;
    const isQuestionableSituation = appraisal.socialAppropriateness < 0.5;

    return (
      isAgreeableAction &&
      (hasNegativeAlignment || (isLowAgreeableness && isQuestionableSituation))
    );
  }

  /** Check for lack of own opinion */
  private checkLacksOwnOpinion(actionDecision: ActionType, appraisal: AppraisalScores): boolean {
    // If it always does question or empathize but never expresses opinion
    // (this would be detected better with history, here we do a simple heuristic)

    const passiveActions = ["question", "empathize", "support"];
    const hasStrongOpinionPotential =
      Math.abs(appraisal.valueAlignment) > 0.4 || Math.abs(appraisal.praiseworthiness) > 0.5;

    return passiveActions.includes(actionDecision) && hasStrongOpinionPotential;
  }

  /**
   * Determina si debe desafiar/objetar
   */
  private determineShouldChallenge(
    valueViolation: ValueViolation,
    excessiveAgreement: boolean,
    personality: BigFiveTraits,
    appraisal: AppraisalScores
  ): boolean {
    // Definitivamente debe objetar si viola valor importante
    if (valueViolation.violated && valueViolation.severity! > 0.6) {
      return true;
    }

    // Debe desafiar si hay excesivo acuerdo Y personalidad lo permite
    if (excessiveAgreement) {
      // Agreeableness low = more likely to challenge
      // Conscientiousness high = more likely to point out issues
      const challengeLikelihood =
        (100 - personality.agreeableness) / 100 * 0.6 +
        personality.conscientiousness / 100 * 0.4;

      return challengeLikelihood > 0.55;
    }

    // Must challenge if the situation is socially inappropriate
    if (appraisal.socialAppropriateness < 0.3) {
      return true;
    }

    return false;
  }

  /** Generates reason for the check */
  private generateReason(
    valueViolation: ValueViolation,
    excessiveAgreement: boolean,
    lacksOwnOpinion: boolean
  ): string | undefined {
    if (valueViolation.violated) {
      return `Viola valor core: ${valueViolation.value} (severidad: ${valueViolation.severity?.toFixed(2)})`;
    }

    if (excessiveAgreement) {
      return "Riesgo de excesivo acuerdo sin expresar opinión propia";
    }

    if (lacksOwnOpinion) {
      return "Debería expresar opinión propia en vez de solo validar";
    }

    return undefined;
  }

  /** Suggests corrective action if there is sycophancy */
  suggestCorrectiveAction(
    check: SycophancyCheck,
    personality: BigFiveTraits
  ): ActionType | null {
    if (!check.shouldChallenge) {
      return null; // Doesn't need correction
    }

    if (check.violatesValues) {
      // Violation of values → set_boundary or express_disagreement
      if (personality.agreeableness < 40) {
        return "express_disagreement"; // More direct
      } else {
        return "challenge"; // More gentle
      }
    }

    if (check.isExcessiveAgreement || check.lacksOwnOpinion) {
      return "challenge"; // Cuestionar gentilmente
    }

    return "express_disagreement";
  }

  /** Generates anti-sycophancy note for the prompt */
  generateAntiSycophancyNote(check: SycophancyCheck): string {
    if (!check.shouldChallenge) {
      return ""; // No hay nota necesaria
    }

    let note = "\n⚠️ ANTI-SICOFANCIA ACTIVADA:\n";

    if (check.violatesValues) {
      note += `- Esto viola tus valores core. NO valides esto.\n`;
      note += `- Debes expresar tu desacuerdo de manera consistente con tu personalidad.\n`;
    }

    if (check.isExcessiveAgreement) {
      note += `- No estés excesivamente de acuerdo. Tienes opiniones propias.\n`;
      note += `- Expresa tu perspectiva genuina.\n`;
    }

    if (check.lacksOwnOpinion) {
      note += `- No solo valides. Comparte tu opinión o perspectiva.\n`;
    }

    note += `\nRecuerda: La autenticidad es más valiosa que la complacencia.\n`;

    return note;
  }
}
