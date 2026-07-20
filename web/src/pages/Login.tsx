import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

export function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("E-mail ou senha inválidos.");
    setSubmitting(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="sidebar-brand-mark" style={{ margin: "0 auto 12px" }}>
            <span>D</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 22 }}>
            Dra. Camila
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>Fisioterapia — CRM</p>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label className="field-label">E-mail</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Senha</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
