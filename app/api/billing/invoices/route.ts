import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get facturas del usuario (últimas 50)
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // También obtener pagos (para compatibilidad)
    const payments = await prisma.payment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // Combinar y formatear
    const allInvoices = [
      ...invoices.map((inv) => ({
        id: inv.id,
        date: inv.createdAt.toISOString(),
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status === "approved" || inv.status === "paid" ? "paid" as const :
                inv.status === "pending" ? "pending" as const : "failed" as const,
        description: (inv.metadata as any)?.description || "Subscription payment",
        invoiceUrl: (inv.metadata as any)?.invoiceUrl || undefined,
        mercadopagoPaymentId: inv.mercadopagoPaymentId,
      })),
      ...payments.map((pay) => ({
        id: pay.id,
        date: pay.createdAt.toISOString(),
        amount: pay.amount,
        currency: pay.currency,
        status: pay.status === "approved" ? "paid" as const :
                pay.status === "pending" ? "pending" as const : "failed" as const,
        description: (pay.metadata as any)?.description || "Payment",
        invoiceUrl: (pay.metadata as any)?.receiptUrl || undefined,
        mercadopagoPaymentId: pay.mercadopagoPaymentId,
      })),
    ];

    // Sort por fecha descendente
    allInvoices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({
      invoices: allInvoices.slice(0, 50),
      total: allInvoices.length,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
