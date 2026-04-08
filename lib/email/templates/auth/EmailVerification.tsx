/**
 * Email Verification Template
 * Sent: When user signs up or requests email verification
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';

interface EmailVerificationProps {
  userName?: string;
  verificationUrl: string;
  unsubscribeUrl?: string;
  expiresInHours?: number;
}

export default function EmailVerification(props: EmailVerificationProps) {
  const {
    userName = 'Usuario',
    verificationUrl = '#',
    unsubscribeUrl = '#',
    expiresInHours = 24,
  } = props;

  return (
    <EmailLayout preview="Verifica tu dirección de email" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Verifica tu dirección de email</Heading>

      <Text style={text}>Hola {userName},</Text>

      <Text style={text}>
        Gracias por registrarte en Blaniel. Para completar tu registro y comenzar a disfrutar de
        conversaciones increíbles con personajes de IA, necesitamos verificar tu dirección de email.
      </Text>

      <Text style={text}>
        <strong>Haz clic en el botón de abajo para verificar tu email:</strong>
      </Text>

      <Button href={verificationUrl} variant="primary">
        Verificar mi email
      </Button>

      <Text style={text}>
        O copia y pega este enlace en tu navegador:
      </Text>

      <Text style={link}>{verificationUrl}</Text>

      <Text style={text}>
        <strong>Este enlace expirará en {expiresInHours} horas.</strong>
      </Text>

      <Text style={warningBox}>
        <strong>⚠️ Importante:</strong> Si no solicitaste esta verificación, puedes ignorar este
        email de forma segura. Tu cuenta no será activada sin completar la verificación.
      </Text>

      <Text style={text}>
        Si tienes alguna pregunta o problema, no dudes en contactarnos respondiendo a este email.
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

const link = {
  color: '#6366f1',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
  wordBreak: 'break-all' as const,
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
