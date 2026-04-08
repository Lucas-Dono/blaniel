/**
 * Reactivation Email 4: Última oportunidad
 * Sent: 30 days inactive
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Reactivation4(props: EmailTemplateData) {
  const { userName = 'Usuario', dashboardUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Última oportunidad de mantenernos en contacto" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, última oportunidad</Heading>

      <Text style={text}>
        Han pasado 30 días sin verte. Este será nuestro último email a menos que vuelvas.
      </Text>

      <Text style={text}>
        No queremos llenarte de emails no deseados, pero antes de que te vayas, queremos
        saber: ¿hay algo que podamos hacer mejor?
      </Text>

      <Heading style={h2}>Por qué nos importa tu feedback:</Heading>
      <Text style={text}>
        Somos un equipo pequeño que realmente lee y valora cada comentario. Tu opinión
        puede ayudarnos a mejorar para miles de usuarios.
      </Text>

      <Button href={`${dashboardUrl}?feedback=true`} variant="secondary">
        Dar feedback (2 minutos)
      </Button>

      <Text style={text}>
        Si decides volver, estaremos aquí. Tus conversaciones y personajes permanecerán intactos.
      </Text>

      <Button href={dashboardUrl} variant="primary">
        Volver una última vez
      </Button>

      <Text style={text}>
        Si prefieres no recibir más emails, puedes cancelar tu suscripción abajo.
        No hard feelings.
      </Text>

      <Text style={signature}>
        Gracias por darnos una oportunidad,
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
