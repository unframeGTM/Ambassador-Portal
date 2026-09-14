// Portal admins: when one of these people logs in, the dashboard shows the
// admin view (all registrations, grouped by ambassador) instead of their own.
// Gating is enforced server-side against the OTP-verified session email.
const ADMIN_EMAILS = new Set([
  'lex.levitte@unframe.ai',
  'shea.gegan@unframe.ai',
  'sebastien.adjiman@unframe.ai',
  'ryan.roberts@unframe.ai',
]);

export function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}
