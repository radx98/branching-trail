import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type SupabaseUser = Pick<
  User,
  "id" | "email" | "aud" | "role" | "app_metadata" | "user_metadata"
>;

function buildDevUser(): SupabaseUser | null {
  const devUserId = process.env.DEV_SUPABASE_USER_ID;
  if (!devUserId || process.env.NODE_ENV === "production") {
    return null;
  }

  return {
    id: devUserId,
    email: process.env.DEV_SUPABASE_USER_EMAIL ?? "dev@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {
      provider: "dev-bypass",
    },
    user_metadata: {},
  };
}

export async function requireAuthenticatedClient(): Promise<{
  supabase: SupabaseClient | null;
  user: SupabaseUser;
}> {
  const supabase = createSupabaseServerClient();
  const devUser = buildDevUser();

  if (!supabase) {
    if (devUser) {
      return { supabase: null, user: devUser };
    }

    throw new ApiError(
      401,
      "Authentication required. Configure Supabase credentials or set DEV_SUPABASE_USER_ID.",
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) {
      throw new ApiError(401, "Invalid or expired session.");
    }

    if (!data.user) {
      throw new ApiError(401, "Authentication required.");
    }

    return { supabase, user: data.user };
  }

  if (devUser) {
    return { supabase, user: devUser };
  }

  throw new ApiError(401, "Authentication required.");
}
