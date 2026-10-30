import "server-only";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function appUrl() {
  // URL is set by Netlify; APP_URL overrides it (e.g. a custom domain).
  return (process.env.APP_URL || process.env.URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Sends one email through Resend's HTTP API. */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...msg }),
  });
  if (res.ok) return { ok: true as const };
  const body = await res.text().catch(() => "");
  return { ok: false as const, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain, branded email body. `paragraphs` are text; the button links to `cta.href`. */
export function layout(opts: { heading: string; paragraphs: string[]; cta: { label: string; href: string } }) {
  const html = `<!doctype html><html><body style="margin:0;background:#F5F6F4;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A201D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E6E2;border-radius:10px">
<tr><td style="padding:28px 28px 8px"><div style="font-weight:700;font-size:15px;color:#2F5D50">Steady</div>
<h1 style="font-size:22px;line-height:1.3;margin:14px 0 6px">${escape(opts.heading)}</h1></td></tr>
${opts.paragraphs.map((p) => `<tr><td style="padding:4px 28px;font-size:15px;line-height:1.55;color:#3a423e">${escape(p)}</td></tr>`).join("")}
<tr><td style="padding:20px 28px 28px"><a href="${escape(opts.cta.href)}" style="display:inline-block;background:#2F5D50;color:#FFFFFF;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:8px">${escape(opts.cta.label)}</a></td></tr>
</table>
<p style="font-size:12px;color:#69736E;margin:16px 0 0">You’re getting this because you’re on your organization’s Steady roster.</p>
</td></tr></table></body></html>`;
  const text = [opts.heading, "", ...opts.paragraphs, "", `${opts.cta.label}: ${opts.cta.href}`].join("\n");
  return { html, text };
}
