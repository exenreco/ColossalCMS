import { smtpMailer } from "./smtp-mailer.mjs";
export function siteMailer(db, manager) {
  return smtpMailer({
    db,
    credentials: () => manager.mailCredentials(),
    async credentialStatus() {
      const { fields } = await manager.describe();
      const username = fields.find((field) => field.key === "SMTP_USERNAME");
      const password = fields.find((field) => field.key === "SMTP_PASSWORD");
      return {
        available: true,
        username: username.value,
        usernameManaged: username.managed,
        passwordConfigured: password.configured,
        passwordManaged: password.managed,
      };
    },
    async saveCredentials({ username, password }, serverless) {
      if (serverless)
        throw Object.assign(
          new Error(
            "Set SMTP_USERNAME and SMTP_PASSWORD in your hosting environment and redeploy.",
          ),
          { status: 409 },
        );
      const input = {};
      if (username !== undefined) input.SMTP_USERNAME = username;
      if (password) input.SMTP_PASSWORD = password;
      if (Object.keys(input).length) await manager.save(input);
    },
  });
}
