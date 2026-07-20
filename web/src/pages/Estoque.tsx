import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  min_quantity: number | null;
  notes: string | null;
}

const EMPTY_FORM = { name: "", category: "", quantity: "0", unit: "", min_quantity: "", notes: "" };

export function Estoque() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<{ items: InventoryItem[] }>("/inventory").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }

  useEffect(load, []);

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
      notes: item.notes || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        category: form.category || null,
        quantity: Number(form.quantity),
        unit: form.unit || null,
        min_quantity: form.min_quantity ? Number(form.min_quantity) : null,
        notes: form.notes || null,
      };
      if (editingId) await api.patch(`/inventory/${editingId}`, payload);
      else await api.post("/inventory", payload);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: InventoryItem) {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function adjustQuantity(item: InventoryItem, delta: number) {
    const newQuantity = Math.max(item.quantity + delta, 0);
    setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? { ...i, quantity: newQuantity } : i)) : prev));
    try {
      await api.patch(`/inventory/${item.id}`, { quantity: newQuantity });
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600 }}>{editingId ? "Editar item" : "Novo item"}</div>}
      <div>
        <label className="field-label">Nome</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Categoria</label>
        <input className="input" placeholder="Agulhas, ventosas, álcool..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Quantidade</label>
          <input className="input" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Unidade</label>
          <input className="input" placeholder="unidades, ml, caixas..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="field-label">Estoque mínimo (opcional)</label>
        <input className="input" type="number" step="0.01" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} />
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
          <p className="page-subtitle">Materiais da clínica</p>
        </div>
        <button className="btn" onClick={startCreate}>
          + Novo item
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

      {items === null && <div className="empty-state">Carregando...</div>}
      {items !== null && items.length === 0 && <div className="empty-state">Nenhum item cadastrado.</div>}

      <div className="card" style={{ padding: 0 }}>
        {items?.map((item) => {
          const low = item.min_quantity != null && item.quantity <= item.min_quantity;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.name}</span>
                  {low && <span className="badge badge-red">Estoque baixo</span>}
                </div>
                {item.category && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.category}</div>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="btn-secondary" style={{ width: 28, height: 28, padding: 0, fontSize: 15 }} onClick={() => adjustQuantity(item, -1)}>
                  −
                </button>
                <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 60, textAlign: "center" }}>
                  {item.quantity} {item.unit || ""}
                </span>
                <button className="btn-secondary" style={{ width: 28, height: 28, padding: 0, fontSize: 15 }} onClick={() => adjustQuantity(item, 1)}>
                  +
                </button>
              </div>

              <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => startEdit(item)}>
                Editar
              </button>
              <button className="btn-danger" style={{ height: 34, fontSize: 12.5 }} onClick={() => handleDelete(item)}>
                Excluir
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
