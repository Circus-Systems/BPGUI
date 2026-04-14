import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

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

  return supabaseResponse;
}
