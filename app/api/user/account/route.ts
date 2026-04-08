import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/user/account - Delete user account permanently
export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the user account
    // This will cascade delete all related data (agents, messages, worlds, etc.)
    await prisma.user.delete({
      where: {
        id: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Cuenta eliminada exitosamente",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Error al eliminar la cuenta" },
      { status: 500 }
    );
  }
}
