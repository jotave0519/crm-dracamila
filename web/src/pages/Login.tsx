import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

// Clinica de uma unica profissional - so existe uma conta, entao a tela de
// login pede so a senha (o e-mail continua sendo usado por baixo dos panos
// para autenticar de verdade no Supabase Auth).
const ACCOUNT_EMAIL = "dra.teste@dracamila.com";

export function Login() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: ACCOUNT_EMAIL, password });
    if (error) setError("Senha inválida.");
    setSubmitting(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="sidebar-brand-mark" style={{ margin: "0 auto 12px" }}>
            <span>C</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 22 }}>
            Conta Teste
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>Fisioterapia — CRM</p>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Senha</label>
          <input className="input" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
