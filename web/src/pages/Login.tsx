import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

// Clinica de uma unica profissional - so existe uma conta, entao a tela de
// login pede so a senha (o e-mail continua sendo usado por baixo dos panos
// para autenticar de verdade no Supabase Auth).
const ACCOUNT_EMAIL = "dra.teste@dracamila.com";

// Mostra so um pedaco do e-mail (ex: "d***e@dracamila.com") pra confirmar pra
// quem esqueceu a senha que o link foi mesmo enviado, sem expor o e-mail
// inteiro na tela de recuperacao.
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain || user.length < 2) return email;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export function Login() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: ACCOUNT_EMAIL, password });
      if (error) setError("Senha inválida.");
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente mais tarde.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setSendingReset(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(ACCOUNT_EMAIL, {
        redirectTo: `${window.location.origin}/recuperar-senha`,
      });
      if (error) {
        setError("Não foi possível enviar o link de recuperação agora. Tente novamente em instantes.");
        return;
      }
      setResetSent(true);
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente mais tarde.");
    } finally {
      setSendingReset(false);
    }
  }

  if (resetSent) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: "center" }}>
          <h1 className="page-title" style={{ fontSize: 20, marginBottom: 10 }}>
            Link enviado
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Enviamos um link para redefinir a senha para <strong>{maskEmail(ACCOUNT_EMAIL)}</strong>. Abra o e-mail e siga o
            link pra criar uma senha nova.
          </p>
          <button type="button" className="btn" style={{ marginTop: 18, width: "100%" }} onClick={() => setResetSent(false)}>
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="login-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="sidebar-brand-mark" style={{ width: 44, height: 44, borderRadius: 13, fontSize: 24, margin: "0 auto 14px" }}>
            <span>C</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 22 }}>
            Conta Doutora Camila
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>Fisioterapia — CRM</p>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ marginBottom: 10 }}>
          <label className="field-label">Senha</label>
          <input className="input" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div style={{ textAlign: "right", marginBottom: 18 }}>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={sendingReset}
            style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}
          >
            {sendingReset ? "Enviando..." : "Esqueci minha senha"}
          </button>
        </div>

        <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
