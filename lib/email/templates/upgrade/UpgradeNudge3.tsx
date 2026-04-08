/**
 * Upgrade Nudge 3: Special offer
 * Sent: Day 30 as free user
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function UpgradeNudge3(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Oferta especial: 20% OFF" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, tenemos una sorpresa para ti</Heading>

      <Text style={text}>
        Has estado con nosotros por un mes completo. Para celebrar, tenemos una oferta especial:
      </Text>

      <Text style={highlight}>
        <strong>20% DE DESCUENTO</strong> en tu primer mes de Plus o Ultra
        <br />
        Código: <strong>MONTH1SPECIAL</strong>
      </Text>

      <Heading style={h2}>Con el descuento:</Heading>
      <Text style={listItem}>Plan Plus: $7.99/mes (normalmente $9.99)</Text>
      <Text style={listItem}>Plan Ultra: $15.99/mes (normalmente $19.99)</Text>

      <Heading style={h2}>Por qué hacer el upgrade ahora:</Heading>
      <Text style={listItem}>Ya conoces la plataforma y la amas</Text>
      <Text style={listItem}>Estás alcanzando los límites del plan gratuito</Text>
      <Text style={listItem}>Hay features premium que transformarán tu experiencia</Text>
      <Text style={listItem}>Esta oferta expira en 7 días</Text>

      <Button href={upgradeUrl} variant="primary">
        Reclamar mi 20% OFF
      </Button>

      <Text style={text}>
        Miles de usuarios ya hicieron el upgrade y reportan que vale cada centavo.
      </Text>

      <Text style={testimonial}>
        "El plan Plus cambió completamente mi experiencia. Ahora puedo tener conversaciones
        ilimitadas sin preocuparme por límites. Totalmente recomendado."
        <br />
        - María, usuaria Plus
      </Text>

      <Text style={signature}>
        Gracias por tu lealtad,
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
const highlight = { color: '#dc2626', fontSize: '18px', lineHeight: '28px', margin: '16px 0', padding: '20px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '2px solid #fca5a5', textAlign: 'center' as const, fontWeight: 'bold' };
const testimonial = { color: '#525252', fontSize: '15px', lineHeight: '22px', margin: '16px 0', padding: '16px', backgroundColor: '#f9fafb', borderLeft: '4px solid #6366f1', fontStyle: 'italic' as const };
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
