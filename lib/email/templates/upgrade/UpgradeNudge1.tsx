/**
 * Upgrade Nudge 1: Casi en el límite
 * Sent: When user reaches 90% of message limit
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function UpgradeNudge1(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#', messagesUsed = 90, messagesLimit = 100 } = props;

  return (
    <EmailLayout preview="Casi alcanzaste tu límite de mensajes" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, estás cerca del límite</Heading>

      <Text style={text}>
        Has usado <strong>{messagesUsed} de {messagesLimit} mensajes</strong> este mes.
        Eso es increíble! Estás aprovechando al máximo Blaniel.
      </Text>

      <Text style={text}>
        Para que nunca te quedes sin conversaciones, considera el plan Plus:
      </Text>

      <Heading style={h2}>Plan Plus - $9.99/mes</Heading>
      <Text style={listItem}>Mensajes ILIMITADOS (nunca te preocupes por límites)</Text>
      <Text style={listItem}>50 personajes personalizados (vs 5 gratis)</Text>
      <Text style={listItem}>Mundos virtuales avanzados</Text>
      <Text style={listItem}>Memoria extendida para IAs</Text>
      <Text style={listItem}>Sin anuncios</Text>

      <Button href={upgradeUrl} variant="primary">
        Upgrade a Plus
      </Button>

      <Text style={text}>
        O prueba el plan Ultra con características aún más avanzadas y modelos de IA premium.
      </Text>

      <Text style={signature}>
        Sigue conversando,
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
