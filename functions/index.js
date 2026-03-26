const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();

const db = admin.firestore();

const ALLOWED_EMAIL_TYPES = [
  "cold outreach",
  "follow up",
  "thank you",
  "networking",
  "application follow up",
];

const ALLOWED_TONES = [
  "professional",
  "friendly",
  "confident",
  "concise",
];

const MAX_LENGTHS = {
  company: 100,
  role: 100,
  contactName: 100,
  notes: 1000,
  extraContext: 1000,
};

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5;

function getString(value, maxLength, fieldName, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (required && !trimmed) {
    throw new Error(`${fieldName} is required`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return trimmed;
}

function getEnum(value, allowedValues, fieldName, { required = false } = {}) {
  const normalized = getString(value, 100, fieldName, { required }).toLowerCase();

  if (!normalized && !required) {
    return "";
  }

  if (!allowedValues.includes(normalized)) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`
    );
  }

  return normalized;
}

async function enforceRateLimit(uid) {
  const rateLimitRef = db.collection("emailDraftRateLimits").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);

    let data = {
      windowStart: now,
      requestCount: 0,
    };

    if (snapshot.exists) {
      data = snapshot.data();
    }

    const windowStart = typeof data.windowStart === "number" ? data.windowStart : now;
    const requestCount = typeof data.requestCount === "number" ? data.requestCount : 0;

    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      transaction.set(rateLimitRef, {
        windowStart: now,
        requestCount: 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
      throw new Error("Rate limit exceeded. Please wait a minute and try again.");
    }

    transaction.set(rateLimitRef, {
      windowStart,
      requestCount: requestCount + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

exports.generateEmailDraft = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          error: "Method not allowed",
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error("Missing OPENAI_API_KEY");
        return res.status(500).json({
          error: "Server configuration error",
        });
      }

      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!token) {
        return res.status(401).json({
          error: "Missing auth token",
        });
      }

      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;

      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
          error: "Invalid request body",
        });
      }

      const company = getString(req.body.company, MAX_LENGTHS.company, "company", {
        required: true,
      });

      const role = getString(req.body.role, MAX_LENGTHS.role, "role", {
        required: true,
      });

      const contactName = getString(
        req.body.contactName,
        MAX_LENGTHS.contactName,
        "contactName"
      );

      const notes = getString(req.body.notes, MAX_LENGTHS.notes, "notes");
      const extraContext = getString(
        req.body.extraContext,
        MAX_LENGTHS.extraContext,
        "extraContext"
      );

      const emailType = getEnum(
        req.body.emailType,
        ALLOWED_EMAIL_TYPES,
        "emailType",
        { required: true }
      );

      const tone = getEnum(
        req.body.tone,
        ALLOWED_TONES,
        "tone",
        { required: true }
      );

      await enforceRateLimit(uid);

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `
Write a ${tone} ${emailType} email.

Context:
- Company: ${company}
- Role: ${role}
- Contact: ${contactName || "Not provided"}
- Notes: ${notes || "None"}
- Extra context: ${extraContext || "None"}

Rules:
- Keep it under 150 words
- Sound natural and human
- No generic AI phrases
- Include a greeting and sign-off
- Return only valid JSON
- JSON format must be:
{"subject":"...","body":"..."}
`;

      const response = await openai.responses.create({
        model: "gpt-5.2",
        input: prompt,
      });

      const text = response.output_text?.trim();

      if (!text) {
        console.error("Empty response from OpenAI", { uid });
        return res.status(500).json({
          error: "Could not generate a draft",
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.error("Invalid JSON returned by OpenAI", {
          uid,
          rawOutput: text,
        });
        return res.status(500).json({
          error: "Could not generate a valid draft",
        });
      }

      const subject = getString(parsed.subject, 200, "subject", { required: true });
      const body = getString(parsed.body, 5000, "body", { required: true });

      return res.status(200).json({
        subject,
        body,
      });
    } catch (error) {
      console.error("generateEmailDraft failed:", error);

      const message = error?.message || "Unexpected error";

      if (
        message.includes("required") ||
        message.includes("must be a string") ||
        message.includes("must be one of") ||
        message.includes("characters or fewer") ||
        message.includes("Rate limit exceeded")
      ) {
        return res.status(400).json({
          error: message,
        });
      }

      if (
        message.includes("auth") ||
        message.includes("token") ||
        message.includes("id token") ||
        message.includes("Firebase ID token")
      ) {
        return res.status(401).json({
          error: "Unauthorized",
        });
      }

      return res.status(500).json({
        error: "Something went wrong while generating the draft",
      });
    }
  }
);