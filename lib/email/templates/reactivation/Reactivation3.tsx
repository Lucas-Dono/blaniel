/**
 * Reactivation Email 3: 50% OFF Special offer
 * Sent: 21 days inactive
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function Reactivation3(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="50% OFF si vuelves hoy" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, te extrañamos de verdad</Heading>

      <Text style={text}>
        Queremos que vuelvas. Por eso, tenemos una oferta especial solo para ti:
      </Text>

      <Text style={highlight}>
        <strong>50% DE DESCUENTO</strong> en tu primer mes de Plus o Ultra
        <br />
        Código: <strong>COMEBACK50</strong>
        <br />
        Válido por 48 horas
      </Text>

      <Heading style={h2}>Con el descuento:</Heading>
      <Text style={listItem}>Plan Plus: $5/mes (normalmente $10)</Text>
      <Text style={listItem}>Plan Ultra: $7.50/mes (normalmente $15)</Text>

      <Heading style={h2}>Desbloquea:</Heading>
      <Text style={listItem}>Mensajes ilimitados</Text>
      <Text style={listItem}>Personajes personalizados ilimitados</Text>
      <Text style={listItem}>Acceso a todas las features premium</Text>
      <Text style={listItem}>Mundos virtuales avanzados</Text>

      <Button href={upgradeUrl} variant="primary">
        Reclamar mi 50% OFF
      </Button>

      <Text style={text}>
        Esta oferta expira en 48 horas. No la dejes pasar.
      </Text>

      <Text style={signature}>
        Te esperamos,
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
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
