/**
 * Password Changed Template
 * Sent: After a successful password reset
 */

import { Heading, Text, Link } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';

interface PasswordChangedProps {
  userName?: string;
  loginUrl?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
  ipAddress?: string;
  changedAt?: string;
}

export default function PasswordChanged(props: PasswordChangedProps) {
  const {
    userName = 'Usuario',
    loginUrl = '#',
    supportUrl = '#',
    unsubscribeUrl = '#',
    ipAddress,
    changedAt,
  } = props;

  return (
    <EmailLayout preview="Tu contraseña fue cambiada" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>✅ Contraseña cambiada exitosamente</Heading>

      <Text style={text}>Hola {userName},</Text>

      <Text style={text}>
        Te confirmamos que la contraseña de tu cuenta en Blaniel fue cambiada exitosamente.
      </Text>

      {(ipAddress || changedAt) && (
        <Text style={infoBox}>
          <strong>📋 Información del cambio:</strong>
          <br />
          {changedAt && (
            <>
              Fecha: {changedAt}
              <br />
            </>
          )}
          {ipAddress && <>IP: {ipAddress}</>}
        </Text>
      )}

      <Text style={text}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>

      <Button href={loginUrl} variant="primary">
        Iniciar sesión
      </Button>

      <Text style={warningBox}>
        <strong>⚠️ ¿No fuiste tú?</strong>
        <br />
        <br />
        Si NO cambiaste tu contraseña, tu cuenta podría estar comprometida.
        <br />
        <br />
        Por favor, contacta inmediatamente a nuestro{' '}
        <Link href={supportUrl} style={linkStyle}>
          equipo de soporte
        </Link>{' '}
        para proteger tu cuenta.
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

const infoBox = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #3b82f6',
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

const linkStyle = {
  color: '#6366f1',
  textDecoration: 'underline',
};

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0',
  fontStyle: 'italic' as const,
};
