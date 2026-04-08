/**
 * Email Verification Code Template
 * Sent: When user needs to verify email with 6-digit code (mobile/2FA)
 */

import { Heading, Text, Section } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';

interface EmailVerificationCodeProps {
  code: string;
  userName?: string;
  unsubscribeUrl?: string;
  expiresInMinutes?: number;
}

export default function EmailVerificationCode(props: EmailVerificationCodeProps) {
  const {
    code = '000000',
    userName = 'Usuario',
    unsubscribeUrl = '#',
    expiresInMinutes = 15,
  } = props;

  return (
    <EmailLayout preview="Tu codigo de verificacion" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Verifica tu email</Heading>

      <Text style={text}>Hola {userName},</Text>

      <Text style={text}>
        Usa el siguiente codigo para verificar tu direccion de email en Blaniel:
      </Text>

      <Section style={codeContainer}>
        <Text style={codeText}>{code}</Text>
      </Section>

      <Text style={text}>
        <strong>Este codigo expira en {expiresInMinutes} minutos.</strong>
      </Text>

      <Text style={helpText}>
        Si no solicitaste este codigo, puedes ignorar este email de forma segura.
        Tu cuenta permanecera sin cambios.
      </Text>

      <Text style={warningBox}>
        <strong>Importante:</strong> Nunca compartas este codigo con nadie.
        El equipo de Blaniel nunca te pedira este codigo.
      </Text>

      <Text style={signature}>
        Hasta pronto,
        <br />
        El equipo de Blaniel
      </Text>
    </EmailLayout>
  );
}

// Styles
const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px',
  padding: '0',
  lineHeight: '1.3',
};

const text = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const codeContainer = {
  backgroundColor: '#1F2937',
  borderRadius: '12px',
  margin: '24px 0',
  padding: '24px',
  textAlign: 'center' as const,
};

const codeText = {
  color: '#8B5CF6',
  fontSize: '36px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  margin: '0',
  fontFamily: 'monospace',
};

const helpText = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0',
};

const warningBox = {
  backgroundColor: '#fef3c7',
  border: '1px solid #f59e0b',
  borderRadius: '8px',
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0',
  padding: '16px',
};

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0',
  fontStyle: 'italic' as const,
};
