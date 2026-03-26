const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();

exports.generateEmailDraft = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "Missing OpenAI key" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!token) {
        return res.status(401).json({ error: "Missing auth token" });
      }

      await admin.auth().verifyIdToken(token);

      const {
        company,
        role,
        contactName,
        notes,
        emailType,
        tone,
        extraContext,
      } = req.body;

      const prompt = `
Write a ${tone} ${emailType} email.

Context:
- Company: ${company}
- Role: ${role}
- Contact: ${contactName}
- Notes: ${notes}
- Extra context: ${extraContext}

Rules:
- Keep it under 150 words
- Sound natural and human
- No generic AI phrases
- Include greeting and sign-off

Return JSON:
{"subject":"...","body":"..."}
`;

      const response = await openai.responses.create({
        model: "gpt-5.2",
        input: prompt,
      });

      const text = response.output_text?.trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        return res.status(500).json({
          error: "Invalid AI response",
          raw: text,
        });
      }

      return res.json({
        subject: parsed.subject,
        body: parsed.body,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: error.message,
      });
    }
  }
);