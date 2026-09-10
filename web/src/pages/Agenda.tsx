import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import { layoutDayEvents } from "../lib/calendarLayout";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { FormSheet } from "../components/FormSheet";
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, MoreVerticalIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "../components/icons";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

interface ScheduleItem {
  id: string;
  patient_name: string;
  phone: string;
  procedure: string;
  date: string;
  time: string;
  status: "Agendado" | "Confirmado" | "Cancelado" | "Concluido" | "Faltou";
  duration_minutes?: number | null;
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortMonth(d: Date): string {
  return capitalize(d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""));
}

/** "Ontem" / "Hoje" / "Amanha" quando a data cai em um desses dias; senao null. */
function relativeDayLabel(date: Date): string | null {
  const target = toIso(date);
  if (target === toIso(new Date())) return "Hoje";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (target === toIso(y)) return "Ontem";
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (target === toIso(t)) return "Amanhã";
  return null;
}

/** Rotulo curto de um dia especifico: "Hoje", "Ontem", "Amanha" ou "Qua, 09/09". */
function dayLabel(date: Date): string {
  const rel = relativeDayLabel(date);
  if (rel) return rel;
  const weekday = capitalize(date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""));
  return `${weekday}, ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Rotulo do periodo da semana que contem `date`: "08–14 set" ou "29 set – 05 out". */
function weekRangeLabel(date: Date): string {
  const w = weekDates(date);
  const start = w[0];
  const end = w[6];
  const dd = (d: Date) => String(d.getDate()).padStart(2, "0");
  if (start.getMonth() === end.getMonth()) return `${dd(start)}–${dd(end)} ${shortMonth(end).toLowerCase()}`;
  return `${dd(start)} ${shortMonth(start).toLowerCase()} – ${dd(end)} ${shortMonth(end).toLowerCase()}`;
}

/** Rotulo do botao central da barra de navegacao. */
function navLabel(mode: ViewMode, date: Date): string {
  if (mode === "dia") return relativeDayLabel(date) || `${String(date.getDate()).padStart(2, "0")} ${shortMonth(date)}`;
  if (mode === "semana") {
    const week = weekDates(date);
    const start = week[0];
    const end = week[6];
    const startDay = String(start.getDate()).padStart(2, "0");
    const endDay = String(end.getDate()).padStart(2, "0");
    if (start.getMonth() === end.getMonth()) return `Semana ${startDay}–${endDay} ${shortMonth(end)}`;
    return `Semana ${startDay} ${shortMonth(start)} – ${endDay} ${shortMonth(end)}`;
  }
  return `${capitalize(date.toLocaleDateString("pt-BR", { month: "long" }))} ${date.getFullYear()}`;
}

function weekDates(center: Date): Date[] {
  // Semana comeca na segunda-feira (convencao BR).
  const start = new Date(center);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
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
  gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
  const gridEnd = new Date(last);
  gridEnd.setDate(gridEnd.getDate() + ((7 - gridEnd.getDay()) % 7));
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

const STATUS_LABEL: Record<string, string> = { Agendado: "Agendado", Confirmado: "Confirmado", Concluido: "Concluído", Faltou: "Faltou", Cancelado: "Cancelado" };
const STATUS_COLOR: Record<string, string> = { Agendado: "blue", Confirmado: "yellow", Concluido: "green", Faltou: "red", Cancelado: "neutral" };
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const EMPTY_FORM = { patientId: "", newPatientName: "", newPatientPhone: "", procedure: "", treatmentPlanId: "", time: "09:00" };

// Grade de horas (views Dia e Semana no desktop/tablet).
const HOUR_HEIGHT = 60;
const MIN_EVENT_HEIGHT = 44;
const EVENT_GAP = 3;
const DEFAULT_DURATION_MINUTES = 30;

/** Fundo translucido do evento a partir da cor do tipo de atendimento (hex #rrggbb). */
function eventColors(hex: string | undefined): { bg: string; border: string } {
  if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) return { bg: `${hex}1f`, border: hex };
  return { bg: "var(--accent-bg)", border: "var(--accent)" };
}

const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22, ease: "easeOut" as const },
};

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
              className="card month-cell"
              onClick={() => onSelectDay(d)}
              style={{
                padding: "10px 6px",
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
  const { showToast } = useToast();
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

  const weekCountByDate: Record<string, number> = {};
  for (const s of schedules || []) weekCountByDate[s.date] = (weekCountByDate[s.date] || 0) + 1;

  // ---- Grade de horas (Dia/Semana no desktop/tablet) ----
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const gridDays = viewMode === "semana" ? days : [selectedDate];
  const gridDayStrs = gridDays.map((d) => toIso(d));
  const gridItems = (schedules || []).filter((s) => gridDayStrs.includes(s.date));
  const startHour = Math.max(
    6,
    Math.min(7, ...gridItems.map((s) => parseInt(s.time.slice(0, 2), 10)))
  );
  const endHour = Math.min(
    23,
    Math.max(
      20,
      ...gridItems.map((s) => {
        const [h, m] = s.time.split(":").map(Number);
        return Math.ceil((h * 60 + m + (s.duration_minutes || DEFAULT_DURATION_MINUTES)) / 60);
      })
    )
  );
  const hourCount = Math.max(1, endHour - startHour);

  // Ao abrir/trocar de dia, rola a grade pra 30min antes do primeiro
  // compromisso (ou do horario atual, o que vier antes).
  useEffect(() => {
    if (isMobile || viewMode === "mes") return;
    const el = gridScrollRef.current;
    if (!el) return;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const firstEventMin = gridItems.length
      ? Math.min(...gridItems.map((s) => parseInt(s.time.slice(0, 2), 10) * 60 + parseInt(s.time.slice(3, 5), 10)))
      : 8 * 60;
    const anchor = Math.min(firstEventMin, nowMin) - 30;
    const t = setTimeout(() => {
      el.scrollTop = Math.max(0, (anchor - startHour * 60) * (HOUR_HEIGHT / 60));
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isMobile, toIso(selectedDate), gridItems.length]);

  function renderDayColumn(d: Date) {
    const dateStr = toIso(d);
    const isToday = dateStr === toIso(new Date());
    const list = (schedules || []).filter((s) => s.date === dateStr);
    const positioned = layoutDayEvents(
      list.map((s) => ({ ...s, durationMinutes: s.duration_minutes || DEFAULT_DURATION_MINUTES })),
      HOUR_HEIGHT / 60,
      startHour,
      MIN_EVENT_HEIGHT,
      EVENT_GAP
    );
    const now = new Date();
    const nowTop = isToday ? (now.getHours() * 60 + now.getMinutes() - startHour * 60) * (HOUR_HEIGHT / 60) : -1;

    return (
      <div
        key={dateStr}
        className="agenda-day-col"
        style={{
          height: hourCount * HOUR_HEIGHT,
          backgroundImage: `repeating-linear-gradient(var(--surface), var(--surface) ${HOUR_HEIGHT - 1}px, var(--border-soft) ${HOUR_HEIGHT}px)`,
        }}
      >
        {isToday && nowTop >= 0 && nowTop <= hourCount * HOUR_HEIGHT && (
          <div className="agenda-now-line" style={{ top: nowTop }}>
            <span className="agenda-now-dot" />
          </div>
        )}
        {schedules === null && (
          <div style={{ padding: 8, display: "grid", gap: 6 }}>
            <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
          </div>
        )}
        {positioned.map(({ item, top, height, left, width }) => {
          const c = eventColors(treatmentTypes.find((t) => t.name === item.procedure)?.color);
          return (
            <div
              key={item.id}
              className="agenda-event"
              onClick={() => setActionsFor(item)}
              style={{
                top,
                height,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                background: c.bg,
                borderLeft: `3px solid ${c.border}`,
                color: "var(--text)",
              }}
            >
              <span className="agenda-event-status" style={{ background: `var(--${STATUS_COLOR[item.status] || "neutral"})` }} />
              <div className="agenda-event-inner">
                <div className="agenda-event-time">{item.time.slice(0, 5)}</div>
                {height >= 28 && <div className="agenda-event-name">{item.patient_name}</div>}
                {height >= 46 && <div className="agenda-event-procedure">{item.procedure}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderHourGrid() {
    const hours = Array.from({ length: hourCount }, (_, i) => startHour + i);
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="agenda-grid-head">
          <div className="agenda-hour-col" style={{ paddingTop: 0 }} />
          {gridDays.map((d) => {
            const isToday = toIso(d) === toIso(new Date());
            return (
              <div key={toIso(d)} className="agenda-grid-day">
                <div className={`agenda-grid-day-label${isToday ? " is-today" : ""}`}>
                  {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                </div>
                <div className={`agenda-grid-day-number${isToday ? " is-today" : ""}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="agenda-grid-scroll" ref={gridScrollRef} style={{ maxHeight: "calc(100vh - 290px)" }}>
          <div className="agenda-hour-col">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }}>
                <span className="agenda-hour-label">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
          {gridDays.map((d) => renderDayColumn(d))}
        </div>
      </div>
    );
  }

  // ---- Cartao de sessao (mobile, reutilizado por Dia e Semana) ----
  function sessionCard(s: ScheduleItem) {
    return (
      <motion.div
        key={s.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="card agenda-card"
        style={{ borderLeft: `4px solid ${treatmentTypes.find((t) => t.name === s.procedure)?.color || "transparent"}` }}
      >
        <div className="agenda-card-top">
          <div className="agenda-time">{s.time.slice(0, 5)}</div>
          <div className="agenda-card-main">
            <div className="agenda-patient-name">{s.patient_name}</div>
            <div className="agenda-procedure">{s.procedure}</div>
          </div>
          <button className="mobile-icon-btn agenda-item-action-btn" onClick={() => setActionsFor(s)} aria-label="Ações da sessão">
            <MoreVerticalIcon width={16} height={16} />
          </button>
        </div>
        <div className="agenda-status-row">
          <span className={`status-chip status-chip-${STATUS_COLOR[s.status]}`}>
            <span className="status-dot" />
            {STATUS_LABEL[s.status]}
          </span>
        </div>
      </motion.div>
    );
  }

  /** View "Dia" no mobile: foco em um unico dia. */
  function renderMobileDay() {
    return (
      <>
        <div className="agenda-day-header">
          {capitalize(selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }))}
        </div>
        {dayItems.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <EmptyState icon={<CalendarIcon width={20} height={20} />} title="Agenda livre" description="Nenhuma sessão agendada para este dia." />
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AnimatePresence mode="popLayout">{dayItems.map((s) => sessionCard(s))}</AnimatePresence>
          </div>
        )}
      </>
    );
  }

  /** View "Semana" no mobile: a semana inteira, agrupada por dia. */
  function renderMobileWeek() {
    const todayIso = toIso(new Date());
    const bySide: Record<string, ScheduleItem[]> = {};
    for (const s of schedules || []) (bySide[s.date] ||= []).push(s);
    const weekTotal = days.reduce((n, d) => n + (bySide[toIso(d)]?.length || 0), 0);

    if (weekTotal === 0) {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
          <EmptyState icon={<CalendarIcon width={20} height={20} />} title="Semana livre" description="Nenhuma sessão agendada nesta semana." />
        </motion.div>
      );
    }

    return (
      <div className="agenda-week-list">
        {days.map((d) => {
          const iso = toIso(d);
          const items = (bySide[iso] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
          const isToday = iso === todayIso;
          return (
            <div key={iso} className="agenda-daygroup">
              <div className={`agenda-daygroup-header${isToday ? " is-today" : ""}`}>
                <span className="dg-weekday">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                <span className="dg-date">
                  {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                </span>
                {items.length > 0 && <span className="dg-count">{items.length}</span>}
              </div>
              {items.length === 0 ? (
                <div className="agenda-daygroup-empty">Sem atendimentos</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <AnimatePresence mode="popLayout">{items.map((s) => sessionCard(s))}</AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function goPrev() {
    setSelectedDate(shiftDate(selectedDate, viewMode, -1));
  }
  function goNext() {
    setSelectedDate(shiftDate(selectedDate, viewMode, 1));
  }
  function goToday() {
    setSelectedDate(new Date());
  }
  // Mobile: as setas paginam a FAIXA (uma semana), e cada dia se escolhe tocando na faixa.
  function goPrevStrip() {
    setSelectedDate(shiftDate(selectedDate, "semana", -1));
  }
  function goNextStrip() {
    setSelectedDate(shiftDate(selectedDate, "semana", 1));
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
      showToast("Sessão cancelada");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleOutcome(s: ScheduleItem, outcome: "completed" | "no_show") {
    setActionsFor(null);
    try {
      await api.patch(`/schedules/${s.id}/outcome`, { outcome });
      load();
      if (outcome === "completed") showToast("Sessão concluída");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleConfirm(s: ScheduleItem) {
    setActionsFor(null);
    try {
      await api.patch(`/schedules/${s.id}/confirm`, {});
      load();
      showToast("Presença confirmada");
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
      showToast("✓ Sessão criada");
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

  const subtitle = isMobile
    ? viewMode === "mes"
      ? "Visão mensal"
      : `${dayItems.length} atendimento${dayItems.length === 1 ? "" : "s"} neste dia`
    : viewMode === "dia"
    ? "Sessões do dia"
    : viewMode === "semana"
    ? "Sessões da semana"
    : "Visão mensal";

  const canAct = (s: ScheduleItem) => s.status === "Agendado" || s.status === "Confirmado";

  const contentKey =
    viewMode === "mes" ? `mes-${selectedDate.getFullYear()}-${selectedDate.getMonth()}` : viewMode === "semana" ? `semana-${toIso(days[0])}` : `dia-${toIso(selectedDate)}`;

  return (
    <MotionConfig reducedMotion="user">
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          <PlusIcon width={16} height={16} />
          Nova sessão
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {isMobile ? (
        <div style={{ marginBottom: 16 }}>
          <div className="segmented segmented-full" style={{ marginBottom: 14 }}>
            {(["dia", "semana", "mes"] as const).map((m) => (
              <span key={m} className={`segmented-item${viewMode === m ? " active" : ""}`} onClick={() => setViewMode(m)}>
                {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Mês"}
              </span>
            ))}
          </div>

          {viewMode === "mes" ? (
            <div className="agenda-relnav">
              <button className="agenda-relnav-btn" onClick={goPrev} aria-label="Mês anterior">
                <ChevronLeftIcon width={18} height={18} />
              </button>
              <span className="agenda-relnav-label" onClick={goToday}>{navLabel("mes", selectedDate)}</span>
              <button className="agenda-relnav-btn" onClick={goNext} aria-label="Próximo mês">
                <ChevronRightIcon width={18} height={18} />
              </button>
            </div>
          ) : (
            <>
              <div className="agenda-relnav">
                <button
                  className="agenda-relnav-btn"
                  onClick={viewMode === "semana" ? goPrevStrip : goPrev}
                  aria-label={viewMode === "semana" ? "Semana anterior" : "Dia anterior"}
                >
                  <ChevronLeftIcon width={18} height={18} />
                </button>
                <span className="agenda-relnav-label" onClick={goToday}>
                  {viewMode === "semana" ? weekRangeLabel(selectedDate) : dayLabel(selectedDate)}
                </span>
                <button
                  className="agenda-relnav-btn"
                  onClick={viewMode === "semana" ? goNextStrip : goNext}
                  aria-label={viewMode === "semana" ? "Próxima semana" : "Próximo dia"}
                >
                  <ChevronRightIcon width={18} height={18} />
                </button>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={toIso(days[0])}
                  className="day-strip"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {days.map((d) => {
                    const iso = toIso(d);
                    const isSelected = iso === toIso(selectedDate);
                    const isToday = iso === toIso(new Date());
                    const hasSessions = (weekCountByDate[iso] || 0) > 0;
                    const label = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
                    return (
                      <button
                        key={iso}
                        className={`week-day-cell${isSelected ? " active" : ""}${isToday ? " is-today" : ""}`}
                        onClick={() => setSelectedDate(d)}
                      >
                        <span className="week-day-label">{label}</span>
                        <span className="week-day-number">{d.getDate()}</span>
                        <span className="week-day-indicators">{hasSessions && <span className="week-day-dot week-day-dot-sessions" />}</span>
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div className="segmented">
            {(["dia", "semana", "mes"] as const).map((m) => (
              <span key={m} className={`segmented-item${viewMode === m ? " active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setViewMode(m)}>
                {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Mês"}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn-secondary" style={{ padding: "0 10px", height: 36 }} onClick={goPrev} aria-label="Anterior">
              <ChevronLeftIcon width={16} height={16} />
            </button>
            <button className="btn-secondary" style={{ padding: "0 14px", height: 36 }} onClick={goToday}>
              {navLabel(viewMode, selectedDate)}
            </button>
            <button className="btn-secondary" style={{ padding: "0 10px", height: 36 }} onClick={goNext} aria-label="Próximo">
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>
          <input className="input" type="date" style={{ maxWidth: 160 }} value={toIso(selectedDate)} onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))} />
        </div>
      )}

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      <AnimatePresence mode="wait">
        <motion.div key={contentKey} initial={fadeSlide.initial} animate={fadeSlide.animate} exit={fadeSlide.exit} transition={fadeSlide.transition}>
          {viewMode === "mes" ? (
            <MonthGrid monthDate={selectedDate} schedules={schedules || []} onSelectDay={selectDayFromMonth} />
          ) : !isMobile ? (
            renderHourGrid()
          ) : schedules === null ? (
            <div style={{ display: "grid", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 76, borderRadius: 12 }} />
              ))}
            </div>
          ) : viewMode === "semana" ? (
            renderMobileWeek()
          ) : (
            renderMobileDay()
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {actionsFor && (
          <motion.div
            className="modal-overlay"
            style={{ animation: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActionsFor(null)}
          >
            <motion.div
              className="modal-card"
              style={{ maxWidth: 420, animation: "none" }}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="agenda-sheet-header">
                <div>
                  <div className="text-h3">{actionsFor.patient_name}</div>
                  <div className="agenda-sheet-subtitle">
                    {actionsFor.procedure} · {new Date(`${actionsFor.date}T12:00:00`).toLocaleDateString("pt-BR")} às {actionsFor.time.slice(0, 5)}
                  </div>
                </div>
                <button className="mobile-icon-btn" onClick={() => setActionsFor(null)} aria-label="Fechar">
                  <XIcon width={15} height={15} />
                </button>
              </div>

              <div className="agenda-sheet-actions">
                {actionsFor.status === "Agendado" && (
                  <button className="agenda-sheet-action" onClick={() => handleConfirm(actionsFor)}>
                    <span className="agenda-sheet-action-icon">
                      <CheckIcon width={16} height={16} />
                    </span>
                    Confirmar presença
                  </button>
                )}
                {canAct(actionsFor) && (
                  <>
                    <button className="agenda-sheet-action" onClick={() => openReschedule(actionsFor)}>
                      <span className="agenda-sheet-action-icon">
                        <PencilIcon width={16} height={16} />
                      </span>
                      Editar sessão (remarcar)
                    </button>
                    <button className="agenda-sheet-action" onClick={() => handleOutcome(actionsFor, "completed")}>
                      <span className="agenda-sheet-action-icon">
                        <CheckIcon width={16} height={16} />
                      </span>
                      Marcar como realizada
                    </button>
                    <button className="agenda-sheet-action" onClick={() => handleOutcome(actionsFor, "no_show")}>
                      <span className="agenda-sheet-action-icon">
                        <XIcon width={16} height={16} />
                      </span>
                      Marcar falta
                    </button>
                  </>
                )}
              </div>

              {canAct(actionsFor) && (
                <>
                  <div className="agenda-sheet-divider" />
                  <button className="agenda-sheet-action agenda-sheet-action-danger" onClick={() => handleCancel(actionsFor)}>
                    <span className="agenda-sheet-action-icon agenda-sheet-action-icon-danger">
                      <TrashIcon width={16} height={16} />
                    </span>
                    Cancelar sessão
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rescheduleFor && (
          <motion.div
            className="modal-overlay"
            style={{ animation: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setRescheduleFor(null)}
          >
            <motion.div
              className="modal-card"
              style={{ maxWidth: 380, animation: "none" }}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-h3" style={{ marginBottom: 4 }}>
                Editar sessão
              </div>
              <div className="agenda-sheet-subtitle" style={{ marginBottom: 12 }}>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!cancelFor}
        title="Cancelar sessão?"
        message={cancelFor ? `A sessão de ${cancelFor.patient_name} será cancelada.` : ""}
        confirmLabel="Cancelar sessão"
        onConfirm={confirmCancel}
        onCancel={() => setCancelFor(null)}
      />
    </div>
    </MotionConfig>
  );
}
