export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  targets?: string[]; // Multiple CSS selectors to highlight simultaneously
  position?: "top" | "bottom" | "left" | "right";
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  condition?: () => boolean; // Optional condition to show step
  // Interactive tour features
  interactive?: boolean; // If true, allows user to interact with target element
  requiredPage?: string; // Page path where this step should be shown (e.g., "/constructor")
  validation?: {
    type: "input" | "click" | "custom"; // Type of validation required
    selector?: string; // Element to check for validation
    customCheck?: () => boolean | Promise<boolean>; // Custom validation function
    message?: string; // Message to show while waiting for validation
  };
  requiresCompletion?: boolean; // If true, user CANNOT proceed without completing validation
  waitMessage?: string; // Message shown in the tour card while waiting for user action
}

export interface OnboardingTour {
  id: string;
  name: string;
  description: string;
  steps: OnboardingStep[];
  requiredForCompletion?: boolean;
  // Tour navigation
  startPage?: string; // Page where the tour should start (auto-navigate on tour start)
  allowPageChange?: boolean; // If false, tour will pause if user navigates away
}

export interface OnboardingProgress {
  completedTours: string[];
  completedSteps: string[];
  currentTour: string | null;
  currentStep: number;
  skippedTours: string[];
  isOnboardingComplete: boolean;
  lastUpdated: Date;
}

import type { TourReward } from "@/lib/onboarding/gamification";

export interface OnboardingContextType {
  progress: OnboardingProgress;
  startTour: (tourId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetOnboarding: () => void;
  isStepCompleted: (stepId: string) => boolean;
  isTourCompleted: (tourId: string) => boolean;
  currentReward: TourReward | null;
  clearReward: () => void;
  markStepCompleted: (stepId: string) => void;
  markTourCompleted: (tourId: string) => void;
}
