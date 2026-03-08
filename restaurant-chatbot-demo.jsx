import { useState, useRef, useEffect } from "react";

const RESTAURANT = {
  name: "Bella Notte",
  cuisine: "Italiana",
  emoji: "🍝",
  color: "#C8102E",
  accent: "#F4A261",
};

const SYSTEM_PROMPT = `Eres el asistente virtual de ${RESTAURANT.name}, un restaurante italiano elegante.

INFORMACIÓN DEL RESTAURANTE:
- Nombre: ${RESTAURANT.name}
- Tipo: Restaurante italiano de autor
- Horario: Lunes a Jueves 12:00–23:00 | Viernes y Sábado 12:00–00:00 | Domingo 12:00–22:00
- Dirección: Calle Gourmet 45, Zona Rosa
- Teléfono: +1 (555) 234-5678
- Reservaciones: Sí, con mínimo 2 horas de anticipación

MENÚ PRINCIPALES:
Entradas: Bruschetta al pomodoro $12 | Carpaccio di manzo $18 | Burrata fresca $16
Pastas: Spaghetti alla carbonara $24 | Tagliatelle al ragú $22 | Ravioli di ricotta $20
Secondi: Branzino al forno $32 | Pollo alla Milanese $28 | Filetto di manzo $45
Postres: Tiramisú clásico $10 | Panna cotta $9 | Cannoli siciliani $11
Bebidas: Vinos desde $9 la copa | Cócteles $14 | Sin alcohol $6

OPCIONES ESPECIALES:
- Menú vegetariano disponible
- Opciones sin gluten (preguntar al mesero)
- Menú infantil $15
- Happy Hour: Lun-Jue 17:00–19:00 (50% en cócteles)

REGLAS:
- Responde SIEMPRE en el idioma que te hablen (español, inglés, etc.)
- Sé cálido, elegante y breve (máximo 3-4 líneas por respuesta)
- Si preguntan por reservación, pide: nombre, fecha, hora y número de personas
- Si no sabes algo, di que con gusto un miembro del equipo puede ayudar
- Usa emojis con moderación y buen gusto
- Nunca inventes precios o platos que no están en el menú`;

const QUICK_QUESTIONS = [
  "¿Cuál es el horario?",
  "¿Tienen opciones vegetarianas?",
  "Quiero hacer una reservación",
  "¿Qué me recomiendas?",
];

export default function RestaurantChatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `¡Benvenuto a ${RESTAURANT.name}! 🍷 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userMessage = text || input.trim();
    if (!userMessage || loading) return;

    setInput("");
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || "Lo siento, intenta de nuevo.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Disculpa, hubo un problema. Por favor intenta nuevamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        .chat-container { width: 100%; max-width: 420px; }
        .header { background: #C8102E; padding: 24px 28px; border-radius: 20px 20px 0 0; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.06); border-radius: 50%; }
        .header::after { content: ''; position: absolute; bottom: -20px; left: 20px; width: 80px; height: 80px; background: rgba(244,162,97,0.15); border-radius: 50%; }
        .restaurant-name { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 600; color: white; letter-spacing: 1px; margin: 0; }
        .restaurant-sub { font-family: 'Jost', sans-serif; font-size: 11px; color: rgba(255,255,255,0.7); letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
        .status { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
        .status-dot { width: 7px; height: 7px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .status-text { font-family: 'Jost', sans-serif; font-size: 11px; color: rgba(255,255,255,0.8); }
        .messages { background: #111; padding: 20px; height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; scrollbar-width: thin; scrollbar-color: #333 transparent; }
        .bubble { max-width: 82%; padding: 12px 16px; border-radius: 18px; font-family: 'Jost', sans-serif; font-size: 14px; line-height: 1.6; animation: fadeUp 0.3s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .bubble.user { background: #C8102E; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .bubble.assistant { background: #1e1e1e; color: #e8e8e8; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #2a2a2a; }
        .typing { display: flex; gap: 4px; align-items: center; padding: 14px 18px; }
        .dot { width: 6px; height: 6px; background: #555; border-radius: 50%; animation: bounce 1.2s infinite; }
        .dot:nth-child(2){animation-delay:0.2s} .dot:nth-child(3){animation-delay:0.4s}
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        .quick-questions { background: #111; padding: 0 16px 12px; display: flex; gap: 6px; flex-wrap: wrap; }
        .quick-btn { background: transparent; border: 1px solid #333; color: #aaa; padding: 6px 12px; border-radius: 20px; font-family: 'Jost', sans-serif; font-size: 12px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .quick-btn:hover { border-color: #C8102E; color: #C8102E; }
        .input-area { background: #161616; padding: 16px 20px; border-radius: 0 0 20px 20px; border-top: 1px solid #222; display: flex; gap: 10px; align-items: center; }
        .input-field { flex: 1; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 12px; padding: 11px 16px; color: #e8e8e8; font-family: 'Jost', sans-serif; font-size: 14px; outline: none; transition: border 0.2s; }
        .input-field:focus { border-color: #C8102E; }
        .input-field::placeholder { color: #555; }
        .send-btn { width: 42px; height: 42px; background: #C8102E; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
        .send-btn:hover { background: #a50d26; transform: scale(1.05); }
        .send-btn:disabled { background: #333; cursor: not-allowed; transform: none; }
        .powered { text-align: center; margin-top: 12px; font-family: 'Jost', sans-serif; font-size: 10px; color: #444; letter-spacing: 1px; }
        .powered span { color: #666; }
      `}</style>

      <div className="chat-container">
        {/* Header */}
        <div className="header">
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "28px", marginBottom: "4px" }}>🍷</div>
            <p className="restaurant-name">{RESTAURANT.name}</p>
            <p className="restaurant-sub">Ristorante Italiano</p>
            <div className="status">
              <div className="status-dot" />
              <span className="status-text">Asistente en línea</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`bubble ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="bubble assistant" style={{ padding: 0 }}>
              <div className="typing">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div className="quick-questions">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} className="quick-btn" onClick={() => sendMessage(q)}>
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="input-area">
          <input
            className="input-field"
            placeholder="Escribe tu pregunta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <p className="powered">POWERED BY <span>AI</span> · TU LOGO AQUÍ</p>
      </div>
    </div>
  );
}
