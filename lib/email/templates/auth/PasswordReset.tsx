/**
 * Password Reset Template
 * Sent: When user requests a password reset
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';

interface PasswordResetProps {
  userName?: string;
  resetUrl: string;
  unsubscribeUrl?: string;
  expiresInHours?: number;
  ipAddress?: string;
  userAgent?: string;
}

export default function PasswordReset(props: PasswordResetProps) {
  const {
    userName = 'Usuario',
    resetUrl = '#',
    unsubscribeUrl = '#',
    expiresInHours = 1,
    ipAddress,
    userAgent,
  } = props;

  return (
    <EmailLayout preview="Restablece tu contraseña" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Restablece tu contraseña</Heading>

      <Text style={text}>Hola {userName},</Text>

      <Text style={text}>
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en Blaniel.
      </Text>

      <Text style={text}>
        <strong>Haz clic en el botón de abajo para crear una nueva contraseña:</strong>
      </Text>

      <Button href={resetUrl} variant="primary">
        Restablecer contraseña
      </Button>

      <Text style={text}>
        O copia y pega este enlace en tu navegador:
      </Text>

      <Text style={link}>{resetUrl}</Text>

      <Text style={text}>
        <strong>Este enlace expirará en {expiresInHours} hora{expiresInHours !== 1 ? 's' : ''}.</strong>
      </Text>

      {(ipAddress || userAgent) && (
        <Text style={infoBox}>
          <strong>📋 Información de la solicitud:</strong>
          <br />
          {ipAddress && (
            <>
              IP: {ipAddress}
              <br />
            </>
          )}
          {userAgent && <>Dispositivo: {userAgent}</>}
        </Text>
      )}

      <Text style={warningBox}>
        <strong>⚠️ Importante:</strong> Si no solicitaste este cambio de contraseña, alguien podría
        estar intentando acceder a tu cuenta. En ese caso:
        <br />
        <br />
        1. <strong>NO</strong> hagas clic en el enlace de arriba
        <br />
        2. Cambia tu contraseña inmediatamente desde la aplicación
        <br />
        3. Contacta a nuestro equipo de soporte
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

const infoBox = {
  backgroundColor: '#f0f9ff',
  border: '1px solid  #3b82f6',
  borderRadius: '8px',
  color: '#1e40af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0',
  padding: '16px',
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
