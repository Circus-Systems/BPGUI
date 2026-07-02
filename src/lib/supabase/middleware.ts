import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];
const LOG_SKIP_PREFIXES = [
  "/_next",
  "/favicon",
  "/api/auth",
  "/login",
  "/auth/callback",
];

function shouldLogRequest(pathname: string): boolean {
  return !LOG_SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

async function logActivity(user: User, request: NextRequest) {
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  await db.from("user_activity").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    path: request.nextUrl.pathname,
    method: request.method,
    ip,
    user_agent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Not authenticated — redirect to login (unless already on a public path)
  if (!user) {
    if (isPublicPath) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated — check MFA status
  const SKIP_MFA = process.env.SKIP_MFA === "true";

  if (!SKIP_MFA) {
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData) {
      const { currentLevel, nextLevel } = aalData;

      if (currentLevel === "aal1" && nextLevel === "aal2") {
        if (pathname === "/login/mfa") return supabaseResponse;
        const url = request.nextUrl.clone();
        url.pathname = "/login/mfa";
        return NextResponse.redirect(url);
      }

      if (currentLevel === "aal1" && nextLevel === "aal1") {
        if (pathname === "/login/enroll-mfa") return supabaseResponse;
        const url = request.nextUrl.clone();
        url.pathname = "/login/enroll-mfa";
        return NextResponse.redirect(url);
      }
    }
  }

  // Fully authenticated — redirect away from login pages
  if (isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (shouldLogRequest(pathname)) {
    waitUntil(logActivity(user, request).catch(() => {}));
  }

  return supabaseResponse;
}
