import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
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
  calendar_sync_status: "synced" | "pending";
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

type ViewMode = "dia" | "semana" | "mes";

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

/** Intervalo a buscar do backend para cada modo - sempre so o necessario, nunca um periodo grande demais. */
function rangeFor(mode: ViewMode, date: Date): { from: Date; to: Date } {
  if (mode === "dia") return { from: date, to: date };
  if (mode === "semana") {
    const days = weekDates(date);
    return { from: days[0], to: days[6] };
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(last);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  return { from: gridStart, to: gridEnd };
}

function shiftDate(date: Date, mode: ViewMode, dir: 1 | -1): Date {
  if (mode === "mes") {
    // setMonth() estoura pro mes seguinte quando o dia atual nao existe no mes de destino
    // (ex: 31/jan + 1 mes vira 03/mar, pulando fevereiro inteiro) - por isso calcula o
    // ultimo dia valido do mes de destino em vez de deixar o JS estourar sozinho.
    const year = date.getFullYear();
    const month = date.getMonth() + dir;
    const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(date.getDate(), daysInTargetMonth));
  }
  const next = new Date(date);
  if (mode === "dia") next.setDate(next.getDate() + dir);
  else next.setDate(next.getDate() + dir * 7);
  return next;
}

const STATUS_BADGE: Record<string, string> = { Agendado: "badge-blue", Confirmado: "badge-yellow", Concluido: "badge-green", Faltou: "badge-red", Cancelado: "badge-neutral" };
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EMPTY_FORM = { patientId: "", newPatientName: "", newPatientPhone: "", procedure: "", treatmentPlanId: "", time: "09:00" };

function MonthGrid({ monthDate, schedules, onSelectDay }: { monthDate: Date; schedules: ScheduleItem[]; onSelectDay: (d: Date) => void }) {
  const month = monthDate.getMonth();
  const { from } = rangeFor("mes", monthDate);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return d;
  });
  const countByDate: Record<string, number> = {};
  for (const s of schedules) countByDate[s.date] = (countByDate[s.date] || 0) + 1;
  const todayIso = toIso(new Date());

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((d) => {
          const iso = toIso(d);
          const inMonth = d.getMonth() === month;
          const count = countByDate[iso] || 0;
          const isToday = iso === todayIso;
          return (
            <button
              key={iso}
              className="card"
              onClick={() => onSelectDay(d)}
              style={{
                padding: "10px 6px",
                minHeight: 62,
                textAlign: "left",
                opacity: inMonth ? 1 : 0.4,
                border: isToday ? "1.5px solid var(--accent)" : undefined,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.getDate()}</div>
              {count > 0 && (
                <span className="badge badge-blue" style={{ marginTop: 6, fontSize: 10, display: "inline-block" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Agenda() {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>("semana");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleItem[] | null>(null);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<ScheduleItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [patientPlans, setPatientPlans] = useState<TreatmentPlanOption[]>([]);
  const [rescheduleFor, setRescheduleFor] = useState<ScheduleItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [cancelFor, setCancelFor] = useState<ScheduleItem | null>(null);

  const days = weekDates(selectedDate);

  function load() {
    const { from, to } = rangeFor(viewMode, selectedDate);
    api.get<{ items: ScheduleItem[] }>(`/schedules?from=${toIso(from)}&to=${toIso(to)}`).then((r) => setSchedules(r.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate.getTime()]);

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

  function goPrev() {
    setSelectedDate(shiftDate(selectedDate, viewMode, -1));
  }
  function goNext() {
    setSelectedDate(shiftDate(selectedDate, viewMode, 1));
  }
  function goToday() {
    setSelectedDate(new Date());
  }
  function selectDayFromMonth(d: Date) {
    setSelectedDate(d);
    setViewMode("semana");
  }

  function handleCancel(s: ScheduleItem) {
    setActionsFor(null);
    setCancelFor(s);
  }

  async function confirmCancel() {
    if (!cancelFor) return;
    try {
      await api.delete(`/schedules/${cancelFor.id}`);
      setCancelFor(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleOutcome(s: ScheduleItem, outcome: "completed" | "no_show") {
    setActionsFor(null);
    try {
      await api.patch(`/schedules/${s.id}/outcome`, { outcome });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSync(s: ScheduleItem) {
    setActionsFor(null);
    try {
      await api.post(`/schedules/${s.id}/sync`, {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleConfirm(s: ScheduleItem) {
    setActionsFor(null);
    try {
      await api.patch(`/schedules/${s.id}/confirm`, {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openReschedule(s: ScheduleItem) {
    setActionsFor(null);
    setRescheduleFor(s);
    setRescheduleDate(s.date);
    setRescheduleTime(s.time.slice(0, 5));
  }

  async function handleReschedule(e: FormEvent) {
    e.preventDefault();
    if (!rescheduleFor) return;
    setSavingReschedule(true);
    setError(null);
    try {
      const start = new Date(`${rescheduleDate}T${rescheduleTime}:00-03:00`).toISOString();
      await api.patch(`/schedules/${rescheduleFor.id}/reschedule`, { start });
      setRescheduleFor(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingReschedule(false);
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

  const subtitle = viewMode === "dia" ? "Sessões do dia" : viewMode === "semana" ? "Sessões da semana" : "Visão mensal";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          + Nova sessão
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div className="segmented">
          {(["dia", "semana", "mes"] as const).map((m) => (
            <span key={m} className={`segmented-item${viewMode === m ? " active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setViewMode(m)}>
              {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Mês"}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="btn-secondary" style={{ padding: "6px 12px" }} onClick={goPrev}>
            ←
          </button>
          <button className="btn-secondary" style={{ padding: "6px 12px" }} onClick={goToday}>
            Hoje
          </button>
          <button className="btn-secondary" style={{ padding: "6px 12px" }} onClick={goNext}>
            →
          </button>
        </div>
        <input className="input" type="date" style={{ maxWidth: 160 }} value={toIso(selectedDate)} onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))} />
      </div>

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      {viewMode === "semana" && (
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
      )}

      {viewMode === "mes" ? (
        <MonthGrid monthDate={selectedDate} schedules={schedules || []} onSelectDay={selectDayFromMonth} />
      ) : (
        <>
          {viewMode === "dia" && (
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, textTransform: "capitalize" }}>
              {selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          )}

          {dayItems.length === 0 && (
            <EmptyState title="Nenhuma sessão nesse dia" description="A agenda deste dia está livre." actionLabel="+ Nova sessão" onAction={() => setShowForm(true)} />
          )}

          {dayItems.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              {dayItems.map((s, i) => (
                <div
                  key={s.id}
                  className="agenda-item-enter"
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    padding: "14px 18px 14px 14px",
                    borderBottom: "1px solid var(--border-soft)",
                    borderLeft: `4px solid ${treatmentTypes.find((t) => t.name === s.procedure)?.color || "transparent"}`,
                    animationDelay: `${Math.min(i, 10) * 30}ms`,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, width: 46, flex: "0 0 46px" }}>{s.time.slice(0, 5)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.patient_name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.procedure}</div>
                  </div>
                  {s.calendar_sync_status === "pending" && (
                    <span className="badge badge-yellow" title="Não sincronizado com o Google Calendar ainda">
                      ⏳ Pendente
                    </span>
                  )}
                  <span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                  <button className="mobile-icon-btn" style={{ width: 32, height: 32, flex: "0 0 32px" }} onClick={() => setActionsFor(s)}>
                    ⋮
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {actionsFor && (
        <div className="modal-overlay" onClick={() => setActionsFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{actionsFor.patient_name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
              {actionsFor.procedure} · {new Date(`${actionsFor.date}T12:00:00`).toLocaleDateString("pt-BR")} às {actionsFor.time.slice(0, 5)}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {actionsFor.calendar_sync_status === "pending" && (
                <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => handleSync(actionsFor)}>
                  ⏳ Sincronizar com o Google Calendar
                </button>
              )}
              {actionsFor.status === "Agendado" && (
                <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => handleConfirm(actionsFor)}>
                  Confirmar presença
                </button>
              )}
              {(actionsFor.status === "Agendado" || actionsFor.status === "Confirmado") && (
                <>
                  <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => openReschedule(actionsFor)}>
                    Editar sessão (remarcar)
                  </button>
                  <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => handleOutcome(actionsFor, "completed")}>
                    Marcar como realizado
                  </button>
                  <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => handleOutcome(actionsFor, "no_show")}>
                    Marcar como faltou
                  </button>
                </>
              )}
              {(actionsFor.status === "Agendado" || actionsFor.status === "Confirmado") && (
                <button className="btn-danger" style={{ justifyContent: "flex-start" }} onClick={() => handleCancel(actionsFor)}>
                  Cancelar sessão
                </button>
              )}
              <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => setActionsFor(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleFor && (
        <div className="modal-overlay" onClick={() => setRescheduleFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Editar sessão</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
              {rescheduleFor.patient_name} — {rescheduleFor.procedure}
            </div>
            <form onSubmit={handleReschedule} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="field-label">Data</label>
                <input className="input" type="date" required value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Horário</label>
                <input className="input" type="time" required value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" type="submit" disabled={savingReschedule}>
                  {savingReschedule ? "Salvando..." : "Salvar"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setRescheduleFor(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelFor}
        title="Cancelar sessão?"
        message={cancelFor ? `A sessão de ${cancelFor.patient_name} será cancelada.` : ""}
        confirmLabel="Cancelar sessão"
        onConfirm={confirmCancel}
        onCancel={() => setCancelFor(null)}
      />
    </div>
  );
}
