import bcrypt from "bcryptjs";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  )
    fail(
      "Use a password of at least 12 characters and at most 72 UTF-8 bytes.",
    );
  return bcrypt.hash(password, 12);
}
export function passwordAuth(
  db,
  { secure = true, clock = () => Date.now(), setupToken = "" } = {},
) {
  const attempts = new Map();
  const setupAttempts = new Map();
  const setupNeeded = async () =>
    !(await db
      .prepare("SELECT id FROM auth_credentials WHERE id='owner'")
      .first());
  const cookie = (token, age) =>
    `cms_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const token = (request) => {
    const match = (request.headers.get("cookie") || "").match(
      /(?:^|;\s*)cms_session=([a-f0-9]{64})(?:;|$)/,
    );
    return match?.[1];
  };
  return {
    setupNeeded,
    async setup(email, password, token, client = "unknown") {
      if (!(await setupNeeded()))
        fail("Administrator setup is already complete.", 409);
      for (const [key, attempt] of setupAttempts)
        if (clock() - attempt.start > 15 * 60 * 1000) setupAttempts.delete(key);
      if (setupAttempts.size > 10000) fail("Please try again later.", 429);
      const attempt = setupAttempts.get(client) || { start: clock(), count: 0 };
      if (attempt.count >= 10)
        fail("Too many setup attempts. Try again in 15 minutes.", 429);
      attempt.count++;
      setupAttempts.set(client, attempt);
      if (
        typeof setupToken !== "string" ||
        setupToken.length < 32 ||
        typeof token !== "string" ||
        token.length > 4096 ||
        !timingSafeEqual(
          Buffer.from(digest(token), "hex"),
          Buffer.from(digest(setupToken), "hex"),
        )
      )
        fail("Invalid setup token.", 403);
      email = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid administrator email.");
      const hash = await hashPassword(password);
      if (!(await setupNeeded()))
        fail("Administrator setup is already complete.", 409);
      const owner = await db
        .prepare("SELECT id FROM members WHERE id='owner'")
        .first();
      const existing = await db
        .prepare("SELECT id FROM members WHERE email=?")
        .bind(email)
        .first();
      if (existing && existing.id !== "owner")
        fail("This email already belongs to another member.", 409);
      try {
        await db.batch([
          owner
            ? db
                .prepare(
                  "UPDATE members SET email=?,role='admin' WHERE id='owner'",
                )
                .bind(email)
            : db
                .prepare(
                  "INSERT INTO members (id,email,role) VALUES ('owner',?,'admin')",
                )
                .bind(email),
          db
            .prepare(
              "INSERT INTO auth_credentials (id,password_hash,updated_at) VALUES ('owner',?,?)",
            )
            .bind(hash, new Date(clock()).toISOString()),
          db.prepare("DELETE FROM auth_sessions WHERE member_id='owner'"),
        ]);
      } catch (error) {
        if (!(await setupNeeded()))
          fail("Administrator setup is already complete.", 409);
        throw error;
      }
    },
    async bootstrap(email, passwordHash) {
      const owner = await db
        .prepare("SELECT id,email FROM members WHERE id='owner'")
        .first();
      if (
        owner &&
        (await db
          .prepare("SELECT id FROM auth_credentials WHERE id='owner'")
          .first())
      )
        return;
      if (
        typeof email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(passwordHash || "")
      )
        fail(
          "Set CMS_ADMIN_EMAIL and a bcrypt cost-12 CMS_ADMIN_PASSWORD_HASH to initialize the production owner.",
        );
      if (owner && owner.email !== email.toLowerCase())
        fail(
          "CMS_ADMIN_EMAIL must match the existing owner's email before adding password sign-in.",
        );
      await db.batch([
        ...(!owner
          ? [
              db
                .prepare(
                  "INSERT INTO members (id,email,role) VALUES ('owner',?,'admin')",
                )
                .bind(email.toLowerCase()),
            ]
          : []),
        db
          .prepare(
            "INSERT INTO auth_credentials (id,password_hash,updated_at) VALUES ('owner',?,?)",
          )
          .bind(passwordHash, new Date(clock()).toISOString()),
      ]);
    },
    async setPassword(email, password) {
      email = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid member email.");
      const hash = await hashPassword(password);
      const member = await db
        .prepare("SELECT * FROM members WHERE email=?")
        .bind(email)
        .first();
      const memberId = member?.id ?? randomUUID();
      await db.batch([
        ...(!member
          ? [
              db
                .prepare(
                  "INSERT INTO members (id,email,role) VALUES (?,?,'editor')",
                )
                .bind(memberId, email),
            ]
          : []),
        db
          .prepare(
            "INSERT INTO auth_credentials (id,password_hash,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at",
          )
          .bind(memberId, hash, new Date(clock()).toISOString()),
        db
          .prepare("DELETE FROM auth_sessions WHERE member_id=?")
          .bind(memberId),
      ]);
    },
    async identify(request) {
      const raw = token(request);
      if (!raw) return null;
      const session = await db
        .prepare("SELECT * FROM auth_sessions WHERE id=? AND expires_at>?")
        .bind(digest(raw), new Date(clock()).toISOString())
        .first();
      if (!session) return null;
      return db
        .prepare("SELECT * FROM members WHERE id=?")
        .bind(session.member_id)
        .first();
    },
    async login(email, password, client = "unknown") {
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        email.length > 254 ||
        Buffer.byteLength(password, "utf8") > 72
      )
        fail("Invalid email or password.", 401);
      // Bound memory and rate-limit both account and connection source, including nonexistent users.
      const keys = ["email:" + email.toLowerCase(), "client:" + client];
      for (const [k, v] of attempts)
        if (clock() - v.start > 15 * 60 * 1000) attempts.delete(k);
      if (attempts.size > 10000) fail("Please try again later.", 429);
      for (const key of keys) {
        const entry = attempts.get(key) || { start: clock(), count: 0 };
        if (entry.count >= 10)
          fail("Too many sign-in attempts. Try again in 15 minutes.", 429);
        entry.count++;
        attempts.set(key, entry);
      }
      const member = await db
        .prepare("SELECT * FROM members WHERE email=?")
        .bind(email.toLowerCase())
        .first();
      const credentials = member
        ? await db
            .prepare("SELECT password_hash FROM auth_credentials WHERE id=?")
            .bind(member.id)
            .first()
        : null;
      const valid = await bcrypt.compare(
        password,
        credentials?.password_hash ||
          "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
      );
      if (!member || !credentials || !valid)
        fail("Invalid email or password.", 401);
      for (const key of keys) attempts.delete(key);
      const raw = randomBytes(32).toString("hex"),
        expires = new Date(clock() + 8 * 60 * 60 * 1000).toISOString();
      await db.batch([
        db
          .prepare("DELETE FROM auth_sessions WHERE expires_at<=?")
          .bind(new Date(clock()).toISOString()),
        db
          .prepare(
            "INSERT INTO auth_sessions (id,member_id,expires_at) VALUES (?,?,?)",
          )
          .bind(digest(raw), member.id, expires),
      ]);
      return { cookie: cookie(raw, 28800) };
    },
    async logout(request) {
      const raw = token(request);
      if (raw)
        await db
          .prepare("DELETE FROM auth_sessions WHERE id=?")
          .bind(digest(raw))
          .run();
      return { cookie: cookie("", 0) };
    },
  };
}
