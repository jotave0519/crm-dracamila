import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
}

const EMPTY_FORM = { name: "", phone: "", email: "", birth_date: "" };

export function Pacientes() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [items, setItems] = useState<Patient[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    api.get<{ items: Patient[] }>(`/patients${query}`).then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/patients", { ...form, birth_date: form.birth_date || null });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600 }}>Novo paciente</div>}
      <div>
        <label className="field-label">Nome completo</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Telefone</label>
        <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <label className="field-label">E-mail</label>
        <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Data de nascimento</label>
        <input className="input" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
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
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">Cadastro e histórico de atendimento</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          + Novo paciente
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <input className="input" style={{ maxWidth: 320, marginBottom: 18 }} placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 420 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      {items === null && <div className="empty-state">Carregando...</div>}
      {items !== null && items.length === 0 && search && <div className="empty-state">Nenhum paciente encontrado para "{search}".</div>}
      {items !== null && items.length === 0 && !search && (
        <EmptyState title="Nenhum paciente cadastrado" description="Comece cadastrando o primeiro paciente da clínica." actionLabel="Cadastrar primeiro paciente" onAction={() => setShowForm(true)} />
      )}

      {items !== null && items.length > 0 && (
      <div className="card" style={{ padding: 0 }}>
        {items?.map((p) => (
          <div key={p.id} className="mobile-list-item" style={{ cursor: "pointer" }} onClick={() => navigate(`/pacientes/${p.id}`)}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name || "Contato sem nome"}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {p.phone}
                {p.email ? ` · ${p.email}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
