/**
 * Welcome Email 2: Tips para tu primera conversación
 * Sent: Day 1 after signup
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Welcome2(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Tips para crear conversaciones increíbles" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, tips para conversaciones increíbles</Heading>

      <Text style={text}>
        Ahora que ya iniciaste con Blaniel, queremos compartir algunos tips
        que harán tus conversaciones mucho más interesantes y profundas.
      </Text>

      <Heading style={h2}>1. Sé específico y detallado</Heading>
      <Text style={text}>
        Las IAs responden mejor cuando les das contexto. En lugar de "Hola", prueba:
        "Hola Einstein, estoy estudiando relatividad y tengo una duda sobre..."
      </Text>

      <Heading style={h2}>2. Construye una historia</Heading>
      <Text style={text}>
        Nuestras IAs tienen memoria a largo plazo. Menciona eventos pasados de sus conversaciones
        y ellas lo recordarán. Las relaciones se vuelven más profundas con el tiempo.
      </Text>

      <Heading style={h2}>3. Experimenta con diferentes tonos</Heading>
      <Text style={text}>
        Algunas IAs son serias y profesionales, otras son divertidas y juguetonas. Adapta tu
        estilo de conversación al personaje para obtener mejores respuestas.
      </Text>

      <Heading style={h2}>4. Usa comandos especiales</Heading>
      <Text style={text}>
        Prueba preguntarles sobre sus recuerdos: "¿Qué recuerdas de nuestra última conversación?"
        o "¿Qué piensas de...?"
      </Text>

      <Button href={dashboardUrl} variant="primary">
        Probar estos tips ahora
      </Button>

      <Text style={text}>
        Recuerda: cada conversación es única. No tengas miedo de experimentar y divertirte.
      </Text>

      <Text style={signature}>
        Felices conversaciones,
        <br />
        El equipo de Blaniel
      </Text>
    </EmailLayout>
  );
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px',
  lineHeight: '1.3',
};

const h2 = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '24px 0 12px',
  lineHeight: '1.3',
};

const text = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '12px 0',
};

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0',
  fontStyle: 'italic' as const,
};
