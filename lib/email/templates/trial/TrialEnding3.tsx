/**
 * Trial Ending 3: Trial ended - downgraded to free
 * Sent: Day after trial ends
 */

import { Heading, Text } from '@react-email/components';
import React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import type { EmailTemplateData } from '../../types';

export default function TrialEnding3(props: EmailTemplateData) {
  const { userName = 'Usuario', upgradeUrl = '#', unsubscribeUrl = '#' } = props;

  return (
    <EmailLayout preview="Tu plan ha cambiado a Free" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={h1}>Hola {userName}, tu plan ha cambiado</Heading>

      <Text style={text}>
        Tu trial de Plus ha terminado y ahora estás de vuelta en el plan gratuito.
        Tus conversaciones y personajes siguen intactos, pero hay algunas limitaciones:
      </Text>

      <Heading style={h2}>Lo que perdiste:</Heading>
      <Text style={lossItem}>Mensajes ilimitados mensajes limitados a 100/día</Text>
      <Text style={lossItem}>50 personajes personalizados solo 5 personajes</Text>
      <Text style={lossItem}>Mundos virtuales avanzados solo mundos básicos</Text>
      <Text style={lossItem}>Memoria extendida para IAs memoria básica (2,000 tokens)</Text>
      <Text style={lossItem}>Experiencia sin anuncios verás anuncios ocasionales</Text>

      <Heading style={h2}>Todavía tienes tiempo para recuperarlo:</Heading>
      <Text style={highlight}>
        Reactiva tu plan Plus en las próximas 48 horas y obtén
        <strong> 25% de descuento</strong> en tu primer mes
        <br />
        Código: <strong>COMEBACK25</strong>
      </Text>

      <Button href={upgradeUrl} variant="primary">
        Reactivar Plus con descuento
      </Button>

      <Text style={text}>
        Sabemos que las features premium marcan la diferencia. Más de 10,000 usuarios
        han elegido Plus por sus beneficios.
      </Text>

      <Text style={text}>
        Si el plan gratuito te funciona, perfecto! Seguiremos mejorando la plataforma
        para todos los usuarios.
      </Text>

      <Text style={signature}>
        Siempre bienvenido,
        <br />
        El equipo de Blaniel
      </Text>
    </EmailLayout>
  );
}

const h1 = { color: '#1a1a1a', fontSize: '24px', fontWeight: 'bold', margin: '0 0 24px', lineHeight: '1.3' };
const h2 = { color: '#1a1a1a', fontSize: '18px', fontWeight: 'bold', margin: '24px 0 12px', lineHeight: '1.3' };
const text = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const lossItem = { color: '#dc2626', fontSize: '15px', lineHeight: '22px', margin: '8px 0', paddingLeft: '20px', textDecoration: 'line-through' };
const highlight = { color: '#059669', fontSize: '16px', lineHeight: '24px', margin: '16px 0', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', textAlign: 'center' as const };
const signature = { color: '#1a1a1a', fontSize: '16px', lineHeight: '24px', margin: '32px 0 0', fontStyle: 'italic' as const };
