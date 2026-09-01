import { env } from "../config/env";

// Outbound e-mail.
//
// Password reset is the only thing that sends mail today, and it is the one
// feature that genuinely cannot work without a third-party service: a reset link
// that never reaches an inbox is not a reset. So the provider is pluggable and
// the failure mode is explicit — `send` reports whether it actually delivered,
// and the caller decides what to tell the user.
//
// - "console": writes the message to the log. Fine for development, useless in
//   production, and it says so.
// - "resend": real delivery via https://resend.com. Set RESEND_API_KEY.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendResult {
  delivered: boolean;
  provider: string;
  error?: string;
}

async function sendViaResend(message: EmailMessage): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { delivered: false, provider: "resend", error: `HTTP ${res.status} ${detail.slice(0, 200)}` };
    }
    return { delivered: true, provider: "resend" };
  } catch (err) {
    return { delivered: false, provider: "resend", error: err instanceof Error ? err.message : String(err) };
  }
}

function sendViaConsole(message: EmailMessage): SendResult {
  console.log("\n--- E-MAIL (provider: console — nada foi enviado de verdade) ---");
  console.log(`para   : ${message.to}`);
  console.log(`assunto: ${message.subject}`);
  console.log(message.text);
  console.log("--- fim ---\n");
  return { delivered: false, provider: "console" };
}

/** Whether a real delivery provider is configured. */
export function emailIsConfigured(): boolean {
  return Boolean(env.resendApiKey);
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!emailIsConfigured()) {
    return sendViaConsole(message);
  }
  return sendViaResend(message);
}

/**
 * The password reset message.
 *
 * Deliberately plain: no images, no tracking, and the raw URL is visible in the
 * text so someone who distrusts the button can read where it goes. It also
 * states the expiry, because a link that silently stopped working is the most
 * common reason people give up on a reset.
 */
export function passwordResetEmail(name: string, link: string, minutes: number): EmailMessage {
  const text = [
    `Olá, ${name}.`,
    "",
    "Recebemos um pedido para redefinir a sua senha no Insights CRM.",
    "Abra o link abaixo para escolher uma nova senha:",
    "",
    link,
    "",
    `O link vale por ${minutes} minutos e só pode ser usado uma vez.`,
    "Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#0b0b0b;max-width:520px">
      <p>Olá, ${escapeHtml(name)}.</p>
      <p>Recebemos um pedido para redefinir a sua senha no <strong>Insights CRM</strong>.</p>
      <p>
        <a href="${escapeHtml(link)}"
           style="display:inline-block;background:#2a78d6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          Escolher uma nova senha
        </a>
      </p>
      <p style="font-size:13px;color:#52514e">
        Ou copie este endereço:<br />
        <span style="word-break:break-all">${escapeHtml(link)}</span>
      </p>
      <p style="font-size:13px;color:#52514e">
        O link vale por ${minutes} minutos e só pode ser usado uma vez.<br />
        Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.
      </p>
    </div>
  `.trim();

  return { to: "", subject: "Redefinir sua senha — Insights CRM", text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
