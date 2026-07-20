import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { api } from "../lib/api";

interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
}

interface BusinessHourSlot {
  id: string;
  weekday: number;
  time: string;
}

interface BusinessHourException {
  id: string;
  date: string;
  type: "holiday" | "block" | "special";
  closed: boolean;
  slots: string[] | null;
  note: string | null;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function SlotEditor({ times, onAdd, onRemove }: { times: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [draft, setDraft] = useState("09:00");
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {times.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum horário cadastrado.</span>}
        {times.map((t) => (
          <span key={t} className="chip" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {t}
            <button onClick={() => onRemove(t)} style={{ fontSize: 11, fontWeight: 700 }}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="input" type="time" style={{ maxWidth: 130 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            onAdd(draft);
          }}
        >
          + Adicionar horário
        </button>
      </div>
    </div>
  );
}

export function HorariosClinica() {
  const [rows, setRows] = useState<BusinessHourRow[] | null>(null);
  const [slots, setSlots] = useState<BusinessHourSlot[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [excForm, setExcForm] = useState({ date: "", type: "block" as "holiday" | "block" | "special", closed: true, note: "" });
  const [excSlots, setExcSlots] = useState<string[]>([]);
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);
  const [pendingRemoveSlot, setPendingRemoveSlot] = useState<{ id: string; time: string } | null>(null);
  const [pendingRemoveException, setPendingRemoveException] = useState<BusinessHourException | null>(null);

  function load() {
    api
      .get<{ businessHours: BusinessHourRow[]; businessHourSlots: BusinessHourSlot[] }>("/settings")
      .then((r) => {
        setRows(r.businessHours);
        setSlots(r.businessHourSlots);
      })
      .catch((e) => setError(e.message));
    api.get<{ items: BusinessHourException[] }>("/business-hours/exceptions").then((r) => setExceptions(r.items));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleDay(weekday: number, enabled: boolean) {
    if (!rows) return;
    const updated = rows.map((r) => (r.weekday === weekday ? { ...r, enabled } : r));
    setRows(updated);
    try {
      await api.patch("/settings", { businessHours: updated });
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function addSlot(weekday: number, time: string) {
    try {
      await api.post("/business-hours/slots", { weekday, time });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function confirmRemoveSlot() {
    if (!pendingRemoveSlot) return;
    try {
      await api.delete(`/business-hours/slots/${pendingRemoveSlot.id}`);
      setPendingRemoveSlot(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEditException(exc: BusinessHourException) {
    setEditingExceptionId(exc.id);
    setExcForm({ date: exc.date, type: exc.type, closed: exc.closed, note: exc.note || "" });
    setExcSlots(exc.slots || []);
  }

  async function handleCreateException(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...excForm, slots: excForm.closed ? null : excSlots };
      if (editingExceptionId) await api.patch(`/business-hours/exceptions/${editingExceptionId}`, payload);
      else await api.post("/business-hours/exceptions", payload);
      setExcForm({ date: "", type: "block", closed: true, note: "" });
      setExcSlots([]);
      setEditingExceptionId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function confirmRemoveException() {
    if (!pendingRemoveException) return;
    try {
      await api.delete(`/business-hours/exceptions/${pendingRemoveException.id}`);
      setPendingRemoveException(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!rows) return <div className="empty-state">Carregando...</div>;

  return (
    <div>
      <h1 className="page-title">Horários da Clínica</h1>
      <p className="page-subtitle">Os horários oferecidos pelo WhatsApp são exatamente os cadastrados aqui — o sistema nunca cria horários automaticamente.</p>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
        {DISPLAY_ORDER.map((weekday) => {
          const row = rows.find((r) => r.weekday === weekday)!;
          const daySlots = slots.filter((s) => s.weekday === weekday).map((s) => s.time.slice(0, 5)).sort();
          return (
            <div key={weekday} className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: row.enabled ? 14 : 0 }}>
                <label className="switch">
                  <input type="checkbox" checked={row.enabled} onChange={(e) => toggleDay(weekday, e.target.checked)} />
                  <span className="switch-track" />
                </label>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{WEEKDAY_LABELS[weekday]}</span>
              </div>
              {row.enabled && (
                <SlotEditor
                  times={daySlots}
                  onAdd={(t) => addSlot(weekday, t)}
                  onRemove={(t) => {
                    const match = slots.find((s) => s.weekday === weekday && s.time.slice(0, 5) === t);
                    if (match) setPendingRemoveSlot({ id: match.id, time: t });
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Feriados, bloqueios e dias especiais</div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>Para um dia específico com expediente diferente do normal (ou totalmente fechado).</p>

      <form onSubmit={handleCreateException} className="card" style={{ maxWidth: 480, display: "grid", gap: 12, marginBottom: 20 }}>
        {editingExceptionId && <div style={{ fontSize: 13.5, fontWeight: 600 }}>Editando exceção</div>}
        <div>
          <label className="field-label">Data</label>
          <input className="input" type="date" required value={excForm.date} onChange={(e) => setExcForm({ ...excForm, date: e.target.value })} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
          <input type="checkbox" checked={excForm.closed} onChange={(e) => setExcForm({ ...excForm, closed: e.target.checked })} />
          Clínica fechada nesse dia
        </label>
        {!excForm.closed && (
          <div>
            <label className="field-label">Horários customizados desse dia</label>
            <SlotEditor times={excSlots} onAdd={(t) => setExcSlots([...new Set([...excSlots, t])].sort())} onRemove={(t) => setExcSlots(excSlots.filter((s) => s !== t))} />
          </div>
        )}
        <div>
          <label className="field-label">Observação (opcional)</label>
          <input className="input" value={excForm.note} onChange={(e) => setExcForm({ ...excForm, note: e.target.value })} placeholder="Ex: Feriado nacional" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" type="submit" style={{ width: "fit-content" }}>
            {editingExceptionId ? "Salvar alterações" : "Adicionar"}
          </button>
          {editingExceptionId && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditingExceptionId(null);
                setExcForm({ date: "", type: "block", closed: true, note: "" });
                setExcSlots([]);
              }}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {exceptions.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          {exceptions.map((exc) => (
            <div key={exc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{new Date(`${exc.date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{exc.closed ? "Fechado" : `Horários: ${exc.slots?.join(", ") || "—"}`}{exc.note ? ` · ${exc.note}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" style={{ height: 32, padding: "0 12px", fontSize: 12 }} onClick={() => startEditException(exc)}>
                  Editar
                </button>
                <button className="btn-danger" style={{ height: 32, padding: "0 12px", fontSize: 12 }} onClick={() => setPendingRemoveException(exc)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemoveSlot}
        title="Remover horário?"
        message={pendingRemoveSlot ? `O horário ${pendingRemoveSlot.time} deixa de ser oferecido.` : ""}
        confirmLabel="Remover"
        onConfirm={confirmRemoveSlot}
        onCancel={() => setPendingRemoveSlot(null)}
      />
      <ConfirmDialog
        open={!!pendingRemoveException}
        title="Remover exceção?"
        message={pendingRemoveException ? `A exceção de ${new Date(`${pendingRemoveException.date}T12:00:00`).toLocaleDateString("pt-BR")} será removida.` : ""}
        confirmLabel="Remover"
        onConfirm={confirmRemoveException}
        onCancel={() => setPendingRemoveException(null)}
      />
    </div>
  );
}
