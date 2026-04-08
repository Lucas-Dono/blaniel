/**
 * Trial Ending 2: Trial ends tomorrow
 * Sent: 1 day before trial ends
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function TrialEnding2(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Última oportunidad: Tu trial termina mañana" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, última oportunidad</Heading>

      <Text style={alert}>
        Tu trial de Plus termina MAÑANA
      </Text>

      <Text style={text}>
        Después de mañana, volverás al plan gratuito y perderás acceso a:
      </Text>

      <Text style={lossItem}>Mensajes ilimitados (volverás a 100/día)</Text>
      <Text style={lossItem}>50 personajes personalizados (volverás a 5)</Text>
      <Text style={lossItem}>Mundos virtuales avanzados</Text>
      <Text style={lossItem}>Memoria extendida para IAs (perderás memoria antigua)</Text>
      <Text style={lossItem}>Navegación sin anuncios</Text>

      <Text style={text}>
        Por solo $9.99/mes, puedes mantener todo esto y más. Sin compromisos, cancela
        cuando quieras.
      </Text>

      <Button href={upgradeUrl} variant="primary">
        No quiero perder mis features
      </Button>

      <Text style={text}>
        O explora el plan Ultra ($19.99/mes) con características aún más avanzadas:
        modelos de IA premium, personajes ilimitados, y creación de mundos personalizados.
      </Text>

      <Button href={`${upgradeUrl}?plan=ultra`} variant="secondary">
        Ver plan Ultra
      </Button>

      <Text style={signature}>
        Mañana es el último día,
        <br />
        El equipo de Blaniel
      </Text>
    </EmailLayout>
  );
}

const h1 = { color: '#1a1a1a', fontSize: '24px', fontWeight: 'bold', margin: '0 0 24px', lineHeight: '1.3' };
const text = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const alert = { color: '#dc2626', fontSize: '20px', lineHeight: '28px', margin: '16px 0', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '2px solid #fca5a5', textAlign: 'center' as const, fontWeight: 'bold' };
const lossItem = { color: '#dc2626', fontSize: '15px', lineHeight: '22px', margin: '8px 0', paddingLeft: '20px' };
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
