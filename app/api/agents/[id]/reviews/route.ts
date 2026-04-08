import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// GET /api/agents/[id]/reviews - Obtener reviews de un agente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Get reviews with user information
    const reviews = await prisma.review.findMany({
      where: { agentId },
      include: {
        Agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Hide sensitive user information (only show initials)
    const sanitizedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      // We don't include userId for privacy, or we replace it with initials
      userInitials: review.userId.substring(0, 2).toUpperCase(),
    }));

    // Calculate statistics
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    return NextResponse.json({
      reviews: sanitizedReviews,
      stats: {
        totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        ratingDistribution,
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Error al obtener reviews" },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/reviews - Crear o actualizar review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: agentId } = await params;
    const body = await request.json();
    const { rating, comment } = body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "El rating debe estar entre 1 y 5" },
        { status: 400 }
      );
    }

    // Get user
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Check que el agente existe
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agente no encontrado" },
        { status: 404 }
      );
    }

    // Verify that the user is not rating their own agent
    if (agent.userId === dbUser.id) {
      return NextResponse.json(
        { error: "No puedes calificar tu propio compañero" },
        { status: 403 }
      );
    }

    // Create o actualizar review (upsert)
    const review = await prisma.review.upsert({
      where: {
        agentId_userId: {
          agentId,
          userId: dbUser.id,
        },
      },
      update: {
        rating,
        comment: comment || null,
      },
      create: {
        id: nanoid(),
        agentId,
        userId: dbUser.id,
        rating,
        comment: comment || null,
        updatedAt: new Date(),
      },
    });

    // Recalcular rating promedio del agente
    const allReviews = await prisma.review.findMany({
      where: { agentId },
    });

    const averageRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    // Update rating del agente
    await prisma.agent.update({
      where: { id: agentId },
      data: { rating: averageRating },
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
      newAverageRating: Number(averageRating.toFixed(2)),
    });
  } catch (error) {
    console.error("Error creating/updating review:", error);
    return NextResponse.json(
      { error: "Error al crear/actualizar review" },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/reviews - Delete current user's review
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: agentId } = await params;

    // Get user
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Delete review
    const deleted = await prisma.review.deleteMany({
      where: {
        agentId,
        userId: dbUser.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Review no encontrada" },
        { status: 404 }
      );
    }

    // Recalcular rating promedio del agente
    const allReviews = await prisma.review.findMany({
      where: { agentId },
    });

    const averageRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : null;

    // Update rating del agente
    await prisma.agent.update({
      where: { id: agentId },
      data: { rating: averageRating },
    });

    return NextResponse.json({
      success: true,
      message: "Review eliminada",
      newAverageRating: averageRating ? Number(averageRating.toFixed(2)) : null,
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return NextResponse.json(
      { error: "Error al eliminar review" },
      { status: 500 }
    );
  }
}
