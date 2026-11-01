// Test-only stand-in for @clerk/backend: socket tokens "test:<name>" belong
// to user_<name>; anything else is rejected, like an invalid Clerk token.
export async function verifyToken(token: unknown) {
  const match = /^test:([A-Za-z0-9_-]{1,40})$/.exec(String(token));
  if (!match) throw new Error("bad test token");
  return { sub: `user_${match[1]}` };
}
