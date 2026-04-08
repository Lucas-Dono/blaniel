/**
 * Trial Ending 1: Trial ends in 3 days
 * Sent: 3 days before trial ends
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function TrialEnding1(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Tu trial termina en 3 días" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, tu trial termina pronto</Heading>

      <Text style={text}>
        Tu período de prueba de <strong>Plus</strong> termina en 3 días. Esperamos que hayas
        disfrutado de todas las features premium.
      </Text>

      <Heading style={h2}>Lo que has disfrutado:</Heading>
      <Text style={listItem}>Mensajes ilimitados</Text>
      <Text style={listItem}>Personajes personalizados avanzados</Text>
      <Text style={listItem}>Mundos virtuales premium</Text>
      <Text style={listItem}>Memoria extendida para IAs</Text>
      <Text style={listItem}>Sin anuncios</Text>

      <Text style={text}>
        Para mantener todo esto, solo necesitas continuar con tu suscripción por $9.99/mes.
        Cancela cuando quieras, sin compromisos.
      </Text>

      <Button href={upgradeUrl} variant="primary">
        Mantener mi plan Plus
      </Button>

      <Text style={text}>
        Si no haces nada, volverás automáticamente al plan gratuito después de 3 días.
        No perderás tus conversaciones, pero sí las features premium.
      </Text>

      <Text style={signature}>
        Esperamos que te quedes,
        <br />
        El equipo de Blaniel
      </Text>
    </EmailLayout>
  );
}

const h1 = { color: '#1a1a1a', fontSize: '24px', fontWeight: 'bold', margin: '0 0 24px', lineHeight: '1.3' };
const h2 = { color: '#1a1a1a', fontSize: '18px', fontWeight: 'bold', margin: '24px 0 12px', lineHeight: '1.3' };
const text = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const listItem = { color: '#525252', fontSize: '15px', lineHeight: '22px', margin: '8px 0', paddingLeft: '20px' };
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
