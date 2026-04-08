import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/user/update-profile - Update user profile after registration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, birthDate } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    // Update user with additional profile data
    const updateData: any = {};

    if (birthDate) {
      updateData.birthDate = new Date(birthDate);
    }

    if (Object.keys(updateData).length === 0) {
      // Nothing to update, return success
      return NextResponse.json({ success: true });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        plan: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
