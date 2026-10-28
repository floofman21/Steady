/** Empty or unset ALLOWED_EMAIL_DOMAINS means any domain (the roster still gates sign-in). */
export function emailDomainAllowed(email: string, allowedList = process.env.ALLOWED_EMAIL_DOMAINS ?? "") {
  const allowed = allowedList
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  if (!allowed.length) return true;
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  return allowed.includes(domain);
}
