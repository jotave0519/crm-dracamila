import { ReactNode, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { api } from "../lib/api";

interface AiSettings {
  master_enabled: boolean;
  greeting_enabled: boolean;
  confirmation_enabled: boolean;
  confirmation_hours_before: number[];
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  away_enabled: boolean;
  away_first_minutes: number;
  away_first_message: string;
  away_second_minutes: number;
  away_second_message: string;
  business_hours_only_enabled: boolean;
  business_hours_message: string;
  human_handoff_enabled: boolean;
  reactivation_enabled: boolean;
  reactivation_days_threshold: number;
  reactivation_message: string;
  waitlist_enabled: boolean;
  post_session_enabled: boolean;
  post_session_hours_after: number;
  post_session_message: string;
  pre_anamnesis_enabled: boolean;
  scheduling_enabled: boolean;
  cancellation_enabled: boolean;
  rescheduling_enabled: boolean;
  notifications_enabled: boolean;
}

interface StatusData {
  whatsappConfigured: boolean;
  whatsappConnected: boolean;
  whatsappConnectedSince: string | null;
  googleCalendarConfigured: boolean;
  messagesToday: number;
  patientsAttendedToday: number;
  appointmentsToday: number;
  cancellationsToday: number;
  reschedulesToday: number;
}

function ComingSoonBadge() {
  return (
    <span className="badge badge-neutral" style={{ fontSize: 10.5, marginLeft: 8, verticalAlign: 1 }}>
      Em breve
    </span>
  );
}

function Block({
  title,
  desc,
  enabled,
  onToggle,
  comingSoon,
  noSwitch,
  children,
}: {
  title: string;
  desc: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  comingSoon?: boolean;
  noSwitch?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 0, marginBottom: 14 }}>
      <div className="toggle-card">
        <div style={{ flex: 1 }}>
          <div className="toggle-card-title">
            {title}
            {comingSoon && <ComingSoonBadge />}
          </div>
          <div className="toggle-card-desc">{desc}</div>
        </div>
        {!noSwitch && (
          <label className="switch">
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle?.(e.target.checked)} />
            <span className="switch-track" />
          </label>
        )}
      </div>
      {(noSwitch || enabled) && children && <div style={{ padding: "0 18px 18px" }}>{children}</div>}
    </div>
  );
}

function ChipSelect<T extends number>({ value, options, labels, onChange }: { value: T; options: T[]; labels: string[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt, i) => (
        <button key={opt} type="button" className={`chip${value === opt ? " active" : ""}`} onClick={() => onChange(opt)}>
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

function ChipMultiSelect({ value, options, labels, onChange }: { value: number[]; options: number[]; labels: string[]; onChange: (v: number[]) => void }) {
  function toggle(opt: number) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt].sort((a, b) => b - a));
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt, i) => (
        <button key={opt} type="button" className={`chip${value.includes(opt) ? " active" : ""}`} onClick={() => toggle(opt)}>
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="field-label" style={{ marginTop: 12, display: "block" }}>{children}</label>;
}

export function AssistenteIA() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignPreview, setCampaignPreview] = useState<number | null>(null);
  const [confirmingCampaign, setConfirmingCampaign] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [campaignResult, setCampaignResult] = useState<string | null>(null);

  function load() {
    api.get<AiSettings>("/ai-settings").then(setSettings).catch((e) => setError(e.message));
    api.get<StatusData>("/ai-settings/status").then(setStatus).catch(() => {});
  }

  useEffect(load, []);

  function patch(fields: Partial<AiSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...fields } : prev));
    api.patch("/ai-settings", fields).catch((e) => setError(e.message));
  }

  async function handleOpenCampaignConfirm() {
    setError(null);
    try {
      const preview = await api.get<{ count: number }>("/ai-settings/reactivation-campaign/preview");
      setCampaignPreview(preview.count);
      setConfirmingCampaign(true);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSendCampaign() {
    setConfirmingCampaign(false);
    setSendingCampaign(true);
    setCampaignResult(null);
    try {
      const result = await api.post<{ sent: number; failed: number }>("/ai-settings/reactivation-campaign/send", {});
      setCampaignResult(`Campanha enviada para ${result.sent} paciente${result.sent === 1 ? "" : "s"}${result.failed > 0 ? ` (${result.failed} falharam)` : ""}.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSendingCampaign(false);
    }
  }

  if (!settings) return <div className="empty-state">Carregando...</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="page-title">Assistente IA</h1>
      <p className="page-subtitle">Ligue, desligue e ajuste o que a IA faz no WhatsApp — sem mexer em código.</p>

      {error && <div className="error-text">{error}</div>}

      <Block title="Atendimento Automático" desc="A IA responde sozinha no WhatsApp." enabled={settings.master_enabled} onToggle={(v) => patch({ master_enabled: v })} />
      {!settings.master_enabled && (
        <div className="card" style={{ marginBottom: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
          A IA está desativada. As mensagens deverão ser respondidas manualmente.
        </div>
      )}

      <Block title="Saudação automática" desc="Enviar mensagem de boas-vindas no primeiro contato." enabled={settings.greeting_enabled} onToggle={(v) => patch({ greeting_enabled: v })} />

      <Block
        title="Confirmação de consultas"
        desc="Enviar confirmação automática antes da sessão."
        enabled={settings.confirmation_enabled}
        onToggle={(v) => patch({ confirmation_enabled: v })}
        comingSoon
      >
        <FieldLabel>Enviar confirmação</FieldLabel>
        <ChipMultiSelect
          value={settings.confirmation_hours_before}
          options={[24, 12, 6, 1]}
          labels={["24 horas antes", "12 horas antes", "6 horas antes", "1 hora antes"]}
          onChange={(v) => patch({ confirmation_hours_before: v })}
        />
      </Block>

      <Block title="Lembrete da consulta" desc="Enviar lembrete antes da consulta." enabled={settings.reminder_enabled} onToggle={(v) => patch({ reminder_enabled: v })} comingSoon>
        <FieldLabel>Enviar lembrete</FieldLabel>
        <ChipSelect value={settings.reminder_minutes_before} options={[30, 60, 120, 180]} labels={["30 min antes", "1 hora antes", "2 horas antes", "3 horas antes"]} onChange={(v) => patch({ reminder_minutes_before: v })} />
      </Block>

      <Block title="Mensagens de ausência" desc="Retomar contato quando o paciente para de responder." enabled={settings.away_enabled} onToggle={(v) => patch({ away_enabled: v })} comingSoon>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Primeira mensagem</div>
        <FieldLabel>Enviar após (minutos sem resposta)</FieldLabel>
        <input className="input" type="number" min={1} style={{ width: 100 }} value={settings.away_first_minutes} onChange={(e) => patch({ away_first_minutes: Number(e.target.value) })} />
        <FieldLabel>Mensagem</FieldLabel>
        <textarea className="input" rows={3} value={settings.away_first_message} onBlur={(e) => patch({ away_first_message: e.target.value })} onChange={(e) => setSettings({ ...settings, away_first_message: e.target.value })} />

        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 18 }}>Segunda mensagem</div>
        <FieldLabel>Enviar após mais (minutos)</FieldLabel>
        <input className="input" type="number" min={1} style={{ width: 100 }} value={settings.away_second_minutes} onChange={(e) => patch({ away_second_minutes: Number(e.target.value) })} />
        <FieldLabel>Mensagem</FieldLabel>
        <textarea className="input" rows={3} value={settings.away_second_message} onBlur={(e) => patch({ away_second_message: e.target.value })} onChange={(e) => setSettings({ ...settings, away_second_message: e.target.value })} />
      </Block>

      <Block
        title="Horário de atendimento"
        desc="Responder apenas durante o horário comercial cadastrado."
        enabled={settings.business_hours_only_enabled}
        onToggle={(v) => patch({ business_hours_only_enabled: v })}
      >
        <FieldLabel>Mensagem fora do horário</FieldLabel>
        <textarea
          className="input"
          rows={3}
          value={settings.business_hours_message}
          onBlur={(e) => patch({ business_hours_message: e.target.value })}
          onChange={(e) => setSettings({ ...settings, business_hours_message: e.target.value })}
        />
      </Block>

      <Block title="Transferência para humano" desc='Permitir que o paciente peça para falar com alguém da equipe.' enabled={settings.human_handoff_enabled} onToggle={(v) => patch({ human_handoff_enabled: v })} />

      <Block
        title="Reativação de pacientes"
        desc="Enviar mensagem para pacientes que não retornam há um tempo."
        enabled={settings.reactivation_enabled}
        onToggle={(v) => patch({ reactivation_enabled: v })}
      >
        <FieldLabel>Paciente sem retornar há</FieldLabel>
        <ChipSelect value={settings.reactivation_days_threshold} options={[30, 45, 60, 90]} labels={["30 dias", "45 dias", "60 dias", "90 dias"]} onChange={(v) => patch({ reactivation_days_threshold: v })} />
        <FieldLabel>Mensagem</FieldLabel>
        <textarea
          className="input"
          rows={3}
          value={settings.reactivation_message}
          onBlur={(e) => patch({ reactivation_message: e.target.value })}
          onChange={(e) => setSettings({ ...settings, reactivation_message: e.target.value })}
        />
        <button className="btn" style={{ marginTop: 12 }} onClick={handleOpenCampaignConfirm} disabled={sendingCampaign}>
          {sendingCampaign ? "Enviando..." : "Enviar campanha agora"}
        </button>
        {campaignResult && <div style={{ fontSize: 12.5, color: "var(--green)", marginTop: 8 }}>{campaignResult}</div>}
      </Block>

      <Block title="Lista de espera" desc="Oferecer horários vagos automaticamente quando alguém cancelar." enabled={settings.waitlist_enabled} onToggle={(v) => patch({ waitlist_enabled: v })} comingSoon />

      <Block title="Pós-atendimento" desc="Perguntar como o paciente está depois da sessão." enabled={settings.post_session_enabled} onToggle={(v) => patch({ post_session_enabled: v })} comingSoon>
        <FieldLabel>Enviar após</FieldLabel>
        <ChipSelect value={settings.post_session_hours_after} options={[2, 6, 24]} labels={["2 horas", "6 horas", "24 horas"]} onChange={(v) => patch({ post_session_hours_after: v })} />
        <FieldLabel>Mensagem</FieldLabel>
        <textarea
          className="input"
          rows={3}
          value={settings.post_session_message}
          onBlur={(e) => patch({ post_session_message: e.target.value })}
          onChange={(e) => setSettings({ ...settings, post_session_message: e.target.value })}
        />
      </Block>

      <Block title="Anamnese automática" desc="A IA coleta informações antes da primeira consulta." enabled={settings.pre_anamnesis_enabled} onToggle={(v) => patch({ pre_anamnesis_enabled: v })} comingSoon />

      <Block title="Agenda Inteligente" desc="Permitir que a IA agende sessões, consultando CRM e Google Calendar." enabled={settings.scheduling_enabled} onToggle={(v) => patch({ scheduling_enabled: v })} />

      <Block title="Cancelamentos" desc="Permitir cancelamento de sessão pelo WhatsApp." enabled={settings.cancellation_enabled} onToggle={(v) => patch({ cancellation_enabled: v })} />

      <Block title="Remarcações" desc="Permitir remarcação de sessão pelo WhatsApp." enabled={settings.rescheduling_enabled} onToggle={(v) => patch({ rescheduling_enabled: v })} />

      <Block title="Notificações da clínica" desc="Avisar dentro do CRM sobre eventos importantes (novo paciente, cancelamento, etc)." enabled={settings.notifications_enabled} onToggle={(v) => patch({ notifications_enabled: v })} comingSoon />

      <Block title="Inteligência" desc="Status atual do assistente — apenas para visualização." noSwitch>
        {status ? (
          <div style={{ display: "grid", gap: 10 }}>
            <StatusRow label="IA" value={settings.master_enabled ? "Online" : "Desativada"} />
            <StatusRow label="WhatsApp" value={!status.whatsappConfigured ? "Não configurado" : status.whatsappConnected ? "Conectado" : "Desconectado"} />
            {status.whatsappConnectedSince && <StatusRow label="Conectado desde" value={new Date(status.whatsappConnectedSince).toLocaleString("pt-BR")} />}
            <StatusRow label="Google Calendar" value={status.googleCalendarConfigured ? "Configurado" : "Não configurado"} />
            <StatusRow label="Mensagens hoje" value={String(status.messagesToday)} />
            <StatusRow label="Pacientes atendidos hoje" value={String(status.patientsAttendedToday)} />
            <StatusRow label="Agendamentos hoje" value={String(status.appointmentsToday)} />
            <StatusRow label="Remarcações hoje" value={String(status.reschedulesToday)} />
            <StatusRow label="Cancelamentos hoje" value={String(status.cancellationsToday)} />
          </div>
        ) : (
          <div className="empty-state">Carregando...</div>
        )}
      </Block>

      <ConfirmDialog
        open={confirmingCampaign}
        title="Enviar campanha de reativação?"
        message={`Isso vai enviar mensagem agora para ${campaignPreview ?? 0} paciente${campaignPreview === 1 ? "" : "s"}.`}
        confirmLabel="Enviar"
        danger={false}
        onConfirm={handleSendCampaign}
        onCancel={() => setConfirmingCampaign(false)}
      />
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
