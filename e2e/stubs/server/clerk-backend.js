// Test-only stand-in for @clerk/backend: socket tokens "test:<name>".
export async function verifyToken(token) {
  const match = /^test:([A-Za-z0-9_-]{1,40})$/.exec(String(token));
  if (!match) throw new Error("bad test token");
  return { sub: `user_${match[1]}` };
}
