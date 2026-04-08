import { NextResponse } from "next/server";
import swaggerJsdoc from "swagger-jsdoc";
import { swaggerOptions } from "@/lib/swagger/config";

export async function GET() {
  const spec = swaggerJsdoc(swaggerOptions);
  return NextResponse.json(spec);
}
