import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/messages/delete-all - Delete all user messages
export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all messages from the user
    const result = await prisma.message.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `${result.count} mensajes eliminados exitosamente`,
    });
  } catch (error) {
    console.error("Error deleting messages:", error);
    return NextResponse.json(
      { error: "Error al eliminar los mensajes" },
      { status: 500 }
    );
  }
}
