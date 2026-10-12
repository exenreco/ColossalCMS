import nodemailer from "nodemailer";
import { readMailSettings, mailAddress } from "../server/mail.mjs";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export function smtpMailer({
  db,
  credentials,
  credentialStatus,
  saveCredentials,
  transportFactory = nodemailer.createTransport,
}) {
  async function transport() {
    const settings = await readMailSettings(db);
    if (!settings.enabled)
      fail("Enable SMTP in Settings before sending mail.", 409);
    const auth = await credentials();
    if (!auth.user || !auth.pass)
      fail(
        "Configure SMTP_USERNAME and SMTP_PASSWORD before sending mail.",
        409,
      );
    return {
      settings,
      client: transportFactory({
        host: settings.host,
        port: settings.port,
        secure: settings.encryption === "tls",
        requireTLS: settings.encryption === "starttls",
        tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        auth,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    };
  }
  async function run(fn) {
    const { settings, client } = await transport();
    try {
      return await fn(client, settings);
    } catch {
      fail(
        "SMTP operation failed. Check the account credentials, host, encryption, sender permissions, and hosting network access.",
        502,
      );
    } finally {
      client.close?.();
    }
  }
  return {
    describe: credentialStatus,
    saveCredentials,
    verify: () =>
      run(async (client) => {
        await client.verify();
        return { ok: true };
      }),
    async send(message) {
      if (!message || typeof message !== "object")
        fail("A mail message is required.");
      const to = (Array.isArray(message.to) ? message.to : [message.to]).map(
        mailAddress,
      );
      if (!to.length || to.length > 50)
        fail("Use 1–50 recipients per message.");
      if (
        typeof message.subject !== "string" ||
        !message.subject ||
        message.subject.length > 500 ||
        /[\r\n\0]/.test(message.subject)
      )
        fail("Enter a valid mail subject.");
      if (!message.text && !message.html) fail("Add a mail message body.");
      for (const key of ["text", "html"])
        if (
          message[key] !== undefined &&
          (typeof message[key] !== "string" || message[key].length > 200000)
        )
          fail("Mail content is too large.");
      return run(async (client, settings) => {
        const result = await client.sendMail({
          to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          from: { name: settings.fromName, address: settings.fromEmail },
          replyTo: settings.replyTo || undefined,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (!result.accepted?.length) fail("No recipients accepted.");
        return {
          ok: true,
          messageId: result.messageId,
          accepted: result.accepted.length,
          rejected: result.rejected?.length || 0,
        };
      });
    },
  };
}
