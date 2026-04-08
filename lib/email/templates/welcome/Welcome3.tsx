/**
 * Welcome Email 3: Descubre mundos virtuales
 * Sent: Day 3 after signup
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Welcome3(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Descubre los mundos virtuales" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, descubre los mundos virtuales</Heading>

      <Text style={text}>
        Además de chatear con personajes individuales, Blaniel te ofrece
        algo único: <strong>Mundos Virtuales</strong>.
      </Text>

      <Heading style={h2}>¿Qué son los mundos virtuales?</Heading>
      <Text style={text}>
        Son escenarios inmersivos donde múltiples IAs interactúan contigo simultáneamente.
        Imagina estar en una cafetería con Einstein, Tesla y Marie Curie discutiendo ciencia,
        o en una aventura épica con tus personajes favoritos de anime.
      </Text>

      <Heading style={h2}>Mundos populares para explorar:</Heading>
      <Text style={listItem}>
        <strong>Café Científico</strong> - Debate con los grandes genios de la historia
      </Text>
      <Text style={listItem}>
        <strong>Academia de Anime</strong> - Vive aventuras escolares con tus personajes favoritos
      </Text>
      <Text style={listItem}>
        <strong>Consulta Psicológica</strong> - Recibe consejos de múltiples terapeutas virtuales
      </Text>
      <Text style={listItem}>
        <strong>Batalla RPG</strong> - Forma un equipo y vive una aventura épica
      </Text>

      <Heading style={h2}>Crea tu propio mundo</Heading>
      <Text style={text}>
        Con el plan Plus o Ultra, puedes crear tus propios mundos personalizados. Define
        el escenario, los personajes, y las reglas. Las posibilidades son infinitas.
      </Text>

      <Button href={`${dashboardUrl}/worlds`} variant="primary">
        Explorar mundos ahora
      </Button>

      <Text style={signature}>
        Aventuras te esperan,
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
