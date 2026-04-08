/**
 * API Route: POST /api/analytics/track
 *
 * Endpoint para tracking de eventos de analytics desde el cliente.
 * Soporta eventos anónimos (landing page) y autenticados (app).
 *
 * - Landing events (landing.*): No requieren autenticación
 * - App events (app.*): Requieren autenticación
 * - Conversion events (conversion.*): Requieren autenticación
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { trackEvent, EventType } from "@/lib/analytics/kpi-tracker";
import {
  LandingEventType,
  AppEventType,
  ConversionEventType,
} from "@/lib/analytics/types";

export async function POST(req: NextRequest) {
  try {
    // Parsear body primero
    const body = await req.json();
    console.log('[Analytics Track] Received body:', JSON.stringify(body));

    // Validación básica
    if (!body || typeof body !== 'object') {
      console.log('[Analytics Track] Invalid body type');
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { eventType, metadata = {} } = body;

    // Validate eventType
    if (!eventType || typeof eventType !== 'string') {
      console.log('[Analytics Track] Missing or invalid eventType:', eventType);
      return NextResponse.json(
        { error: "eventType is required and must be a string", received: eventType },
        { status: 400 }
      );
    }

    console.log('[Analytics Track] Validating eventType:', eventType);

    // Validate que el eventType existe en alguno de los enums
    const allValidEventTypes = [
      ...Object.values(EventType),
      ...Object.values(LandingEventType),
      ...Object.values(AppEventType),
      ...Object.values(ConversionEventType),
    ];

    // Permitir cualquier string que siga el patrón namespace.event
    // Esto da flexibilidad para nuevos eventos sin necesidad de actualizar el enum
    const isValidPattern = /^(landing|app|conversion)\.[a-z_]+$/.test(eventType);

    if (!isValidPattern && !allValidEventTypes.includes(eventType as any)) {
      console.log('[Analytics Track] Invalid eventType:', eventType);
      return NextResponse.json(
        {
          error: "Invalid event type format",
          received: eventType,
          expected: "Format: namespace.event (e.g., landing.page_view, app.message_send)",
        },
        { status: 400 }
      );
    }

    // Check authentication solo para eventos que NO son de landing
    const isLandingEvent = eventType.startsWith('landing.');

    if (!isLandingEvent) {
      // For eventos de app, requerir autenticación
      const user = await getAuthenticatedUser(req);
      if (!user?.id) {
        console.log('[Analytics Track] No user authenticated for non-landing event');
        return NextResponse.json(
          { error: "Unauthorized - authentication required for this event type" },
          { status: 401 }
        );
      }
      console.log('[Analytics Track] User authenticated:', user.id);

      // Agregar userId al metadata si está autenticado
      metadata.userId = user.id;
    } else {
      // For eventos de landing, permitir anónimos
      console.log('[Analytics Track] Landing event - allowing anonymous tracking');
    }

    // Track the event
    console.log('[Analytics Track] About to call trackEvent with:', { eventType, metadataKeys: Object.keys(metadata) });
    try {
      await trackEvent(eventType as EventType, metadata);
      console.log('[Analytics Track] Event tracked successfully');
    } catch (trackError) {
      console.error('[Analytics Track] Error calling trackEvent:', trackError);
      throw trackError;
    }

    return NextResponse.json({
      success: true,
      message: "Event tracked successfully",
    });
  } catch (error) {
    console.error("[Analytics Track API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
