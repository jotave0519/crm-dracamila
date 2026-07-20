import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

type MovementType = "entrada" | "saida" | "ajuste" | "consumo_interno";

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  min_quantity: number | null;
  unit_price: number | null;
  supplier: string | null;
  notes: string | null;
  lastMovement: { type: MovementType; created_at: string } | null;
}

interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  supplier: string | null;
  staffName: string | null;
  notes: string | null;
  created_at: string;
}

interface Summary {
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

const MOVEMENT_LABEL: Record<MovementType, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste", consumo_interno: "Consumo interno" };
const MOVEMENT_BADGE: Record<MovementType, string> = { entrada: "badge-green", saida: "badge-red", ajuste: "badge-blue", consumo_interno: "badge-yellow" };

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusOf(item: InventoryItem): { label: string; badge: string } {
  if (item.quantity <= 0) return { label: "Sem estoque", badge: "badge-red" };
  if (item.min_quantity != null && item.quantity <= item.min_quantity) return { label: "Estoque baixo", badge: "badge-red" };
  return { label: "Em estoque", badge: "badge-green" };
}

const EMPTY_FORM = { name: "", category: "", quantity: "0", unit: "", min_quantity: "", unit_price: "", supplier: "", notes: "" };
const EMPTY_MOVEMENT_FORM = { type: "entrada" as MovementType, quantity: "", new_quantity: "", supplier: "", notes: "" };

export function Estoque() {
  const isMobile = useIsMobile();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [movementFor, setMovementFor] = useState<InventoryItem | null>(null);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT_FORM);
  const [savingMovement, setSavingMovement] = useState(false);

  const [historyFor, setHistoryFor] = useState<InventoryItem | null>(null);
  const [historyItems, setHistoryItems] = useState<Movement[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null);

  const hasActiveFilters = !!(categoryFilter || supplierFilter || search || lowStockOnly);

  function loadSummary() {
    api.get<Summary>("/inventory/summary").then(setSummary).catch((e) => setError(e.message));
  }

  function loadFilterOptions() {
    api.get<{ items: InventoryItem[] }>("/inventory").then((r) => {
      setCategories(Array.from(new Set(r.items.map((i) => i.category).filter((c): c is string => !!c))).sort());
      setSuppliers(Array.from(new Set(r.items.map((i) => i.supplier).filter((s): s is string => !!s))).sort());
    });
  }

  function loadItems() {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (search) params.set("search", search);
    if (lowStockOnly) params.set("lowStock", "true");
    api.get<{ items: InventoryItem[] }>(`/inventory?${params.toString()}`).then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSummary();
    loadFilterOptions();
  }, []);
  useEffect(loadItems, [categoryFilter, supplierFilter, search, lowStockOnly]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  function refreshAfterChange() {
    loadItems();
    loadSummary();
    loadFilterOptions();
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category || "",
      quantity: String(item.quantity),
      unit: item.unit || "",
      min_quantity: item.min_quantity != null ? String(item.min_quantity) : "",
      unit_price: item.unit_price != null ? String(item.unit_price) : "",
      supplier: item.supplier || "",
      notes: item.notes || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        category: form.category || null,
        unit: form.unit || null,
        min_quantity: form.min_quantity ? Number(form.min_quantity) : null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        supplier: form.supplier || null,
        notes: form.notes || null,
      };
      if (editingId) {
        await api.patch(`/inventory/${editingId}`, payload);
      } else {
        payload.quantity = Number(form.quantity);
        await api.post("/inventory", payload);
      }
      setShowForm(false);
      refreshAfterChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api.delete(`/inventory/${pendingDelete.id}`);
      setPendingDelete(null);
      refreshAfterChange();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDuplicate(item: InventoryItem) {
    try {
      await api.post("/inventory", {
        name: `${item.name} (cópia)`,
        category: item.category,
        quantity: 0,
        unit: item.unit,
        min_quantity: item.min_quantity,
        unit_price: item.unit_price,
        supplier: item.supplier,
        notes: item.notes,
      });
      refreshAfterChange();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openMovement(item: InventoryItem) {
    setMovementFor(item);
    setMovementForm(EMPTY_MOVEMENT_FORM);
  }

  async function handleSaveMovement(e: FormEvent) {
    e.preventDefault();
    if (!movementFor) return;
    setSavingMovement(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { type: movementForm.type, notes: movementForm.notes || null };
      if (movementForm.type === "ajuste") payload.new_quantity = Number(movementForm.new_quantity);
      else payload.quantity = Number(movementForm.quantity);
      if (movementForm.type === "entrada") payload.supplier = movementForm.supplier || null;

      await api.post(`/inventory/${movementFor.id}/movements`, payload);
      setMovementFor(null);
      refreshAfterChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingMovement(false);
    }
  }

  function openHistory(item: InventoryItem) {
    setHistoryFor(item);
    setHistoryItems(null);
    api.get<{ items: Movement[] }>(`/inventory/${item.id}/movements`).then((r) => setHistoryItems(r.items)).catch((e) => setError(e.message));
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600 }}>{editingId ? "Editar produto" : "Novo produto"}</div>}
      <div>
        <label className="field-label">Nome</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Categoria</label>
        <input className="input" placeholder="Agulhas, ventosas, álcool..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
      </div>
      {!editingId && (
        <div>
          <label className="field-label">Quantidade inicial</label>
          <input className="input" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Unidade</label>
          <input className="input" placeholder="unidades, ml, caixas..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Estoque mínimo</label>
          <input className="input" type="number" step="0.01" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Valor unitário</label>
          <input className="input" type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Fornecedor</label>
          <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
        </div>
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
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">Materiais e produtos da clínica</p>
        </div>
        <button className="btn" onClick={startCreate}>
          + Novo produto
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
          <div className="kpi-value">{summary ? summary.totalItems : "—"}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Produtos cadastrados</div>
        </div>
        <div className="card">
          <div className="kpi-value" style={{ color: summary && summary.lowStock > 0 ? "var(--red)" : undefined }}>
            {summary ? summary.lowStock : "—"}
          </div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Estoque baixo</div>
        </div>
        <div className="card">
          <div className="kpi-value" style={{ color: summary && summary.outOfStock > 0 ? "var(--red)" : undefined }}>
            {summary ? summary.outOfStock : "—"}
          </div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Sem estoque</div>
        </div>
        <div className="card">
          <div className="kpi-value">{summary ? formatMoney(summary.totalValue) : "—"}</div>
          <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Valor total em estoque</div>
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 20 }}>
        <div style={{ flex: "1 1 180px" }}>
          <label className="field-label">Buscar</label>
          <input className="input" placeholder="Nome do produto..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Categoria</label>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Fornecedor</label>
          <select className="input" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, paddingBottom: 10 }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Só estoque baixo
        </label>
      </div>

      {items === null && <div className="empty-state">Carregando...</div>}
      {items !== null && items.length === 0 && hasActiveFilters && <div className="empty-state">Nenhum produto encontrado com esses filtros.</div>}
      {items !== null && items.length === 0 && !hasActiveFilters && (
        <EmptyState title="Nenhum produto cadastrado" description="Cadastre o primeiro material ou produto da clínica." actionLabel="Cadastrar primeiro produto" onAction={startCreate} />
      )}

      {items !== null && items.length > 0 && isMobile && (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => {
            const status = statusOf(item);
            return (
              <div key={item.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.category || "Sem categoria"}</div>
                  </div>
                  <span className={`badge ${status.badge}`}>{status.label}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 10 }}>
                  {item.quantity} {item.unit || ""} {item.min_quantity != null && <span style={{ color: "var(--text-muted)" }}>(mínimo {item.min_quantity})</span>}
                </div>
                {item.unit_price != null && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{formatMoney(item.unit_price)} / unidade</div>}
                {item.supplier && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Fornecedor: {item.supplier}</div>}
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
                  Última movimentação: {item.lastMovement ? `${MOVEMENT_LABEL[item.lastMovement.type]} · ${new Date(item.lastMovement.created_at).toLocaleDateString("pt-BR")}` : "—"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="btn-secondary" style={{ flex: "1 1 auto", height: 34, fontSize: 12.5 }} onClick={() => openMovement(item)}>
                    Movimentar
                  </button>
                  <button className="btn-secondary" style={{ flex: "1 1 auto", height: 34, fontSize: 12.5 }} onClick={() => openHistory(item)}>
                    Histórico
                  </button>
                  <button className="btn-secondary" style={{ flex: "1 1 auto", height: 34, fontSize: 12.5 }} onClick={() => startEdit(item)}>
                    Editar
                  </button>
                  <button className="btn-secondary" style={{ flex: "1 1 auto", height: 34, fontSize: 12.5 }} onClick={() => handleDuplicate(item)}>
                    Duplicar
                  </button>
                  <button className="btn-danger" style={{ flex: "1 1 auto", height: 34, fontSize: 12.5 }} onClick={() => setPendingDelete(item)}>
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items !== null && items.length > 0 && !isMobile && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Quantidade</th>
                <th>Mínimo</th>
                <th>Valor unitário</th>
                <th>Fornecedor</th>
                <th>Última movimentação</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = statusOf(item);
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category || "—"}</td>
                    <td>
                      {item.quantity} {item.unit || ""}
                    </td>
                    <td>{item.min_quantity ?? "—"}</td>
                    <td>{item.unit_price != null ? formatMoney(item.unit_price) : "—"}</td>
                    <td>{item.supplier || "—"}</td>
                    <td>
                      {item.lastMovement ? (
                        <>
                          {MOVEMENT_LABEL[item.lastMovement.type]} · {new Date(item.lastMovement.created_at).toLocaleDateString("pt-BR")}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`badge ${status.badge}`}>{status.label}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => openMovement(item)}>
                          Movimentar
                        </button>
                        <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => openHistory(item)}>
                          Histórico
                        </button>
                        <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => startEdit(item)}>
                          Editar
                        </button>
                        <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDuplicate(item)}>
                          Duplicar
                        </button>
                        <button className="btn-danger" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => setPendingDelete(item)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {movementFor && (
        <div className="modal-overlay" onClick={() => setMovementFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Movimentar estoque</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
              {movementFor.name} — {movementFor.quantity} {movementFor.unit || ""} em estoque
            </div>
            <form onSubmit={handleSaveMovement} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="field-label">Tipo</label>
                <select className="input" value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as MovementType })}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="consumo_interno">Consumo interno</option>
                </select>
              </div>
              {movementForm.type === "ajuste" ? (
                <div>
                  <label className="field-label">Nova quantidade (contagem corrigida)</label>
                  <input className="input" type="number" step="0.01" required value={movementForm.new_quantity} onChange={(e) => setMovementForm({ ...movementForm, new_quantity: e.target.value })} />
                </div>
              ) : (
                <div>
                  <label className="field-label">Quantidade</label>
                  <input className="input" type="number" step="0.01" min="0.01" required value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} />
                </div>
              )}
              {movementForm.type === "entrada" && (
                <div>
                  <label className="field-label">Fornecedor (opcional)</label>
                  <input className="input" value={movementForm.supplier} onChange={(e) => setMovementForm({ ...movementForm, supplier: e.target.value })} />
                </div>
              )}
              <div>
                <label className="field-label">Observação</label>
                <textarea className="input" rows={2} value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" type="submit" disabled={savingMovement}>
                  {savingMovement ? "Salvando..." : "Confirmar"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setMovementFor(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="modal-overlay" onClick={() => setHistoryFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Histórico — {historyFor.name}</div>
            {historyItems === null && <div className="empty-state">Carregando...</div>}
            {historyItems && historyItems.length === 0 && <div className="empty-state">Nenhuma movimentação registrada ainda.</div>}
            {historyItems && historyItems.length > 0 && (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {historyItems.map((m) => (
                  <div key={m.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`badge ${MOVEMENT_BADGE[m.type]}`}>{MOVEMENT_LABEL[m.type]}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: m.quantity < 0 ? "var(--red)" : "var(--green)" }}>
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {m.supplier ? `${m.supplier} · ` : ""}
                      {m.staffName || "—"}
                    </div>
                    {m.notes && <div style={{ fontSize: 12.5, marginTop: 4, fontStyle: "italic" }}>{m.notes}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setHistoryFor(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir produto?"
        message={pendingDelete ? `"${pendingDelete.name}" e todo o histórico de movimentação serão apagados.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
