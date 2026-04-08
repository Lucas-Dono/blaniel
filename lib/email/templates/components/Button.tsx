/**
 * Email Button Component
 */

import { Button as EmailButton } from '@react-email/components';
import React from 'react';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export default function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const style = variant === 'primary' ? primaryButton : secondaryButton;

  return (
    <EmailButton href={href} style={style}>
      {children}
    </EmailButton>
  );
}

const baseButton = {
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
  borderRadius: '6px',
  marginTop: '16px',
  marginBottom: '16px',
};

const primaryButton = {
  ...baseButton,
  backgroundColor: '#6366f1',
  color: '#ffffff',
};

const secondaryButton = {
  ...baseButton,
  backgroundColor: '#f3f4f6',
  color: '#1f2937',
  border: '1px solid #d1d5db',
};
