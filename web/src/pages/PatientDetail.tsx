import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackHeader } from "../components/BackHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { EvolutionLineChart } from "../components/EvolutionLineChart";
import { api } from "../lib/api";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  created_at: string;
  profession: string | null;
  health_insurance: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  main_complaint: string | null;
  medical_conditions: string | null;
  surgeries: string | null;
  medications: string | null;
  allergies: string | null;
  pain_scale: number | null;
  muscle_strength: string | null;
  mobility: string | null;
  treatment_goals: string | null;
  notes: string | null;
}

interface ScheduleItem {
  id: string;
  procedure: string;
  date: string;
  time: string;
  status: string;
  evolution_note: string | null;
}

interface HistoryResponse {
  patient: Patient;
  schedules: ScheduleItem[];
}

interface Attachment {
  id: string;
  category: "foto" | "exame" | "documento";
  file_name: string;
  mime_type: string | null;
  uploaded_at: string;
  url: string | null;
}

interface TreatmentTypeOption {
  id: string;
  name: string;
}

interface TreatmentPlan {
  id: string;
  treatment_type_id: string | null;
  total_sessions: number;
  total_price: number | null;
  start_date: string | null;
  goal: string | null;
  diagnosis: string | null;
  next_reassessment_date: string | null;
  status: "ativo" | "concluido" | "cancelado";
  notes: string | null;
  sessionsCompleted: number;
  sessionsRemaining: number;
}

interface Evolution {
  id: string;
  schedule_id: string | null;
  staffName: string | null;
  evolution_date: string;
  main_complaint: string | null;
  pain_scale: number | null;
  mobility_score: number | null;
  strength_score: number | null;
  rom_score: number | null;
  treated_region: string | null;
  treatment_performed: string | null;
  techniques_used: string | null;
  observations: string | null;
  treatment_response: string | null;
  guidance_given: string | null;
  next_goals: string | null;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  label: string;
  detail: string | null;
  noteId: string | null;
}

const STATUS_BADGE: Record<string, string> = { Agendado: "badge-blue", Confirmado: "badge-yellow", Concluido: "badge-green", Faltou: "badge-red", Cancelado: "badge-neutral" };
const PLAN_STATUS_BADGE: Record<string, string> = { ativo: "badge-blue", concluido: "badge-green", cancelado: "badge-neutral" };

const TIMELINE_ICONS: Record<string, string> = {
  primeira_avaliacao: "🩺",
  sessao_realizada: "✅",
  sessao_remarcada: "🔁",
  paciente_faltou: "⚠️",
  consulta_cancelada: "❌",
  pagamento: "💰",
  evolucao: "📈",
  plano_iniciado: "📋",
  plano_concluido: "🎉",
  nota_manual: "📝",
};

const TIMELINE_COLORS: Record<string, string> = {
  paciente_faltou: "var(--red)",
  consulta_cancelada: "var(--red)",
  plano_concluido: "var(--green)",
  pagamento: "var(--green)",
};

function formatMoney(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toIso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function formatLongDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function painScaleBadge(scale: number | null): { label: string; className: string } | null {
  if (scale == null) return null;
  const className = scale <= 3 ? "badge-green" : scale <= 6 ? "badge-yellow" : "badge-red";
  return { label: `Dor ${scale}/10`, className };
}

function evolutionField(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{value}</div>
    </div>
  );
}

type Tab = "resumo" | "clinico" | "avaliacao" | "evolucao" | "plano" | "linha_do_tempo" | "anexos" | "sessoes" | "conversas";
const TABS: { id: Tab; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "clinico", label: "Histórico Clínico" },
  { id: "avaliacao", label: "Avaliação Física" },
  { id: "evolucao", label: "Evolução" },
  { id: "plano", label: "Plano de Tratamento" },
  { id: "linha_do_tempo", label: "Linha do Tempo" },
  { id: "anexos", label: "Anexos" },
  { id: "sessoes", label: "Sessões" },
  { id: "conversas", label: "Conversas" },
];

interface ConversationHistoryItem {
  id: string;
  status: "ai" | "human" | "closed";
  lastMessage: string | null;
  updated_at: string;
}

const EMPTY_PLAN_FORM = {
  treatment_type_id: "",
  total_sessions: "10",
  total_price: "",
  start_date: "",
  goal: "",
  diagnosis: "",
  next_reassessment_date: "",
  status: "ativo" as TreatmentPlan["status"],
  notes: "",
};

const EMPTY_EVOLUTION_FORM = {
  schedule_id: "",
  evolution_date: toIso(new Date()),
  main_complaint: "",
  pain_scale: "",
  mobility_score: "",
  strength_score: "",
  rom_score: "",
  treated_region: "",
  treatment_performed: "",
  techniques_used: "",
  observations: "",
  treatment_response: "",
  guidance_given: "",
  next_goals: "",
};

const EMPTY_FORM: Omit<Patient, "id" | "created_at"> = {
  name: "",
  phone: "",
  email: "",
  birth_date: "",
  profession: "",
  health_insurance: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  main_complaint: "",
  medical_conditions: "",
  surgeries: "",
  medications: "",
  allergies: "",
  pain_scale: null,
  muscle_strength: "",
  mobility: "",
  treatment_goals: "",
  notes: "",
};

export function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tab, setTab] = useState<Tab>("resumo");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [uploadCategory, setUploadCategory] = useState<Attachment["category"]>("foto");
  const [uploading, setUploading] = useState(false);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentTypeOption[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[] | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [evolutions, setEvolutions] = useState<Evolution[] | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryItem[] | null>(null);
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const [editingEvolutionId, setEditingEvolutionId] = useState<string | null>(null);
  const [evolutionForm, setEvolutionForm] = useState(EMPTY_EVOLUTION_FORM);
  const [savingEvolution, setSavingEvolution] = useState(false);
  const [viewingEvolution, setViewingEvolution] = useState<Evolution | null>(null);
  const [evolutionAttachments, setEvolutionAttachments] = useState<Attachment[] | null>(null);
  const [evolutionUploadCategory, setEvolutionUploadCategory] = useState<Attachment["category"]>("foto");
  const [uploadingEvolutionAttachment, setUploadingEvolutionAttachment] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<TreatmentPlan | null | undefined>(undefined);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ event_date: toIso(new Date()), note: "" });
  const [savingNote, setSavingNote] = useState(false);

  function load() {
    if (!id) return;
    api
      .get<HistoryResponse>(`/patients/${id}/history`)
      .then((r) => {
        setPatient(r.patient);
        setSchedules(r.schedules);
        setForm({ ...EMPTY_FORM, ...r.patient, pain_scale: r.patient.pain_scale ?? null });
      })
      .catch((e) => setError(e.message));
  }

  function loadAttachments() {
    if (!id) return;
    api.get<{ items: Attachment[] }>(`/patients/${id}/attachments`).then((r) => setAttachments(r.items)).catch((e) => setError(e.message));
  }

  function loadPlans() {
    if (!id) return;
    api.get<{ items: TreatmentPlan[] }>(`/patients/${id}/treatment-plans`).then((r) => setPlans(r.items)).catch((e) => setError(e.message));
  }

  function loadEvolutions() {
    if (!id) return;
    api.get<{ items: Evolution[] }>(`/patients/${id}/evolutions`).then((r) => setEvolutions(r.items)).catch((e) => setError(e.message));
  }

  function loadConversationHistory() {
    if (!id) return;
    api.get<{ items: ConversationHistoryItem[] }>(`/patients/${id}/conversations`).then((r) => setConversationHistory(r.items)).catch((e) => setError(e.message));
  }

  function loadCurrentPlan() {
    if (!id) return;
    api.get<{ plan: TreatmentPlan | null }>(`/patients/${id}/treatment-plans/current`).then((r) => setCurrentPlan(r.plan)).catch(() => setCurrentPlan(null));
  }

  function loadTimeline() {
    if (!id) return;
    api.get<{ items: TimelineEvent[] }>(`/patients/${id}/timeline`).then((r) => setTimeline(r.items)).catch((e) => setError(e.message));
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingNote(true);
    setError(null);
    try {
      await api.post(`/patients/${id}/timeline-notes`, noteForm);
      setShowNoteForm(false);
      setNoteForm({ event_date: toIso(new Date()), note: "" });
      loadTimeline();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingNote(false);
    }
  }

  function handleDeleteNote(noteId: string) {
    setConfirm({
      title: "Excluir evento?",
      message: "Esse evento manual será removido da linha do tempo.",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/timeline-notes/${noteId}`);
          loadTimeline();
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }

  useEffect(load, [id]);
  useEffect(() => {
    api.get<{ items: TreatmentTypeOption[] }>("/treatment-types").then((r) => setTreatmentTypes(r.items));
  }, []);
  useEffect(loadCurrentPlan, [id]);
  useEffect(() => {
    if (tab === "anexos" && attachments === null) loadAttachments();
    if (tab === "plano" && plans === null) loadPlans();
    if (tab === "evolucao" && evolutions === null) loadEvolutions();
    if (tab === "conversas" && conversationHistory === null) loadConversationHistory();
    if (tab === "linha_do_tempo" && timeline === null) loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("newPlan") === "1") {
      setTab("plano");
      setEditingPlanId(null);
      setPlanForm(EMPTY_PLAN_FORM);
      setShowPlanForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function treatmentTypeName(treatmentTypeId: string | null): string {
    return treatmentTypes.find((t) => t.id === treatmentTypeId)?.name || "—";
  }

  function startCreatePlan() {
    setEditingPlanId(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setShowPlanForm(true);
  }

  function startEditPlan(p: TreatmentPlan) {
    setEditingPlanId(p.id);
    setPlanForm({
      treatment_type_id: p.treatment_type_id || "",
      total_sessions: String(p.total_sessions),
      total_price: p.total_price != null ? String(p.total_price) : "",
      start_date: p.start_date || "",
      goal: p.goal || "",
      diagnosis: p.diagnosis || "",
      next_reassessment_date: p.next_reassessment_date || "",
      status: p.status,
      notes: p.notes || "",
    });
    setShowPlanForm(true);
  }

  async function handleSavePlan(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingPlan(true);
    setError(null);
    try {
      const payload = {
        treatment_type_id: planForm.treatment_type_id || null,
        total_sessions: Number(planForm.total_sessions),
        total_price: planForm.total_price ? Number(planForm.total_price) : null,
        start_date: planForm.start_date || null,
        goal: planForm.goal || null,
        diagnosis: planForm.diagnosis || null,
        next_reassessment_date: planForm.next_reassessment_date || null,
        status: planForm.status,
        notes: planForm.notes || null,
      };
      if (editingPlanId) await api.patch(`/treatment-plans/${editingPlanId}`, payload);
      else await api.post(`/patients/${id}/treatment-plans`, payload);
      setShowPlanForm(false);
      loadPlans();
      loadCurrentPlan();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingPlan(false);
    }
  }

  function handleDeletePlan(p: TreatmentPlan) {
    setConfirm({
      title: "Excluir plano de tratamento?",
      message: "As sessões já registradas continuam no histórico, só o plano é removido.",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/treatment-plans/${p.id}`);
          loadPlans();
          loadCurrentPlan();
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }

  function handleDeletePatient() {
    if (!patient) return;
    setConfirm({
      title: "Excluir paciente?",
      message: `Isso remove ${patient.name || "este paciente"} e todo o histórico associado (sessões, anexos, planos). Essa ação não pode ser desfeita.`,
      onConfirm: async () => {
        setConfirm(null);
        setDeletingPatient(true);
        try {
          await api.delete(`/patients/${id}`);
          navigate("/pacientes");
        } catch (e: any) {
          setError(e.message);
          setDeletingPatient(false);
        }
      },
    });
  }

  function startCreateEvolution() {
    setEditingEvolutionId(null);
    setEvolutionForm(EMPTY_EVOLUTION_FORM);
    setShowEvolutionForm(true);
  }

  function startEditEvolution(ev: Evolution) {
    setEditingEvolutionId(ev.id);
    setEvolutionForm({
      schedule_id: ev.schedule_id || "",
      evolution_date: ev.evolution_date,
      main_complaint: ev.main_complaint || "",
      pain_scale: ev.pain_scale != null ? String(ev.pain_scale) : "",
      mobility_score: ev.mobility_score != null ? String(ev.mobility_score) : "",
      strength_score: ev.strength_score != null ? String(ev.strength_score) : "",
      rom_score: ev.rom_score != null ? String(ev.rom_score) : "",
      treated_region: ev.treated_region || "",
      treatment_performed: ev.treatment_performed || "",
      techniques_used: ev.techniques_used || "",
      observations: ev.observations || "",
      treatment_response: ev.treatment_response || "",
      guidance_given: ev.guidance_given || "",
      next_goals: ev.next_goals || "",
    });
    setViewingEvolution(null);
    setShowEvolutionForm(true);
  }

  async function handleSaveEvolution(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingEvolution(true);
    setError(null);
    try {
      const payload = {
        schedule_id: evolutionForm.schedule_id || null,
        evolution_date: evolutionForm.evolution_date,
        main_complaint: evolutionForm.main_complaint || null,
        pain_scale: evolutionForm.pain_scale !== "" ? Number(evolutionForm.pain_scale) : null,
        mobility_score: evolutionForm.mobility_score !== "" ? Number(evolutionForm.mobility_score) : null,
        strength_score: evolutionForm.strength_score !== "" ? Number(evolutionForm.strength_score) : null,
        rom_score: evolutionForm.rom_score !== "" ? Number(evolutionForm.rom_score) : null,
        treated_region: evolutionForm.treated_region || null,
        treatment_performed: evolutionForm.treatment_performed || null,
        techniques_used: evolutionForm.techniques_used || null,
        observations: evolutionForm.observations || null,
        treatment_response: evolutionForm.treatment_response || null,
        guidance_given: evolutionForm.guidance_given || null,
        next_goals: evolutionForm.next_goals || null,
      };
      if (editingEvolutionId) await api.patch(`/evolutions/${editingEvolutionId}`, payload);
      else await api.post(`/patients/${id}/evolutions`, payload);
      setShowEvolutionForm(false);
      loadEvolutions();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingEvolution(false);
    }
  }

  function handleDeleteEvolution(ev: Evolution) {
    setConfirm({
      title: "Excluir evolução?",
      message: `O registro de ${formatLongDate(ev.evolution_date)} será removido definitivamente, junto com os anexos vinculados a ele.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/evolutions/${ev.id}`);
          setViewingEvolution(null);
          loadEvolutions();
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }

  async function handleDuplicateEvolution(ev: Evolution) {
    if (!id) return;
    try {
      await api.post(`/patients/${id}/evolutions`, {
        schedule_id: null,
        evolution_date: toIso(new Date()),
        main_complaint: ev.main_complaint,
        pain_scale: ev.pain_scale,
        mobility_score: ev.mobility_score,
        strength_score: ev.strength_score,
        rom_score: ev.rom_score,
        treated_region: ev.treated_region,
        treatment_performed: ev.treatment_performed,
        techniques_used: ev.techniques_used,
        observations: ev.observations,
        treatment_response: ev.treatment_response,
        guidance_given: ev.guidance_given,
        next_goals: ev.next_goals,
      });
      loadEvolutions();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openEvolutionDetail(ev: Evolution) {
    setViewingEvolution(ev);
    setEvolutionAttachments(null);
    loadEvolutionAttachments(ev.id);
  }

  function loadEvolutionAttachments(evolutionId: string) {
    if (!id) return;
    api
      .get<{ items: Attachment[] }>(`/patients/${id}/attachments?evolutionId=${evolutionId}`)
      .then((r) => setEvolutionAttachments(r.items))
      .catch((e) => setError(e.message));
  }

  async function handleUploadEvolutionAttachment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!viewingEvolution || !id) return;
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingEvolutionAttachment(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", evolutionUploadCategory);
      formData.append("evolution_id", viewingEvolution.id);
      await api.upload(`/patients/${id}/attachments`, formData);
      input.value = "";
      loadEvolutionAttachments(viewingEvolution.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingEvolutionAttachment(false);
    }
  }

  function handleDeleteEvolutionAttachment(attachmentId: string) {
    if (!id || !viewingEvolution) return;
    const evolutionId = viewingEvolution.id;
    setConfirm({
      title: "Excluir anexo?",
      message: "O arquivo será removido definitivamente.",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/patients/${id}/attachments/${attachmentId}`);
          loadEvolutionAttachments(evolutionId);
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }

  function field(key: keyof typeof form) {
    return (form[key] as string) ?? "";
  }

  function setField(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = {
        ...form,
        birth_date: form.birth_date || null,
        pain_scale: form.pain_scale === null || form.pain_scale === ("" as any) ? null : Number(form.pain_scale),
      };
      const updated = await api.patch<Patient>(`/patients/${id}`, payload);
      setPatient(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      await api.upload(`/patients/${id}/attachments`, formData);
      input.value = "";
      loadAttachments();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteAttachment(attachmentId: string) {
    if (!id) return;
    setConfirm({
      title: "Excluir anexo?",
      message: "O arquivo será removido definitivamente.",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api.delete(`/patients/${id}/attachments/${attachmentId}`);
          loadAttachments();
        } catch (e: any) {
          setError(e.message);
        }
      },
    });
  }

  if (error && !patient) return <div className="empty-state">{error}</div>;
  if (!patient) return <div className="empty-state">Carregando...</div>;

  const saveBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
      {saved && <span style={{ fontSize: 12.5, color: "var(--accent)" }}>Salvo.</span>}
    </div>
  );

  return (
    <div>
      <BackHeader title={patient.name || "Contato sem nome"} subtitle={`${patient.phone}${patient.email ? ` · ${patient.email}` : ""} · paciente desde ${new Date(patient.created_at).toLocaleDateString("pt-BR")}`} backTo="/pacientes" />

      {error && <div className="error-text">{error}</div>}

      <div className="tab-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-nav-item${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div style={{ maxWidth: 560 }}>
          {currentPlan !== undefined && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Plano de Tratamento</div>
                {currentPlan && (
                  <span className={`badge ${PLAN_STATUS_BADGE[currentPlan.status]}`}>
                    {currentPlan.status === "ativo" ? "🟢 Em andamento" : currentPlan.status === "concluido" ? "✅ Concluído" : "Cancelado"}
                  </span>
                )}
              </div>

              {!currentPlan && (
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>Nenhum plano de tratamento ativo no momento.</div>
                  <button className="btn btn-secondary" onClick={() => { setTab("plano"); startCreatePlan(); }}>
                    Criar plano de tratamento
                  </button>
                </div>
              )}

              {currentPlan && (
                <div>
                  {currentPlan.diagnosis && (
                    <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-muted)" }}>Diagnóstico: </span>
                      {currentPlan.diagnosis}
                    </div>
                  )}
                  {currentPlan.goal && (
                    <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                      <span style={{ color: "var(--text-muted)" }}>Objetivo: </span>
                      {currentPlan.goal}
                    </div>
                  )}
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>
                    {currentPlan.sessionsCompleted} de {currentPlan.total_sessions} sessões concluídas
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--border-soft)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${currentPlan.total_sessions > 0 ? Math.min((currentPlan.sessionsCompleted / currentPlan.total_sessions) * 100, 100) : 0}%`,
                        background: currentPlan.sessionsRemaining === 1 ? "var(--red)" : currentPlan.sessionsRemaining === 2 ? "var(--yellow)" : "var(--accent)",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  {currentPlan.next_reassessment_date && (
                    <div style={{ fontSize: 12.5, marginTop: 10 }}>
                      <span style={{ color: "var(--text-muted)" }}>Próxima reavaliação: </span>
                      {new Date(`${currentPlan.next_reassessment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                  <button className="btn btn-secondary" style={{ marginTop: 14, fontSize: 12.5, height: 32, padding: "0 12px" }} onClick={() => setTab("plano")}>
                    Ver detalhes
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="card">
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="field-label">Nome</label>
              <input className="input" value={field("name")} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Telefone</label>
              <input className="input" value={field("phone")} onChange={(e) => setField("phone", e.target.value)} />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input className="input" value={field("email")} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Data de nascimento</label>
              <input className="input" type="date" value={field("birth_date")} onChange={(e) => setField("birth_date", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Profissão</label>
              <input className="input" value={field("profession")} onChange={(e) => setField("profession", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Convênio</label>
              <input className="input" value={field("health_insurance")} onChange={(e) => setField("health_insurance", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Contato de emergência — nome</label>
              <input className="input" value={field("emergency_contact_name")} onChange={(e) => setField("emergency_contact_name", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Contato de emergência — telefone</label>
              <input className="input" value={field("emergency_contact_phone")} onChange={(e) => setField("emergency_contact_phone", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Queixa principal</label>
              <textarea className="input" rows={3} value={field("main_complaint")} onChange={(e) => setField("main_complaint", e.target.value)} />
            </div>
          </div>
          {saveBar}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-soft)" }}>
            <button className="btn-danger" onClick={handleDeletePatient} disabled={deletingPatient}>
              {deletingPatient ? "Excluindo..." : "Excluir paciente"}
            </button>
          </div>
          </div>
        </div>
      )}

      {tab === "clinico" && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="field-label">Doenças</label>
              <textarea className="input" rows={2} value={field("medical_conditions")} onChange={(e) => setField("medical_conditions", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Cirurgias</label>
              <textarea className="input" rows={2} value={field("surgeries")} onChange={(e) => setField("surgeries", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Medicamentos</label>
              <textarea className="input" rows={2} value={field("medications")} onChange={(e) => setField("medications", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Alergias</label>
              <textarea className="input" rows={2} value={field("allergies")} onChange={(e) => setField("allergies", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Observações</label>
              <textarea className="input" rows={3} value={field("notes")} onChange={(e) => setField("notes", e.target.value)} />
            </div>
          </div>
          {saveBar}
        </div>
      )}

      {tab === "avaliacao" && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="field-label">Escala de dor (0-10)</label>
              <input className="input" type="number" min={0} max={10} value={form.pain_scale ?? ""} onChange={(e) => setForm({ ...form, pain_scale: e.target.value === "" ? null : (Number(e.target.value) as any) })} />
            </div>
            <div>
              <label className="field-label">Força muscular</label>
              <textarea className="input" rows={2} value={field("muscle_strength")} onChange={(e) => setField("muscle_strength", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Mobilidade</label>
              <textarea className="input" rows={2} value={field("mobility")} onChange={(e) => setField("mobility", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Objetivos do tratamento</label>
              <textarea className="input" rows={3} value={field("treatment_goals")} onChange={(e) => setField("treatment_goals", e.target.value)} />
            </div>
          </div>
          {saveBar}
        </div>
      )}

      {tab === "evolucao" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn" onClick={startCreateEvolution}>
              + Nova evolução
            </button>
          </div>

          {evolutions && evolutions.length >= 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { key: "pain_scale" as const, label: "Escala de dor", color: "var(--red)" },
                { key: "mobility_score" as const, label: "Mobilidade", color: "var(--accent)" },
                { key: "strength_score" as const, label: "Força", color: "var(--green)" },
                { key: "rom_score" as const, label: "Amplitude de movimento", color: "var(--accent-dark)" },
              ].map(({ key, label, color }) => {
                const chartData = [...evolutions]
                  .reverse()
                  .map((e, i) => ({ label: `S${i + 1}`, value: e[key] }))
                  .filter((d): d is { label: string; value: number } => d.value != null);
                if (chartData.length < 2) return null;
                return (
                  <div key={key} className="card">
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
                    <EvolutionLineChart data={chartData} color={color} ariaLabel={`Evolução de ${label.toLowerCase()} por sessão`} />
                  </div>
                );
              })}
            </div>
          )}

          {showEvolutionForm && (
            <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
              <form onSubmit={handleSaveEvolution} style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{editingEvolutionId ? "Editar evolução" : "Nova evolução"}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Data</label>
                    <input className="input" type="date" required value={evolutionForm.evolution_date} onChange={(e) => setEvolutionForm({ ...evolutionForm, evolution_date: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Escala de dor (0-10)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={10}
                      value={evolutionForm.pain_scale}
                      onChange={(e) => setEvolutionForm({ ...evolutionForm, pain_scale: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Mobilidade (0-10)</label>
                    <input className="input" type="number" min={0} max={10} value={evolutionForm.mobility_score} onChange={(e) => setEvolutionForm({ ...evolutionForm, mobility_score: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Força (0-10)</label>
                    <input className="input" type="number" min={0} max={10} value={evolutionForm.strength_score} onChange={(e) => setEvolutionForm({ ...evolutionForm, strength_score: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Amplitude de movimento (0-10)</label>
                    <input className="input" type="number" min={0} max={10} value={evolutionForm.rom_score} onChange={(e) => setEvolutionForm({ ...evolutionForm, rom_score: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Sessão vinculada (opcional)</label>
                  <select className="input" value={evolutionForm.schedule_id} onChange={(e) => setEvolutionForm({ ...evolutionForm, schedule_id: e.target.value })}>
                    <option value="">Nenhuma</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(`${s.date}T12:00:00`).toLocaleDateString("pt-BR")} — {s.procedure}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Queixa do paciente</label>
                  <textarea className="input" rows={2} value={evolutionForm.main_complaint} onChange={(e) => setEvolutionForm({ ...evolutionForm, main_complaint: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Região tratada</label>
                  <input className="input" value={evolutionForm.treated_region} onChange={(e) => setEvolutionForm({ ...evolutionForm, treated_region: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Conduta realizada</label>
                  <textarea className="input" rows={2} value={evolutionForm.treatment_performed} onChange={(e) => setEvolutionForm({ ...evolutionForm, treatment_performed: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Técnicas utilizadas</label>
                  <textarea className="input" rows={2} value={evolutionForm.techniques_used} onChange={(e) => setEvolutionForm({ ...evolutionForm, techniques_used: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Observações</label>
                  <textarea className="input" rows={2} value={evolutionForm.observations} onChange={(e) => setEvolutionForm({ ...evolutionForm, observations: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Resposta ao tratamento</label>
                  <textarea className="input" rows={2} value={evolutionForm.treatment_response} onChange={(e) => setEvolutionForm({ ...evolutionForm, treatment_response: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Orientações passadas</label>
                  <textarea className="input" rows={2} value={evolutionForm.guidance_given} onChange={(e) => setEvolutionForm({ ...evolutionForm, guidance_given: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Próximos objetivos</label>
                  <textarea className="input" rows={2} value={evolutionForm.next_goals} onChange={(e) => setEvolutionForm({ ...evolutionForm, next_goals: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" type="submit" disabled={savingEvolution}>
                    {savingEvolution ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowEvolutionForm(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {evolutions === null && <div className="empty-state">Carregando...</div>}
          {evolutions && evolutions.length === 0 && (
            <EmptyState title="Nenhuma evolução registrada" description="Registre a primeira evolução clínica desse paciente." actionLabel="Registrar primeira evolução" onAction={startCreateEvolution} />
          )}

          {evolutions && evolutions.length > 0 && (
            <div>
              {evolutions.map((ev, i) => {
                const pain = painScaleBadge(ev.pain_scale);
                return (
                  <div key={ev.id} style={{ display: "flex", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, flex: "0 0 12px" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", marginTop: 8, flex: "0 0 auto" }} />
                      {i < evolutions.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border-soft)", marginTop: 4 }} />}
                    </div>
                    <div className="card" style={{ flex: 1, marginBottom: 16, cursor: "pointer" }} onClick={() => openEvolutionDetail(ev)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{formatLongDate(ev.evolution_date)}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ev.staffName || "Profissional"}</div>
                        </div>
                        {pain && <span className={`badge ${pain.className}`}>{pain.label}</span>}
                      </div>
                      {ev.treated_region && <div style={{ fontSize: 12.5, marginTop: 8 }}>Região: {ev.treated_region}</div>}
                      {ev.main_complaint && (
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.main_complaint}</div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => startEditEvolution(ev)}>
                          Editar
                        </button>
                        <button className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDuplicateEvolution(ev)}>
                          Duplicar
                        </button>
                        <button className="btn-danger" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDeleteEvolution(ev)}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "plano" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn" onClick={startCreatePlan}>
              + Novo plano
            </button>
          </div>

          {showPlanForm && (
            <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
              <form onSubmit={handleSavePlan} style={{ display: "grid", gap: 12 }}>
                <div>
                  <label className="field-label">Tipo de atendimento</label>
                  <select className="input" value={planForm.treatment_type_id} onChange={(e) => setPlanForm({ ...planForm, treatment_type_id: e.target.value })}>
                    <option value="">Selecione...</option>
                    {treatmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Sessões contratadas</label>
                    <input className="input" type="number" min={1} required value={planForm.total_sessions} onChange={(e) => setPlanForm({ ...planForm, total_sessions: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Valor total (opcional)</label>
                    <input className="input" type="number" step="0.01" value={planForm.total_price} onChange={(e) => setPlanForm({ ...planForm, total_price: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Data de início</label>
                    <input className="input" type="date" value={planForm.start_date} onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Próxima reavaliação</label>
                    <input className="input" type="date" value={planForm.next_reassessment_date} onChange={(e) => setPlanForm({ ...planForm, next_reassessment_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Diagnóstico principal</label>
                  <input className="input" value={planForm.diagnosis} onChange={(e) => setPlanForm({ ...planForm, diagnosis: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Objetivo do tratamento</label>
                  <textarea className="input" rows={2} value={planForm.goal} onChange={(e) => setPlanForm({ ...planForm, goal: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Status</label>
                  <select className="input" value={planForm.status} onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as TreatmentPlan["status"] })}>
                    <option value="ativo">Ativo</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" type="submit" disabled={savingPlan}>
                    {savingPlan ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowPlanForm(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {plans === null && <div className="empty-state">Carregando...</div>}
          {plans && plans.length === 0 && (
            <EmptyState title="Nenhum plano de tratamento" description="Crie o primeiro plano pra acompanhar sessões contratadas e progresso." actionLabel="Criar primeiro plano" onAction={startCreatePlan} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {plans?.map((p) => {
              const progress = p.total_sessions > 0 ? Math.min((p.sessionsCompleted / p.total_sessions) * 100, 100) : 0;
              const nearEnd = p.status === "ativo" && p.sessionsRemaining >= 1 && p.sessionsRemaining <= 2;
              const barColor = p.status === "ativo" && p.sessionsRemaining === 1 ? "var(--red)" : p.status === "ativo" && p.sessionsRemaining === 2 ? "var(--yellow)" : "var(--accent)";
              return (
                <div key={p.id} className="card" style={nearEnd ? { borderColor: p.sessionsRemaining === 1 ? "var(--red)" : "var(--yellow)" } : undefined}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{treatmentTypeName(p.treatment_type_id)}</div>
                    <span className={`badge ${PLAN_STATUS_BADGE[p.status]}`}>{p.status}</span>
                  </div>
                  {p.diagnosis && <div style={{ fontSize: 12.5, marginTop: 6 }}>Diagnóstico: {p.diagnosis}</div>}
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    {p.sessionsCompleted} de {p.total_sessions} sessões realizadas ({p.sessionsRemaining} restantes)
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--border-soft)", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: barColor, borderRadius: 3 }} />
                  </div>
                  {nearEnd && (
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, color: p.sessionsRemaining === 1 ? "var(--red)" : "var(--yellow)" }}>
                      {p.sessionsRemaining === 1 ? "Última sessão disponível" : "Restam apenas 2 sessões"}
                    </div>
                  )}
                  {p.total_price != null && <div style={{ fontSize: 12.5, marginTop: 8 }}>Valor total: {formatMoney(p.total_price)}</div>}
                  {p.goal && <div style={{ fontSize: 12.5, marginTop: 6 }}>Objetivo: {p.goal}</div>}
                  {p.next_reassessment_date && (
                    <div style={{ fontSize: 12.5, marginTop: 6 }}>Próxima reavaliação: {new Date(`${p.next_reassessment_date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => startEditPlan(p)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => handleDeletePlan(p)}>
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "linha_do_tempo" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn" onClick={() => setShowNoteForm(true)}>
              + Adicionar evento
            </button>
          </div>

          {showNoteForm && (
            <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
              <form onSubmit={handleAddNote} style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Novo evento</div>
                <div>
                  <label className="field-label">Data</label>
                  <input className="input" type="date" required value={noteForm.event_date} onChange={(e) => setNoteForm({ ...noteForm, event_date: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">O que aconteceu</label>
                  <textarea className="input" rows={2} required placeholder="Ex: Paciente iniciou academia" value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" type="submit" disabled={savingNote}>
                    {savingNote ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowNoteForm(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {timeline === null && <div className="empty-state">Carregando...</div>}
          {timeline && timeline.length === 0 && <EmptyState title="Nenhum evento ainda" description="Conforme o paciente for utilizando o sistema, os eventos aparecem aqui automaticamente." />}
          {timeline && timeline.length > 0 && (
            <div>
              {timeline.map((ev, i) => (
                <div key={ev.id} style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, flex: "0 0 12px" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: TIMELINE_COLORS[ev.type] || "var(--accent)", marginTop: 8, flex: "0 0 auto" }} />
                    {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border-soft)", marginTop: 4 }} />}
                  </div>
                  <div className="card" style={{ flex: 1, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                          {TIMELINE_ICONS[ev.type] || "•"} {ev.label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(`${ev.date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                      </div>
                      {ev.noteId && (
                        <button className="btn-danger" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDeleteNote(ev.noteId!)}>
                          Excluir
                        </button>
                      )}
                    </div>
                    {ev.detail && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>{ev.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "anexos" && (
        <div>
          <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
            <form onSubmit={handleUpload} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="field-label">Tipo</label>
                <select className="input" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as Attachment["category"])}>
                  <option value="foto">Foto</option>
                  <option value="exame">Exame (raio-x, ressonância...)</option>
                  <option value="documento">Documento</option>
                </select>
              </div>
              <div>
                <label className="field-label">Arquivo</label>
                <input className="input" type="file" name="file" required accept="image/*,application/pdf" />
              </div>
              <button className="btn" type="submit" disabled={uploading} style={{ justifySelf: "start" }}>
                {uploading ? "Enviando..." : "Enviar anexo"}
              </button>
            </form>
          </div>

          {attachments === null && <div className="empty-state">Carregando...</div>}
          {attachments && attachments.length === 0 && <div className="empty-state">Nenhum anexo ainda.</div>}
          {attachments && attachments.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {attachments.map((a) => (
                <div key={a.id} className="card" style={{ padding: 10 }}>
                  {a.mime_type?.startsWith("image/") && a.url ? (
                    <img src={a.url} alt={a.file_name} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
                  ) : (
                    <div style={{ width: "100%", height: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-bg)", borderRadius: 8, marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
                      {a.category}
                    </div>
                  )}
                  <div style={{ fontSize: 12, wordBreak: "break-all", marginBottom: 6 }}>{a.file_name}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ fontSize: 11.5, padding: "4px 8px" }}>
                        Abrir
                      </a>
                    )}
                    <button className="btn-danger" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDeleteAttachment(a.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sessoes" && (
        <div>
          {schedules.length === 0 && <div className="empty-state">Nenhuma sessão registrada ainda.</div>}
          <div className="card" style={{ padding: 0 }}>
            {schedules.map((s) => (
              <div key={s.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.procedure}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(`${s.date}T12:00:00`).toLocaleDateString("pt-BR")} às {s.time.slice(0, 5)}
                    </div>
                  </div>
                  <span className={`badge ${STATUS_BADGE[s.status] || "badge-neutral"}`}>{s.status}</span>
                </div>
                {s.evolution_note && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>{s.evolution_note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "conversas" && (
        <div>
          {conversationHistory === null && <div className="empty-state">Carregando...</div>}
          {conversationHistory !== null && conversationHistory.length === 0 && (
            <EmptyState title="Nenhuma conversa registrada" description="Esse paciente ainda não trocou mensagens pelo WhatsApp." />
          )}
          {conversationHistory !== null && conversationHistory.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              {conversationHistory.map((c) => (
                <div key={c.id} className="mobile-list-item" style={{ cursor: "pointer" }} onClick={() => navigate(`/conversas?id=${c.id}`)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
                    <span className={`badge ${c.status === "human" ? "badge-blue" : c.status === "closed" ? "badge-neutral" : "badge-green"}`}>
                      {c.status === "human" ? "Humano" : c.status === "closed" ? "Encerrada" : "IA"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewingEvolution && (
        <div className="modal-overlay" onClick={() => setViewingEvolution(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, textTransform: "capitalize" }}>{formatLongDate(viewingEvolution.evolution_date)}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{viewingEvolution.staffName || "Profissional"}</div>
              </div>
              {painScaleBadge(viewingEvolution.pain_scale) && (
                <span className={`badge ${painScaleBadge(viewingEvolution.pain_scale)!.className}`}>{painScaleBadge(viewingEvolution.pain_scale)!.label}</span>
              )}
            </div>

            {(viewingEvolution.mobility_score != null || viewingEvolution.strength_score != null || viewingEvolution.rom_score != null) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {viewingEvolution.mobility_score != null && <span className="badge badge-neutral">Mobilidade {viewingEvolution.mobility_score}/10</span>}
                {viewingEvolution.strength_score != null && <span className="badge badge-neutral">Força {viewingEvolution.strength_score}/10</span>}
                {viewingEvolution.rom_score != null && <span className="badge badge-neutral">ADM {viewingEvolution.rom_score}/10</span>}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-soft)" }}>
              {evolutionField("Queixa do paciente", viewingEvolution.main_complaint)}
              {evolutionField("Região tratada", viewingEvolution.treated_region)}
              {evolutionField("Conduta realizada", viewingEvolution.treatment_performed)}
              {evolutionField("Técnicas utilizadas", viewingEvolution.techniques_used)}
              {evolutionField("Observações", viewingEvolution.observations)}
              {evolutionField("Resposta ao tratamento", viewingEvolution.treatment_response)}
              {evolutionField("Orientações passadas", viewingEvolution.guidance_given)}
              {evolutionField("Próximos objetivos", viewingEvolution.next_goals)}
            </div>

            <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Anexos</div>

              {evolutionAttachments === null && <div className="empty-state">Carregando...</div>}
              {evolutionAttachments && evolutionAttachments.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 12 }}>Nenhum anexo nessa evolução.</div>}
              {evolutionAttachments && evolutionAttachments.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
                  {evolutionAttachments.map((a) => (
                    <div key={a.id} className="card" style={{ padding: 8 }}>
                      {a.mime_type?.startsWith("image/") && a.url ? (
                        <img src={a.url} alt={a.file_name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 6 }} />
                      ) : (
                        <div style={{ width: "100%", height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-bg)", borderRadius: 6, marginBottom: 6, fontSize: 11, color: "var(--text-muted)" }}>
                          {a.category}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, wordBreak: "break-all", marginBottom: 6 }}>{a.file_name}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ fontSize: 10.5, padding: "3px 6px" }}>
                            Abrir
                          </a>
                        )}
                        <button className="btn-danger" style={{ fontSize: 10.5, padding: "3px 6px" }} onClick={() => handleDeleteEvolutionAttachment(a.id)}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleUploadEvolutionAttachment} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select className="input" style={{ maxWidth: 150 }} value={evolutionUploadCategory} onChange={(e) => setEvolutionUploadCategory(e.target.value as Attachment["category"])}>
                  <option value="foto">Foto</option>
                  <option value="exame">Exame</option>
                  <option value="documento">Documento</option>
                </select>
                <input className="input" style={{ maxWidth: 220 }} type="file" name="file" required accept="image/*,application/pdf" />
                <button className="btn btn-secondary" type="submit" disabled={uploadingEvolutionAttachment}>
                  {uploadingEvolutionAttachment ? "Enviando..." : "Anexar"}
                </button>
              </form>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
              <button className="btn btn-secondary" onClick={() => startEditEvolution(viewingEvolution)}>
                Editar
              </button>
              <button className="btn btn-secondary" onClick={() => handleDuplicateEvolution(viewingEvolution)}>
                Duplicar
              </button>
              <button className="btn-danger" onClick={() => handleDeleteEvolution(viewingEvolution)}>
                Excluir
              </button>
              <button className="btn btn-secondary" onClick={() => setViewingEvolution(null)} style={{ marginLeft: "auto" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirm} title={confirm?.title || ""} message={confirm?.message || ""} onConfirm={() => confirm?.onConfirm()} onCancel={() => setConfirm(null)} />
    </div>
  );
}
