import { useState, useRef, useEffect } from "react";
import ReservationWidget from "./ReservationWidget.jsx";

const RESTAURANT = {
  name: "Bella Notte",
  cuisine: "Italiana",
  emoji: "🍷",
  color: "#C8102E",
  accent: "#F4A261",
};

const SYSTEM_PROMPT = `You are the virtual assistant of ${RESTAURANT.name}, an elegant Italian restaurant.

TODAY'S DATE: ${new Date().toISOString().split("T")[0]} — always use this year when the user doesn't specify a year.

RESTAURANT INFO:
- Name: ${RESTAURANT.name}
- Type: Italian fine dining
- Hours: Mon–Thu 12:00–23:00 | Fri–Sat 12:00–00:00 | Sun 12:00–22:00
- Address: Gourmet St. 45, Zona Rosa
- Phone: +1 (555) 234-5678
- Reservations: Yes, at least 2 hours in advance

MENU:
Starters: Bruschetta al pomodoro $12 | Carpaccio di manzo $18 | Burrata fresca $16
Pasta: Spaghetti alla carbonara $24 | Tagliatelle al ragú $22 | Ravioli di ricotta $20
Mains: Branzino al forno $32 | Pollo alla Milanese $28 | Filetto di manzo $45
Desserts: Classic Tiramisú $10 | Panna cotta $9 | Cannoli siciliani $11
Drinks: Wine from $9/glass | Cocktails $14 | Non-alcoholic $6

SPECIAL OPTIONS:
- Vegetarian menu available
- Gluten-free options (ask your server)
- Kids menu $15
- Happy Hour: Mon–Thu 17:00–19:00 (50% off cocktails)

RULES:
- ALWAYS respond in the language the user writes in (English, Spanish, etc.)
- Be warm, elegant and brief (max 3-4 lines per response)
- If you don't know something, say a team member will be happy to help
- Use emojis sparingly and tastefully
- Never invent prices or dishes not listed in the menu

RESERVATION SYSTEM:
- When a user wants to make a reservation, respond warmly and briefly, then on a NEW LINE add exactly:
SHOW_RESERVATION_WIDGET
- Do NOT collect name, phone, date, time, or guests conversationally — the interactive form handles everything.
- Do NOT add SHOW_RESERVATION_WIDGET more than once. If the widget is already showing, just answer questions normally.
- After the widget appears, wait for the user to complete the form. Answer any questions they have in the meantime.

MODIFICATION SYSTEM:
- When a user wants to modify an existing reservation, ask for their confirmation number (#ID).
- Then ask what they want to change: date, time, and/or number of guests.
- Once you have the confirmation number AND all new details confirmed, say "Let me update your reservation..." then on a NEW LINE add exactly:
MODIFY_RESERVATION_DATA:{"id":N,"fecha":"YYYY-MM-DD","hora":"HH:MM","personas":N}
- Do NOT say the reservation is updated — the system will handle it automatically.
- Only add MODIFY_RESERVATION_DATA when you have the id and all new details. Never add it otherwise.`;

const I18N = {
  en: {
    sub: "Ristorante Italiano",
    status: "Assistant online",
    welcome: `Welcome to ${RESTAURANT.name}! 🍷 I'm your virtual assistant. How can I help you today?`,
    placeholder: "Type your question...",
    quick: ["What are your hours?", "Vegetarian options?", "Make a reservation", "What do you recommend?"],
    powered: "POWERED BY CLAUDE AI",
    toggle: "ES",
  },
  es: {
    sub: "Ristorante Italiano",
    status: "Asistente en línea",
    welcome: `¡Benvenuto a ${RESTAURANT.name}! 🍷 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?`,
    placeholder: "Escribe tu pregunta...",
    quick: ["¿Cuál es el horario?", "¿Opciones vegetarianas?", "Hacer una reservación", "¿Qué recomiendas?"],
    powered: "POWERED BY CLAUDE AI",
    toggle: "EN",
  },
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  body {
    font-family: 'Jost', sans-serif;
    background: #0a0a0a;
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
  }

  .page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    min-height: 100dvh;
    padding: 0;
    background: #0a0a0a;
  }

  .chat-wrapper {
    width: 100%;
    max-width: 440px;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #111;
    overflow: hidden;
  }

  @media (min-width: 500px) {
    .page { padding: 20px; }
    .chat-wrapper {
      height: min(780px, 96dvh);
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7);
    }
  }

  .header {
    background: #C8102E;
    padding: 20px 24px 18px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -30px; right: -30px;
    width: 130px; height: 130px;
    background: rgba(255,255,255,0.06);
    border-radius: 50%;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -20px; left: 20px;
    width: 80px; height: 80px;
    background: rgba(244,162,97,0.15);
    border-radius: 50%;
  }
  .header-inner { position: relative; z-index: 1; }
  .header-emoji { font-size: 26px; margin-bottom: 4px; }
  .restaurant-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(22px, 5vw, 26px);
    font-weight: 600;
    color: white;
    letter-spacing: 1px;
  }
  .restaurant-sub {
    font-size: 10px;
    color: rgba(255,255,255,0.7);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .status-dot {
    width: 7px; height: 7px;
    background: #4ade80;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .status-text { font-size: 11px; color: rgba(255,255,255,0.8); }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #2a2a2a transparent;
  }
  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }

  .bubble {
    max-width: 82%;
    padding: 11px 15px;
    border-radius: 18px;
    font-size: clamp(13px, 3.5vw, 14px);
    line-height: 1.6;
    animation: fadeUp 0.25s ease;
    word-break: break-word;
    white-space: pre-wrap;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .bubble.user {
    background: #C8102E;
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .bubble.assistant {
    background: #1e1e1e;
    color: #e8e8e8;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
    border: 1px solid #2a2a2a;
  }

  .typing {
    display: flex;
    gap: 5px;
    align-items: center;
    padding: 14px 18px;
  }
  .dot {
    width: 6px; height: 6px;
    background: #555;
    border-radius: 50%;
    animation: bounce 1.2s infinite;
  }
  .dot:nth-child(2){animation-delay:0.2s}
  .dot:nth-child(3){animation-delay:0.4s}
  @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

  .quick-questions {
    padding: 0 14px 10px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .quick-btn {
    background: transparent;
    border: 1px solid #2e2e2e;
    color: #999;
    padding: 6px 12px;
    border-radius: 20px;
    font-family: 'Jost', sans-serif;
    font-size: clamp(11px, 3vw, 12px);
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .quick-btn:hover, .quick-btn:active { border-color: #C8102E; color: #C8102E; }

  .input-area {
    background: #161616;
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top: 1px solid #222;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-shrink: 0;
  }
  .input-field {
    flex: 1;
    background: #1e1e1e;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 11px 14px;
    color: #e8e8e8;
    font-family: 'Jost', sans-serif;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
    -webkit-appearance: none;
  }
  .input-field:focus { border-color: #C8102E; }
  .input-field::placeholder { color: #555; }

  .send-btn {
    width: 44px; height: 44px;
    background: #C8102E;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, transform 0.15s;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .send-btn:hover { background: #a50d26; }
  .send-btn:active { transform: scale(0.93); }
  .send-btn:disabled { background: #2a2a2a; cursor: not-allowed; transform: none; }

  .powered {
    text-align: center;
    padding: 6px 0 8px;
    font-size: 10px;
    color: #3a3a3a;
    letter-spacing: 1px;
    flex-shrink: 0;
    background: #161616;
  }
  .powered span { color: #555; }

  .lang-btn {
    position: absolute;
    top: 50%; right: 0;
    transform: translateY(-50%);
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    font-family: 'Jost', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1px;
    padding: 5px 10px;
    border-radius: 20px;
    cursor: pointer;
    transition: background 0.2s;
    -webkit-tap-highlight-color: transparent;
  }
  .lang-btn:hover { background: rgba(255,255,255,0.25); }
`;

export default function RestaurantChatbot() {
  const [lang, setLang] = useState("en");
  const t = I18N[lang];

  const [messages, setMessages] = useState([
    { role: "assistant", content: I18N.en.welcome },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const toggleLang = () => {
    const next = lang === "en" ? "es" : "en";
    setLang(next);
    setMessages([{ role: "assistant", content: I18N[next].welcome }]);
    setInput("");
  };

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: newMessages.filter(m => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "API error");
      let reply = data.content?.[0]?.text || (lang === "en" ? "Sorry, please try again." : "Lo siento, intenta de nuevo.");

      // Detect widget marker
      if (reply.includes("SHOW_RESERVATION_WIDGET")) {
        reply = reply.replace(/\nSHOW_RESERVATION_WIDGET/g, "").replace(/SHOW_RESERVATION_WIDGET/g, "").trim();
        const updatedMessages = [...newMessages, { role: "assistant", content: reply }, { role: "widget" }];
        setMessages(updatedMessages);
        setLoading(false);
        if (window.innerWidth >= 500) inputRef.current?.focus();
        return;
      }

      // Detect modification marker
      const modifyMatch = reply.match(/MODIFY_RESERVATION_DATA:(\{.*?\})/s);
      if (modifyMatch) {
        reply = reply.replace(/\nMODIFY_RESERVATION_DATA:\{.*?\}/s, "").trim();
        try {
          const modData = JSON.parse(modifyMatch[1]);
          const resRes = await fetch(`/api/reservacion/${modData.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(modData),
          });
          const resData = await resRes.json();
          if (resData.ok) {
            reply += lang === "en"
              ? `\n\n✅ Reservation #${modData.id} has been updated!`
              : `\n\n✅ ¡Reservación #${modData.id} actualizada!`;
          } else if (resData.error === "not_found") {
            reply += lang === "en"
              ? `\n\n❌ No reservation found with #${modData.id}. Please check your confirmation number.`
              : `\n\n❌ No se encontró la reservación #${modData.id}. Verifica tu número de confirmación.`;
          } else if (resData.error === "no_disponible") {
            const alts = resData.alternativas?.join(", ") || (lang === "en" ? "no availability" : "sin disponibilidad");
            reply += lang === "en"
              ? `\n\n❌ That time is not available. Try one of these: ${alts}`
              : `\n\n❌ Ese horario no está disponible. Prueba uno de estos: ${alts}`;
          }
        } catch (e) {
          console.error("Modify error:", e);
        }
      }

      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: lang === "en" ? "Sorry, there was a problem. Please try again." : "Disculpa, hubo un problema. Por favor intenta nuevamente." },
      ]);
    } finally {
      setLoading(false);
      if (window.innerWidth >= 500) inputRef.current?.focus();
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="page">
        <div className="chat-wrapper">
          <div className="header">
            <div className="header-inner" style={{ position: "relative", paddingRight: "60px" }}>
              <div className="header-emoji">{RESTAURANT.emoji}</div>
              <p className="restaurant-name">{RESTAURANT.name}</p>
              <p className="restaurant-sub">{t.sub}</p>
              <div className="status">
                <div className="status-dot" />
                <span className="status-text">{t.status}</span>
              </div>
              <button className="lang-btn" onClick={toggleLang}>{t.toggle}</button>
            </div>
          </div>

          <div className="messages">
            {messages.map((msg, i) => (
              msg.role === "widget" ? (
                <div key={i} className="bubble assistant" style={{ padding: "6px", maxWidth: "min(300px, 90%)", background: "transparent", border: "none" }}>
                  <ReservationWidget lang={lang} />
                </div>
              ) : (
                <div key={i} className={`bubble ${msg.role}`}>
                  {msg.content}
                </div>
              )
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

          <div className="quick-questions">
            {t.quick.map((q) => (
              <button key={q} className="quick-btn" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>

          <div className="input-area">
            <input
              ref={inputRef}
              className="input-field"
              placeholder={t.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              enterKeyHint="send"
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <div className="powered">POWERED BY <span>CLAUDE AI</span></div>
        </div>
      </div>
    </>
  );
}
