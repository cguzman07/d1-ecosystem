import { Resend } from "resend";

/**
 * Provider-agnostic email service (Resend).
 * Set RESEND_API_KEY and EMAIL_FROM in the environment.
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  const from = process.env.EMAIL_FROM ?? "D1 Ecosystem <onboarding@resend.dev>";
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const html = input.html ?? `<p>${input.text}</p>`;

  const { data, error } = await getResend().emails.send({
    from,
    to,
    subject: input.subject,
    html,
    text: input.text,
  });

  if (error) {
    throw new Error(`RESEND_SEND_FAILED: ${error.message}`);
  }

  const messageId = data?.id ?? "unknown";

  console.info(
    JSON.stringify({
      level: "info",
      event: "email_sent",
      messageId,
      to: input.to,
      subject: input.subject,
      at: new Date().toISOString(),
    }),
  );

  return { messageId };
}
