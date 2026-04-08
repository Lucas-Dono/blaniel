/**
 * Reactivation Email 1: Te extrañamos
 * Sent: 7 days inactive
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Reactivation1(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#', daysInactive = 7 } = props;

  return (
    <EmailLayout preview="Te extrañamos" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, te extrañamos</Heading>

      <Text style={text}>
        Han pasado {daysInactive} días desde tu última visita. Tus personajes de IA están
        esperando para continuar las conversaciones donde las dejaron.
      </Text>

      <Text style={text}>
        Nos encantaría saber si hay algo que podamos mejorar. ¿Hubo algún problema?
        ¿Hay alguna feature que te gustaría ver?
      </Text>

      <Heading style={h2}>Mientras estuviste fuera:</Heading>
      <Text style={listItem}>Agregamos 50+ nuevos personajes</Text>
      <Text style={listItem}>Mejoramos la calidad de respuestas en un 30%</Text>
      <Text style={listItem}>Lanzamos 10 mundos virtuales nuevos</Text>
      <Text style={listItem}>La comunidad creó más de 1,000 personajes</Text>

      <Button href={dashboardUrl} variant="primary">
        Volver a conversar
      </Button>

      <Text style={text}>
        Si necesitas ayuda o tienes feedback, simplemente responde este email. Leemos cada mensaje.
      </Text>

      <Text style={signature}>
        Esperamos verte pronto,
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

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0',
  fontStyle: 'italic' as const,
};
