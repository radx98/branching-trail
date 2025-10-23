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

export async function requireAuthenticatedClient(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) {
    throw new ApiError(401, "Authentication required.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new ApiError(401, "Invalid or expired session.");
  }

  return { supabase, user: data.user };
}
