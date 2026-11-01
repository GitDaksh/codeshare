// Test-only stand-in for @clerk/express: "Authorization: Bearer test:<name>"
// signs you in as user_<name>. Never part of the app.
function userFrom(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer test:([A-Za-z0-9_-]{1,40})$/.exec(header);
  return match ? `user_${match[1]}` : null;
}
export function clerkMiddleware() {
  return (req, _res, next) => {
    req.__testUserId = userFrom(req);
    next();
  };
}
export function getAuth(req) {
  return { userId: req.__testUserId ?? null };
}
