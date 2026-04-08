import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth-helper";

/**
 * GET /api/groups/[id]/export
 * Export group conversation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 1. Check membership
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        memberType: "user",
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "No eres miembro de este grupo" },
        { status: 403 }
      );
    }

    // 2. Get export format
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json"; // json, txt, md

    // 3. Load group data
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        GroupMember: {
          where: { isActive: true },
          include: {
            User: {
              select: {
                id: true,
                name: true,
              },
            },
            Agent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    // 4. Load all messages
    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: "asc" },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        Agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 5. Generate export based on format
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case "json":
        content = JSON.stringify(
          {
            group: {
              id: group.id,
              name: group.name,
              description: group.description,
              createdAt: group.createdAt,
              totalMessages: messages.length,
            },
            members: group.GroupMember.map((m: any) => ({
              type: m.memberType,
              name: m.memberType === "user" ? m.User?.name : m.Agent?.name,
              role: m.role,
              totalMessages: m.totalMessages,
            })),
            messages: messages.map((m) => ({
              id: m.id,
              author:
                m.authorType === "user" ? m.User?.name : m.Agent?.name,
              authorType: m.authorType,
              content: m.content,
              timestamp: m.createdAt,
              isSystemMessage: m.isSystemMessage,
            })),
            exportedAt: new Date().toISOString(),
            exportedBy: user.name,
          },
          null,
          2
        );
        contentType = "application/json";
        filename = `${group.name.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.json`;
        break;

      case "txt":
        content = generateTextExport(group, messages);
        contentType = "text/plain";
        filename = `${group.name.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.txt`;
        break;

      case "md":
        content = generateMarkdownExport(group, messages);
        contentType = "text/markdown";
        filename = `${group.name.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.md`;
        break;

      default:
        return NextResponse.json(
          { error: "Formato no soportado" },
          { status: 400 }
        );
    }

    // 6. Return file
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting group:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

function generateTextExport(group: any, messages: any[]): string {
  let text = "";
  text += `EXPORTACIÓN DE GRUPO: ${group.name}\n`;
  text += `=`.repeat(50) + "\n\n";

  if (group.description) {
    text += `Descripción: ${group.description}\n\n`;
  }

  text += `Total de mensajes: ${messages.length}\n`;
  text += `Fecha de exportación: ${new Date().toLocaleString()}\n`;
  text += `\n` + `=`.repeat(50) + "\n\n";

  text += `CONVERSACIÓN\n`;
  text += `-`.repeat(50) + "\n\n";

  for (const message of messages) {
    if (message.isSystemMessage) {
      text += `[SISTEMA] ${message.content}\n\n`;
    } else {
      const author =
        message.authorType === "user"
          ? message.User?.name || "Usuario"
          : message.Agent?.name || "IA";
      const timestamp = new Date(message.createdAt).toLocaleString();

      text += `[${timestamp}] ${author}:\n`;
      text += `${message.content}\n\n`;
    }
  }

  return text;
}

function generateMarkdownExport(group: any, messages: any[]): string {
  let md = "";
  md += `# ${group.name}\n\n`;

  if (group.description) {
    md += `> ${group.description}\n\n`;
  }

  md += `---\n\n`;
  md += `**Total de mensajes:** ${messages.length}\n\n`;
  md += `**Fecha de exportación:** ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;
  md += `## Conversación\n\n`;

  for (const message of messages) {
    if (message.isSystemMessage) {
      md += `*${message.content}*\n\n`;
    } else {
      const author =
        message.authorType === "user"
          ? message.User?.name || "Usuario"
          : `**${message.Agent?.name || "IA"}**`;
      const timestamp = new Date(message.createdAt).toLocaleString();

      md += `### ${author}\n`;
      md += `<sub>${timestamp}</sub>\n\n`;
      md += `${message.content}\n\n`;
      md += `---\n\n`;
    }
  }

  return md;
}
