/**
 * PDF Export Utility
 *
 * Exporta conversaciones de chat a PDF con formato profesional
 */

import type { Message } from "@/components/chat/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface PDFExportOptions {
  agentName: string;
  userName?: string;
  includeImages?: boolean;
  includeTimestamps?: boolean;
}

/**
 * Exporta una conversación a PDF
 * Usa jsPDF para generar el documento
 */
export async function exportConversationToPDF(
  messages: Message[],
  options: PDFExportOptions
): Promise<void> {
  // Import jsPDF dynamically (client-only)
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let yPosition = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`Conversación con ${options.agentName}`, margin, yPosition);
  yPosition += 10;

  // Export date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Exportado el ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
    margin,
    yPosition
  );
  yPosition += 10;

  // Línea separadora
  doc.setDrawColor(200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Mensajes
  doc.setFontSize(11);
  doc.setTextColor(0);

  for (const message of messages) {
    // Verificar si necesitamos nueva página
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = margin;
    }

    // Emisor
    doc.setFont("helvetica", "bold");
    const sender = message.type === "user"
      ? (options.userName || "Tú")
      : options.agentName;

    doc.text(sender, margin, yPosition);

    // Timestamp (si está habilitado)
    if (options.includeTimestamps) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150);
      const timestamp = format(message.timestamp, "HH:mm", { locale: es });
      const timestampWidth = doc.getTextWidth(timestamp);
      doc.text(timestamp, pageWidth - margin - timestampWidth, yPosition);
    }

    yPosition += 5;

    // Contenido del mensaje
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);

    if (message.content.text) {
      const lines = doc.splitTextToSize(message.content.text, contentWidth);

      for (const line of lines) {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin + 2, yPosition);
        yPosition += 5;
      }
    }

    // Indicador de imagen (si existe)
    if (message.content.image) {
      doc.setTextColor(100);
      doc.setFont("helvetica", "italic");
      doc.text("[Imagen adjunta]", margin + 2, yPosition);
      yPosition += 5;
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
    }

    // Indicador de audio (si existe)
    if (message.content.audio) {
      doc.setTextColor(100);
      doc.setFont("helvetica", "italic");
      doc.text("[Mensaje de voz]", margin + 2, yPosition);
      yPosition += 5;
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
    }

    yPosition += 3;

    // Línea separadora entre mensajes
    doc.setDrawColor(230);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;
  }

  // Pie de página en todas las páginas
  const totalPages = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150);

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Descargar el PDF
  const fileName = `conversacion_${options.agentName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;
  doc.save(fileName);
}

/**
 * Exporta una conversación a texto plano
 * Alternativa más simple si jsPDF no está disponible
 */
export function exportConversationToText(
  messages: Message[],
  options: PDFExportOptions
): void {
  let content = `Conversación con ${options.agentName}\n`;
  content += `Exportado el ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}\n`;
  content += `${"=".repeat(50)}\n\n`;

  for (const message of messages) {
    const sender = message.type === "user"
      ? (options.userName || "Tú")
      : options.agentName;

    const timestamp = options.includeTimestamps
      ? ` [${format(message.timestamp, "HH:mm", { locale: es })}]`
      : "";

    content += `${sender}${timestamp}:\n`;

    if (message.content.text) {
      content += `${message.content.text}\n`;
    }

    if (message.content.image) {
      content += `[Imagen adjunta]\n`;
    }

    if (message.content.audio) {
      content += `[Mensaje de voz]\n`;
    }

    content += "\n";
  }

  // Descargar como archivo de texto
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `conversacion_${options.agentName.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmmss")}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
