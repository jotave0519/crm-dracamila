import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangleIcon, BellIcon, ChevronDownIcon, ChevronRightIcon, TrendingDownIcon, TrendingUpIcon } from "../components/icons";
import { MonthlyBarChart } from "../components/MonthlyBarChart";
import { RevenueAreaChart } from "../components/RevenueAreaChart";
import { SkeletonKpiGrid } from "../components/Skeleton";
import { useClinic } from "../context/ClinicContext";
import { useCountUp } from "../hooks/useCountUp";
import { useSessionCache } from "../hooks/useSessionCache";
import { api } from "../lib/api";

const REFRESH_INTERVAL_MS = 60_000;

interface ChartMonth {
  month: string;
  value: number;
}

interface DashboardData {
  kpis: {
    sessionsToday: number;
    revenueThisMonth: number;
    revenueToday: number;
    expensesThisMonth: number;
    profitThisMonth: number;
    lowStockCount: number;
    patientsWithoutReturnCount: number;
    patientsNearingDischarge: number;
  };
  nextAppointment: { id: string; patient_name: string; procedure: string; date: string; time: string; status: string } | null;
  todayAppointments: { id: string; patient_id: string; patient_name: string; procedure: string; time: string; status: string }[];
  recentSessions: { id: string; patient_name: string; procedure: string; date: string; time: string }[];
  upcomingReturns: { id: string; patient_name: string; procedure: string; date: string; time: string }[];
  patientsWithoutReturn: { patientId: string; patientName: string; phone: string; daysSince: number }[];
  packagesEndingSoon: { planId: string; patientId: string; patientName: string | null; sessionsRemaining: number }[];
  charts: {
    revenueByMonth: ChartMonth[];
  };
}

/**
 * Indicadores historicos (6 meses) que so aparecem dentro do card colapsavel
 * "Resumo da Clinica" - buscados sob demanda so quando esse card e expandido,
 * em vez de sempre junto com o /dashboard (ver getDashboardSummary no backend).
 */
interface DashboardSummaryData {
  kpis: {
    sessionsThisWeek: number;
    sessionsThisMonth: number;
    activePatients: number;
    newPatientsThisMonth: number;
    patientsInTreatment: number;
    birthdaysThisMonthCount: number;
    patientsCompletedTreatment: number;
  };
  birthdays: { id: string; name: string; day: number }[];
  charts: {
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

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
}

function contextualSubtitle(data: DashboardData): string {
  const todayCount = data.todayAppointments.length;
  if (todayCount === 0) return "Nenhum atendimento hoje.";
  const remaining = data.todayAppointments.filter((a) => a.status === "Agendado" || a.status === "Confirmado");
  if (remaining.length === 0) return "Nenhum atendimento restante hoje.";
  const plural = todayCount > 1 ? "s" : "";
  if (data.nextAppointment) {
    return `Você possui ${todayCount} atendimento${plural} hoje — próximo às ${data.nextAppointment.time.slice(0, 5)}.`;
  }
  return `Você possui ${todayCount} atendimento${plural} hoje.`;
}

interface KpiItem {
  label: string;
  value: string;
  color?: string;
  onClick?: () => void;
}

function KpiGroup({ title, accent, items }: { title: string; accent: string; items: KpiItem[] }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: accent, display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</span>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        {items.map((it) => {
          const inner = (
            <>
              <div className="kpi-label">{it.label}</div>
              <div className="kpi-value" style={it.color ? { color: it.color } : undefined}>
                {it.value}
              </div>
            </>
          );
          return it.onClick ? (
            <button key={it.label} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={it.onClick}>
              {inner}
            </button>
          ) : (
            <div key={it.label} className="card">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HighlightCard({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="card" onClick={onClick} style={{ textAlign: "left", cursor: onClick ? "pointer" : undefined, padding: "20px 18px" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      )}
    </Tag>
  );
}

/** Rotulo de secao (caption discreto) que dá ritmo/hierarquia ao dashboard. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-caption" style={{ margin: "4px 2px 10px" }}>
      {children}
    </div>
  );
}

/** Card de destaque do faturamento: numero grande + tendencia + grafico de area. */
function RevenueHeroCard({ current, byMonth }: { current: number; byMonth: ChartMonth[] }) {
  const prev = byMonth.length >= 2 ? byMonth[byMonth.length - 2].value : 0;
  const last = byMonth.length >= 1 ? byMonth[byMonth.length - 1].value : current;
  const delta = prev > 0 ? ((last - prev) / prev) * 100 : null;
  const up = (delta ?? 0) >= 0;

  return (
    <div className="card" style={{ padding: "20px 18px 8px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="text-caption" style={{ marginBottom: 8 }}>
            Faturamento · últimos 12 meses
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{formatMoney(current)}</div>
        </div>
        {delta !== null && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              marginTop: 4,
              fontSize: 12,
              fontWeight: 600,
              color: up ? "var(--green)" : "var(--red)",
              background: up ? "var(--green-bg)" : "var(--red-bg)",
              padding: "4px 9px",
              borderRadius: 999,
            }}
          >
            {up ? <TrendingUpIcon width={13} height={13} /> : <TrendingDownIcon width={13} height={13} />}
            {up ? "+" : ""}
            {delta.toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <RevenueAreaChart data={byMonth} height={140} formatValue={formatMoney} />
      </div>
    </div>
  );
}

function ListCard({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: ReactNode }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 className="text-h3">{title}</h3>
        {onSeeAll && (
          <button className="link-accent" onClick={onSeeAll}>
            Ver mais <ChevronRightIcon width={13} height={13} />
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
      <h3 className="text-h3" style={{ marginBottom: 12 }}>{title}</h3>
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

function CollapsibleSection({ title, onExpand, children }: { title: string; onExpand?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onExpand?.();
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left" }}
      >
        <span className="text-h3">{title}</span>
        <span className="link-accent">
          {open ? "Ocultar" : "Mostrar indicadores"}
          <ChevronDownIcon width={14} height={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
        </span>
      </button>
      {open && <div style={{ marginTop: 22 }}>{children}</div>}
    </div>
  );
}

export function Dashboard() {
  const { professionalName } = useClinic();
  const navigate = useNavigate();
  // Cache entre navegacoes: ao voltar pra essa tela, mostra o ultimo dado
  // conhecido na hora (em vez de skeleton) enquanto atualiza por tras.
  const [data, setData] = useSessionCache<DashboardData>("dashboard");
  const [reminderCount, setReminderCount] = useSessionCache<number>("dashboard-reminders");
  const [summary, setSummary] = useSessionCache<DashboardSummaryData>("dashboard-summary");
  const [summaryLoading, setSummaryLoading] = useState(false);
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

  // "Resumo da Clinica" fica colapsado por padrao - os indicadores historicos
  // (6 meses) so sao buscados quando a doutora realmente expande o card, em
  // vez de sempre no carregamento inicial (era a consulta mais pesada do
  // dashboard e a maioria das visitas nunca chega a abrir esse card).
  function loadSummary() {
    if (summary || summaryLoading) return;
    setSummaryLoading(true);
    api
      .get<DashboardSummaryData>("/dashboard/summary")
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }

  async function handleContact(patientId: string) {
    try {
      const r = await api.post<{ id: string }>(`/patients/${patientId}/conversations/ensure`, {});
      navigate(`/conversas?id=${r.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const attendedTodayRaw = data ? data.todayAppointments.filter((a) => a.status === "Concluido").length : 0;
  const awaitingConfirmationRaw = data ? data.todayAppointments.filter((a) => a.status === "Agendado").length : 0;
  const revenueTodayRaw = data ? Math.round(data.kpis.revenueToday) : 0;
  const attendedToday = useCountUp(attendedTodayRaw);
  const awaitingConfirmation = useCountUp(awaitingConfirmationRaw);
  const revenueToday = useCountUp(revenueTodayRaw);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) {
    return (
      <div>
        <div className="skeleton skeleton-title" style={{ width: 220, height: 24, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: 300, marginBottom: 24 }} />
        <SkeletonKpiGrid count={8} />
      </div>
    );
  }

  return (
    <div>
      <div className="text-caption" style={{ marginBottom: 6 }}>
        {capitalizeFirst(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }))}
      </div>
      <h1 className="page-title">
        {greeting()}, <span style={{ fontStyle: "italic" }}>{professionalName}</span>
      </h1>
      <p className="page-subtitle">{contextualSubtitle(data)}</p>

      {reminderCount !== null && reminderCount > 0 && (
        <button
          className="card"
          onClick={() => navigate("/lembretes")}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 24, textAlign: "left" }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              flex: "0 0 32px",
              borderRadius: 9,
              background: "var(--accent-bg)",
              color: "var(--accent-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BellIcon width={16} height={16} />
          </span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>
            Você tem <strong>{reminderCount}</strong> lembrete{reminderCount > 1 ? "s" : ""} pra hoje
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
            Ver lembretes <ChevronRightIcon width={14} height={14} />
          </span>
        </button>
      )}

      <SectionLabel>Hoje</SectionLabel>
      <div className="kpi-grid" style={{ gap: 14, marginBottom: 16 }}>
        <HighlightCard label="Atendidos hoje" value={String(attendedToday)} sub={`de ${data.todayAppointments.length} agendados`} />
        <HighlightCard
          label="Próximo atendimento"
          value={data.nextAppointment ? data.nextAppointment.time.slice(0, 5) : "—"}
          sub={data.nextAppointment ? data.nextAppointment.patient_name : "Nenhum agendado"}
        />
        <HighlightCard label="A confirmar" value={String(awaitingConfirmation)} sub="sessões de hoje" />
        <HighlightCard label="Receita do dia" value={formatMoney(revenueToday)} />
      </div>

      <ListCard title="Agenda de hoje" onSeeAll={() => navigate("/agenda")}>
        {data.todayAppointments.length === 0 && <div className="empty-state">Nenhuma sessão para hoje.</div>}
        {data.todayAppointments.map((a) => (
          <div key={a.id} className="dash-appt-row">
            <div style={{ textAlign: "right", width: 44, flex: "0 0 44px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>{a.time.slice(0, 5)}</div>
            <div style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: "var(--accent)" }} />
            <div style={{ flex: "1 1 150px", minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.patient_name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.procedure}</div>
            </div>
            <span
              className={`badge ${a.status === "Concluido" ? "badge-green" : a.status === "Faltou" ? "badge-red" : a.status === "Confirmado" ? "badge-yellow" : "badge-blue"}`}
              style={{ whiteSpace: "nowrap" }}
            >
              {a.status}
            </span>
            <div className="dash-appt-actions">
              <button className="btn-secondary" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => navigate(`/pacientes/${a.patient_id}`)}>
                Ver ficha
              </button>
              <button className="btn-secondary" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => handleContact(a.patient_id)}>
                Iniciar conversa
              </button>
            </div>
          </div>
        ))}
      </ListCard>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>Financeiro</SectionLabel>
        <RevenueHeroCard current={data.kpis.revenueThisMonth} byMonth={data.charts.revenueByMonth} />
        <div className="grid-responsive-3" style={{ gap: 14, marginTop: 14 }}>
          <div className="card">
            <div className="kpi-label">Receita do mês</div>
            <div className="kpi-value">{formatMoney(data.kpis.revenueThisMonth)}</div>
          </div>
          <div className="card">
            <div className="kpi-label">Despesas do mês</div>
            <div className="kpi-value">{formatMoney(data.kpis.expensesThisMonth)}</div>
          </div>
          <div className="card">
            <div className="kpi-label">Lucro do mês</div>
            <div className="kpi-value" style={{ color: data.kpis.profitThisMonth < 0 ? "var(--red)" : "var(--green)" }}>
              {formatMoney(data.kpis.profitThisMonth)}
            </div>
          </div>
        </div>
      </div>

      {data.kpis.lowStockCount > 0 && (
        <button
          className="card"
          onClick={() => navigate("/estoque")}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", marginTop: 14, borderLeft: "3px solid var(--red)" }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              flex: "0 0 32px",
              borderRadius: 9,
              background: "var(--red-bg)",
              color: "var(--red)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangleIcon width={16} height={16} />
          </span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <strong>Estoque</strong> — {data.kpis.lowStockCount} produto{data.kpis.lowStockCount > 1 ? "s" : ""} com estoque baixo
          </span>
          <ChevronRightIcon width={15} height={15} style={{ color: "var(--text-faint)" }} />
        </button>
      )}

      <div style={{ marginTop: 28 }}>
        <SectionLabel>Acompanhamento</SectionLabel>
        <div className="grid-responsive-3" style={{ gap: 14 }}>
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

        <ListCard title="Pacientes sem retorno" onSeeAll={() => navigate("/lembretes")}>
          {data.patientsWithoutReturn.length === 0 && <div className="empty-state">Todo mundo em dia.</div>}
          {data.patientsWithoutReturn.map((p) => (
            <div key={p.patientId} style={{ padding: "10px 4px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", flex: "0 0 6px" }} />
                {p.patientName}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Há {p.daysSince} dias</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => navigate(`/pacientes/${p.patientId}`)}>
                  Ver ficha
                </button>
                <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => handleContact(p.patientId)}>
                  Contato
                </button>
              </div>
            </div>
          ))}
        </ListCard>

        <ListCard title="Pacotes próximos do fim" onSeeAll={() => navigate("/pacientes")}>
          {data.packagesEndingSoon.length === 0 && <div className="empty-state">Nenhum pacote perto do fim.</div>}
          {data.packagesEndingSoon.map((p) => (
            <div key={p.planId} style={{ padding: "10px 4px", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.patientName || "Paciente"}</span>
                <span className={`badge ${p.sessionsRemaining === 1 ? "badge-red" : "badge-yellow"}`}>{p.sessionsRemaining === 1 ? "Última sessão" : `${p.sessionsRemaining} restantes`}</span>
              </div>
              <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 8px", marginTop: 8 }} onClick={() => navigate(`/pacientes/${p.patientId}`)}>
                Ver ficha
              </button>
            </div>
          ))}
          </ListCard>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>Visão geral</SectionLabel>
        <CollapsibleSection title="Resumo da Clínica" onExpand={loadSummary}>
        {!summary ? (
          <SkeletonKpiGrid count={4} />
        ) : (
          <>
            <KpiGroup
              title="Atendimento"
              accent="var(--accent)"
              items={[
                { label: "Sessões na semana", value: String(summary.kpis.sessionsThisWeek) },
                { label: "Sessões no mês", value: String(summary.kpis.sessionsThisMonth) },
              ]}
            />

            <KpiGroup
              title="Pacientes"
              accent="var(--green)"
              items={[
                { label: "Ativos", value: String(summary.kpis.activePatients) },
                { label: "Em tratamento", value: String(summary.kpis.patientsInTreatment) },
                { label: "Novos no mês", value: String(summary.kpis.newPatientsThisMonth) },
                { label: "Aniversariantes no mês", value: String(summary.kpis.birthdaysThisMonthCount) },
                { label: "Concluíram tratamento", value: String(summary.kpis.patientsCompletedTreatment), onClick: () => navigate("/pacientes") },
                {
                  label: "Sem retorno",
                  value: String(data.kpis.patientsWithoutReturnCount),
                  color: data.kpis.patientsWithoutReturnCount > 0 ? "var(--red)" : undefined,
                  onClick: () => navigate("/lembretes"),
                },
                { label: "Próximos da alta", value: String(data.kpis.patientsNearingDischarge), onClick: () => navigate("/pacientes") },
              ]}
            />

            <div className="grid-responsive-3" style={{ gap: 20, marginBottom: 24 }}>
              <ListCard title="Aniversariantes do mês" onSeeAll={() => navigate("/pacientes")}>
                {summary.birthdays.length === 0 && <div className="empty-state">Nenhum aniversariante este mês.</div>}
                {summary.birthdays.map((b) => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 6px", borderTop: "1px solid var(--border-soft)" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{b.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>dia {String(b.day).padStart(2, "0")}</span>
                  </div>
                ))}
              </ListCard>
            </div>

            <div className="grid-responsive-2" style={{ gap: 14 }}>
              <ChartCard title="Sessões por mês">
                <MonthlyBarChart data={summary.charts.sessionsByMonth} color="var(--accent)" formatValue={(v) => String(v)} ariaLabel="Sessões concluídas por mês" />
              </ChartCard>
              <ChartCard title="Novos pacientes por mês">
                <MonthlyBarChart data={summary.charts.newPatientsByMonth} color="var(--accent)" formatValue={(v) => String(v)} ariaLabel="Novos pacientes por mês" />
              </ChartCard>
              <ChartCard title="Tipos de atendimento mais realizados">
                <TreatmentTypesList data={summary.charts.topTreatmentTypes} />
              </ChartCard>
            </div>
          </>
        )}
      </CollapsibleSection>

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
      </div>
    </div>
  );
}
