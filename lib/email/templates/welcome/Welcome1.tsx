/**
 * Welcome Email 1: Bienvenida + Quick Start Guide
 * Sent: Immediately after signup
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Welcome1(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Bienvenido a Blaniel" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, bienvenido a Blaniel</Heading>

      <Text style={text}>
        Estamos emocionados de tenerte aquí. Has dado el primer paso hacia conversaciones increíbles
        con personajes de IA únicos y mundos virtuales fascinantes.
      </Text>

      <Text style={text}>
        <strong>Aquí está tu guía rápida para empezar:</strong>
      </Text>

      <Text style={listItem}>
        <strong>1. Explora personajes</strong> - Descubre cientos de IAs con personalidades únicas,
        desde Einstein hasta personajes de anime.
      </Text>

      <Text style={listItem}>
        <strong>2. Inicia tu primera conversación</strong> - Selecciona un personaje y comienza
        a chatear. La IA recordará todo lo que hablen.
      </Text>

      <Text style={listItem}>
        <strong>3. Crea tu propia IA</strong> - Dale vida a tus ideas creando personajes personalizados
        con sus propias personalidades y recuerdos.
      </Text>

      <Text style={listItem}>
        <strong>4. Descubre mundos virtuales</strong> - Explora escenarios interactivos donde múltiples
        IAs pueden interactuar contigo simultáneamente.
      </Text>

      <Button href={dashboardUrl} variant="primary">
        Comenzar ahora
      </Button>

      <Text style={text}>
        Si tienes alguna pregunta, nuestro equipo de soporte está aquí para ayudarte. Simplemente
        responde a este email.
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

const listItem = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '12px 0',
  paddingLeft: '20px',
};

const signature = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '32px 0 0',
  fontStyle: 'italic' as const,
};
