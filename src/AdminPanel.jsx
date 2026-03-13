import { useState, useEffect } from "react";

const ESTADOS = {
  pendiente:  { label: "Pending",   color: "#F59E0B" },
  confirmada: { label: "Confirmed", color: "#10B981" },
  cancelada:  { label: "Cancelled", color: "#EF4444" },
};

export default function AdminPanel() {
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReservas = async (pwd = password, f = fecha) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reservaciones?password=${encodeURIComponent(pwd)}&fecha=${f}`);
      if (!res.ok) throw new Error("Unauthorized");
      setReservas(await res.json());
      setAuth(true);
      setError("");
    } catch {
      setError("Incorrect password");
      setAuth(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (auth) fetchReservas(password, fecha);
  }, [fecha]);

  const deleteReserva = async (id, nombre) => {
    if (!window.confirm(`Delete reservation #${id} for ${nombre}?`)) return;
    await fetch(`/api/admin/reservaciones/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    fetchReservas(password, fecha);
  };

  const updateEstado = async (id, estado) => {
    await fetch(`/api/admin/reservaciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, estado }),
    });
    fetchReservas(password, fecha);
  };

  if (!auth) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", fontFamily: "sans-serif" }}>
        <div style={{ background: "#111", padding: "40px", borderRadius: "16px", border: "1px solid #222", width: "320px" }}>
          <h2 style={{ color: "#C8102E", fontFamily: "Georgia, serif", marginBottom: "6px", margin: "0 0 6px" }}>Bella Notte</h2>
          <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 28px" }}>Admin Panel</p>
          {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchReservas()}
            style={{ width: "100%", background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "10px 14px", color: "#e8e8e8", fontSize: "14px", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}
          />
          <button
            onClick={() => fetchReservas()}
            disabled={loading}
            style={{ width: "100%", background: "#C8102E", color: "white", border: "none", borderRadius: "8px", padding: "11px", fontSize: "14px", cursor: "pointer" }}
          >
            {loading ? "..." : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", fontFamily: "sans-serif", color: "#e8e8e8" }}>
      <div style={{ background: "#C8102E", padding: "18px 24px" }}>
        <h2 style={{ fontFamily: "Georgia, serif", color: "white", margin: 0, fontSize: "20px" }}>Bella Notte — Reservations</h2>
      </div>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "8px 12px", color: "#e8e8e8", fontSize: "14px", outline: "none" }}
          />
          <span style={{ color: "#555", fontSize: "13px" }}>{reservas.length} reservation{reservas.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <p style={{ color: "#555" }}>Loading...</p>
        ) : reservas.length === 0 ? (
          <p style={{ color: "#555" }}>No reservations for this date.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["#", "Name", "Phone", "Time", "Guests", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#555", fontSize: "11px", fontWeight: "500", letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservas.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "12px", color: "#555", fontSize: "13px" }}>#{r.id}</td>
                    <td style={{ padding: "12px", fontSize: "14px" }}>{r.nombre}</td>
                    <td style={{ padding: "12px", color: "#888", fontSize: "13px" }}>{r.telefono || "—"}</td>
                    <td style={{ padding: "12px", fontSize: "14px", fontWeight: "500" }}>{r.hora?.slice(0, 5)}</td>
                    <td style={{ padding: "12px", color: "#888", fontSize: "13px" }}>{r.personas}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ background: (ESTADOS[r.estado]?.color || "#888") + "22", color: ESTADOS[r.estado]?.color || "#888", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" }}>
                        {ESTADOS[r.estado]?.label || r.estado}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {r.estado !== "confirmada" && (
                          <button onClick={() => updateEstado(r.id, "confirmada")} style={{ background: "#10B98118", color: "#10B981", border: "1px solid #10B98140", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>
                            Confirm
                          </button>
                        )}
                        {r.estado !== "cancelada" && (
                          <button onClick={() => updateEstado(r.id, "cancelada")} style={{ background: "#EF444418", color: "#EF4444", border: "1px solid #EF444440", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>
                            Cancel
                          </button>
                        )}
                        <button onClick={() => deleteReserva(r.id, r.nombre)} style={{ background: "#33181818", color: "#666", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
