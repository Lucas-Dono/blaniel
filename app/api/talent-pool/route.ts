import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Áreas válidas para el talent pool
const VALID_AREAS = ['engineering', 'design', 'community', 'other'] as const;

// Esquema de validación
const TalentPoolSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  area: z.enum(VALID_AREAS, {
    message: 'Área de interés inválida',
  }),
  portfolioUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  message: z.string().max(500, 'El mensaje no puede exceder 500 caracteres').optional(),
});

/**
 * POST /api/talent-pool - Registrar en la bolsa de talento
 * Endpoint público (sin autenticación)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate datos
    const validatedData = TalentPoolSchema.parse(body);

    // Limpiar portfolioUrl si está vacío
    const portfolioUrl = validatedData.portfolioUrl || null;

    // Check si el email ya existe
    const existingEntry = await prisma.talentPoolEntry.findUnique({
      where: { email: validatedData.email },
    });

    if (existingEntry) {
      return NextResponse.json(
        {
          error: 'Este email ya está registrado en nuestra bolsa de talento',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }

    // Create entrada
    const entry = await prisma.talentPoolEntry.create({
      data: {
        id: nanoid(),
        email: validatedData.email,
        name: validatedData.name,
        area: validatedData.area,
        portfolioUrl,
        message: validatedData.message || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Te has registrado exitosamente en nuestra bolsa de talento',
      id: entry.id,
    });
  } catch (error: unknown) {
    // Error de validación de Zod
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: zodError.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('Error en talent-pool:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
