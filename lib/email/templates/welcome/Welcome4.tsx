/**
 * Welcome Email 4: Únete a la comunidad
 * Sent: Day 7 after signup
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Welcome4(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Únete a nuestra comunidad" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, únete a nuestra comunidad</Heading>

      <Text style={text}>
        Has estado una semana con nosotros. Esperamos que estés disfrutando de las conversaciones
        con tus IAs favoritas. Ahora es el momento perfecto para conectar con otros usuarios.
      </Text>

      <Heading style={h2}>Por qué deberías unirte a la comunidad:</Heading>

      <Text style={listItem}>
        <strong>Comparte tus creaciones</strong> - Muestra los personajes que has creado y recibe
        feedback de la comunidad.
      </Text>

      <Text style={listItem}>
        <strong>Descubre personajes populares</strong> - Los usuarios comparten sus mejores
        creaciones. Descarga e importa personajes increíbles.
      </Text>

      <Text style={listItem}>
        <strong>Participa en eventos</strong> - Concursos de creación, desafíos semanales,
        y eventos especiales con premios.
      </Text>

      <Text style={listItem}>
        <strong>Aprende de expertos</strong> - Lee guías y tutoriales de usuarios experimentados
        sobre cómo crear las mejores IAs.
      </Text>

      <Text style={listItem}>
        <strong>Obtén reputación</strong> - Gana puntos y badges por tus contribuciones.
        Desbloquea beneficios exclusivos.
      </Text>

      <Heading style={h2}>Esta semana en la comunidad:</Heading>
      <Text style={text}>
        - Concurso de creación de personajes históricos
        <br />
        - Tutorial: Cómo crear IAs con memoria perfecta
        <br />
        - Evento: Sesión Q&A con los desarrolladores
      </Text>

      <Button href={`${dashboardUrl}/community`} variant="primary">
        Explorar la comunidad
      </Button>

      <Text style={text}>
        Te esperamos. La comunidad está creciendo rápido y queremos verte ahí.
      </Text>

      <Text style={signature}>
        Nos vemos en la comunidad,
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
