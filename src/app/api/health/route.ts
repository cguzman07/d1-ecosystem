import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";

/** Health / session probe for local verification */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    ok: true,
    authenticated: !!session,
    user: session
      ? {
          email: session.user.email,
          role: session.user.role,
          roleLabel: ROLE_LABELS[session.user.role],
        }
      : null,
  });
}
