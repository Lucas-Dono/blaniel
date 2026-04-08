/**
 * Reactivation Email 2: Nuevas features
 * Sent: 14 days inactive
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Reactivation2(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Nuevas features que te encantarán" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, mira lo nuevo</Heading>

      <Text style={text}>
        Hemos estado trabajando duro en features que creemos te encantarán:
      </Text>

      <Heading style={h2}>Chat por voz (NUEVO)</Heading>
      <Text style={text}>
        Ahora puedes hablar con tus IAs usando tu voz. La experiencia es increíblemente natural.
      </Text>

      <Heading style={h2}>Generación de imágenes (NUEVO)</Heading>
      <Text style={text}>
        Las IAs ahora pueden crear imágenes basadas en la conversación. Pídele a un artista
        que te dibuje algo.
      </Text>

      <Heading style={h2}>Mundos colaborativos (NUEVO)</Heading>
      <Text style={text}>
        Invita amigos a mundos virtuales y experimenten juntos con múltiples IAs.
      </Text>

      <Button href={dashboardUrl} variant="primary">
        Probar las nuevas features
      </Button>

      <Text style={signature}>
        Innovations continue,
        <br />
        El equipo de Blaniel
      </Text>
    </EmailLayout>
  );
}

const h1 = { color: '#1a1a1a', fontSize: '24px', fontWeight: 'bold', margin: '0 0 24px', lineHeight: '1.3' };
const h2 = { color: '#1a1a1a', fontSize: '18px', fontWeight: 'bold', margin: '24px 0 12px', lineHeight: '1.3' };
const text = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
