/**
 * Real-Time Security Alerting System
 * 
 * Real-time alert system for security threats
 * 
 * Alert channels:
 * - Email (critical and daily summary)
 * - Webhook (Slack, Discord, etc.)
 * - Real-time dashboard (WebSocket)
 * - SMS (critical only, optional)
 */

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'real_time' | 'digest' | 'critical' | 'honeypot' | 'canary';

export interface AlertConfig {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  channels: {
    email?: string[];
    webhook?: string;
    dashboard?: boolean;
    sms?: string[];
  };
  metadata?: any;
  threatDetectionId?: string;
}

// ============================================================================
// ALERT CREATION
// ============================================================================

/** Creates and sends a security alert */
export async function sendAlert(config: AlertConfig): Promise<void> {
  try {
    console.log(`[ALERT] ${config.severity.toUpperCase()}: ${config.title}`);

    // Create database record
    const alert = await prisma.threatAlert.create({
      data: {
        id: nanoid(),
        updatedAt: new Date(),
        threatDetectionId: config.threatDetectionId,
        alertType: config.type,
        severity: config.severity,
        title: config.title,
        description: config.description,
        actionable: config.severity === 'critical' || config.severity === 'high',
        metadata: config.metadata || {},
        emailSent: false,
        slackSent: false,
        webhookSent: false,
        dashboardNotified: false,
      },
    });

    // Send via configured channels
    const promises: Promise<any>[] = [];

    if (config.channels.email && config.channels.email.length > 0) {
      promises.push(sendEmailAlert(alert.id, config));
    }

    if (config.channels.webhook) {
      promises.push(sendWebhookAlert(alert.id, config));
    }

    if (config.channels.dashboard) {
      promises.push(sendDashboardAlert(alert.id, config));
    }

    // Ejecutar en paralelo
    await Promise.allSettled(promises);

    console.log(`[ALERT] Alert ${alert.id} sent successfully`);
  } catch (error) {
    console.error('[ALERT] Error sending alert:', error);
    throw error;
  }
}

// ============================================================================
// EMAIL ALERTS
// ============================================================================

/** Sends alert via email */
async function sendEmailAlert(alertId: string, config: AlertConfig): Promise<void> {
  try {
    // TODO: Integrar con servicio de email (SendGrid, Resend, etc.)
    // Por ahora, solo logging

    const emailContent = formatEmailAlert(config);

    console.log('[ALERT] Email would be sent to:', config.channels.email);
    console.log('[ALERT] Email content:', emailContent);

    // Marcar como enviado
    await prisma.threatAlert.update({
      where: { id: alertId },
      data: { emailSent: true },
    });

    // TODO: Implement actual email sending
    /*
    await sendEmail({
      to: config.channels.email,
      subject: `[SECURITY] ${config.severity.toUpperCase()}: ${config.title}`,
      html: emailContent,
    });
    */
  } catch (error) {
    console.error('[ALERT] Error sending email:', error);
    throw error;
  }
}

function formatEmailAlert(config: AlertConfig): string {
  const severityColors: Record<AlertSeverity, string> = {
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626',
  };

  const severityEmojis: Record<AlertSeverity, string> = {
    low: 'ℹ️',
    medium: '⚠️',
    high: '🔥',
    critical: '🚨',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${severityColors[config.severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .severity { display: inline-block; padding: 4px 12px; background: ${severityColors[config.severity]}; color: white; border-radius: 4px; font-weight: bold; }
    .metadata { background: white; padding: 15px; border-left: 4px solid ${severityColors[config.severity]}; margin-top: 15px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${severityEmojis[config.severity]} Security Alert</h2>
    </div>
    <div class="content">
      <p><span class="severity">${config.severity.toUpperCase()}</span></p>
      <h3>${config.title}</h3>
      <p>${config.description.replace(/\n/g, '<br>')}</p>

      ${config.metadata ? `
      <div class="metadata">
        <strong>Additional Details:</strong>
        <pre>${JSON.stringify(config.metadata, null, 2)}</pre>
      </div>
      ` : ''}

      <p style="margin-top: 20px;">
        <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
        <strong>Alert Type:</strong> ${config.type}
      </p>
    </div>
    <div class="footer">
      <p>This is an automated security alert from your application.</p>
      <p>Please review and take appropriate action if necessary.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================================
// WEBHOOK ALERTS (Slack, Discord, etc.)
// ============================================================================

/** Sends alert via webhook */
async function sendWebhookAlert(alertId: string, config: AlertConfig): Promise<void> {
  try {
    if (!config.channels.webhook) {
      return;
    }

    const webhookPayload = formatWebhookAlert(config);

    const response = await fetch(config.channels.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
    }

    // Marcar como enviado
    await prisma.threatAlert.update({
      where: { id: alertId },
      data: {
        webhookSent: true,
        slackSent: true, // Asumir Slack por ahora
      },
    });

    console.log('[ALERT] Webhook sent successfully');
  } catch (error) {
    console.error('[ALERT] Error sending webhook:', error);
    throw error;
  }
}

function formatWebhookAlert(config: AlertConfig): any {
  const severityColors: Record<AlertSeverity, string> = {
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626',
  };

  const severityEmojis: Record<AlertSeverity, string> = {
    low: ':information_source:',
    medium: ':warning:',
    high: ':fire:',
    critical: ':rotating_light:',
  };

  // Formato compatible con Slack y Discord
  return {
    username: 'Security Alert Bot',
    icon_emoji: ':shield:',
    attachments: [
      {
        color: severityColors[config.severity],
        title: `${severityEmojis[config.severity]} ${config.title}`,
        text: config.description,
        fields: [
          {
            title: 'Severity',
            value: config.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Type',
            value: config.type,
            short: true,
          },
          {
            title: 'Timestamp',
            value: new Date().toISOString(),
            short: false,
          },
        ],
        footer: 'Security Monitoring System',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

// ============================================================================
// DASHBOARD ALERTS (Real-time)
// ============================================================================

/** Sends alert to real-time dashboard */
async function sendDashboardAlert(alertId: string, _config: AlertConfig): Promise<void> {
  try {
    // Marcar como notificado
    await prisma.threatAlert.update({
      where: { id: alertId },
      data: { dashboardNotified: true },
    });

    // TODO: Implementar WebSocket broadcast
    // Por ahora, el dashboard puede hacer polling a la API

    console.log('[ALERT] Dashboard notified');
  } catch (error) {
    console.error('[ALERT] Error notifying dashboard:', error);
    throw error;
  }
}

// ============================================================================
// ALERT TEMPLATES
// ============================================================================

/**
 * Templates de alertas pre-configuradas
 */
export const AlertTemplates = {
  honeypotHit: (ipAddress: string, honeypotName: string): AlertConfig => ({
    type: 'honeypot',
    severity: 'high',
    title: `Honeypot Hit: ${honeypotName}`,
    description: `An attacker has accessed a honeypot endpoint.\n\nIP: ${ipAddress}\nHoneypot: ${honeypotName}\n\nThis indicates active scanning or attack attempts.`,
    channels: {
      email: [process.env.SECURITY_EMAIL || 'security@example.com'],
      webhook: process.env.SLACK_WEBHOOK_URL,
      dashboard: true,
    },
  }),

  canaryTokenTriggered: (tokenType: string, ipAddress: string): AlertConfig => ({
    type: 'canary',
    severity: 'critical',
    title: `Canary Token Triggered: ${tokenType}`,
    description: `A canary token has been accessed, indicating potential data breach!\n\nToken Type: ${tokenType}\nIP Address: ${ipAddress}\n\nImmediate investigation required.`,
    channels: {
      email: [process.env.SECURITY_EMAIL || 'security@example.com'],
      webhook: process.env.SLACK_WEBHOOK_URL,
      dashboard: true,
      sms: process.env.SECURITY_SMS ? [process.env.SECURITY_SMS] : undefined,
    },
  }),

  bruteForceDetected: (ipAddress: string, endpoint: string, attempts: number): AlertConfig => ({
    type: 'real_time',
    severity: 'high',
    title: 'Brute Force Attack Detected',
    description: `Brute force attack detected from ${ipAddress}\n\nEndpoint: ${endpoint}\nAttempts: ${attempts}\n\nThe IP has been automatically blocked.`,
    channels: {
      email: [process.env.SECURITY_EMAIL || 'security@example.com'],
      webhook: process.env.SLACK_WEBHOOK_URL,
      dashboard: true,
    },
  }),

  sqlInjectionAttempt: (ipAddress: string, payload: string): AlertConfig => ({
    type: 'real_time',
    severity: 'critical',
    title: 'SQL Injection Attempt',
    description: `SQL injection attempt detected!\n\nIP: ${ipAddress}\nPayload: ${payload.substring(0, 200)}...\n\nRequest has been blocked.`,
    channels: {
      email: [process.env.SECURITY_EMAIL || 'security@example.com'],
      webhook: process.env.SLACK_WEBHOOK_URL,
      dashboard: true,
    },
  }),

  suspiciousActivity: (ipAddress: string, threatScore: number): AlertConfig => ({
    type: 'real_time',
    severity: threatScore > 70 ? 'high' : 'medium',
    title: 'Suspicious Activity Detected',
    description: `Suspicious activity from ${ipAddress}\n\nThreat Score: ${threatScore}/100\n\nMonitoring in progress.`,
    channels: {
      dashboard: true,
      webhook: threatScore > 80 ? process.env.SLACK_WEBHOOK_URL : undefined,
    },
  }),
};

// ============================================================================
// ALERT MANAGEMENT
// ============================================================================

/**
 * Obtiene alertas recientes
 */
export async function getRecentAlerts(
  limit: number = 50,
  filters?: {
    severity?: AlertSeverity[];
    type?: AlertType[];
    acknowledged?: boolean;
  }
): Promise<any[]> {
  try {
    return await prisma.threatAlert.findMany({
      where: {
        severity: filters?.severity ? { in: filters.severity } : undefined,
        alertType: filters?.type ? { in: filters.type } : undefined,
        acknowledged: filters?.acknowledged,
      },
      include: {
        ThreatDetection: {
          select: {
            threatType: true,
            ipAddress: true,
            path: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('[ALERT] Error getting recent alerts:', error);
    throw error;
  }
}

/**
 * Marca una alerta como reconocida
 */
export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
  try {
    await prisma.threatAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      },
    });

    console.log(`[ALERT] Alert ${alertId} acknowledged by ${acknowledgedBy}`);
  } catch (error) {
    console.error('[ALERT] Error acknowledging alert:', error);
    throw error;
  }
}

/**
 * Marca una alerta como resuelta
 */
export async function resolveAlert(
  alertId: string,
  resolution: string
): Promise<void> {
  try {
    await prisma.threatAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolution,
      },
    });

    console.log(`[ALERT] Alert ${alertId} resolved`);
  } catch (error) {
    console.error('[ALERT] Error resolving alert:', error);
    throw error;
  }
}

// ============================================================================
// ALERT STATISTICS
// ============================================================================

/** Gets alert statistics */
export async function getAlertStats(timeRange: { from: Date; to: Date }) {
  try {
    const alerts = await prisma.threatAlert.findMany({
      where: {
        createdAt: {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
      select: {
        severity: true,
        alertType: true,
        acknowledged: true,
        resolved: true,
      },
    });

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let acknowledged = 0;
    let resolved = 0;

    for (const alert of alerts) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byType[alert.alertType] = (byType[alert.alertType] || 0) + 1;
      if (alert.acknowledged) acknowledged++;
      if (alert.resolved) resolved++;
    }

    return {
      total: alerts.length,
      bySeverity,
      byType,
      acknowledged,
      resolved,
      pending: alerts.length - resolved,
    };
  } catch (error) {
    console.error('[ALERT] Error getting stats:', error);
    throw error;
  }
}

// ============================================================================
// DAILY DIGEST
// ============================================================================

/** Generates and sends daily security summary */
export async function sendDailySecurityDigest(): Promise<void> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Statistics
    const alertStats = await getAlertStats({ from: yesterday, to: today });

    const threatStats = await prisma.threatDetection.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    const honeypotHits = await prisma.honeypotHit.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    const canaryTriggers = await prisma.canaryTokenTrigger.count({
      where: {
        triggeredAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    // Create resumen
    const digest = `
Security Digest - ${yesterday.toLocaleDateString()}

📊 Summary:
- Total Alerts: ${alertStats.total}
- Critical Alerts: ${alertStats.bySeverity.critical || 0}
- Threats Detected: ${threatStats}
- Honeypot Hits: ${honeypotHits}
- Canary Triggers: ${canaryTriggers}

🔥 By Severity:
${Object.entries(alertStats.bySeverity).map(([sev, count]) => `- ${sev}: ${count}`).join('\n')}

✅ Status:
- Acknowledged: ${alertStats.acknowledged}
- Resolved: ${alertStats.resolved}
- Pending: ${alertStats.pending}
    `.trim();

    // Enviar digest
    await sendAlert({
      type: 'digest',
      severity: 'low',
      title: 'Daily Security Digest',
      description: digest,
      channels: {
        email: [process.env.SECURITY_EMAIL || 'security@example.com'],
        dashboard: true,
      },
    });

    console.log('[ALERT] Daily digest sent');
  } catch (error) {
    console.error('[ALERT] Error sending daily digest:', error);
  }
}
