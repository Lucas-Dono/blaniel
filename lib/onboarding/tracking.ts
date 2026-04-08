/**
 * Onboarding Progress Tracking Utilities
 *
 * This module provides functions to track and update user onboarding progress
 * on the client side using localStorage.
 */

export type OnboardingTaskId =
  | "create_first_ai"
  | "first_conversation"
  | "customize_ai"
  | "join_community"
  | "share_post"
  | "setup_notifications";

interface OnboardingTask {
  id: OnboardingTaskId;
  completed: boolean;
  completedAt?: Date;
}

const STORAGE_KEY = "onboarding_tasks";

/**
 * Get all onboarding tasks from localStorage
 */
export function getOnboardingTasks(): OnboardingTask[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const tasks = JSON.parse(stored);
    return tasks.map((task: any) => ({
      ...task,
      completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Mark a specific task as completed
 */
export function completeOnboardingTask(taskId: OnboardingTaskId): void {
  if (typeof window === "undefined") return;

  const tasks = getOnboardingTasks();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);

  if (taskIndex >= 0) {
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      completed: true,
      completedAt: new Date(),
    };
  } else {
    tasks.push({
      id: taskId,
      completed: true,
      completedAt: new Date(),
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

  // Dispatch event for components to react
  window.dispatchEvent(new CustomEvent("onboarding-task-completed", { detail: { taskId } }));
}

/**
 * Check if a specific task is completed
 */
export function isTaskCompleted(taskId: OnboardingTaskId): boolean {
  const tasks = getOnboardingTasks();
  const task = tasks.find((t) => t.id === taskId);
  return task?.completed || false;
}

/**
 * Get onboarding completion percentage
 */
export function getOnboardingProgress(): number {
  const tasks = getOnboardingTasks();
  if (tasks.length === 0) return 0;

  const completed = tasks.filter((t) => t.completed).length;
  return Math.round((completed / tasks.length) * 100);
}

/**
 * Reset all onboarding progress
 */
export function resetOnboardingTasks(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("onboarding-reset"));
}

/**
 * Auto-detect and complete tasks based on user actions
 */
export class OnboardingTracker {
  /**
   * Track when user creates their first AI
   */
  static trackFirstAICreated() {
    if (!isTaskCompleted("create_first_ai")) {
      completeOnboardingTask("create_first_ai");
    }
  }

  /**
   * Track when user has their first conversation
   */
  static trackFirstConversation() {
    if (!isTaskCompleted("first_conversation")) {
      completeOnboardingTask("first_conversation");
    }
  }

  /**
   * Track when user customizes their AI
   */
  static trackAICustomization() {
    if (!isTaskCompleted("customize_ai")) {
      completeOnboardingTask("customize_ai");
    }
  }

  /**
   * Track when user joins community
   */
  static trackCommunityJoin() {
    if (!isTaskCompleted("join_community")) {
      completeOnboardingTask("join_community");
    }
  }

  /**
   * Track when user shares their first post
   */
  static trackFirstPost() {
    if (!isTaskCompleted("share_post")) {
      completeOnboardingTask("share_post");
    }
  }

  /**
   * Track when user sets up notifications
   */
  static trackNotificationsSetup() {
    if (!isTaskCompleted("setup_notifications")) {
      completeOnboardingTask("setup_notifications");
    }
  }
}
