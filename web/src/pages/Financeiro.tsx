import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { FormSheet } from "../components/FormSheet";
import { CopyIcon, PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSessionCache } from "../hooks/useSessionCache";
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

interface FinancialCategory {
  id: string;
  type: TransactionType;
  name: string;
}

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

  // Cache entre navegacoes: ao voltar pra essa tela, mostra o ultimo dado
  // conhecido na hora (em vez de skeleton) enquanto atualiza por tras.
  const [summary, setSummary] = useSessionCache<Summary>("financeiro-summary");
  const [chart, setChart] = useSessionCache<ChartMonth[]>("financeiro-chart");
  const [transactions, setTransactions] = useSessionCache<Transaction[]>("financeiro-transactions");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryType, setNewCategoryType] = useState<TransactionType>("receita");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<FinancialCategory | null>(null);

  function loadCategories() {
    api.get<{ items: FinancialCategory[] }>("/financial-categories").then((r) => setCategories(r.items)).catch((e) => setError(e.message));
  }

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
    loadCategories();
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api.delete(`/financial-transactions/${pendingDelete.id}`);
      setPendingDelete(null);
      loadTransactions();
      loadSummary();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDuplicate(t: Transaction) {
    try {
      await api.post("/financial-transactions", {
        type: t.type,
        description: t.description,
        category: t.category,
        patient_id: t.patient_id,
        payment_method: t.payment_method,
        transaction_date: toIso(new Date()),
        amount: t.amount,
        status: t.status,
        notes: t.notes,
      });
      loadTransactions();
      loadSummary();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await api.post("/financial-categories", { type: newCategoryType, name: newCategoryName.trim() });
      setNewCategoryName("");
      loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRenameCategory(id: string) {
    if (!editingCategoryName.trim()) return;
    try {
      await api.patch(`/financial-categories/${id}`, { name: editingCategoryName.trim() });
      setEditingCategoryId(null);
      loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function confirmDeleteCategory() {
    if (!pendingDeleteCategory) return;
    try {
      await api.delete(`/financial-categories/${pendingDeleteCategory.id}`);
      setPendingDeleteCategory(null);
      loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const categoryOptions = categories.filter((c) => c.type === form.type);
  const filterCategoryOptions = { receita: categories.filter((c) => c.type === "receita"), despesa: categories.filter((c) => c.type === "despesa") };
  const hasExtraFilters = !!(categoryFilter || patientFilter || statusFilter);

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
            <option key={c.id} value={c.name}>
              {c.name}
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
          <PlusIcon width={16} height={16} />
          Nova movimentação
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

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi-label">Receita do período</div>
          <div className="kpi-value" style={{ color: summary ? "var(--green)" : undefined }}>
            {summary ? formatMoney(summary.revenue) : "—"}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Despesas do período</div>
          <div className="kpi-value" style={{ color: summary ? "var(--red)" : undefined }}>
            {summary ? formatMoney(summary.expenses) : "—"}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Lucro líquido</div>
          <div className="kpi-value" style={{ color: summary ? (summary.profit < 0 ? "var(--red)" : "var(--green)") : undefined }}>
            {summary ? formatMoney(summary.profit) : "—"}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Contas pendentes</div>
          <div className="kpi-value" style={{ color: summary && summary.pending > 0 ? "var(--yellow)" : undefined }}>
            {summary ? formatMoney(summary.pending) : "—"}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="text-h3" style={{ marginBottom: 14 }}>
          Receita x despesa (últimos 6 meses)
        </h3>
        {chart ? <FinancialChart months={chart} /> : <div className="empty-state">Carregando...</div>}
      </div>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 24 }}>
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
              {filterCategoryOptions.receita.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Despesa">
              {filterCategoryOptions.despesa.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="field-label">&nbsp;</label>
          <button className="btn-secondary" style={{ height: 40, fontSize: 12.5, display: "block" }} type="button" onClick={() => setShowCategoryManager(true)}>
            Gerenciar categorias
          </button>
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

      {transactions === null && (
        <div className="list-card card">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="list-row">
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: "45%" }} />
                <div className="skeleton skeleton-text" style={{ width: "25%" }} />
              </div>
              <div className="skeleton skeleton-text" style={{ width: 70 }} />
            </div>
          ))}
        </div>
      )}

      {transactions !== null && transactions.length === 0 && (
        <EmptyState
          title="Nenhuma movimentação"
          description={hasExtraFilters ? "Nenhum resultado com esses filtros." : "Nenhuma movimentação registrada nesse período."}
          actionLabel="Nova movimentação"
          onAction={startCreate}
        />
      )}

      {transactions !== null && transactions.length > 0 && (
        <div className="card list-card">
          <div className="list-card-head">
            <h3 className="text-h3">Movimentações</h3>
            <span className="text-caption">
              {transactions.length} {transactions.length === 1 ? "lançamento" : "lançamentos"}
            </span>
          </div>

          {isMobile
            ? transactions.map((t) => (
                <div key={t.id} className="mobile-list-item">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {t.category}
                        {t.patientName ? ` · ${t.patientName}` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: t.type === "receita" ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }}>
                      {t.type === "receita" ? "+" : "−"} {formatMoney(t.amount)}
                    </span>
                  </div>
                  <div className="mobile-list-row" style={{ justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString("pt-BR")} · {t.payment_method}
                    </span>
                    <span className={`badge ${t.status === "Pago" ? "badge-green" : "badge-yellow"}`}>{t.status}</span>
                  </div>
                  <div className="mobile-list-actions">
                    <button className="btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => startEdit(t)}>
                      <PencilIcon width={13} height={13} /> Editar
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => handleDuplicate(t)}>
                      <CopyIcon width={13} height={13} /> Duplicar
                    </button>
                    <button className="icon-btn-sm danger" style={{ width: 34, height: 34, flex: "0 0 34px" }} onClick={() => setPendingDelete(t)} aria-label="Excluir">
                      <TrashIcon width={15} height={15} />
                    </button>
                  </div>
                </div>
              ))
            : transactions.map((t) => (
                <div key={t.id} className="list-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.description}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {t.category} · {t.payment_method}
                      {t.patientName ? ` · ${t.patientName}` : ""} · {new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <span className={`badge ${t.type === "receita" ? "badge-green" : "badge-red"}`} style={{ flex: "0 0 auto" }}>
                    {t.type === "receita" ? "Receita" : "Despesa"}
                  </span>
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: t.type === "receita" ? "var(--green)" : "var(--red)", flex: "0 0 auto", minWidth: 100, textAlign: "right" }}
                  >
                    {t.type === "receita" ? "+" : "−"} {formatMoney(t.amount)}
                  </span>
                  <span className={`badge ${t.status === "Pago" ? "badge-green" : "badge-yellow"}`} style={{ flex: "0 0 auto" }}>
                    {t.status}
                  </span>
                  <div className="list-row-actions">
                    <button className="icon-btn-sm" onClick={() => startEdit(t)} aria-label="Editar" title="Editar">
                      <PencilIcon width={15} height={15} />
                    </button>
                    <button className="icon-btn-sm" onClick={() => handleDuplicate(t)} aria-label="Duplicar" title="Duplicar">
                      <CopyIcon width={15} height={15} />
                    </button>
                    <button className="icon-btn-sm danger" onClick={() => setPendingDelete(t)} aria-label="Excluir" title="Excluir">
                      <TrashIcon width={15} height={15} />
                    </button>
                  </div>
                </div>
              ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir movimentação?"
        message={pendingDelete ? `"${pendingDelete.description}" será removida.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {showCategoryManager && (
        <div className="modal-overlay" onClick={() => setShowCategoryManager(false)}>
          <div className={`modal-card${isMobile ? " modal-card--fullscreen" : ""}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: isMobile ? undefined : 460 }}>
            <div className="text-h3" style={{ marginBottom: 14 }}>Categorias</div>

            <form onSubmit={handleCreateCategory} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <select className="input" style={{ maxWidth: 120 }} value={newCategoryType} onChange={(e) => setNewCategoryType(e.target.value as TransactionType)}>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
              <input className="input" placeholder="Nome da categoria" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
              <button className="btn" type="submit" style={{ flex: "0 0 auto" }}>
                <PlusIcon width={15} height={15} />
              </button>
            </form>

            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {(["receita", "despesa"] as const).map((type) => (
                <div key={type} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{type === "receita" ? "Receita" : "Despesa"}</div>
                  {categories.filter((c) => c.type === type).length === 0 && <div className="empty-state" style={{ padding: "8px 0" }}>Nenhuma categoria ainda.</div>}
                  {categories
                    .filter((c) => c.type === type)
                    .map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                        {editingCategoryId === c.id ? (
                          <>
                            <input className="input" style={{ flex: 1 }} value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} />
                            <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleRenameCategory(c.id)}>
                              Salvar
                            </button>
                            <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => setEditingCategoryId(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                            <button
                              className="icon-btn-sm"
                              aria-label="Editar categoria"
                              title="Editar"
                              onClick={() => {
                                setEditingCategoryId(c.id);
                                setEditingCategoryName(c.name);
                              }}
                            >
                              <PencilIcon width={14} height={14} />
                            </button>
                            <button className="icon-btn-sm danger" aria-label="Excluir categoria" title="Excluir" onClick={() => setPendingDeleteCategory(c)}>
                              <TrashIcon width={14} height={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>

            <button className="btn btn-secondary" style={{ marginTop: 6 }} onClick={() => setShowCategoryManager(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteCategory}
        title="Excluir categoria?"
        message={pendingDeleteCategory ? `"${pendingDeleteCategory.name}" some das opções — movimentações já lançadas com essa categoria não são afetadas.` : ""}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingDeleteCategory(null)}
      />
    </div>
  );
}
