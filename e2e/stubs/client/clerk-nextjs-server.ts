// Test-only stand-in for @clerk/nextjs/server.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function auth() {
  const name = (await cookies()).get("cs-test-user")?.value;
  return { userId: name ? `user_${name}` : null, redirectToSignIn: () => null };
}
export function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((p) => new RegExp(`^${p}$`));
  return (req: NextRequest) => regexes.some((r) => r.test(req.nextUrl.pathname));
}
type Handler = (auth: (() => Promise<{ userId: string | null }>) & { protect: () => Promise<void> }, req: NextRequest) => Promise<unknown>;
export function clerkMiddleware(handler: Handler) {
  return async (req: NextRequest) => {
    const name = req.cookies.get("cs-test-user")?.value;
    let redirect = false;
    const authFn = Object.assign(async () => ({ userId: name ? `user_${name}` : null }), {
      protect: async () => {
        if (!name) redirect = true;
      },
    });
    await handler(authFn, req);
    if (redirect) return NextResponse.redirect(new URL(`/sign-in?redirect_url=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
    return NextResponse.next();
  };
}
