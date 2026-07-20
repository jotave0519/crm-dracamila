import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BackHeader } from "../components/BackHeader";
import { api } from "../lib/api";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
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
  status: "ativo" | "concluido" | "cancelado";
  notes: string | null;
  sessionsCompleted: number;
  sessionsRemaining: number;
}

interface Payment {
  id: string;
  treatment_plan_id: string | null;
  amount: number;
  payment_date: string;
  method: string | null;
  notes: string | null;
}

const STATUS_BADGE: Record<string, string> = { Agendado: "badge-blue", Confirmado: "badge-yellow", Concluido: "badge-green", Faltou: "badge-red", Cancelado: "badge-neutral" };
const PLAN_STATUS_BADGE: Record<string, string> = { ativo: "badge-blue", concluido: "badge-green", cancelado: "badge-neutral" };

function formatMoney(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Tab = "resumo" | "clinico" | "avaliacao" | "plano" | "financeiro" | "anexos" | "sessoes";
const TABS: { id: Tab; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "clinico", label: "Histórico Clínico" },
  { id: "avaliacao", label: "Avaliação Física" },
  { id: "plano", label: "Plano de Tratamento" },
  { id: "financeiro", label: "Financeiro" },
  { id: "anexos", label: "Anexos" },
  { id: "sessoes", label: "Sessões" },
];

const EMPTY_PLAN_FORM = { treatment_type_id: "", total_sessions: "10", total_price: "", start_date: "", goal: "", status: "ativo" as TreatmentPlan["status"], notes: "" };
const EMPTY_PAYMENT_FORM = { amount: "", payment_date: new Date().toLocaleDateString("en-CA"), method: "", treatment_plan_id: "", notes: "" };

const EMPTY_FORM: Omit<Patient, "id" | "created_at"> = {
  name: "",
  phone: "",
  email: "",
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
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [savingPayment, setSavingPayment] = useState(false);

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

  function loadPayments() {
    if (!id) return;
    api.get<{ items: Payment[] }>(`/patients/${id}/payments`).then((r) => setPayments(r.items)).catch((e) => setError(e.message));
  }

  useEffect(load, [id]);
  useEffect(() => {
    api.get<{ items: TreatmentTypeOption[] }>("/treatment-types").then((r) => setTreatmentTypes(r.items));
  }, []);
  useEffect(() => {
    if (tab === "anexos" && attachments === null) loadAttachments();
    if ((tab === "plano" || tab === "financeiro") && plans === null) loadPlans();
    if (tab === "financeiro" && payments === null) loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
        status: planForm.status,
        notes: planForm.notes || null,
      };
      if (editingPlanId) await api.patch(`/treatment-plans/${editingPlanId}`, payload);
      else await api.post(`/patients/${id}/treatment-plans`, payload);
      setShowPlanForm(false);
      loadPlans();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan(p: TreatmentPlan) {
    if (!window.confirm("Excluir este plano de tratamento? As sessões já registradas continuam no histórico.")) return;
    try {
      await api.delete(`/treatment-plans/${p.id}`);
      loadPlans();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSavePayment(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingPayment(true);
    setError(null);
    try {
      await api.post(`/patients/${id}/payments`, {
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date || null,
        method: paymentForm.method || null,
        treatment_plan_id: paymentForm.treatment_plan_id || null,
        notes: paymentForm.notes || null,
      });
      setShowPaymentForm(false);
      setPaymentForm(EMPTY_PAYMENT_FORM);
      loadPayments();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!window.confirm("Excluir este pagamento?")) return;
    try {
      await api.delete(`/payments/${paymentId}`);
      loadPayments();
    } catch (e: any) {
      setError(e.message);
    }
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
      const payload = { ...form, pain_scale: form.pain_scale === null || form.pain_scale === ("" as any) ? null : Number(form.pain_scale) };
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

  async function handleDeleteAttachment(attachmentId: string) {
    if (!id) return;
    if (!window.confirm("Excluir este anexo?")) return;
    try {
      await api.delete(`/patients/${id}/attachments/${attachmentId}`);
      loadAttachments();
    } catch (e: any) {
      setError(e.message);
    }
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
        <div className="card" style={{ maxWidth: 560 }}>
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
                <div>
                  <label className="field-label">Data de início</label>
                  <input className="input" type="date" value={planForm.start_date} onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })} />
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
          {plans && plans.length === 0 && <div className="empty-state">Nenhum plano de tratamento cadastrado.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {plans?.map((p) => {
              const progress = p.total_sessions > 0 ? Math.min((p.sessionsCompleted / p.total_sessions) * 100, 100) : 0;
              return (
                <div key={p.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{treatmentTypeName(p.treatment_type_id)}</div>
                    <span className={`badge ${PLAN_STATUS_BADGE[p.status]}`}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    {p.sessionsCompleted} de {p.total_sessions} sessões realizadas ({p.sessionsRemaining} restantes)
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--border-soft)", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 3 }} />
                  </div>
                  {p.total_price != null && <div style={{ fontSize: 12.5, marginTop: 8 }}>Valor total: {formatMoney(p.total_price)}</div>}
                  {p.goal && <div style={{ fontSize: 12.5, marginTop: 6 }}>Objetivo: {p.goal}</div>}
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

      {tab === "financeiro" && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="kpi-value">{formatMoney((payments || []).reduce((sum, p) => sum + Number(p.amount), 0))}</div>
              <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Total pago</div>
            </div>
            {(plans || [])
              .filter((p) => p.total_price != null)
              .map((p) => {
                const paid = (payments || []).filter((pay) => pay.treatment_plan_id === p.id).reduce((sum, pay) => sum + Number(pay.amount), 0);
                const pending = Math.max((p.total_price || 0) - paid, 0);
                return (
                  <div className="card" key={p.id}>
                    <div className="kpi-value">{formatMoney(pending)}</div>
                    <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>Pendente — {treatmentTypeName(p.treatment_type_id)}</div>
                  </div>
                );
              })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn" onClick={() => setShowPaymentForm(true)}>
              + Novo pagamento
            </button>
          </div>

          {showPaymentForm && (
            <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
              <form onSubmit={handleSavePayment} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Valor</label>
                    <input className="input" type="number" step="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Data</label>
                    <input className="input" type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Forma de pagamento</label>
                  <input className="input" placeholder="Pix, dinheiro, cartão..." value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Plano de tratamento (opcional)</label>
                  <select className="input" value={paymentForm.treatment_plan_id} onChange={(e) => setPaymentForm({ ...paymentForm, treatment_plan_id: e.target.value })}>
                    <option value="">Pagamento avulso</option>
                    {plans?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {treatmentTypeName(p.treatment_type_id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" type="submit" disabled={savingPayment}>
                    {savingPayment ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowPaymentForm(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {payments === null && <div className="empty-state">Carregando...</div>}
          {payments && payments.length === 0 && <div className="empty-state">Nenhum pagamento registrado ainda.</div>}
          {payments && payments.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              {payments.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{formatMoney(p.amount)}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(`${p.payment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                      {p.method ? ` · ${p.method}` : ""}
                      {p.treatment_plan_id ? ` · ${treatmentTypeName(plans?.find((pl) => pl.id === p.treatment_plan_id)?.treatment_type_id || null)}` : " · avulso"}
                    </div>
                  </div>
                  <button className="btn-danger" style={{ fontSize: 11.5, padding: "4px 8px" }} onClick={() => handleDeletePayment(p.id)}>
                    Excluir
                  </button>
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
    </div>
  );
}
