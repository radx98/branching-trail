import { NextRequest, NextResponse } from "next/server";

import { ApiError, requireAuthenticatedClient } from "@/lib/server/auth";
import {
  deleteSession,
  getSessionRepositoryDiagnostics,
} from "@/lib/server/session-repository";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireAuthenticatedClient();

    await deleteSession(supabase, id, user.id);

    return NextResponse.json(
      { success: true, meta: getSessionRepositoryDiagnostics() },
      {
        status: 200,
        headers: {
          "x-session-storage": getSessionRepositoryDiagnostics().backend,
        },
      },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to delete session", error);
    return NextResponse.json(
      { error: "Failed to delete session." },
      { status: 500 },
    );
  }
}
