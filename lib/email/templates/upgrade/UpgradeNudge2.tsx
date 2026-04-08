/**
 * Upgrade Nudge 2: Unlock mundos virtuales
 * Sent: Day 20 as free user
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function UpgradeNudge2(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Unlock los mundos virtuales" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, lleva tus conversaciones al siguiente nivel</Heading>

      <Text style={text}>
        Has estado disfrutando de conversaciones 1-a-1 con nuestras IAs. Pero hay una
        experiencia completamente diferente esperándote: <strong>Mundos Virtuales</strong>.
      </Text>

      <Heading style={h2}>Qué te estás perdiendo:</Heading>
      <Text style={listItem}>
        <strong>Interacciones múltiples</strong> - Varios personajes interactuando contigo
        y entre ellos simultáneamente
      </Text>
      <Text style={listItem}>
        <strong>Escenarios inmersivos</strong> - Desde cafeterías hasta batallas épicas
      </Text>
      <Text style={listItem}>
        <strong>Narrativas dinámicas</strong> - Las historias evolucionan según tus decisiones
      </Text>
      <Text style={listItem}>
        <strong>Crea tus mundos</strong> - Con Ultra, diseña escenarios completamente personalizados
      </Text>

      <Text style={highlight}>
        Usuarios de Plus reportan 3x más engagement y satisfacción
      </Text>

      <Button href={upgradeUrl} variant="primary">
        Explorar mundos virtuales
      </Button>

      <Text style={text}>
        Pruébalo por un mes. Si no te encanta, cancela en cualquier momento.
      </Text>

      <Text style={signature}>
        Aventuras te esperan,
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
const highlight = { color: '#059669', fontSize: '16px', lineHeight: '24px', margin: '16px 0', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' };
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
