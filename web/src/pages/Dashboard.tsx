import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface DashboardData {
  kpis: {
    sessionsToday: number;
    activePatients: number;
    sessionsThisMonth: number;
    revenueThisMonth: number;
    newPatientsThisMonth: number;
    patientsInTreatment: number;
  };
  nextAppointment: { id: string; patient_name: string; procedure: string; date: string; time: string; status: string } | null;
  todayAppointments: { id: string; patient_name: string; procedure: string; time: string; status: string }[];
  recentSessions: { id: string; patient_name: string; procedure: string; date: string; time: string; evolution_note: string | null }[];
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface RemindersData {
  withoutReturn: unknown[];
  finishedTreatments: unknown[];
  pendingPayments: unknown[];
  tomorrowSessions: unknown[];
}

export function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setData).catch((e) => setError(e.message));
    api
      .get<RemindersData>("/reminders")
      .then((r) => setReminderCount(r.withoutReturn.length + r.finishedTreatments.length + r.pendingPayments.length + r.tomorrowSessions.length))
      .catch(() => {});
  }, []);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const name = session?.user.email?.split("@")[0] || "";

  return (
    <div>
      <h1 className="page-title">
        {greeting()}, <span style={{ fontStyle: "italic" }}>{name}</span>
      </h1>
      <p className="page-subtitle">
        {data.nextAppointment ? (
          <>
            Próximo atendimento: <strong style={{ color: "var(--text)" }}>{data.nextAppointment.patient_name}</strong> às{" "}
            <strong style={{ color: "var(--text)" }}>{data.nextAppointment.time.slice(0, 5)}</strong>
            {data.nextAppointment.date !== new Date().toLocaleDateString("en-CA") && " (outro dia)"}
          </>
        ) : (
          "Nenhum atendimento futuro agendado."
        )}
      </p>

      {reminderCount !== null && reminderCount > 0 && (
        <button
          className="card"
          onClick={() => navigate("/lembretes")}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 18, textAlign: "left" }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>
            Você tem <strong>{reminderCount}</strong> lembrete{reminderCount > 1 ? "s" : ""} pra hoje
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }}>Ver lembretes</span>
        </button>
      )}

      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-value">{data.kpis.sessionsToday}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Sessões hoje</div>
        </div>
        <div className="card">
          <div className="kpi-value">{data.kpis.activePatients}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Pacientes ativos</div>
        </div>
        <div className="card">
          <div className="kpi-value">{data.kpis.patientsInTreatment}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Pacientes em tratamento</div>
        </div>
        <div className="card">
          <div className="kpi-value">{data.kpis.newPatientsThisMonth}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Pacientes novos (mês)</div>
        </div>
        <div className="card">
          <div className="kpi-value">{data.kpis.sessionsThisMonth}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Sessões realizadas (mês)</div>
        </div>
        <div className="card">
          <div className="kpi-value">{formatMoney(data.kpis.revenueThisMonth)}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Receita do mês (estimada)</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Agenda de hoje</div>
            <button style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }} onClick={() => navigate("/agenda")}>
              Ver agenda
            </button>
          </div>
          {data.todayAppointments.length === 0 && <div className="empty-state">Nenhuma sessão para hoje.</div>}
          {data.todayAppointments.map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 13, padding: "9px 6px", alignItems: "center" }}>
              <div style={{ textAlign: "right", width: 46, flex: "0 0 46px", fontSize: 13, fontWeight: 600 }}>{a.time.slice(0, 5)}</div>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: "var(--accent)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.patient_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.procedure}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Últimos atendimentos</div>
            <button style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }} onClick={() => navigate("/agenda")}>
              Ver agenda
            </button>
          </div>
          {data.recentSessions.length === 0 && <div className="empty-state">Nenhum atendimento realizado ainda.</div>}
          {data.recentSessions.map((s) => (
            <div key={s.id} style={{ padding: "11px 4px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.patient_name}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(`${s.date}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.procedure}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
