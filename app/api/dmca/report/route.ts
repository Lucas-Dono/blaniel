/**
 * DMCA TAKEDOWN REPORT ENDPOINT
 * 
 * Endpoint to report copyright violations under DMCA (Digital Millennium Copyright Act).
 * 
 * Process:
 * 1. User/copyright holder reports content
 * 2. System stores report in DB
 * 3. Automatic email to dmca@blaniel.com
 * 4. Admin reviews and takes manual action
 * 
 * IMPORTANT: This is a CRITICAL legal process.
 * Handle with SERIOUSNESS and respond within 24-48 hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logging/logger";

export const runtime = "nodejs";

const log = createLogger("DMCAReport");

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const DMCAReportSchema = z.object({
  // Reporter information
  reporterName: z.string().min(2, "Nombre requerido"),
  reporterEmail: z.string().email("Email válido requerido"),
  reporterCompany: z.string().optional(),
  reporterAddress: z.string().min(10, "Dirección completa requerida"),
  reporterPhone: z.string().optional(),

  // Copyright information
  copyrightWork: z.string().min(10, "Descripción de la obra protegida requerida"),
  copyrightOwner: z.string().min(2, "Propietario del copyright requerido"),
  copyrightRegistration: z.string().optional(), // Número de registro si existe

  // Contenido infractor
  infringingContentUrl: z.string().url("URL válida del contenido infractor requerida"),
  infringingContentDescription: z.string().min(20, "Descripción detallada del contenido infractor requerida"),
  infringingContentType: z.enum([
    "agent_character", // Personaje/agente basado en persona real sin permiso
    "agent_image", // Imagen del agente
    "marketplace_character", // Personaje en marketplace
    "user_profile", // Imagen de perfil de usuario
    "community_post", // Post en comunidad
    "other",
  ]),

  // Good faith statement
  goodFaithStatement: z.boolean().refine((val) => val === true, {
    message: "Debes declarar que actúas de buena fe",
  }),
  accuracyStatement: z.boolean().refine((val) => val === true, {
    message: "Debes declarar bajo pena de perjurio que la información es exacta",
  }),
  authorizedStatement: z.boolean().refine((val) => val === true, {
    message: "Debes declarar que estás autorizado para actuar en nombre del propietario",
  }),

  // Signature
  signature: z.string().min(2, "Firma requerida"),
  signatureDate: z.string().datetime("Fecha de firma requerida"),
});

// type DMCAReport = z.infer<typeof DMCAReportSchema>;

// ============================================================================
// POST /api/dmca/report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate entrada
    const validation = DMCAReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: validation.error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const report = validation.data;

    // Save en base de datos
    const dmcaReport = await prisma.dMCAReport.create({
      data: {
        // Reportante
        reporterName: report.reporterName,
        reporterEmail: report.reporterEmail,
        reporterCompany: report.reporterCompany,
        reporterAddress: report.reporterAddress,
        reporterPhone: report.reporterPhone,

        // Copyright
        copyrightWork: report.copyrightWork,
        copyrightOwner: report.copyrightOwner,
        copyrightRegistration: report.copyrightRegistration,

        // Contenido infractor
        infringingContentUrl: report.infringingContentUrl,
        infringingContentDescription: report.infringingContentDescription,
        infringingContentType: report.infringingContentType,

        // Firma y declaraciones
        signature: report.signature,
        signatureDate: new Date(report.signatureDate),

        // State inicial
        status: "pending",
        submittedAt: new Date(),
      },
    });

    // TODO: Enviar email a dmca@blaniel.com
    // Usar el email service existente:
    // import { sendEmail } from "@/lib/email/sender";
    //
    // await sendEmail({
    //   to: "dmca@blaniel.com",
    //   subject: `[DMCA] Nuevo reporte #${dmcaReport.id}`,
    //   html: generateDMCAEmailTemplate(report),
    // });

    console.log(`[DMCA] Nuevo reporte recibido: #${dmcaReport.id} de ${report.reporterName} <${report.reporterEmail}>`);
    console.log(`[DMCA] Contenido reportado: ${report.infringingContentUrl}`);

    return NextResponse.json({
      success: true,
      reportId: dmcaReport.id,
      message: "Reporte DMCA recibido. Será revisado en 24-48 horas.",
      estimatedResponseTime: "24-48 horas",
    });
  } catch (error) {
    log.error({ err: error, context: "DMCAReport" }, "Error processing DMCA report");

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "No se pudo procesar el reporte DMCA. Por favor contacta a dmca@blaniel.com directamente.",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/dmca/report?reportId=xxx
// Endpoint to check report status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("reportId");

    if (!reportId) {
      return NextResponse.json(
        {
          error: "reportId requerido",
        },
        { status: 400 }
      );
    }

    const report = await prisma.dMCAReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        resolvedAt: true,
        resolutionNotes: true,
        infringingContentType: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        {
          error: "Reporte no encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      reportId: report.id,
      status: report.status,
      submittedAt: report.submittedAt,
      resolvedAt: report.resolvedAt,
      resolutionNotes: report.resolutionNotes,
    });
  } catch (error) {
    log.error({ err: error, context: "DMCAReportStatus" }, "Error fetching DMCA report status");

    return NextResponse.json(
      {
        error: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
