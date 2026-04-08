/**
 * A/B TESTING INFRASTRUCTURE FOR ONBOARDING
 *
 * Simple but powerful A/B testing system for onboarding optimization.
 *
 * FEATURES:
 * - Multiple variant support
 * - Automatic variant assignment
 * - Persistent variant tracking
 * - Conversion tracking
 * - Statistical analysis
 *
 * USAGE:
 * import { abTesting } from "@/lib/onboarding/ab-testing";
 *
 * // Get assigned variant
 * const variant = abTesting.getVariant("welcome_cta_test");
 *
 * // Track conversion
 * abTesting.trackConversion("welcome_cta_test", variant.id);
 *
 * // Get test results
 * const results = abTesting.getResults("welcome_cta_test");
 */



export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  weight: number; // Percentage of traffic (0-100)
  changes: Record<string, any>;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  variants: ABTestVariant[];
  active: boolean;
}

export interface ABTestResults {
  testId: string;
  variants: Array<{
    variantId: string;
    variantName: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
    confidence: number; // Statistical confidence (0-100)
    winner: boolean;
  }>;
  recommendedWinner?: string;
  statisticalSignificance: boolean;
}

class ABTestingManager {
  private tests: Map<string, ABTest> = new Map();
  private assignments: Map<string, string> = new Map(); // userId -> variantId
  private readonly STORAGE_KEY = "ab_test_assignments";

  constructor() {
    this.loadAssignments();
    this.initializeDefaultTests();
  }

  /**
   * Initialize default A/B tests
   */
  private initializeDefaultTests(): void {
    // Test 1: Welcome CTA
    this.createTest({
      id: "welcome_cta_test",
      name: "Welcome CTA Test",
      description: "Test different CTAs on welcome page",
      startDate: new Date(),
      variants: [
        {
          id: "control",
          name: "Control - Get Started",
          description: "Original CTA",
          weight: 50,
          changes: {
            ctaText: "Get Started",
            ctaStyle: "gradient",
          },
        },
        {
          id: "variant_a",
          name: "Variant A - Create Your AI Now",
          description: "More action-oriented CTA",
          weight: 50,
          changes: {
            ctaText: "Create Your AI Now",
            ctaStyle: "gradient-animated",
          },
        },
      ],
      active: true,
    });

    // Test 2: Template Presentation
    this.createTest({
      id: "template_presentation_test",
      name: "Template Presentation Test",
      description: "Test different ways to present AI templates",
      startDate: new Date(),
      variants: [
        {
          id: "control",
          name: "Control - Grid View",
          description: "Original 2x2 grid",
          weight: 50,
          changes: {
            layout: "grid",
            showStats: true,
            showBadges: true,
          },
        },
        {
          id: "variant_a",
          name: "Variant A - Carousel",
          description: "Horizontal carousel",
          weight: 50,
          changes: {
            layout: "carousel",
            showStats: true,
            showBadges: false,
          },
        },
      ],
      active: false, // Not active by default
    });

    // Test 3: First Message Prompts
    this.createTest({
      id: "first_message_test",
      name: "First Message Prompts Test",
      description: "Test different suggested messages",
      startDate: new Date(),
      variants: [
        {
          id: "control",
          name: "Control - Generic",
          description: "Generic conversation starters",
          weight: 50,
          changes: {
            suggestions: [
              "Hi! I'm excited to meet you!",
              "Tell me about yourself",
              "What can we talk about?",
              "How are you today?",
            ],
          },
        },
        {
          id: "variant_a",
          name: "Variant A - Personalized",
          description: "More personalized starters",
          weight: 50,
          changes: {
            suggestions: [
              "Hi! I'm excited to meet you!",
              "What makes you special?",
              "I had a great day today!",
              "Can you help me with something?",
            ],
          },
        },
      ],
      active: true,
    });
  }

  /**
   * Create a new A/B test
   */
  createTest(test: ABTest): void {
    // Validate weights sum to 100
    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      console.warn(`[A/B Testing] Weights for test ${test.id} don't sum to 100, normalizing...`);
      test.variants = test.variants.map(v => ({
        ...v,
        weight: (v.weight / totalWeight) * 100,
      }));
    }

    this.tests.set(test.id, test);
    console.log(`[A/B Testing] Test created: ${test.name}`);
  }

  /**
   * Get variant for a user
   * Returns consistent variant for same user
   */
  getVariant(testId: string, userId?: string): ABTestVariant {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    if (!test.active) {
      // Return control variant if test is inactive
      return test.variants.find(v => v.id === "control") || test.variants[0];
    }

    // Check if user already has an assignment
    const assignmentKey = `${testId}:${userId || "anonymous"}`;
    const existingAssignment = this.assignments.get(assignmentKey);

    if (existingAssignment) {
      const variant = test.variants.find(v => v.id === existingAssignment);
      if (variant) return variant;
    }

    // Assign new variant based on weights
    const variant = this.selectVariantByWeight(test.variants);
    this.assignments.set(assignmentKey, variant.id);
    this.saveAssignments();

    console.log(`[A/B Testing] Assigned variant ${variant.name} for test ${test.name}`);
    return variant;
  }

  /**
   * Track conversion for a test
   */
  trackConversion(testId: string, variantId: string, metadata?: Record<string, any>): void {
    const storageKey = `ab_test_${testId}_${variantId}`;
    const stored = localStorage.getItem(storageKey);
    const data = stored ? JSON.parse(stored) : { impressions: 0, conversions: 0 };

    data.conversions++;

    localStorage.setItem(storageKey, JSON.stringify(data));
    console.log(`[A/B Testing] Conversion tracked for ${testId} / ${variantId}`);
  }

  /**
   * Track impression for a test
   */
  trackImpression(testId: string, variantId: string): void {
    const storageKey = `ab_test_${testId}_${variantId}`;
    const stored = localStorage.getItem(storageKey);
    const data = stored ? JSON.parse(stored) : { impressions: 0, conversions: 0 };

    data.impressions++;

    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  /**
   * Get results for a test
   */
  getResults(testId: string): ABTestResults {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const variantResults = test.variants.map(variant => {
      const storageKey = `ab_test_${testId}_${variant.id}`;
      const stored = localStorage.getItem(storageKey);
      const data = stored ? JSON.parse(stored) : { impressions: 0, conversions: 0 };

      const conversionRate = data.impressions > 0
        ? (data.conversions / data.impressions) * 100
        : 0;

      return {
        variantId: variant.id,
        variantName: variant.name,
        impressions: data.impressions,
        conversions: data.conversions,
        conversionRate,
        confidence: this.calculateConfidence(data.impressions, data.conversions),
        winner: false,
      };
    });

    // Find winner (highest conversion rate with enough data)
    const minImpressions = 30; // Minimum sample size
    const validVariants = variantResults.filter(v => v.impressions >= minImpressions);

    if (validVariants.length > 0) {
      const winner = validVariants.reduce((max, v) =>
        v.conversionRate > max.conversionRate ? v : max
      );
      winner.winner = true;
    }

    // Calculate statistical significance
    const statisticalSignificance = validVariants.length >= 2 &&
      this.hasStatisticalSignificance(variantResults[0], variantResults[1]);

    return {
      testId,
      variants: variantResults,
      recommendedWinner: variantResults.find(v => v.winner)?.variantId,
      statisticalSignificance,
    };
  }

  /**
   * Get report for all tests
   */
  getReport(): string {
    const lines: string[] = [
      "📊 A/B TESTING REPORT",
      "═".repeat(50),
      "",
    ];

    this.tests.forEach(test => {
      const results = this.getResults(test.id);

      lines.push(`🧪 ${test.name}`);
      lines.push(`   Status: ${test.active ? "Active" : "Inactive"}`);
      lines.push(`   Statistical Significance: ${results.statisticalSignificance ? "Yes" : "No"}`);
      lines.push("");

      results.variants.forEach(variant => {
        lines.push(`   ${variant.winner ? "🏆" : "  "} ${variant.variantName}`);
        lines.push(`      Impressions: ${variant.impressions}`);
        lines.push(`      Conversions: ${variant.conversions}`);
        lines.push(`      Rate: ${variant.conversionRate.toFixed(2)}%`);
        lines.push(`      Confidence: ${variant.confidence.toFixed(0)}%`);
        lines.push("");
      });

      if (results.recommendedWinner) {
        const winner = results.variants.find(v => v.variantId === results.recommendedWinner);
        lines.push(`   ✅ Recommended: ${winner?.variantName}`);
      } else {
        lines.push(`   ⏳ Need more data (min 30 impressions per variant)`);
      }

      lines.push("");
      lines.push("─".repeat(50));
      lines.push("");
    });

    return lines.join("\n");
  }

  /**
   * Reset all test data (for testing)
   */
  reset(): void {
    this.assignments.clear();
    localStorage.removeItem(this.STORAGE_KEY);

    // Clear all test data
    this.tests.forEach(test => {
      test.variants.forEach(variant => {
        const storageKey = `ab_test_${test.id}_${variant.id}`;
        localStorage.removeItem(storageKey);
      });
    });

    console.log("[A/B Testing] All data reset");
  }

  // ===== PRIVATE METHODS =====

  private selectVariantByWeight(variants: ABTestVariant[]): ABTestVariant {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant;
      }
    }

    return variants[0]; // Fallback
  }

  private calculateConfidence(impressions: number, conversions: number): number {
    if (impressions < 10) return 0;

    const conversionRate = conversions / impressions;
    const sampleSize = impressions;

    // Simplified confidence calculation
    // In production, use proper statistical methods (z-test, etc.)
    const confidence = Math.min(
      100,
      (Math.sqrt(sampleSize) * conversionRate * 100) / 2
    );

    return confidence;
  }

  private hasStatisticalSignificance(
    variantA: ABTestResults["variants"][0],
    variantB: ABTestResults["variants"][0]
  ): boolean {
    // Simplified significance test
    // In production, use proper z-test or chi-square test

    const minSampleSize = 30;
    if (variantA.impressions < minSampleSize || variantB.impressions < minSampleSize) {
      return false;
    }

    const diffRate = Math.abs(variantA.conversionRate - variantB.conversionRate);
    return diffRate >= 5; // 5% difference threshold
  }

  private saveAssignments(): void {
    if (typeof window !== "undefined") {
      const obj = Object.fromEntries(this.assignments);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    }
  }

  private loadAssignments(): void {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const obj = JSON.parse(stored);
          this.assignments = new Map(Object.entries(obj));
        }
      } catch (error) {
        console.error("[A/B Testing] Failed to load assignments:", error);
      }
    }
  }
}

/**
 * Singleton instance
 */
export const abTesting = new ABTestingManager();

// Development helper
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).abTesting = abTesting;
  console.log("💡 Tip: Access A/B testing via window.abTesting");
  console.log("   - window.abTesting.getReport()");
  console.log("   - window.abTesting.getResults('welcome_cta_test')");
}
