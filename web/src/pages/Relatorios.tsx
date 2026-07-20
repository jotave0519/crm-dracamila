import { useEffect, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface ReportData {
  revenue: number;
  activePatients: number;
  newPatients: number;
  totalSessions: number;
  sessionsByStatus: Record<string, number>;
  topProcedures: { procedure: string; count: number }[];
}

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toIso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function firstDayOfMonth(): string {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
}

const STATUS_LABEL: Record<string, string> = { Agendado: "Agendadas", Confirmado: "Confirmadas", Concluido: "Realizadas", Faltou: "Faltas", Cancelado: "Canceladas" };

export function Relatorios() {
  const isMobile = useIsMobile();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(toIso(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<ReportData>(`/reports?from=${from}&to=${to}`).then(setData).catch((e) => setError(e.message));
  }

  useEffect(load, [from, to]);

  return (
    <div>
      <h1 className="page-title">Relatórios</h1>
      <p className="page-subtitle">Visão geral do período</p>

      <div className="card" style={{ display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 20, maxWidth: 420 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">De</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Até</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {!data && !error && <div className="empty-state">Carregando...</div>}

      {data && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <div className="card">
              <div className="kpi-value">{formatMoney(data.revenue)}</div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Faturamento</div>
            </div>
            <div className="card">
              <div className="kpi-value">{data.activePatients}</div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Pacientes ativos</div>
            </div>
            <div className="card">
              <div className="kpi-value">{data.newPatients}</div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Pacientes novos no período</div>
            </div>
            <div className="card">
              <div className="kpi-value">{data.totalSessions}</div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Sessões no período</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
            <div className="card">
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Sessões por status</div>
              {Object.keys(data.sessionsByStatus).length === 0 && <div className="empty-state">Nenhuma sessão no período.</div>}
              {Object.entries(data.sessionsByStatus).map(([status, count]) => (
                <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: "9px 4px", borderTop: "1px solid var(--border-soft)" }}>
                  <span style={{ fontSize: 13 }}>{STATUS_LABEL[status] || status}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, padding: "18px 18px 4px" }}>Procedimentos mais realizados</div>
              {data.topProcedures.length === 0 ? (
                <div className="empty-state">Nenhum atendimento concluído no período.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Procedimento</th>
                      <th>Sessões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProcedures.map((p) => (
                      <tr key={p.procedure}>
                        <td>{p.procedure}</td>
                        <td>{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
