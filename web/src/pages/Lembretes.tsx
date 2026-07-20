import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface WithoutReturn {
  patientId: string;
  patientName: string;
  phone: string;
  daysSince: number;
}

interface FinishedTreatment {
  planId: string;
  patientId: string;
  patientName: string | null;
  totalSessions: number;
}

interface PendingPayment {
  planId: string;
  patientId: string;
  patientName: string | null;
  pending: number;
}

interface TomorrowSession {
  scheduleId: string;
  patientId: string;
  patientName: string;
  time: string;
  procedure: string;
}

interface RemindersData {
  withoutReturn: WithoutReturn[];
  finishedTreatments: FinishedTreatment[];
  pendingPayments: PendingPayment[];
  tomorrowSessions: TomorrowSession[];
}

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function Lembretes() {
  const navigate = useNavigate();
  const [data, setData] = useState<RemindersData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<RemindersData>("/reminders").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const sections = [
    {
      title: "Sessão amanhã",
      items: data.tomorrowSessions,
      empty: "Nenhuma sessão amanhã.",
      render: (s: TomorrowSession) => (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.patientName}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {s.time.slice(0, 5)} · {s.procedure}
          </div>
        </>
      ),
      onClick: (s: TomorrowSession) => navigate(`/pacientes/${s.patientId}`),
    },
    {
      title: "Paciente sem retorno",
      items: data.withoutReturn,
      empty: "Nenhum paciente parado.",
      render: (p: WithoutReturn) => (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.patientName}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sem sessão há {p.daysSince} dias</div>
        </>
      ),
      onClick: (p: WithoutReturn) => navigate(`/pacientes/${p.patientId}`),
    },
    {
      title: "Pagamento pendente",
      items: data.pendingPayments,
      empty: "Nenhuma pendência.",
      render: (p: PendingPayment) => (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.patientName || "Paciente"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatMoney(p.pending)} pendente</div>
        </>
      ),
      onClick: (p: PendingPayment) => navigate(`/pacientes/${p.patientId}`),
    },
    {
      title: "Tratamento finalizado",
      items: data.finishedTreatments,
      empty: "Nenhum plano finalizado aguardando revisão.",
      render: (p: FinishedTreatment) => (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.patientName || "Paciente"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Completou as {p.totalSessions} sessões contratadas</div>
        </>
      ),
      onClick: (p: FinishedTreatment) => navigate(`/pacientes/${p.patientId}`),
    },
  ];

  return (
    <div>
      <h1 className="page-title">Lembretes</h1>
      <p className="page-subtitle">Coisas pra ficar de olho hoje</p>

      <div style={{ display: "grid", gap: 20 }}>
        {sections.map((section) => (
          <div key={section.title}>
            <div style={{ fontSize: 14.5, fontWeight: 600, margin: "8px 0 10px" }}>
              {section.title} {section.items.length > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({section.items.length})</span>}
            </div>
            {section.items.length === 0 ? (
              <div className="empty-state">{section.empty}</div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {section.items.map((item: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => section.onClick(item)}
                    style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                  >
                    {section.render(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
