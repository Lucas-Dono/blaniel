/**
 * Email Sequences Type Definitions
 */

export type SequenceName =
  | 'welcome'
  | 'reactivation'
  | 'upgrade_nudge'
  | 'trial_ending'
  | 'feature_announcement';

export type SequenceCategory =
  | 'onboarding'
  | 'retention'
  | 'conversion'
  | 'feature_announcement';

export type TriggerEvent =
  | 'signup'
  | 'inactive_7d'
  | 'inactive_14d'
  | 'inactive_21d'
  | 'inactive_30d'
  | 'trial_ending_3d'
  | 'trial_ending_1d'
  | 'trial_ended'
  | 'limit_reached_90'
  | 'limit_reached_100'
  | 'message_limit_reached'
  | 'world_created'
  | 'first_conversation';

export type EmailStatus =
  | 'pending'
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'cancelled';

export type ConversionType =
  | 'upgrade'
  | 'reactivation'
  | 'feature_use'
  | 'world_creation'
  | 'community_join';

export type UserPlan = 'free' | 'plus' | 'ultra';

export interface EmailTrigger {
  event: TriggerEvent;
  userId: string;
  metadata?: Record<string, any>;
}

export interface EmailVariable {
  userName?: string;
  userEmail?: string;
  plan?: UserPlan;
  messagesUsed?: number;
  messagesLimit?: number;
  daysInactive?: number;
  trialEndsAt?: Date;
  customData?: Record<string, any>;
}

export interface EmailTemplateData extends EmailVariable {
  unsubscribeUrl: string;
  loginUrl: string;
  dashboardUrl: string;
  upgradeUrl: string;
  supportUrl: string;
}

export interface SequenceConfig {
  name: SequenceName;
  description: string;
  category: SequenceCategory;
  triggerEvent: TriggerEvent;
  targetPlans?: UserPlan[];
  priority?: number;
  active?: boolean;
}

export interface EmailTemplateConfig {
  name: string;
  subject: string;
  templateId: string;
  delayDays?: number;
  delayHours?: number;
  sendTimeStart?: number; // 0-23
  sendTimeEnd?: number; // 0-23
  order: number;
  active?: boolean;
  requiresPreviousEmail?: boolean;
  metadata?: Record<string, any>;
}

export interface SequenceStats {
  scheduled: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  opened: number;
  clicked: number;
  converted: number;
  unsubscribed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  unsubscribeRate: number;
}

export interface ConversionGoal {
  type: ConversionType;
  trackingUrl?: string;
  expectedRevenue?: number;
}
