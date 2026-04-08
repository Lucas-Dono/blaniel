/**
 * Email Template Renderer
 *
 * Renders React Email templates to HTML
 */

import React from 'react';
import { render } from '@react-email/components';
import type { EmailTemplateData } from '../types';

// Import templates
import WelcomeEmail from './welcome/Welcome1';
import TipsEmail from './welcome/Welcome2';
import DiscoverWorldsEmail from './welcome/Welcome3';
import JoinCommunityEmail from './welcome/Welcome4';
import UpgradePromptEmail from './welcome/Welcome5';

import ReactivationEmail1 from './reactivation/Reactivation1';
import ReactivationEmail2 from './reactivation/Reactivation2';
import ReactivationEmail3 from './reactivation/Reactivation3';
import ReactivationEmail4 from './reactivation/Reactivation4';

import UpgradeNudge1 from './upgrade/UpgradeNudge1';
import UpgradeNudge2 from './upgrade/UpgradeNudge2';
import UpgradeNudge3 from './upgrade/UpgradeNudge3';

import TrialEnding1 from './trial/TrialEnding1';
import TrialEnding2 from './trial/TrialEnding2';
import TrialEnding3 from './trial/TrialEnding3';

// Auth templates
import EmailVerification from './auth/EmailVerification';
import PasswordReset from './auth/PasswordReset';
import PasswordChanged from './auth/PasswordChanged';

// Template registry
const TEMPLATES: Record<string, React.ComponentType<any>> = {
  // Welcome sequence
  'welcome_1': WelcomeEmail,
  'welcome_2': TipsEmail,
  'welcome_3': DiscoverWorldsEmail,
  'welcome_4': JoinCommunityEmail,
  'welcome_5': UpgradePromptEmail,

  // Reactivation sequence
  'reactivation_1': ReactivationEmail1,
  'reactivation_2': ReactivationEmail2,
  'reactivation_3': ReactivationEmail3,
  'reactivation_4': ReactivationEmail4,

  // Upgrade nudge sequence
  'upgrade_nudge_1': UpgradeNudge1,
  'upgrade_nudge_2': UpgradeNudge2,
  'upgrade_nudge_3': UpgradeNudge3,

  // Trial ending sequence
  'trial_ending_1': TrialEnding1,
  'trial_ending_2': TrialEnding2,
  'trial_ending_3': TrialEnding3,

  // Auth templates
  'email_verification': EmailVerification,
  'password_reset': PasswordReset,
  'password_changed': PasswordChanged,
};

/**
 * Render email template to HTML and text
 */
export async function renderEmailTemplate(
  templateId: string,
  data: EmailTemplateData,
  subjectTemplate: string
): Promise<{ html: string; text: string; subject: string }> {
  const Template = TEMPLATES[templateId];

  if (!Template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Render HTML
  const html = await render(<Template {...data} /> as React.ReactElement);

  // Generate plain text version (basic conversion)
  const text = htmlToText(html);

  // Process subject template (replace variables)
  const subject = processTemplate(subjectTemplate, data);

  return { html, text, subject };
}

/**
 * Process template string (replace {{variables}})
 */
function processTemplate(template: string, data: EmailTemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (data as any)[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Convert HTML to plain text (basic)
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
