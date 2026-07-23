import { FormEvent, useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { MoonIcon, SunIcon } from "../components/icons";
import { api } from "../lib/api";

interface ClinicSettings {
  name: string;
  responsible_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  about_text: string | null;
  general_notes: string | null;
  days_without_return_threshold: number;
}

export function Configuracoes() {
  const { theme, setTheme } = useTheme();
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ clinic: ClinicSettings }>("/settings").then((r) => setClinic(r.clinic)).catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clinic) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch("/settings", { clinic });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof ClinicSettings) {
    if (!clinic) return null;
    return (
      <div>
        <label className="field-label">{label}</label>
        <input className="input" value={(clinic as any)[key] || ""} onChange={(e) => setClinic({ ...clinic, [key]: e.target.value })} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Dados da clínica e preferências da plataforma</p>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Preferências</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>Tema da plataforma</span>
            <div className="segmented">
              <span className={`segmented-item${theme === "light" ? " active" : ""}`} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setTheme("light")}>
                <SunIcon width={14} height={14} /> Claro
              </span>
              <span className={`segmented-item${theme === "dark" ? " active" : ""}`} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setTheme("dark")}>
                <MoonIcon width={14} height={14} /> Escuro
              </span>
            </div>
          </div>
          {clinic && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>Dias sem retorno para gerar lembrete</span>
              <input
                className="input"
                type="number"
                min={1}
                style={{ width: 90 }}
                value={clinic.days_without_return_threshold}
                onChange={(e) => setClinic({ ...clinic, days_without_return_threshold: Number(e.target.value) })}
              />
            </div>
          )}
        </div>

        {clinic && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {saved && <div style={{ color: "var(--green)", fontSize: 12.5 }}>Informações salvas.</div>}

            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Dados da clínica</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>Usados pela IA para responder dúvidas sobre a clínica no WhatsApp</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {field("Nome da clínica", "name")}
                {field("Nome da responsável", "responsible_name")}
                {field("Endereço completo", "address")}
                {field("Cidade", "city")}
                {field("Estado", "state")}
                {field("CEP", "zip_code")}
                {field("Telefone", "phone")}
                {field("E-mail", "email")}
                {field("Instagram", "instagram")}
                {field("Site", "website")}
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Sobre a clínica</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>Usado quando o cliente perguntar "quem é a fisioterapeuta?" ou "como funciona a clínica?"</div>
              <textarea className="input" rows={4} value={clinic.about_text || ""} onChange={(e) => setClinic({ ...clinic, about_text: e.target.value })} />
            </div>

            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Observações gerais</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>Qualquer informação adicional que a IA deve levar em conta</div>
              <textarea className="input" rows={3} value={clinic.general_notes || ""} onChange={(e) => setClinic({ ...clinic, general_notes: e.target.value })} />
            </div>

            <button className="btn" type="submit" disabled={saving} style={{ width: "fit-content" }}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
