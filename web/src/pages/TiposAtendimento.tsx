import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface TreatmentType {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  duration_minutes: number | null;
  notes: string | null;
  pre_instructions: string | null;
  post_instructions: string | null;
  color: string;
  materials_used: string | null;
  active: boolean;
}

const EMPTY_FORM = { name: "", category: "", price: "", duration_minutes: "30", description: "", notes: "", pre_instructions: "", post_instructions: "", color: "#8FA98F", materials_used: "", active: true };

function formatMoney(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function TiposAtendimento() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<TreatmentType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TreatmentType | null>(null);

  function load() {
    api.get<{ items: TreatmentType[] }>("/treatment-types").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(t: TreatmentType) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      category: t.category || "",
      price: t.price != null ? String(t.price) : "",
      duration_minutes: t.duration_minutes != null ? String(t.duration_minutes) : "",
      description: t.description || "",
      notes: t.notes || "",
      pre_instructions: t.pre_instructions || "",
      post_instructions: t.post_instructions || "",
      color: t.color || "#8FA98F",
      materials_used: t.materials_used || "",
      active: t.active,
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
        price: form.price ? Number(form.price) : null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        description: form.description || null,
        notes: form.notes || null,
        pre_instructions: form.pre_instructions || null,
        post_instructions: form.post_instructions || null,
        color: form.color,
        materials_used: form.materials_used || null,
        active: form.active,
      };
      if (editingId) await api.patch(`/treatment-types/${editingId}`, payload);
      else await api.post("/treatment-types", payload);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api.delete(`/treatment-types/${pendingDelete.id}`);
      setPendingDelete(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDuplicate(t: TreatmentType) {
    try {
      await api.post("/treatment-types", {
        name: `${t.name} (cópia)`,
        category: t.category,
        price: t.price,
        duration_minutes: t.duration_minutes,
        description: t.description,
        notes: t.notes,
        pre_instructions: t.pre_instructions,
        post_instructions: t.post_instructions,
        color: t.color,
        materials_used: t.materials_used,
        active: t.active,
      });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600 }}>{editingId ? "Editar atendimento" : "Novo atendimento"}</div>}
      <div>
        <label className="field-label">Nome</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Duração (min)</label>
          <input className="input" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Valor (opcional)</label>
          <input className="input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="field-label">Descrição</label>
        <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Orientações antes da sessão</label>
        <textarea className="input" rows={2} value={form.pre_instructions} onChange={(e) => setForm({ ...form, pre_instructions: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Orientações depois da sessão</label>
        <textarea className="input" rows={2} value={form.post_instructions} onChange={(e) => setForm({ ...form, post_instructions: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Materiais utilizados</label>
        <textarea className="input" rows={2} placeholder="Ex: 10 agulhas, álcool, luvas" value={form.materials_used} onChange={(e) => setForm({ ...form, materials_used: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Cor na agenda</label>
        <input className="input" type="color" style={{ height: 40, padding: 4 }} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Ativo (disponível para a IA oferecer no WhatsApp)
      </label>
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
          <h1 className="page-title">Tipos de Atendimento</h1>
          <p className="page-subtitle">Catálogo de sessões oferecidas pela clínica</p>
        </div>
        <button className="btn" onClick={startCreate}>
          + Novo
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
      {items !== null && items.length === 0 && (
        <EmptyState title="Nenhum tipo de atendimento" description="Cadastre o primeiro serviço oferecido pela clínica." actionLabel="Cadastrar primeiro tipo" onAction={startCreate} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {items?.map((t) => (
          <div key={t.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flex: "0 0 10px" }} />
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.name}</div>
              </div>
              {!t.active && <span className="badge badge-neutral">Inativo</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
              {t.duration_minutes ? `${t.duration_minutes}min` : "—"} · {formatMoney(t.price)}
            </div>
            {t.description && <div style={{ fontSize: 12.5, marginTop: 8 }}>{t.description}</div>}
            {t.materials_used && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>Materiais: {t.materials_used}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => startEdit(t)}>
                Editar
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => handleDuplicate(t)}>
                Duplicar
              </button>
              <button className="btn-danger" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => setPendingDelete(t)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir tipo de atendimento?"
        message={pendingDelete ? `"${pendingDelete.name}" será removido do catálogo.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
