export async function sendNotifyEmail(
  subject: string,
  html: string,
  text: string,
  toAddress?: string,
): Promise<void> {
  const to = (toAddress || process.env.NOTIFY_EMAIL)?.trim();
  if (!to) {
    throw new Error("NOTIFY_EMAIL não está definido no .env.local");
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "");

  if (host && user && pass) {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || `Bolas Helper <${user}>`,
      to,
      subject,
      html,
      text,
    });
    return;
  }

  throw new Error("SMTP incompleto: preenche SMTP_HOST, SMTP_USER e SMTP_PASS no .env.local");
}
