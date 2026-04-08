/**
 * Welcome Email 5: Upgrade prompt (trial ending soon)
 * Sent: Day 14 after signup
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Welcome5(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Desbloquea todo el potencial" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, desbloquea todo el potencial</Heading>

      <Text style={text}>
        Han pasado 2 semanas desde que te uniste a Blaniel. Esperamos que
        estés disfrutando de tus conversaciones con nuestras IAs.
      </Text>

      <Text style={text}>
        Has experimentado lo básico, pero hay mucho más esperándote con nuestros planes premium.
      </Text>

      <Heading style={h2}>Plan Plus - $10/mes</Heading>
      <Text style={listItem}>Mensajes ilimitados (vs 100/día gratis)</Text>
      <Text style={listItem}>Crea hasta 10 personajes personalizados (vs 3 gratis)</Text>
      <Text style={listItem}>100 mensajes de voz por mes</Text>
      <Text style={listItem}>Acceso a mundos virtuales avanzados</Text>
      <Text style={listItem}>Memoria extendida para IAs</Text>
      <Text style={listItem}>Prioridad en tiempos de respuesta</Text>
      <Text style={listItem}>Sin anuncios</Text>

      <Heading style={h2}>Plan Ultra - $15/mes</Heading>
      <Text style={listItem}>Todo lo de Plus, más:</Text>
      <Text style={listItem}>Agentes ilimitados</Text>
      <Text style={listItem}>Mundos virtuales ilimitados</Text>
      <Text style={listItem}>50 mensajes de voz por mes</Text>
      <Text style={listItem}>Memoria ilimitada para IAs</Text>
      <Text style={listItem}>Soporte prioritario 24/7</Text>

      <Heading style={h2}>Oferta de lanzamiento</Heading>
      <Text style={highlight}>
        20% de descuento en tu primer mes con el código: <strong>WELCOME20</strong>
      </Text>

      <Button href={upgradeUrl} variant="primary">
        Upgrade ahora
      </Button>

      <Text style={text}>
        No estás listo todavía? No hay problema. Puedes seguir disfrutando del plan gratuito
        todo el tiempo que quieras.
      </Text>

      <Text style={signature}>
        Gracias por estar con nosotros,
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

const listItem = {
  color: '#525252',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '8px 0',
  paddingLeft: '20px',
};

const highlight = {
  color: '#059669',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '16px',
  backgroundColor: '#ecfdf5',
  borderRadius: '6px',
  border: '1px solid #a7f3d0',
};

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0',
  fontStyle: 'italic' as const,
};
