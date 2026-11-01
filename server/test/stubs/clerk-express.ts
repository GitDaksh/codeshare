// Test-only stand-in for @clerk/express (vitest.config.mts swaps it in).
// "Authorization: Bearer test:<name>" signs you in as user_<name>.
import type { Request, Response, NextFunction } from "express";

type TestRequest = Request & { __testUserId?: string | null };

function userFrom(req: Request): string | null {
  const header = req.headers.authorization || "";
  const match = /^Bearer test:([A-Za-z0-9_-]{1,40})$/.exec(header);
  return match ? `user_${match[1]}` : null;
}

export function clerkMiddleware() {
  return (req: TestRequest, _res: Response, next: NextFunction) => {
    req.__testUserId = userFrom(req);
    next();
  };
}

export function getAuth(req: TestRequest) {
  return { userId: req.__testUserId ?? null };
}
