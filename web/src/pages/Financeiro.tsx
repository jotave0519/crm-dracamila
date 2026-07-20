import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

type TransactionType = "receita" | "despesa";
type TransactionStatus = "Pago" | "Pendente";

interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  category: string;
  patient_id: string | null;
  patientName: string | null;
  payment_method: string;
  transaction_date: string;
  amount: number;
  status: TransactionStatus;
  notes: string | null;
}

interface Summary {
  revenue: number;
  expenses: number;
  profit: number;
  pending: number;
}

interface ChartMonth {
  month: string;
  revenue: number;
  expense: number;
}

interface PatientOption {
  id: string;
  name: string;
}

const RECEITA_CATEGORIES = ["Sessão", "Pacote", "Avaliação", "Venda de produto", "Outro"];
const DESPESA_CATEGORIES = ["Aluguel", "Funcionário", "Material", "Impostos", "Energia", "Água", "Internet", "Marketing", "Outros"];
const PAYMENT_METHODS = ["Pix", "Dinheiro", "Crédito", "Débito", "Transferência"];

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return formatMoney(v);
}

function toIso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function firstDayOfMonth(): string {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

const EMPTY_FORM = {
  type: "receita" as TransactionType,
  description: "",
  category: "",
  patient_id: "",
  payment_method: "",
  transaction_date: toIso(new Date()),
  amount: "",
  status: "Pago" as TransactionStatus,
  notes: "",
};

/*
 * Cores do grafico validadas com a skill de dataviz (scripts/validate_palette.js):
 * o par --green/--red global do app falha o piso de daltonismo (ΔE 4.4 protan/deutan).
 * Este par (verde #008300 / vermelho #e34948 claro, #e66767 escuro) passa em ambos os
 * modos e fica com escopo local, sem alterar os badges do resto do sistema.
 */
function FinancialChart({ months }: { months: ChartMonth[] }) {
  const W = 600;
  const H = 200;
  const padTop = 14;
  const padBottom = 26;
  const plotHeight = H - padTop - padBottom;
  const maxValue = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.expense)));
  const groupWidth = W / Math.max(months.length, 1);
  const barWidth = Math.min(22, groupWidth / 3);
  const gap = 3;

  return (
    <div className="financial-chart">
      <style>{`
        .financial-chart { --chart-green: #008300; --chart-red: #e34948; }
        [data-theme="dark"] .financial-chart { --chart-red: #e66767; }
      `}</style>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--chart-green)", display: "inline-block" }} /> Receita
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--chart-red)", display: "inline-block" }} /> Despesa
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Receita e despesa por mês">
        {[0, 0.5, 1].map((frac) => {
          const y = padTop + plotHeight * (1 - frac);
          return (
            <g key={frac}>
              <line x1={0} x2={W} y1={y} y2={y} stroke="var(--border-soft)" strokeWidth={1} />
              <text x={0} y={y - 4} fontSize={10} fill="var(--text-faint)">
                {formatCompact(maxValue * frac)}
              </text>
            </g>
          );
        })}
        {months.map((m, i) => {
          const groupX = groupWidth * i + groupWidth / 2 - (barWidth + gap / 2);
          const revenueHeight = (m.revenue / maxValue) * plotHeight;
          const expenseHeight = (m.expense / maxValue) * plotHeight;
          const baseline = padTop + plotHeight;
          return (
            <g key={m.month}>
              <rect x={groupX} y={baseline - revenueHeight} width={barWidth} height={revenueHeight} rx={4} fill="var(--chart-green)">
                <title>
                  {monthLabel(m.month)}: {formatMoney(m.revenue)} de receita
                </title>
              </rect>
              <rect x={groupX + barWidth + gap} y={baseline - expenseHeight} width={barWidth} height={expenseHeight} rx={4} fill="var(--chart-red)">
                <title>
                  {monthLabel(m.month)}: {formatMoney(m.expense)} de despesa
                </title>
              </rect>
              <text x={groupX + barWidth + gap / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--text-muted)" style={{ textTransform: "capitalize" }}>
                {monthLabel(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Financeiro() {
  const isMobile = useIsMobile();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(toIso(new Date()));
  const [categoryFilter, setCategoryFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [chart, setChart] = useState<ChartMonth[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function loadSummary() {
    api.get<Summary>(`/financial-summary?from=${from}&to=${to}`).then(setSummary).catch((e) => setError(e.message));
  }

  function loadTransactions() {
    const params = new URLSearchParams({ from, to });
    if (categoryFilter) params.set("category", categoryFilter);
    if (patientFilter) params.set("patientId", patientFilter);
    if (statusFilter) params.set("status", statusFilter);
    api.get<{ items: Transaction[] }>(`/financial-transactions?${params.toString()}`).then((r) => setTransactions(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    api.get<{ months: ChartMonth[] }>("/financial-chart").then((r) => setChart(r.months)).catch((e) => setError(e.message));
    api.get<{ items: PatientOption[] }>("/patients?limit=200").then((r) => setPatients(r.items));
  }, []);

  useEffect(loadSummary, [from, to]);
  useEffect(loadTransactions, [from, to, categoryFilter, patientFilter, statusFilter]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setForm({
      type: t.type,
      description: t.description,
      category: t.category,
      patient_id: t.patient_id || "",
      payment_method: t.payment_method,
      transaction_date: t.transaction_date,
      amount: String(t.amount),
      status: t.status,
      notes: t.notes || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        type: form.type,
        description: form.description,
        category: form.category,
        patient_id: form.patient_id || null,
        payment_method: form.payment_method,
        transaction_date: form.transaction_date,
        amount: Number(form.amount),
        status: form.status,
        notes: form.notes || null,
      };
      if (editingId) await api.patch(`/financial-transactions/${editingId}`, payload);
      else await api.post("/financial-transactions", payload);
      setShowForm(false);
      loadTransactions();
      loadSummary();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: Transaction) {
    if (!window.confirm(`Excluir a movimentação "${t.description}"?`)) return;
    try {
      await api.delete(`/financial-transactions/${t.id}`);
      loadTransactions();
      loadSummary();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const categoryOptions = form.type === "receita" ? RECEITA_CATEGORIES : DESPESA_CATEGORIES;

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600 }}>{editingId ? "Editar movimentação" : "Nova movimentação"}</div>}
      <div>
        <label className="field-label">Descrição</label>
        <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Tipo</label>
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType, category: "" })}>
          <option value="receita">Receita</option>
          <option value="despesa">Despesa</option>
        </select>
      </div>
      <div>
        <label className="field-label">Categoria</label>
        <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="">Selecione...</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Paciente (opcional)</label>
        <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
          <option value="">Nenhum</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Forma de pagamento</label>
        <select className="input" required value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
          <option value="">Selecione...</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Data</label>
          <input className="input" type="date" required value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Valor</label>
          <input className="input" type="number" step="0.01" min="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="field-label">Status</label>
        <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TransactionStatus })}>
          <option value="Pago">Pago</option>
          <option value="Pendente">Pendente</option>
        </select>
      </div>
      <div>
        <label className="field-label">Observações</label>
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Receitas e despesas da clínica</p>
        </div>
        <button className="btn" onClick={startCreate}>
          + Nova movimentação
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi-value">{summary ? formatMoney(summary.revenue) : "—"}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Receita do período</div>
        </div>
        <div className="card">
          <div className="kpi-value">{summary ? formatMoney(summary.expenses) : "—"}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Despesas do período</div>
        </div>
        <div className="card">
          <div className="kpi-value" style={{ color: summary && summary.profit < 0 ? "var(--red)" : undefined }}>
            {summary ? formatMoney(summary.profit) : "—"}
          </div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Lucro líquido</div>
        </div>
        <div className="card">
          <div className="kpi-value">{summary ? formatMoney(summary.pending) : "—"}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Contas pendentes</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>Receita x despesa (últimos 6 meses)</div>
        {chart ? <FinancialChart months={chart} /> : <div className="empty-state">Carregando...</div>}
      </div>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <label className="field-label">De</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Até</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Categoria</label>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas</option>
            <optgroup label="Receita">
              {RECEITA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            <optgroup label="Despesa">
              {DESPESA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="field-label">Paciente</label>
          <select className="input" value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)}>
            <option value="">Todos</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Status</label>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
          </select>
        </div>
      </div>

      {transactions === null && <div className="empty-state">Carregando...</div>}
      {transactions !== null && transactions.length === 0 && <div className="empty-state">Nenhuma movimentação no período.</div>}
      {transactions !== null && transactions.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Paciente</th>
                <th>Tipo</th>
                <th>Pagamento</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.description}</td>
                  <td>{t.category}</td>
                  <td>{t.patientName || "—"}</td>
                  <td>
                    <span className={`badge ${t.type === "receita" ? "badge-green" : "badge-red"}`}>{t.type === "receita" ? "Receita" : "Despesa"}</span>
                  </td>
                  <td>{t.payment_method}</td>
                  <td>{new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td style={{ color: t.type === "receita" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {t.type === "receita" ? "+" : "−"} {formatMoney(t.amount)}
                  </td>
                  <td>
                    <span className={`badge ${t.status === "Pago" ? "badge-green" : "badge-yellow"}`}>{t.status}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => startEdit(t)}>
                        Editar
                      </button>
                      <button className="btn-danger" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDelete(t)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
