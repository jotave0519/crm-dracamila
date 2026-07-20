import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface ScheduleItem {
  id: string;
  patient_name: string;
  phone: string;
  procedure: string;
  date: string;
  time: string;
  status: "Agendado" | "Confirmado" | "Cancelado" | "Concluido" | "Faltou";
  evolution_note: string | null;
}

interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number | null;
  color: string;
}

interface PatientOption {
  id: string;
  name: string;
  phone: string;
}

interface TreatmentPlanOption {
  id: string;
  treatment_type_id: string | null;
  status: "ativo" | "concluido" | "cancelado";
}

function toIso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function weekDates(center: Date): Date[] {
  const start = new Date(center);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const STATUS_BADGE: Record<string, string> = { Agendado: "badge-blue", Confirmado: "badge-yellow", Concluido: "badge-green", Faltou: "badge-red", Cancelado: "badge-neutral" };

const EMPTY_FORM = { patientId: "", newPatientName: "", newPatientPhone: "", procedure: "", treatmentPlanId: "", time: "09:00" };

export function Agenda() {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleItem[] | null>(null);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [noteFor, setNoteFor] = useState<ScheduleItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [patientPlans, setPatientPlans] = useState<TreatmentPlanOption[]>([]);

  const days = weekDates(selectedDate);

  function load() {
    const from = toIso(days[0]);
    const to = toIso(days[6]);
    api.get<{ items: ScheduleItem[] }>(`/schedules?from=${from}&to=${to}`).then((r) => setSchedules(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.getTime()]);

  useEffect(() => {
    api.get<{ items: TreatmentType[] }>("/treatment-types").then((r) => setTreatmentTypes(r.items));
    api.get<{ items: PatientOption[] }>("/patients?limit=200").then((r) => setPatients(r.items));
  }, []);

  useEffect(() => {
    if (!form.patientId) {
      setPatientPlans([]);
      return;
    }
    api
      .get<{ items: TreatmentPlanOption[] }>(`/patients/${form.patientId}/treatment-plans`)
      .then((r) => setPatientPlans(r.items.filter((p) => p.status === "ativo")));
  }, [form.patientId]);

  const dayItems = (schedules || []).filter((s) => s.date === toIso(selectedDate)).sort((a, b) => a.time.localeCompare(b.time));

  async function handleCancel(s: ScheduleItem) {
    setOpenMenuId(null);
    if (!window.confirm(`Cancelar a sessão de ${s.patient_name}?`)) return;
    try {
      await api.delete(`/schedules/${s.id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleOutcome(s: ScheduleItem, outcome: "completed" | "no_show") {
    setOpenMenuId(null);
    try {
      await api.patch(`/schedules/${s.id}/outcome`, { outcome });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleConfirm(s: ScheduleItem) {
    setOpenMenuId(null);
    try {
      await api.patch(`/schedules/${s.id}/confirm`, {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openNoteEditor(s: ScheduleItem) {
    setOpenMenuId(null);
    setNoteFor(s);
    setNoteDraft(s.evolution_note || "");
  }

  async function saveNote() {
    if (!noteFor) return;
    try {
      await api.patch(`/schedules/${noteFor.id}/evolution-note`, { evolutionNote: noteDraft });
      setNoteFor(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const treatment = treatmentTypes.find((t) => t.name === form.procedure);
      const start = new Date(`${toIso(selectedDate)}T${form.time}:00-03:00`).toISOString();
      const payload: Record<string, unknown> = {
        procedure: form.procedure,
        treatmentTypeId: treatment?.id || null,
        treatmentPlanId: form.treatmentPlanId || null,
        start,
        durationMinutes: treatment?.duration_minutes || 30,
      };
      if (form.patientId) payload.userId = form.patientId;
      else payload.newPatient = { name: form.newPatientName, phone: form.newPatientPhone };

      await api.post("/schedules", payload);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
      api.get<{ items: PatientOption[] }>("/patients?limit=200").then((r) => setPatients(r.items));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600 }}>Nova sessão</div>}
      <div>
        <label className="field-label">Paciente</label>
        <select className="input" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
          <option value="">+ Novo paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.phone})
            </option>
          ))}
        </select>
      </div>
      {!form.patientId && (
        <>
          <div>
            <label className="field-label">Nome do novo paciente</label>
            <input className="input" required value={form.newPatientName} onChange={(e) => setForm({ ...form, newPatientName: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Telefone</label>
            <input className="input" required value={form.newPatientPhone} onChange={(e) => setForm({ ...form, newPatientPhone: e.target.value })} />
          </div>
        </>
      )}
      <div>
        <label className="field-label">Tipo de atendimento</label>
        <select className="input" required value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })}>
          <option value="">Selecione...</option>
          {treatmentTypes.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {patientPlans.length > 0 && (
        <div>
          <label className="field-label">Plano de tratamento (opcional)</label>
          <select className="input" value={form.treatmentPlanId} onChange={(e) => setForm({ ...form, treatmentPlanId: e.target.value })}>
            <option value="">Sessão avulsa</option>
            {patientPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {treatmentTypes.find((t) => t.id === p.treatment_type_id)?.name || "Plano ativo"}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="field-label">Data</label>
        <input className="input" type="date" value={toIso(selectedDate)} onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))} />
      </div>
      <div>
        <label className="field-label">Horário</label>
        <input className="input" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Agendar"}
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
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">Sessões da semana</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          + Nova sessão
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="day-strip" style={{ marginBottom: 20 }}>
        {days.map((d) => {
          const iso = toIso(d);
          const isSelected = iso === toIso(selectedDate);
          const label = d.toLocaleDateString("pt-BR", { weekday: "short" });
          return (
            <button key={iso} className={`chip${isSelected ? " active" : ""}`} onClick={() => setSelectedDate(d)} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 54 }}>
              <span style={{ textTransform: "capitalize" }}>{label}</span>
              <span style={{ fontWeight: 700 }}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {!showForm && !isMobile && null}
      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      {dayItems.length === 0 && <div className="empty-state">Nenhuma sessão nesse dia.</div>}

      <div className="card" style={{ padding: 0 }}>
        {dayItems.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px 14px 14px", borderBottom: "1px solid var(--border-soft)", borderLeft: `4px solid ${treatmentTypes.find((t) => t.name === s.procedure)?.color || "transparent"}`, position: "relative" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, width: 46, flex: "0 0 46px" }}>{s.time.slice(0, 5)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.patient_name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.procedure}</div>
              {s.evolution_note && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2, fontStyle: "italic" }}>{s.evolution_note.slice(0, 80)}</div>}
            </div>
            <span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status}</span>
            <button className="mobile-icon-btn" style={{ width: 32, height: 32, flex: "0 0 32px" }} onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}>
              ⋮
            </button>

            {openMenuId === s.id && (
              <div style={{ position: "absolute", top: 48, right: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-card)", zIndex: 5, minWidth: 200, overflow: "hidden" }}>
                {s.status === "Agendado" && (
                  <button style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13 }} onClick={() => handleConfirm(s)}>
                    Confirmar presença
                  </button>
                )}
                {(s.status === "Agendado" || s.status === "Confirmado") && (
                  <>
                    <button style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13 }} onClick={() => handleOutcome(s, "completed")}>
                      Marcar como realizado
                    </button>
                    <button style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13 }} onClick={() => handleOutcome(s, "no_show")}>
                      Marcar como faltou
                    </button>
                  </>
                )}
                <button style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13 }} onClick={() => openNoteEditor(s)}>
                  Nota de evolução
                </button>
                {(s.status === "Agendado" || s.status === "Confirmado") && (
                  <button style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, color: "var(--red)" }} onClick={() => handleCancel(s)}>
                    Cancelar sessão
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {noteFor && (
        <div className="modal-overlay" onClick={() => setNoteFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nota de evolução</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
              {noteFor.patient_name} — {noteFor.procedure}
            </div>
            <textarea className="input" rows={5} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Queixa, conduta, observações..." />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn" onClick={saveNote}>
                Salvar
              </button>
              <button className="btn btn-secondary" onClick={() => setNoteFor(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
