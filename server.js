import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { Resend } from "resend";
import pg from "pg";

const { Pool } = pg;

// Load .env manually
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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

// ── Database ──────────────────────────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

if (pool) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS reservaciones (
      id         SERIAL PRIMARY KEY,
      nombre     VARCHAR(100) NOT NULL,
      telefono   VARCHAR(30),
      email      VARCHAR(100),
      fecha      DATE NOT NULL,
      hora       TIME NOT NULL,
      personas   INTEGER NOT NULL,
      estado     VARCHAR(20) DEFAULT 'pendiente',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
    .then(() => console.log("✅  Database ready"))
    .catch(err => console.error("❌  DB init error:", err.message));
}

// ── Restaurant config ─────────────────────────────────────────────────────────
const RESTAURANT_HOURS = {
  0: { open: "12:00", lastSeating: "20:30" }, // Sun
  1: { open: "12:00", lastSeating: "21:30" }, // Mon
  2: { open: "12:00", lastSeating: "21:30" }, // Tue
  3: { open: "12:00", lastSeating: "21:30" }, // Wed
  4: { open: "12:00", lastSeating: "21:30" }, // Thu
  5: { open: "12:00", lastSeating: "22:30" }, // Fri
  6: { open: "12:00", lastSeating: "22:30" }, // Sat
};
const MAX_PER_SLOT = 3;

function generateSlots(dayOfWeek) {
  const h = RESTAURANT_HOURS[dayOfWeek];
  if (!h) return [];
  const [oh, om] = h.open.split(":").map(Number);
  const [lh, lm] = h.lastSeating.split(":").map(Number);
  const slots = [];
  let cur = oh * 60 + om;
  const last = lh * 60 + lm;
  while (cur <= last) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += 30;
  }
  return slots;
}

function buildEmailHTML({ id, nombre, telefono, email, fecha, hora, personas }) {
  const rows = [
    ["Name", nombre],
    telefono ? ["Phone", telefono] : null,
    email ? ["Email", email] : null,
    ["Date", fecha],
    ["Time", hora],
    ["Guests", personas],
  ].filter(Boolean);
  return `
    <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fff;">
      <h2 style="color: #C8102E; margin-bottom: 8px;">New Reservation #${id}</h2>
      <p style="color: #666; margin-bottom: 24px;">Bella Notte · Virtual Assistant</p>
      <table style="width:100%; border-collapse: collapse;">
        ${rows.map(([label, value], i) => `
          <tr>
            <td style="padding: 10px 0; ${i < rows.length - 1 ? "border-bottom: 1px solid #eee;" : ""} color: #888; width: 40%;">${label}</td>
            <td style="padding: 10px 0; ${i < rows.length - 1 ? "border-bottom: 1px solid #eee;" : ""} font-weight: bold;">${value}</td>
          </tr>`).join("")}
      </table>
      <p style="margin-top: 24px; font-size: 12px; color: #aaa;">Sent automatically by the Bella Notte chatbot</p>
    </div>
  `;
}

const app = express();
app.use(express.json());

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, "dist");
if (existsSync(distPath)) app.use(express.static(distPath));

// ── Chat proxy ────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { system, messages, max_tokens } = req.body;
    const groqMessages = system ? [{ role: "system", content: system }, ...messages] : messages;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: max_tokens || 512, messages: groqMessages }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json({ content: [{ type: "text", text: data.choices?.[0]?.message?.content || "" }] });
  } catch (err) {
    res.status(500).json({ error: { message: "Proxy error: " + err.message } });
  }
});

// ── Availability ──────────────────────────────────────────────────────────────
app.get("/api/disponibilidad", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "fecha required" });
  try {
    const [y, m, d] = fecha.split("-").map(Number);
    const allSlots = generateSlots(new Date(y, m - 1, d).getDay());
    const result = await pool.query(
      `SELECT hora::text, COUNT(*)::int as count FROM reservaciones
       WHERE fecha = $1 AND estado != 'cancelada' GROUP BY hora`,
      [fecha]
    );
    const booked = {};
    result.rows.forEach(r => { booked[r.hora.slice(0, 5)] = r.count; });
    const disponibles = allSlots.filter(s => (booked[s] || 0) < MAX_PER_SLOT);
    res.json({ fecha, disponibles, todos: allSlots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reservation ───────────────────────────────────────────────────────────────
app.post("/api/reservacion", async (req, res) => {
  const { nombre, telefono, email, fecha, hora, personas } = req.body;
  if (!nombre || !fecha || !hora || !personas) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!pool) {
    if (resend) {
      try {
        await resend.emails.send({
          from: "Bella Notte Bot <onboarding@resend.dev>",
          to: OWNER_EMAIL,
          subject: `New Reservation — ${nombre}`,
          html: buildEmailHTML({ id: "N/A", nombre, telefono, email, fecha, hora, personas }),
        });
      } catch (e) { console.error("Email error:", e.message); }
    }
    return res.json({ ok: true, id: null });
  }

  try {
    const check = await pool.query(
      `SELECT COUNT(*)::int as count FROM reservaciones WHERE fecha = $1 AND hora = $2 AND estado != 'cancelada'`,
      [fecha, hora]
    );
    if (check.rows[0].count >= MAX_PER_SLOT) {
      const [y, m, d] = fecha.split("-").map(Number);
      const allSlots = generateSlots(new Date(y, m - 1, d).getDay());
      const bookedRes = await pool.query(
        `SELECT hora::text, COUNT(*)::int as count FROM reservaciones WHERE fecha = $1 AND estado != 'cancelada' GROUP BY hora`,
        [fecha]
      );
      const booked = {};
      bookedRes.rows.forEach(r => { booked[r.hora.slice(0, 5)] = r.count; });
      const alternativas = allSlots.filter(s => (booked[s] || 0) < MAX_PER_SLOT).slice(0, 6);
      return res.status(409).json({ error: "no_disponible", alternativas });
    }

    const result = await pool.query(
      `INSERT INTO reservaciones (nombre, telefono, email, fecha, hora, personas) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [nombre, telefono || null, email || null, fecha, hora, personas]
    );
    const id = result.rows[0].id;

    if (resend) {
      try {
        await resend.emails.send({
          from: "Bella Notte Bot <onboarding@resend.dev>",
          to: OWNER_EMAIL,
          subject: `New Reservation #${id} — ${nombre}`,
          html: buildEmailHTML({ id, nombre, telefono, email, fecha, hora, personas }),
        });
      } catch (e) { console.error("Email error:", e.message); }
    }

    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Modify reservation ────────────────────────────────────────────────────────
app.patch("/api/reservacion/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  const id = parseInt(req.params.id);
  const { fecha, hora, personas } = req.body;
  if (!id || !fecha || !hora || !personas) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const existing = await pool.query(
      `SELECT id, nombre, telefono, fecha::text, hora::text, personas FROM reservaciones WHERE id = $1 AND estado != 'cancelada'`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }
    const prev = existing.rows[0];

    // Check availability for new slot (excluding this reservation)
    const check = await pool.query(
      `SELECT COUNT(*)::int as count FROM reservaciones WHERE fecha = $1 AND hora = $2 AND estado != 'cancelada' AND id != $3`,
      [fecha, hora, id]
    );
    if (check.rows[0].count >= MAX_PER_SLOT) {
      const [y, m, d] = fecha.split("-").map(Number);
      const allSlots = generateSlots(new Date(y, m - 1, d).getDay());
      const bookedRes = await pool.query(
        `SELECT hora::text, COUNT(*)::int as count FROM reservaciones WHERE fecha = $1 AND estado != 'cancelada' AND id != $2 GROUP BY hora`,
        [fecha, id]
      );
      const booked = {};
      bookedRes.rows.forEach(r => { booked[r.hora.slice(0, 5)] = r.count; });
      const alternativas = allSlots.filter(s => (booked[s] || 0) < MAX_PER_SLOT).slice(0, 6);
      return res.status(409).json({ error: "no_disponible", alternativas });
    }

    await pool.query(
      `UPDATE reservaciones SET fecha = $1, hora = $2, personas = $3 WHERE id = $4`,
      [fecha, hora, personas, id]
    );

    if (resend) {
      try {
        await resend.emails.send({
          from: "Bella Notte Bot <onboarding@resend.dev>",
          to: OWNER_EMAIL,
          subject: `Reservation Modified #${id} — ${prev.nombre}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fff;">
              <h2 style="color: #F59E0B; margin-bottom: 8px;">Reservation Modified #${id}</h2>
              <p style="color: #666; margin-bottom: 24px;">Bella Notte · Virtual Assistant</p>
              <table style="width:100%; border-collapse: collapse;">
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888; width: 40%;">Name</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${prev.nombre}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888;">Date</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;"><span style="text-decoration:line-through;color:#aaa;">${prev.fecha}</span> → <strong>${fecha}</strong></td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #888;">Time</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;"><span style="text-decoration:line-through;color:#aaa;">${prev.hora.slice(0,5)}</span> → <strong>${hora}</strong></td></tr>
                <tr><td style="padding: 10px 0; color: #888;">Guests</td><td style="padding: 10px 0;"><span style="text-decoration:line-through;color:#aaa;">${prev.personas}</span> → <strong>${personas}</strong></td></tr>
              </table>
              <p style="margin-top: 24px; font-size: 12px; color: #aaa;">Sent automatically by the Bella Notte chatbot</p>
            </div>
          `,
        });
      } catch (e) { console.error("Email error:", e.message); }
    }

    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.get("/api/admin/reservaciones", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  const fecha = req.query.fecha || new Date().toISOString().split("T")[0];
  try {
    const result = await pool.query(
      `SELECT id, nombre, telefono, email, fecha::text, hora::text, personas, estado
       FROM reservaciones WHERE fecha = $1 ORDER BY hora`,
      [fecha]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/reservaciones/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  const { password, estado } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  if (!["pendiente", "confirmada", "cancelada"].includes(estado)) return res.status(400).json({ error: "Invalid estado" });
  try {
    await pool.query(`UPDATE reservaciones SET estado = $1 WHERE id = $2`, [estado, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/reservaciones/:id", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  try {
    await pool.query(`DELETE FROM reservaciones WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
if (existsSync(distPath)) app.get("*", (_, res) => res.sendFile(join(distPath, "index.html")));

const PORT = process.env.PORT || 3001;
createServer(app).listen(PORT, () => console.log(`✅  Server running on http://localhost:${PORT}`));
