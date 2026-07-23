import { CSSProperties, ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonthlyBarChart } from "../components/MonthlyBarChart";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

const REFRESH_INTERVAL_MS = 60_000;

interface ChartMonth {
  month: string;
  value: number;
}

interface DashboardData {
  kpis: {
    sessionsToday: number;
    sessionsThisWeek: number;
    activePatients: number;
    sessionsThisMonth: number;
    revenueThisMonth: number;
    expensesThisMonth: number;
    profitThisMonth: number;
    newPatientsThisMonth: number;
    patientsInTreatment: number;
    lowStockCount: number;
    birthdaysThisMonthCount: number;
    patientsCompletedTreatment: number;
    patientsWithoutReturnCount: number;
    patientsNearingDischarge: number;
  };
  nextAppointment: { id: string; patient_name: string; procedure: string; date: string; time: string; status: string } | null;
  todayAppointments: { id: string; patient_name: string; procedure: string; time: string; status: string }[];
  recentSessions: { id: string; patient_name: string; procedure: string; date: string; time: string }[];
  upcomingReturns: { id: string; patient_name: string; procedure: string; date: string; time: string }[];
  birthdays: { id: string; name: string; day: number }[];
  patientsWithoutReturn: { patientId: string; patientName: string; phone: string; daysSince: number }[];
  packagesEndingSoon: { planId: string; patientId: string; patientName: string | null; sessionsRemaining: number }[];
  charts: {
    revenueByMonth: ChartMonth[];
    sessionsByMonth: ChartMonth[];
    newPatientsByMonth: ChartMonth[];
    topTreatmentTypes: { procedure: string; count: number }[];
  };
}

interface RemindersData {
  withoutReturn: unknown[];
  finishedTreatments: unknown[];
  pendingPayments: unknown[];
  tomorrowSessions: unknown[];
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

function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
}

interface KpiItem {
  label: string;
  value: string;
  color?: string;
  onClick?: () => void;
}

function KpiGroup({ title, accent, items }: { title: string; accent: string; items: KpiItem[] }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: accent, display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</span>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        {items.map((it) =>
          it.onClick ? (
            <button key={it.label} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={it.onClick}>
              <div className="kpi-value" style={it.color ? { color: it.color } : undefined}>
                {it.value}
              </div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>
                {it.label}
              </div>
            </button>
          ) : (
            <div key={it.label} className="card">
              <div className="kpi-value" style={it.color ? { color: it.color } : undefined}>
                {it.value}
              </div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>
                {it.label}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ListCard({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: ReactNode }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        {onSeeAll && (
          <button style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }} onClick={onSeeAll}>
            Ver mais
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function TreatmentTypesList({ data }: { data: { procedure: string; count: number }[] }) {
  if (data.length === 0) return <div className="empty-state">Nenhum atendimento concluído este mês.</div>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {data.map((d) => (
        <div key={d.procedure}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
            <span>{d.procedure}</span>
            <span style={{ color: "var(--text-muted)" }}>{d.count}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--border-soft)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.count / max) * 100}%`, borderRadius: 3, background: "var(--accent)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState<DashboardData | null>(null);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function loadDashboard() {
      api.get<DashboardData>("/dashboard").then(setData).catch((e) => setError(e.message));
    }
    function loadReminders() {
      api
        .get<RemindersData>("/reminders")
        .then((r) => setReminderCount(r.withoutReturn.length + r.finishedTreatments.length + r.pendingPayments.length + r.tomorrowSessions.length))
        .catch(() => {});
    }
    loadDashboard();
    loadReminders();
    const interval = setInterval(() => {
      loadDashboard();
      loadReminders();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function handleContact(patientId: string) {
    try {
      const r = await api.post<{ id: string }>(`/patients/${patientId}/conversations/ensure`, {});
      navigate(`/conversas?id=${r.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const name = session?.user.email?.split("@")[0] || "";
  const listGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 };
  const chartGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 };

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

      <KpiGroup
        title="Atendimento"
        accent="var(--accent)"
        items={[
          { label: "Sessões hoje", value: String(data.kpis.sessionsToday) },
          { label: "Sessões na semana", value: String(data.kpis.sessionsThisWeek) },
          { label: "Sessões no mês", value: String(data.kpis.sessionsThisMonth) },
        ]}
      />

      <KpiGroup
        title="Pacientes"
        accent="var(--green)"
        items={[
          { label: "Ativos", value: String(data.kpis.activePatients) },
          { label: "Em tratamento", value: String(data.kpis.patientsInTreatment) },
          { label: "Novos no mês", value: String(data.kpis.newPatientsThisMonth) },
          { label: "Aniversariantes no mês", value: String(data.kpis.birthdaysThisMonthCount) },
          { label: "Concluíram tratamento", value: String(data.kpis.patientsCompletedTreatment), onClick: () => navigate("/pacientes") },
          {
            label: "Sem retorno",
            value: String(data.kpis.patientsWithoutReturnCount),
            color: data.kpis.patientsWithoutReturnCount > 0 ? "var(--red)" : undefined,
            onClick: () => navigate("/lembretes"),
          },
          { label: "Próximos da alta", value: String(data.kpis.patientsNearingDischarge), onClick: () => navigate("/pacientes") },
        ]}
      />

      <KpiGroup
        title="Financeiro do mês"
        accent="var(--green)"
        items={[
          { label: "Receita", value: formatMoney(data.kpis.revenueThisMonth) },
          { label: "Despesas", value: formatMoney(data.kpis.expensesThisMonth) },
          { label: "Lucro", value: formatMoney(data.kpis.profitThisMonth), color: data.kpis.profitThisMonth < 0 ? "var(--red)" : "var(--green)" },
        ]}
      />

      <KpiGroup
        title="Estoque"
        accent="var(--red)"
        items={[
          {
            label: "Produtos com estoque baixo",
            value: String(data.kpis.lowStockCount),
            color: data.kpis.lowStockCount > 0 ? "var(--red)" : undefined,
            onClick: () => navigate("/estoque"),
          },
        ]}
      />

      <div style={listGridStyle}>
        <ListCard title="Agenda de hoje" onSeeAll={() => navigate("/agenda")}>
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
        </ListCard>

        <ListCard title="Últimos atendimentos" onSeeAll={() => navigate("/agenda")}>
          {data.recentSessions.length === 0 && <div className="empty-state">Nenhum atendimento realizado ainda.</div>}
          {data.recentSessions.map((s) => (
            <div key={s.id} style={{ padding: "11px 4px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.patient_name}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(`${s.date}T12:00:00`).toLocaleDateString("pt-BR")}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.procedure}</div>
            </div>
          ))}
        </ListCard>

        <ListCard title="Próximos retornos" onSeeAll={() => navigate("/agenda")}>
          {data.upcomingReturns.length === 0 && <div className="empty-state">Nenhum retorno agendado.</div>}
          {data.upcomingReturns.map((s) => (
            <div key={s.id} style={{ padding: "11px 4px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.patient_name}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {formatShortDate(s.date)} · {s.time.slice(0, 5)}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.procedure}</div>
            </div>
          ))}
        </ListCard>

        <ListCard title="Aniversariantes do mês" onSeeAll={() => navigate("/pacientes")}>
          {data.birthdays.length === 0 && <div className="empty-state">Nenhum aniversariante este mês.</div>}
          {data.birthdays.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 6px", borderTop: "1px solid var(--border-soft)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{b.name}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>dia {String(b.day).padStart(2, "0")}</span>
            </div>
          ))}
        </ListCard>

        <ListCard title="Pacientes sem retorno" onSeeAll={() => navigate("/lembretes")}>
          {data.patientsWithoutReturn.length === 0 && <div className="empty-state">Todo mundo em dia — ninguém sem retorno.</div>}
          {data.patientsWithoutReturn.map((p) => (
            <div key={p.patientId} style={{ padding: "10px 6px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>⚠ {p.patientName}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Última sessão há {p.daysSince} dias</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => navigate(`/pacientes/${p.patientId}`)}>
                  Ver ficha
                </button>
                <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => handleContact(p.patientId)}>
                  Entrar em contato
                </button>
              </div>
            </div>
          ))}
        </ListCard>

        <ListCard title="Pacotes próximos do fim" onSeeAll={() => navigate("/pacientes")}>
          {data.packagesEndingSoon.length === 0 && <div className="empty-state">Nenhum pacote perto do fim.</div>}
          {data.packagesEndingSoon.map((p) => (
            <div key={p.planId} style={{ padding: "10px 6px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.patientName || "Paciente"}</span>
                <span className={`badge ${p.sessionsRemaining === 1 ? "badge-red" : "badge-yellow"}`}>
                  {p.sessionsRemaining === 1 ? "Última sessão disponível" : `${p.sessionsRemaining} sessões restantes`}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => navigate(`/pacientes/${p.patientId}`)}>
                  Ver ficha
                </button>
                <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => navigate(`/pacientes/${p.patientId}?newPlan=1`)}>
                  Registrar novo pacote
                </button>
              </div>
            </div>
          ))}
        </ListCard>
      </div>

      <div style={chartGridStyle}>
        <ChartCard title="Receita mensal">
          <MonthlyBarChart data={data.charts.revenueByMonth} color="#008300" formatValue={formatMoney} ariaLabel="Receita por mês" />
        </ChartCard>
        <ChartCard title="Sessões por mês">
          <MonthlyBarChart data={data.charts.sessionsByMonth} color="var(--accent)" formatValue={(v) => String(v)} ariaLabel="Sessões concluídas por mês" />
        </ChartCard>
        <ChartCard title="Novos pacientes por mês">
          <MonthlyBarChart data={data.charts.newPatientsByMonth} color="var(--accent)" formatValue={(v) => String(v)} ariaLabel="Novos pacientes por mês" />
        </ChartCard>
        <ChartCard title="Tipos de atendimento mais realizados">
          <TreatmentTypesList data={data.charts.topTreatmentTypes} />
        </ChartCard>
      </div>
    </div>
  );
}
