import { ChatCircleDots, CircleNotch, PaperPlaneTilt, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

const STORAGE_KEY = "chuang_baiye_ai_chat";
const MAX_HISTORY_MESSAGES = 10;
const WORKER_URL = String(
  import.meta.env.VITE_AI_CHAT_URL ||
    import.meta.env.VITE_PLATFORM_API_URL ||
    "https://chuang-baiye-ai.baiye-platform.workers.dev",
).replace(/\/$/, "");
const WELCOME_MESSAGE = "您好，我是創百業智慧鏈 AI 智能客服，有網站建置、LINE 整合或數位升級相關問題都可以問我。";

function readHistory(): ChatMessage[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [{ role: "assistant", content: WELCOME_MESSAGE }];
    const valid = parsed
      .filter((item): item is ChatMessage =>
        item && (item.role === "assistant" || item.role === "user") && typeof item.content === "string",
      )
      .slice(-MAX_HISTORY_MESSAGES);
    return valid.length ? valid : [{ role: "assistant", content: WELCOME_MESSAGE }];
  } catch {
    return [{ role: "assistant", content: WELCOME_MESSAGE }];
  }
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(readHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY_MESSAGES)));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  const clearConversation = () => {
    const next = [{ role: "assistant" as const, content: WELCOME_MESSAGE }];
    window.localStorage.removeItem(STORAGE_KEY);
    setMessages(next);
    setError("");
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    if (!WORKER_URL) {
      setError("AI 客服服務正在設定中，請稍後再試或透過 LINE 聯絡我們。");
      return;
    }

    const history = messages.slice(-MAX_HISTORY_MESSAGES);
    const nextMessages = [...messages, { role: "user" as const, content: message }].slice(-MAX_HISTORY_MESSAGES);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object" || !("reply" in payload) || typeof payload.reply !== "string") {
        throw new Error("AI service request failed");
      }
      const reply = (payload as { reply: string }).reply;
      const assistantMessage: ChatMessage = { role: "assistant", content: reply };
      setMessages((current) => [...current, assistantMessage].slice(-MAX_HISTORY_MESSAGES));
    } catch {
      setError("目前無法取得 AI 回覆，請稍後再試或透過 LINE 聯絡我們。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="ai-chat" aria-label="AI 智能客服">
      {open && (
        <section className="ai-chat-panel" aria-label="創百業智慧鏈 AI 客服對話視窗">
          <header className="ai-chat-header">
            <span className="ai-chat-header-mark"><ChatCircleDots weight="fill" /></span>
            <div className="ai-chat-heading">
              <strong>創百業智慧鏈 AI 客服</strong>
              <small>網站建置與數位升級諮詢</small>
            </div>
            <button type="button" className="ai-chat-icon-button" onClick={() => setOpen(false)} aria-label="關閉 AI 客服">
              <X />
            </button>
          </header>
          <div className="ai-chat-messages" aria-live="polite">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}-${item.content.slice(0, 16)}`} className={`ai-chat-message ${item.role}`}>
                {item.content}
              </div>
            ))}
            {loading && <div className="ai-chat-loading"><CircleNotch /> AI 正在整理回覆...</div>}
            <div ref={messagesEndRef} />
          </div>
          {error && <p className="ai-chat-error" role="alert">{error}</p>}
          <div className="ai-chat-controls">
            <button type="button" className="ai-chat-clear" onClick={clearConversation}>
              <Trash /> 清除對話
            </button>
          </div>
          <form className="ai-chat-form" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="輸入您的問題..."
              aria-label="輸入問題"
              rows={1}
              maxLength={1000}
              disabled={loading}
            />
            <button type="submit" className="ai-chat-send" aria-label="傳送訊息" disabled={loading || !input.trim()}>
              {loading ? <CircleNotch /> : <PaperPlaneTilt weight="fill" />}
            </button>
          </form>
        </section>
      )}
      <button type="button" className="ai-chat-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ChatCircleDots weight="fill" /> AI 智能客服
      </button>
    </aside>
  );
}
