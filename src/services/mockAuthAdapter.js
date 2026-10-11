import { AuthError } from "./authError.js";

/**
 * ⚠️  DEVELOPMENT MOCK ADAPTER — NOT FOR PRODUCTION USE.  ⚠️
 *
 * Simulates the proposed REST contract locally while the real backend
 * (`VITE_AUTH_API_URL`) is not available. It is selected automatically ONLY
 * when no API URL is configured, and it is never mixed with production
 * authentication responses.
 *
 * Behaviour:
 *   • Data persists in localStorage under "railflow.mock.db" (per browser).
 *   • Passwords are NEVER stored in plain text — salted SHA-256 via Web Crypto.
 *   • No email is ever sent: verification/reset codes are returned in `dev`
 *     payloads, and the UI renders them inside a "development mock" notice.
 *   • Latency is simulated so loading/duplicate-submit guards are exercised.
 */

const DB_KEY = "railflow.mock.db";
const DEMO_USER = {
  name: "Night Controller",
  email: "controller@railflow.dev",
  password: "railflow123",
};
const CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function delay(ms) {
  const actual = globalThis.__RAILFLOW_MOCK_DELAY__ ?? ms;
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/* ------------------------------- storage ------------------------------- */

let memory = null;

function freshDb() {
  return {
    version: 1,
    seeded: false,
    users: [],
    sessions: {},
    verifications: {},
    resets: {},
    resendAt: {},
  };
}

function readDb() {
  // Prefer the persisted copy (single source of truth) and fall back to the
  // in-memory copy when localStorage is unavailable.
  try {
    const raw = globalThis.localStorage?.getItem(DB_KEY);
    if (raw) {
      memory = JSON.parse(raw);
      return memory;
    }
  } catch {
    /* fall through to memory */
  }
  if (memory) return memory;
  memory = freshDb();
  return memory;
}

function writeDb(db) {
  memory = db;
  try {
    globalThis.localStorage?.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable — in-memory copy still works for this page load */
  }
}

/* -------------------------------- crypto ------------------------------- */

function randomHex(bytes) {
  const buffer = new Uint8Array(bytes);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(buffer);
  } else {
    for (let i = 0; i < bytes; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode() {
  const buffer = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(buffer);
  const value = buffer[0] ?? Math.floor(Math.random() * 0xffffffff);
  return String(100000 + (value % 900000));
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

const hashPassword = (password, salt) => sha256Hex(`${salt}:${password}`);

/* ------------------------------ validation ----------------------------- */

function fail(
  message,
  { status = 400, code = "VALIDATION_ERROR", fields = null, retryAfter = null } = {},
) {
  throw new AuthError(message, {
    status,
    code,
    fieldErrors: fields,
    retryAfter,
  });
}

function validateCredentials(email, password) {
  const fields = {};
  const clean = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) fields.email = "Enter a valid email address.";
  if (!password) fields.password = "Password is required.";
  if (Object.keys(fields).length) {
    fail("Check the highlighted fields.", { fields });
  }
  return clean;
}

function publicUser(user) {
  const { id, name, email, verified, role, createdAt } = user;
  return { id, name, email, verified, role, createdAt };
}

async function ensureSeeded() {
  const db = readDb();
  if (db.seeded) return db;
  const salt = randomHex(8);
  db.users.push({
    id: `usr_${randomHex(8)}`,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    salt,
    hash: await hashPassword(DEMO_USER.password, salt),
    verified: true,
    role: "operator",
    createdAt: new Date().toISOString(),
  });
  db.seeded = true;
  writeDb(db);
  return db;
}

function findUser(db, email) {
  return db.users.find((user) => user.email === email) || null;
}

function issueVerificationCode(db, email) {
  const code = randomCode();
  db.verifications[email] = { code, expiresAt: Date.now() + CODE_TTL_MS };
  db.resendAt[email] = Date.now();
  writeDb(db);
  return code;
}

/* ------------------------------- adapter -------------------------------- */

export const mockAdapter = {
  mode: "mock",

  async register({ name, email, password }) {
    await delay(420);
    const db = await ensureSeeded();

    const cleanName = String(name ?? "").trim();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanPassword = String(password ?? "");

    const fields = {};
    if (cleanName.length < 2) {
      fields.name = "Enter your full name (at least 2 characters).";
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      fields.email = "Enter a valid email address.";
    }
    if (cleanPassword.length < 8) {
      fields.password = "Password must be at least 8 characters.";
    }
    if (Object.keys(fields).length) {
      fail("Check the highlighted fields.", { fields });
    }
    if (findUser(db, cleanEmail)) {
      fail("An account with this email already exists.", {
        status: 409,
        code: "EMAIL_TAKEN",
        fields: { email: "This email is already registered." },
      });
    }

    const salt = randomHex(8);
    const user = {
      id: `usr_${randomHex(8)}`,
      name: cleanName,
      email: cleanEmail,
      salt,
      hash: await hashPassword(cleanPassword, salt),
      verified: false,
      role: "operator",
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    const code = issueVerificationCode(db, cleanEmail);
    writeDb(db);

    return {
      user: publicUser(user),
      requiresVerification: true,
      message: "Account created. A verification code was issued.",
      dev: { code, expiresInMinutes: 10 },
    };
  },

  async login({ email, password }) {
    await delay(480);
    const db = await ensureSeeded();
    const cleanEmail = validateCredentials(email, password);

    const user = findUser(db, cleanEmail);
    const candidateHash = user
      ? await hashPassword(String(password), user.salt)
      : null;

    if (!user || candidateHash !== user.hash) {
      fail("Incorrect email or password.", {
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
    }
    if (!user.verified) {
      fail("Verify your email before signing in.", {
        status: 403,
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const token = `rt_${randomHex(24)}`;
    db.sessions[token] = { userId: user.id, createdAt: Date.now() };
    writeDb(db);

    return { token, user: publicUser(user), message: "Signed in." };
  },

  async me({ token }) {
    await delay(180);
    const db = await ensureSeeded();
    const session = token ? db.sessions[token] : null;
    const expired = () =>
      new AuthError("Session expired. Please sign in again.", {
        status: 401,
        code: "SESSION_EXPIRED",
      });

    if (!session) throw expired();
    const user = db.users.find((candidate) => candidate.id === session.userId);
    if (!user) {
      delete db.sessions[token];
      writeDb(db);
      throw expired();
    }
    return { user: publicUser(user) };
  },

  async logout({ token }) {
    await delay(160);
    const db = readDb();
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      writeDb(db);
    }
    return { message: "Signed out." };
  },

  async verifyEmail({ email, code }) {
    await delay(420);
    const db = await ensureSeeded();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanCode = String(code ?? "").trim();

    const user = findUser(db, cleanEmail);
    if (!user) {
      fail("No account found for that email.", {
        status: 404,
        code: "USER_NOT_FOUND",
      });
    }
    if (user.verified) {
      fail("This account is already verified. Sign in instead.", {
        status: 400,
        code: "ALREADY_VERIFIED",
      });
    }

    const record = db.verifications[cleanEmail];
    if (!record) {
      fail("No verification code requested. Request a new one.", {
        status: 400,
        code: "CODE_NOT_FOUND",
      });
    }
    if (Date.now() > record.expiresAt) {
      delete db.verifications[cleanEmail];
      writeDb(db);
      fail("That code has expired. Request a new one.", {
        status: 410,
        code: "CODE_EXPIRED",
      });
    }
    if (cleanCode !== record.code) {
      fail("Incorrect code. Check the 6 digits and try again.", {
        status: 400,
        code: "INVALID_CODE",
      });
    }

    user.verified = true;
    delete db.verifications[cleanEmail];
    writeDb(db);

    return {
      user: publicUser(user),
      message: "Email verified. You can sign in now.",
    };
  },

  async resendVerification({ email }) {
    await delay(380);
    const db = await ensureSeeded();
    const cleanEmail = String(email ?? "").trim().toLowerCase();

    const user = findUser(db, cleanEmail);
    if (!user) {
      fail("No pending verification found for that email.", {
        status: 404,
        code: "USER_NOT_FOUND",
      });
    }
    if (user.verified) {
      fail("This account is already verified.", {
        status: 400,
        code: "ALREADY_VERIFIED",
      });
    }

    const last = db.resendAt[cleanEmail] || 0;
    const elapsed = Date.now() - last;
    if (elapsed < RESEND_COOLDOWN_MS) {
      fail("Too many codes requested. Wait before trying again.", {
        status: 429,
        code: "RATE_LIMITED",
        retryAfter: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      });
    }

    const code = issueVerificationCode(db, cleanEmail);
    return {
      message: "A new verification code was issued.",
      dev: { code, expiresInMinutes: 10 },
    };
  },

  async forgotPassword({ email }) {
    await delay(450);
    const db = await ensureSeeded();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const generic = {
      message:
        "If an account exists for that email, a password reset link has been issued.",
    };

    const user = findUser(db, cleanEmail);
    if (!user) return generic; // never disclose whether an account exists

    const token = `rst_${randomHex(24)}`;
    db.resets[token] = { email: user.email, expiresAt: Date.now() + RESET_TTL_MS };
    writeDb(db);

    return {
      ...generic,
      dev: { token, path: "/reset-password", expiresInMinutes: 15 },
    };
  },

  async inspectResetToken(token) {
    const db = readDb();
    const record = token ? db.resets[token] : null;
    if (!record) return { valid: false, reason: "invalid" };
    if (Date.now() > record.expiresAt) return { valid: false, reason: "expired" };
    const [local = "", domain = ""] = record.email.split("@");
    const masked = `${local.slice(0, 1)}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
    return { valid: true, email: masked };
  },

  async resetPassword({ token, password }) {
    await delay(460);
    const db = await ensureSeeded();
    const cleanPassword = String(password ?? "");

    if (cleanPassword.length < 8) {
      fail("Password must be at least 8 characters.", {
        fields: { password: "Use at least 8 characters." },
      });
    }

    const record = token ? db.resets[token] : null;
    if (!record) {
      fail("This reset link is invalid or has already been used.", {
        status: 400,
        code: "RESET_TOKEN_INVALID",
      });
    }
    if (Date.now() > record.expiresAt) {
      delete db.resets[token];
      writeDb(db);
      fail("This reset link has expired. Request a new one.", {
        status: 410,
        code: "RESET_TOKEN_EXPIRED",
      });
    }

    const user = findUser(db, record.email);
    if (!user) {
      fail("This reset link is invalid.", {
        status: 400,
        code: "RESET_TOKEN_INVALID",
      });
    }

    const salt = randomHex(8);
    user.salt = salt;
    user.hash = await hashPassword(cleanPassword, salt);
    delete db.resets[token];

    // Changing the password invalidates every active session for that account.
    for (const [sessionToken, session] of Object.entries(db.sessions)) {
      if (session.userId === user.id) delete db.sessions[sessionToken];
    }
    writeDb(db);

    return { message: "Password updated. Sign in with your new password." };
  },
};
