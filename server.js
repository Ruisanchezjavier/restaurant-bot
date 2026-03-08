import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

// Load .env manually (no extra dependency)
const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error("❌  Missing GROQ_API_KEY in .env file");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Serve built frontend in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Chat proxy endpoint
app.post("/api/chat", async (req, res) => {
  try {
    // Convert Anthropic-style request to OpenAI-compatible (Groq) format
    const { system, messages, max_tokens } = req.body;
    const groqMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: max_tokens || 512,
        messages: groqMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    // Convert Groq response back to Anthropic-style so the frontend works unchanged
    const text = data.choices?.[0]?.message?.content || "";
    res.json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: { message: "Proxy error: " + err.message } });
  }
});

// SPA fallback
if (existsSync(distPath)) {
  app.get("*", (_, res) => res.sendFile(join(distPath, "index.html")));
}

const PORT = process.env.PORT || 3001;
createServer(app).listen(PORT, () => {
  console.log(`✅  Server running on http://localhost:${PORT}`);
});
