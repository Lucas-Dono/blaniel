/**
 * ONBOARDING ANALYTICS SYSTEM
 *
 * Comprehensive analytics tracking for onboarding flow to:
 * - Track user behavior through each step
 * - Identify drop-off points
 * - Measure conversion rates
 * - Support A/B testing
 * - Optimize user experience
 *
 * USAGE:
 * import { onboardingAnalytics } from "@/lib/onboarding/analytics";
 *
 * // Track step view
 * onboardingAnalytics.trackStepView("intro");
 *
 * // Track step completion
 * onboardingAnalytics.trackStepComplete("intro", { timeSpent: 5000 });
 *
 * // Track skip
 * onboardingAnalytics.trackSkip("customize", "user_clicked_skip");
 *
 * // Get conversion funnel
 * const funnel = await onboardingAnalytics.getConversionFunnel();
 */

export type OnboardingStep =
  | "intro"
  | "choose"
  | "chat"
  | "customize"
  | "community"
  | "complete";

export type OnboardingEventType =
  | "step_view"
  | "step_complete"
  | "step_skip"
  | "template_select"
  | "message_sent"
  | "ai_created"
  | "customization_saved"
  | "onboarding_complete"
  | "onboarding_abandoned";

export interface OnboardingEvent {
  eventType: OnboardingEventType;
  step?: OnboardingStep;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface StepMetrics {
  step: OnboardingStep;
  views: number;
  completions: number;
  skips: number;
  averageTimeSpent: number;
  dropoffRate: number;
  conversionRate: number;
}

export interface ConversionFunnel {
  totalStarts: number;
  completionRate: number;
  steps: StepMetrics[];
  averageTimeToComplete: number;
  topDropoffStep: OnboardingStep;
  templateDistribution: Record<string, number>;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  changes: Record<string, any>;
}

class OnboardingAnalyticsTracker {
  private events: OnboardingEvent[] = [];
  private sessionId: string;
  private abTestVariant?: ABTestVariant;
  private readonly STORAGE_KEY = "onboarding_analytics_events";
  private readonly SESSION_KEY = "onboarding_session_id";
  private readonly AB_TEST_KEY = "onboarding_ab_variant";

  constructor() {
    // Initialize session
    if (typeof window !== "undefined") {
      this.sessionId = this.getOrCreateSessionId();
      this.loadEvents();
      this.loadABTestVariant();
    } else {
      this.sessionId = this.generateSessionId();
    }
  }

  /**
   * Track when a user views an onboarding step
   */
  trackStepView(step: OnboardingStep, metadata?: Record<string, any>): void {
    this.track({
      eventType: "step_view",
      step,
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        ...metadata,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(`[Onboarding Analytics] Step viewed: ${step}`);
  }

  /**
   * Track when a user completes an onboarding step
   */
  trackStepComplete(
    step: OnboardingStep,
    metadata?: { timeSpent?: number; [key: string]: any }
  ): void {
    this.track({
      eventType: "step_complete",
      step,
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        ...metadata,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(
      `[Onboarding Analytics] Step completed: ${step}${
        metadata?.timeSpent ? ` (${(metadata.timeSpent / 1000).toFixed(1)}s)` : ""
      }`
    );
  }

  /**
   * Track when a user skips an onboarding step
   */
  trackSkip(step: OnboardingStep, reason?: string): void {
    this.track({
      eventType: "step_skip",
      step,
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        reason,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(`[Onboarding Analytics] Step skipped: ${step} (${reason || "no reason"})`);
  }

  /**
   * Track template selection
   */
  trackTemplateSelect(templateId: string, templateName: string): void {
    this.track({
      eventType: "template_select",
      step: "choose",
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        templateId,
        templateName,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(`[Onboarding Analytics] Template selected: ${templateName}`);
  }

  /**
   * Track message sent during first conversation
   */
  trackMessageSent(messageNumber: number, suggestedMessage: boolean): void {
    this.track({
      eventType: "message_sent",
      step: "chat",
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        messageNumber,
        suggestedMessage,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(
      `[Onboarding Analytics] Message sent: #${messageNumber} (${
        suggestedMessage ? "suggested" : "custom"
      })`
    );
  }

  /**
   * Track AI creation
   */
  trackAICreated(agentId: string, templateUsed?: string): void {
    this.track({
      eventType: "ai_created",
      step: "choose",
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        agentId,
        templateUsed,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(`[Onboarding Analytics] AI created: ${agentId}`);
  }

  /**
   * Track customization saved
   */
  trackCustomizationSaved(changes: Record<string, any>): void {
    this.track({
      eventType: "customization_saved",
      step: "customize",
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        changes,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(`[Onboarding Analytics] Customization saved`);
  }

  /**
   * Track complete onboarding
   */
  trackOnboardingComplete(totalTimeMs: number): void {
    this.track({
      eventType: "onboarding_complete",
      step: "complete",
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        totalTimeMs,
        totalTimeMinutes: (totalTimeMs / 60000).toFixed(1),
        variant: this.abTestVariant?.id,
      },
    });

    console.log(
      `[Onboarding Analytics] Onboarding completed in ${(totalTimeMs / 60000).toFixed(1)} minutes`
    );

    // Send to analytics service (if available)
    this.sendToAnalyticsService();
  }

  /**
   * Track abandoned onboarding
   */
  trackOnboardingAbandoned(lastStep: OnboardingStep, reason?: string): void {
    this.track({
      eventType: "onboarding_abandoned",
      step: lastStep,
      timestamp: new Date(),
      sessionId: this.sessionId,
      metadata: {
        reason,
        variant: this.abTestVariant?.id,
      },
    });

    console.log(`[Onboarding Analytics] Onboarding abandoned at: ${lastStep}`);
  }

  /**
   * Set A/B test variant for this session
   */
  setABTestVariant(variant: ABTestVariant): void {
    this.abTestVariant = variant;
    if (typeof window !== "undefined") {
      localStorage.setItem(this.AB_TEST_KEY, JSON.stringify(variant));
    }
    console.log(`[Onboarding Analytics] A/B Test Variant: ${variant.name}`);
  }

  /**
   * Get current A/B test variant
   */
  getABTestVariant(): ABTestVariant | undefined {
    return this.abTestVariant;
  }

  /**
   * Calculate conversion funnel metrics
   */
  getConversionFunnel(): ConversionFunnel {
    const steps: OnboardingStep[] = ["intro", "choose", "chat", "customize", "community", "complete"];

    const totalStarts = this.getEventCount("step_view", "intro");
    const totalCompletions = this.getEventCount("onboarding_complete");
    const completionRate = totalStarts > 0 ? (totalCompletions / totalStarts) * 100 : 0;

    const stepMetrics: StepMetrics[] = steps.map((step, index) => {
      const views = this.getEventCount("step_view", step);
      const completions = this.getEventCount("step_complete", step);
      const skips = this.getEventCount("step_skip", step);

      const previousStepViews = index > 0 ? this.getEventCount("step_view", steps[index - 1]) : totalStarts;
      const dropoffRate = previousStepViews > 0 ? ((previousStepViews - views) / previousStepViews) * 100 : 0;
      const conversionRate = views > 0 ? (completions / views) * 100 : 0;

      const avgTimeSpent = this.getAverageTimeSpent(step);

      return {
        step,
        views,
        completions,
        skips,
        averageTimeSpent: avgTimeSpent,
        dropoffRate,
        conversionRate,
      };
    });

    // Find top drop-off step
    const topDropoffStep = stepMetrics.reduce((max, current) =>
      current.dropoffRate > max.dropoffRate ? current : max
    ).step;

    // Template distribution
    const templateEvents = this.events.filter(e => e.eventType === "template_select");
    const templateDistribution: Record<string, number> = {};
    templateEvents.forEach(event => {
      const templateName = event.metadata?.templateName || "Unknown";
      templateDistribution[templateName] = (templateDistribution[templateName] || 0) + 1;
    });

    // Average time to complete
    const completionEvents = this.events.filter(e => e.eventType === "onboarding_complete");
    const avgTimeToComplete = completionEvents.length > 0
      ? completionEvents.reduce((sum, e) => sum + (e.metadata?.totalTimeMs || 0), 0) / completionEvents.length
      : 0;

    return {
      totalStarts,
      completionRate,
      steps: stepMetrics,
      averageTimeToComplete: avgTimeToComplete,
      topDropoffStep,
      templateDistribution,
    };
  }

  /**
   * Get analytics summary report
   */
  getReport(): string {
    const funnel = this.getConversionFunnel();

    return `
📊 ONBOARDING ANALYTICS REPORT
════════════════════════════════════════════════

📈 CONVERSION FUNNEL
  Total Starts: ${funnel.totalStarts}
  Completions: ${Math.round((funnel.completionRate / 100) * funnel.totalStarts)}
  Completion Rate: ${funnel.completionRate.toFixed(1)}%
  Avg Time to Complete: ${(funnel.averageTimeToComplete / 60000).toFixed(1)} minutes

🔻 TOP DROP-OFF POINT
  ${funnel.topDropoffStep}

📋 STEP-BY-STEP BREAKDOWN
${funnel.steps.map(step => `
  ${step.step.toUpperCase()}:
    • Views: ${step.views}
    • Completions: ${step.completions}
    • Skips: ${step.skips}
    • Avg Time: ${(step.averageTimeSpent / 1000).toFixed(1)}s
    • Drop-off: ${step.dropoffRate.toFixed(1)}%
    • Conversion: ${step.conversionRate.toFixed(1)}%
`).join("")}

🎨 TEMPLATE DISTRIBUTION
${Object.entries(funnel.templateDistribution).map(([name, count]) =>
  `  ${name}: ${count} (${((count / funnel.totalStarts) * 100).toFixed(1)}%)`
).join("\n")}

${this.abTestVariant ? `\n🧪 A/B TEST VARIANT: ${this.abTestVariant.name}` : ""}
    `.trim();
  }

  /**
   * Reset analytics (for testing)
   */
  reset(): void {
    this.events = [];
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.SESSION_KEY);
      this.sessionId = this.generateSessionId();
      localStorage.setItem(this.SESSION_KEY, this.sessionId);
    }
    console.log("[Onboarding Analytics] Reset complete");
  }

  // ===== PRIVATE METHODS =====

  private track(event: OnboardingEvent): void {
    this.events.push(event);
    this.saveEvents();
  }

  private getEventCount(eventType: OnboardingEventType, step?: OnboardingStep): number {
    return this.events.filter(
      e => e.eventType === eventType && (!step || e.step === step)
    ).length;
  }

  private getAverageTimeSpent(step: OnboardingStep): number {
    const completions = this.events.filter(
      e => e.eventType === "step_complete" && e.step === step
    );

    if (completions.length === 0) return 0;

    const totalTime = completions.reduce((sum, e) => sum + (e.metadata?.timeSpent || 0), 0);
    return totalTime / completions.length;
  }

  private saveEvents(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
      } catch (error) {
        console.error("[Onboarding Analytics] Failed to save events:", error);
      }
    }
  }

  private loadEvents(): void {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          this.events = JSON.parse(stored).map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }));
        }
      } catch (error) {
        console.error("[Onboarding Analytics] Failed to load events:", error);
        this.events = [];
      }
    }
  }

  private loadABTestVariant(): void {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(this.AB_TEST_KEY);
        if (stored) {
          this.abTestVariant = JSON.parse(stored);
        }
      } catch (error) {
        console.error("[Onboarding Analytics] Failed to load A/B variant:", error);
      }
    }
  }

  private getOrCreateSessionId(): string {
    const stored = localStorage.getItem(this.SESSION_KEY);
    if (stored) return stored;

    const newId = this.generateSessionId();
    localStorage.setItem(this.SESSION_KEY, newId);
    return newId;
  }

  private generateSessionId(): string {
    return `onb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendToAnalyticsService(): Promise<void> {
    // TODO: Integrate with analytics service (Mixpanel, Amplitude, PostHog, etc.)
    // Example:
    // try {
    //   await fetch("/api/analytics/onboarding", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       sessionId: this.sessionId,
    //       events: this.events,
    //       funnel: this.getConversionFunnel(),
    //       variant: this.abTestVariant,
    //     }),
    //   });
    // } catch (error) {
    //   console.error("Failed to send analytics:", error);
    // }

    console.log("[Onboarding Analytics] Events ready to send to analytics service");
  }
}

/**
 * Singleton instance
 */
export const onboardingAnalytics = new OnboardingAnalyticsTracker();

// Development helper - expose to window in dev mode
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).onboardingAnalytics = onboardingAnalytics;
  console.log("💡 Tip: Access onboarding analytics via window.onboardingAnalytics");
  console.log("   - window.onboardingAnalytics.getReport()");
  console.log("   - window.onboardingAnalytics.getConversionFunnel()");
}
