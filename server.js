import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { Resend } from "resend";

// Load .env manually (no extra dependency)
const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY) {
  console.error("❌  Missing GROQ_API_KEY in .env file");
  process.exit(1);
}

const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "owner@example.com";
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

const app = express();
app.use(express.json());

// Serve built frontend in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Chat proxy endpoint ──────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { system, messages, max_tokens } = req.body;
    const groqMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: max_tokens || 512,
        messages: groqMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    const text = data.choices?.[0]?.message?.content || "";
    res.json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: { message: "Proxy error: " + err.message } });
  }
});

// ── Reservation endpoint ─────────────────────────────────────────────────────
app.post("/api/reservacion", async (req, res) => {
  const { name, date, time, guests } = req.body;

  if (!name || !date || !time || !guests) {
    return res.status(400).json({ error: "Missing reservation fields" });
  }

  // Send email to owner
  if (resend) {
    try {
      await resend.emails.send({
        from: "Bella Notte Bot <onboarding@resend.dev>",
        to: OWNER_EMAIL,
        subject: `New Reservation — ${name}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fff;">
            <h2 style="color: #C8102E; margin-bottom: 8px;">New Reservation</h2>
            <p style="color: #666; margin-bottom: 24px;">Bella Notte · Virtual Assistant</p>
            <table style="width:100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888; width: 40%;">Name</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${name}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888;">Date</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${date}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888;">Time</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${time}</td></tr>
              <tr><td style="padding: 10px 0; color: #888;">Guests</td><td style="padding: 10px 0; font-weight: bold;">${guests}</td></tr>
            </table>
            <p style="margin-top: 24px; font-size: 12px; color: #aaa;">Sent automatically by the Bella Notte chatbot</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Email error:", emailErr.message);
    }
  } else {
    console.log("⚠️  No RESEND_API_KEY — email not sent. Reservation:", { name, date, time, guests });
  }

  res.json({ ok: true });
});

// SPA fallback
if (existsSync(distPath)) {
  app.get("*", (_, res) => res.sendFile(join(distPath, "index.html")));
}

const PORT = process.env.PORT || 3001;
createServer(app).listen(PORT, () => {
  console.log(`✅  Server running on http://localhost:${PORT}`);
});
