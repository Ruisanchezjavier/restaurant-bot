import { useState, useEffect } from "react";

export default function ReservationWidget({ lang = "en", onComplete }) {
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [slotsData, setSlotsData] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationId, setConfirmationId] = useState(null);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!fecha) { setSlotsData(null); setHora(""); return; }
    setHora("");
    setSlotsData(null);
    setLoadingSlots(true);
    fetch(`/api/disponibilidad?fecha=${fecha}`)
      .then(r => r.json())
      .then(data => { setSlotsData(data); setLoadingSlots(false); })
      .catch(() => setLoadingSlots(false));
  }, [fecha]);

  const handleSubmit = async () => {
    if (!fecha || !hora || !nombre.trim() || !telefono.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reservacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), fecha, hora, personas }),
      });
      const data = await res.json();
      if (res.status === 409) {
        const alts = data.alternativas?.join(", ") || "";
        setError(lang === "en" ? `That time is taken. Try: ${alts}` : `Ese horario está lleno. Prueba: ${alts}`);
        setHora("");
        const availRes = await fetch(`/api/disponibilidad?fecha=${fecha}`);
        setSlotsData(await availRes.json());
      } else if (data.ok) {
        setConfirmationId(data.id);
        onComplete?.({ id: data.id, nombre: nombre.trim(), fecha, hora, personas });
      }
    } catch {
      setError(lang === "en" ? "Something went wrong. Try again." : "Algo salió mal. Intenta de nuevo.");
    }
    setSubmitting(false);
  };

  const fmt = (t) => {
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
  };

  const tx = lang === "en" ? {
    title: "Reserve a Table",
    date: "Date",
    time: "Available Times",
    noSlots: "Closed or no availability this day",
    loading: "Checking availability...",
    guests: "Guests",
    name: "Full Name",
    phone: "Phone",
    confirm: "Confirm Reservation",
    confirming: "Confirming...",
    doneTitle: "Reservation Confirmed",
    doneNum: "#",
    seeyou: "We look forward to seeing you!",
  } : {
    title: "Reservar Mesa",
    date: "Fecha",
    time: "Horarios Disponibles",
    noSlots: "Cerrado o sin disponibilidad este día",
    loading: "Verificando disponibilidad...",
    guests: "Personas",
    name: "Nombre Completo",
    phone: "Teléfono",
    confirm: "Confirmar Reservación",
    confirming: "Confirmando...",
    doneTitle: "¡Reservación Confirmada!",
    doneNum: "#",
    seeyou: "¡Te esperamos!",
  };

  if (confirmationId !== null) {
    return (
      <div style={s.box}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ fontSize: "26px", marginBottom: "10px" }}>🎉</div>
          <div style={s.doneTitle}>{tx.doneTitle}</div>
          <div style={s.doneId}>{tx.doneNum}{confirmationId}</div>
          <div style={s.doneMeta}>{nombre}</div>
          <div style={s.doneMeta}>{fmt(hora)} · {fecha} · {personas} {personas === 1 ? "guest" : lang === "en" ? "guests" : "personas"}</div>
          <div style={s.doneSub}>{tx.seeyou}</div>
        </div>
      </div>
    );
  }

  const canConfirm = fecha && hora && nombre.trim() && telefono.trim() && !submitting;

  return (
    <div style={s.box}>
      <div style={s.title}>{tx.title}</div>

      {/* Date */}
      <div style={s.field}>
        <span style={s.label}>{tx.date}</span>
        <input
          type="date"
          min={today}
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={s.dateInput}
        />
      </div>

      {/* Time slots */}
      {fecha && (
        <div style={s.field}>
          <span style={s.label}>{tx.time}</span>
          {loadingSlots ? (
            <p style={s.hint}>{tx.loading}</p>
          ) : !slotsData?.todos?.length ? (
            <p style={s.hint}>{tx.noSlots}</p>
          ) : (
            <div style={s.grid}>
              {slotsData.todos.map(slot => {
                const avail = slotsData.disponibles?.includes(slot);
                const sel = hora === slot;
                return (
                  <button
                    key={slot}
                    disabled={!avail}
                    onClick={() => avail && setHora(slot)}
                    style={{ ...s.slot, ...(sel ? s.slotSel : !avail ? s.slotOff : {}) }}
                  >
                    {fmt(slot)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Details — revealed after time is picked */}
      {hora && (
        <>
          <div style={s.divider} />

          {/* Guests */}
          <div style={s.field}>
            <span style={s.label}>{tx.guests}</span>
            <div style={s.stepper}>
              <button style={s.stepBtn} onClick={() => setPersonas(p => Math.max(1, p - 1))}>−</button>
              <span style={s.stepNum}>{personas}</span>
              <button style={s.stepBtn} onClick={() => setPersonas(p => Math.min(10, p + 1))}>+</button>
            </div>
          </div>

          {/* Name */}
          <div style={s.field}>
            <span style={s.label}>{tx.name}</span>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder={lang === "en" ? "John Smith" : "Juan García"}
              style={s.input}
              autoComplete="name"
            />
          </div>

          {/* Phone */}
          <div style={s.field}>
            <span style={s.label}>{tx.phone}</span>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+1 (555) 000-0000"
              style={s.input}
              autoComplete="tel"
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canConfirm}
            style={{ ...s.confirmBtn, ...(!canConfirm ? s.confirmOff : {}) }}
          >
            {submitting ? tx.confirming : tx.confirm}
          </button>
        </>
      )}
    </div>
  );
}

const s = {
  box: {
    background: "#1e1e1e",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "16px",
    width: "100%",
    boxSizing: "border-box",
    animation: "fadeUp 0.25s ease",
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "15px",
    fontWeight: "600",
    color: "#e8e8e8",
    letterSpacing: "0.5px",
    marginBottom: "14px",
    paddingBottom: "12px",
    borderBottom: "1px solid #262626",
  },
  field: { marginBottom: "12px" },
  label: {
    display: "block",
    fontSize: "10px",
    color: "#555",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  dateInput: {
    width: "100%",
    background: "#252525",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "#e8e8e8",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    colorScheme: "dark",
    fontFamily: "inherit",
  },
  hint: { fontSize: "12px", color: "#555", margin: "2px 0 0" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "5px",
  },
  slot: {
    background: "#252525",
    border: "1px solid #333",
    borderRadius: "7px",
    color: "#ccc",
    fontSize: "11px",
    padding: "7px 2px",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
    textAlign: "center",
  },
  slotSel: {
    background: "#C8102E",
    borderColor: "#C8102E",
    color: "white",
    fontWeight: "500",
  },
  slotOff: {
    background: "transparent",
    borderColor: "#222",
    color: "#333",
    cursor: "not-allowed",
  },
  divider: {
    borderTop: "1px solid #262626",
    margin: "4px 0 14px",
  },
  stepper: { display: "flex", alignItems: "center", gap: "14px" },
  stepBtn: {
    width: "28px",
    height: "28px",
    background: "#252525",
    border: "1px solid #333",
    borderRadius: "7px",
    color: "#e8e8e8",
    fontSize: "15px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
    lineHeight: 1,
    padding: 0,
  },
  stepNum: {
    fontSize: "15px",
    color: "#e8e8e8",
    minWidth: "18px",
    textAlign: "center",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    background: "#252525",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "#e8e8e8",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    WebkitAppearance: "none",
  },
  error: { fontSize: "11px", color: "#EF4444", margin: "0 0 8px" },
  confirmBtn: {
    width: "100%",
    background: "#C8102E",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.5px",
    WebkitTapHighlightColor: "transparent",
    marginTop: "2px",
  },
  confirmOff: { background: "#2a2a2a", color: "#555", cursor: "not-allowed" },
  doneTitle: { fontSize: "14px", fontWeight: "600", color: "#e8e8e8", marginBottom: "8px" },
  doneId: {
    fontSize: "24px",
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: "#C8102E",
    fontWeight: "600",
    marginBottom: "10px",
  },
  doneMeta: { fontSize: "12px", color: "#888", marginBottom: "3px" },
  doneSub: { fontSize: "11px", color: "#555", marginTop: "8px" },
};
