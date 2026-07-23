import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface ConversationSummary {
  id: string;
  userName: string | null;
  userPhone: string;
  status: "ai" | "human" | "closed";
  lastMessage: string | null;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function Conversas() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadList() {
    api.get<{ items: ConversationSummary[] }>("/conversations").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadList();
  }, []);

  function loadThread(id: string) {
    api
      .get<{ conversation: ConversationSummary; messages: Message[] }>(`/conversations/${id}`)
      .then((r) => {
        setConversation(r.conversation);
        setMessages(r.messages);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    try {
      await api.post(`/conversations/${selectedId}/messages`, { content: draft });
      setDraft("");
      loadThread(selectedId);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleTakeOver() {
    if (!selectedId) return;
    await api.patch(`/conversations/${selectedId}/status`, { status: "human" });
    loadThread(selectedId);
    loadList();
  }

  async function handleReturnToAi() {
    if (!selectedId) return;
    await api.patch(`/conversations/${selectedId}/status`, { status: "ai" });
    loadThread(selectedId);
    loadList();
  }

  async function handleClose() {
    if (!selectedId) return;
    await api.patch(`/conversations/${selectedId}/status`, { status: "closed" });
    loadThread(selectedId);
    loadList();
  }

  const list = (
    <div className="card" style={{ padding: 0, flex: isMobile ? undefined : "0 0 320px" }}>
      {items === null && <div className="empty-state">Carregando...</div>}
      {items?.map((c) => (
        <div key={c.id} className="mobile-list-item" style={{ cursor: "pointer" }} onClick={() => setSelectedId(c.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.userName || c.userPhone}</span>
            <span className={`badge ${c.status === "human" ? "badge-blue" : c.status === "closed" ? "badge-neutral" : "badge-green"}`}>
              {c.status === "human" ? "Humano" : c.status === "closed" ? "Encerrado" : "IA"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || "—"}</div>
        </div>
      ))}
    </div>
  );

  const thread = selectedId && (
    <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>{conversation?.userName || conversation?.userPhone}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {conversation?.status !== "human" && (
            <button className="btn btn-secondary" style={{ height: 32, padding: "0 10px", fontSize: 12 }} onClick={handleTakeOver}>
              Assumir
            </button>
          )}
          {conversation?.status === "human" && (
            <button className="btn btn-secondary" style={{ height: 32, padding: "0 10px", fontSize: 12 }} onClick={handleReturnToAi}>
              Devolver p/ IA
            </button>
          )}
          {conversation?.status !== "closed" && (
            <button className="btn btn-secondary" style={{ height: 32, padding: "0 10px", fontSize: 12 }} onClick={handleClose}>
              Encerrar
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages?.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-start" : "flex-end", maxWidth: "75%", background: m.role === "user" ? "var(--border-soft)" : "var(--accent-bg)", color: m.role === "user" ? "var(--text)" : "var(--accent-dark)", padding: "9px 13px", borderRadius: 12, fontSize: 13.5 }}>
            {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--border-soft)" }}>
        <input className="input" placeholder="Escrever mensagem..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn" type="submit">
          Enviar
        </button>
      </form>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Conversas</h1>
      <p className="page-subtitle">Atendimento via WhatsApp</p>
      {error && <div className="error-text">{error}</div>}

      {isMobile ? (
        selectedId ? (
          <div>
            <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={() => setSelectedId(null)}>
              ← Voltar
            </button>
            {thread}
          </div>
        ) : (
          list
        )
      ) : (
        <div style={{ display: "flex", gap: 16, height: "calc(100vh - 160px)" }}>
          {list}
          {thread || <div className="card" style={{ flex: 1 }}><div className="empty-state">Selecione uma conversa.</div></div>}
        </div>
      )}
    </div>
  );
}
