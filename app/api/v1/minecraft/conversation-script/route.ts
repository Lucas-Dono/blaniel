import { NextRequest, NextResponse } from "next/server";
import { ConversationScriptGenerator } from "@/lib/minecraft/conversation-script-generator";
import { ConversationScriptManager } from "@/lib/minecraft/conversation-script-manager";
import { AmbientDialogueService } from "@/lib/minecraft/ambient-dialogue-service";

/**
 * POST /api/v1/minecraft/conversation-script
 *
 * Inicia o recupera una conversación con guión completo para un grupo
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { agentIds, location, contextHint, groupHash, forceNew } = body;

    // Validaciones
    if (!Array.isArray(agentIds) || agentIds.length < 2) {
      return NextResponse.json(
        { error: "Se requieren al menos 2 agentIds" },
        { status: 400 }
      );
    }

    if (!location) {
      return NextResponse.json(
        { error: "Se requiere location" },
        { status: 400 }
      );
    }

    if (!groupHash) {
      return NextResponse.json(
        { error: "Se requiere groupHash" },
        { status: 400 }
      );
    }

    // Check si ya hay un script registrado para este grupo
    const existingScript = ConversationScriptManager.getScriptByGroupHash(groupHash);

    if (existingScript && !forceNew) {
      // Retornar script existente completo
      return NextResponse.json({
        scriptId: existingScript.scriptId,
        version: existingScript.version,
        topic: existingScript.topic,
        location: existingScript.location,
        contextHint: existingScript.contextHint,
        participants: existingScript.participants.map((p) => ({
          agentId: p.agentId,
          name: p.name,
        })),
        lines: existingScript.lines.map((line) => ({
          agentId: line.agentId,
          agentName: line.agentName,
          message: line.message,
          phase: line.phase,
          lineNumber: line.lineNumber,
        })),
        totalLines: existingScript.lines.length,
        duration: existingScript.duration,
        createdAt: existingScript.createdAt,
        updatedAt: existingScript.updatedAt,
        source: "cache",
        cost: 0,
        generatedBy: existingScript.generatedBy,
        timing: {
          minDelayBetweenLines: 4,
          maxDelayBetweenLines: 7,
          pauseAtPhaseChange: 3,
          loopDelay: 180,
        },
      });
    }

    // Get participant information
    const participants = await AmbientDialogueService.getParticipantInfo(agentIds);

    // Generate nuevo guión
    const result = await ConversationScriptGenerator.generateScript({
      participants,
      location,
      contextHint,
      desiredLength: 12, // 12 líneas por defecto
      useTemplate: true, // Preferir templates (gratis)
    });

    // Registrar en manager solo para tracking (sin auto-advance)
    ConversationScriptManager.registerScript(groupHash, result.script);

    // Retornar guión completo para que el mod lo almacene localmente
    return NextResponse.json({
      scriptId: result.script.scriptId,
      version: result.script.version,
      topic: result.script.topic,
      location: result.script.location,
      contextHint: result.script.contextHint,
      participants: result.script.participants.map((p) => ({
        agentId: p.agentId,
        name: p.name,
      })),
      lines: result.script.lines.map((line) => ({
        agentId: line.agentId,
        agentName: line.agentName,
        message: line.message,
        phase: line.phase,
        lineNumber: line.lineNumber,
      })),
      totalLines: result.script.lines.length,
      duration: result.script.duration,
      createdAt: result.script.createdAt,
      updatedAt: result.script.updatedAt,
      source: result.source,
      cost: result.cost,
      generatedBy: result.script.generatedBy,
      // Configuración recomendada para el timer del cliente
      timing: {
        minDelayBetweenLines: 4,
        maxDelayBetweenLines: 7,
        pauseAtPhaseChange: 3,
        loopDelay: 180,
      },
    });
  } catch (error) {
    console.error("[Conversation Script API] Error:", error);
    return NextResponse.json(
      {
        error: "Error al generar guión conversacional",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/minecraft/conversation-script/metadata?groupHash=xxx
 *
 * Obtener solo metadata del script (para verificación de versión)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const groupHash = searchParams.get("groupHash");

    if (!groupHash) {
      return NextResponse.json(
        { error: "Se requiere groupHash" },
        { status: 400 }
      );
    }

    const metadata = ConversationScriptManager.getScriptMetadata(groupHash);

    if (!metadata) {
      return NextResponse.json(
        { error: "No hay script registrado para este grupo" },
        { status: 404 }
      );
    }

    return NextResponse.json(metadata);
  } catch (error) {
    console.error("[Conversation Script API] Error:", error);
    return NextResponse.json(
      {
        error: "Error al obtener metadata",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/minecraft/conversation-script?groupHash=xxx&playerId=yyy
 *
 * Reportar que un jugador está escuchando la conversación (para analytics)
 */
export async function PUT(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const groupHash = searchParams.get("groupHash");
    const playerId = searchParams.get("playerId");

    if (!groupHash || !playerId) {
      return NextResponse.json(
        { error: "Se requiere groupHash y playerId" },
        { status: 400 }
      );
    }

    // Registrar jugador como listener (solo para analytics)
    ConversationScriptManager.addListener(groupHash, playerId);

    return NextResponse.json({
      success: true,
      message: "Listener registrado",
    });
  } catch (error) {
    console.error("[Conversation Script API] Error:", error);
    return NextResponse.json(
      {
        error: "Error al registrar listener",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/minecraft/conversation-script?groupHash=xxx
 *
 * Eliminar script registrado para un grupo
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const groupHash = searchParams.get("groupHash");

    if (!groupHash) {
      return NextResponse.json(
        { error: "Se requiere groupHash" },
        { status: 400 }
      );
    }

    ConversationScriptManager.unregisterScript(groupHash);

    return NextResponse.json({
      success: true,
      message: "Script eliminado",
    });
  } catch (error) {
    console.error("[Conversation Script API] Error:", error);
    return NextResponse.json(
      {
        error: "Error al eliminar script",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
