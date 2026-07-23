import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { api } from "../lib/api";

interface StatusData {
  configured: boolean;
  connectionStatus: string;
  phone: string | null;
  profileName: string | null;
  connectedSince: string | null;
  activeConversations: number;
}

function statusLabel(status: StatusData | null): string {
  if (!status) return "...";
  if (!status.configured) return "Não configurado";
  if (status.connectionStatus === "open") return "Online";
  if (status.connectionStatus === "connecting") return "Conectando";
  return "Offline";
}

function statusBadgeClass(status: StatusData | null): string {
  if (!status || !status.configured) return "badge-neutral";
  if (status.connectionStatus === "open") return "badge-green";
  if (status.connectionStatus === "connecting") return "badge-blue";
  return "badge-red";
}

export function WhatsappIA() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [qr, setQr] = useState<{ base64: string | null } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadStatus() {
    api.get<StatusData>("/whatsapp/status").then(setStatus).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleGenerateQr() {
    setLoadingQr(true);
    setError(null);
    try {
      const r = await api.get<{ base64: string | null }>("/whatsapp/qrcode");
      setQr(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingQr(false);
    }
  }

  async function handleReconnect() {
    setReconnecting(true);
    setError(null);
    try {
      await api.post("/whatsapp/reconnect", {});
      loadStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setReconnecting(false);
    }
  }

  async function confirmDisconnect() {
    setConfirmingDisconnect(false);
    try {
      await api.post("/whatsapp/disconnect", {});
      setQr(null);
      loadStatus();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const connected = status?.connectionStatus === "open";

  return (
    <div>
      <h1 className="page-title">WhatsApp IA</h1>
      <p className="page-subtitle">Conexão da clínica com o agente de atendimento no WhatsApp</p>

      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Status da conexão</div>
          <span className={`badge ${statusBadgeClass(status)}`}>{statusLabel(status)}</span>
        </div>

        {status && !status.configured && (
          <div className="empty-state" style={{ textAlign: "left", padding: "16px 0" }}>
            A Evolution API ainda não está configurada neste ambiente (faltam as variáveis EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME). Configure-as e reinicie o serviço para conectar o WhatsApp.
          </div>
        )}

        {status?.configured && connected && (
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span style={{ color: "var(--text-muted)" }}>Número conectado</span>
              <span style={{ fontWeight: 500 }}>{status.phone ? `+${status.phone}` : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span style={{ color: "var(--text-muted)" }}>Nome da conta</span>
              <span style={{ fontWeight: 500 }}>{status.profileName || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span style={{ color: "var(--text-muted)" }}>Conectado desde</span>
              <span style={{ fontWeight: 500 }}>{status.connectedSince ? new Date(status.connectedSince).toLocaleString("pt-BR") : "—"}</span>
            </div>
          </div>
        )}

        {status?.configured && !connected && qr?.base64 && (
          <div style={{ textAlign: "center", margin: "16px 0" }}>
            <img src={qr.base64.startsWith("data:") ? qr.base64 : `data:image/png;base64,${qr.base64}`} alt="QR code" style={{ width: 200, height: 200, borderRadius: 12 }} />
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>Abra o WhatsApp no celular da clínica e escaneie o código.</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {status?.configured && !connected && (
            <button className="btn" onClick={handleGenerateQr} disabled={loadingQr}>
              {loadingQr ? "Gerando..." : qr ? "Gerar novo QR code" : "Conectar WhatsApp"}
            </button>
          )}
          {status?.configured && connected && (
            <button className="btn btn-secondary" onClick={() => setConfirmingDisconnect(true)}>
              Desconectar
            </button>
          )}
          {status?.configured && (
            <button className="btn btn-secondary" onClick={handleReconnect} disabled={reconnecting}>
              {reconnecting ? "Reconectando..." : "Reconectar"}
            </button>
          )}
          {status?.configured && (
            <button className="btn btn-secondary" onClick={loadStatus}>
              Atualizar sessão
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDisconnect}
        title="Desconectar WhatsApp?"
        message="A clínica para de receber e responder mensagens pelo WhatsApp até reconectar."
        confirmLabel="Desconectar"
        onConfirm={confirmDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}
