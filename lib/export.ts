interface Message {
  id: string;
  role: string;
  content: string;
  metadata?: {
    emotions?: string[];
    agentName?: string;
    relationLevel?: string;
  };
  createdAt?: Date | string;
}

export class ConversationExporter {
  /** Export conversation to JSON format */
  static exportToJSON(messages: Message[], agentName?: string, worldName?: string) {
    const data = {
      exportedAt: new Date().toISOString(),
      type: worldName ? "world" : "agent",
      name: worldName || agentName || "Conversación",
      messageCount: messages.length,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        agentName: msg.metadata?.agentName,
        emotions: msg.metadata?.emotions,
        relationLevel: msg.metadata?.relationLevel,
        timestamp: msg.createdAt,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversacion_${worldName || agentName || "export"}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Export conversation to TXT format */
  static exportToTXT(messages: Message[], agentName?: string, worldName?: string) {
    const header = `=== CONVERSACIÓN ${worldName ? "MUNDO" : "AGENTE"}: ${worldName || agentName || "Sin nombre"} ===\n`;
    const timestamp = `Exportado: ${new Date().toLocaleString("es-ES")}\n`;
    const separator = "=".repeat(60) + "\n\n";

    let content = header + timestamp + separator;

    messages.forEach((msg, idx) => {
      const speaker = msg.role === "user"
        ? "USUARIO"
        : msg.metadata?.agentName || agentName || "AGENTE";

      content += `[${idx + 1}] ${speaker}:\n`;
      content += `${msg.content}\n`;

      if (msg.metadata?.emotions && msg.metadata.emotions.length > 0) {
        content += `Emociones: ${msg.metadata.emotions.join(", ")}\n`;
      }

      if (msg.metadata?.relationLevel) {
        content += `Relación: ${msg.metadata.relationLevel}\n`;
      }

      content += "\n" + "-".repeat(60) + "\n\n";
    });

    content += `\nTotal de mensajes: ${messages.length}\n`;
    content += `Fin de la conversación\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversacion_${worldName || agentName || "export"}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Export conversation to Markdown format */
  static exportToMarkdown(messages: Message[], agentName?: string, worldName?: string) {
    const title = `# Conversación: ${worldName || agentName || "Sin nombre"}\n\n`;
    const info = `**Exportado:** ${new Date().toLocaleString("es-ES")}  \n`;
    const type = `**Tipo:** ${worldName ? "Mundo Virtual" : "Chat Individual"}  \n`;
    const count = `**Mensajes:** ${messages.length}\n\n---\n\n`;

    let content = title + info + type + count;

    messages.forEach((msg, _idx) => {
      const speaker = msg.role === "user"
        ? "👤 **Usuario**"
        : `🤖 **${msg.metadata?.agentName || agentName || "Agente"}**`;

      content += `### ${speaker}\n\n`;
      content += `${msg.content}\n\n`;

      if (msg.metadata?.emotions && msg.metadata.emotions.length > 0) {
        content += `*Emociones:* ${msg.metadata.emotions.map(e => `\`${e}\``).join(", ")}\n\n`;
      }

      if (msg.metadata?.relationLevel) {
        content += `*Nivel de relación:* ${msg.metadata.relationLevel}\n\n`;
      }

      content += "---\n\n";
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversacion_${worldName || agentName || "export"}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Copy conversation to clipboard */
  static async copyToClipboard(messages: Message[], agentName?: string, worldName?: string) {
    let content = `=== ${worldName || agentName || "Conversación"} ===\n\n`;

    messages.forEach((msg) => {
      const speaker = msg.role === "user"
        ? "Usuario"
        : msg.metadata?.agentName || agentName || "Agente";

      content += `${speaker}: ${msg.content}\n\n`;
    });

    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (error) {
      console.error("Error al copiar al portapapeles:", error);
      return false;
    }
  }
}
