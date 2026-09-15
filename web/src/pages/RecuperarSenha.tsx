import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { supabase } from "../lib/supabaseClient";

// Pagina que recebe o link de "esqueci minha senha" enviado pelo Supabase
// (ver Login.tsx). O proprio supabase-js detecta o token de recuperacao na
// URL e abre uma sessao temporaria disparando o evento PASSWORD_RECOVERY -
// so depois disso e seguro deixar a pessoa definir a senha nova.
export function RecuperarSenha() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError("Não foi possível salvar a nova senha. Peça um novo link de recuperação e tente de novo.");
        return;
      }
      showToast("Senha alterada com sucesso.");
      navigate("/", { replace: true });
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente mais tarde.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="login-shell">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span className="spinner" />
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: "center" }}>
          <h1 className="page-title" style={{ fontSize: 20, marginBottom: 10 }}>
            Link inválido
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Este link de recuperação não é mais válido ou já expirou. Volte para o login e peça um novo.
          </p>
          <button type="button" className="btn" style={{ marginTop: 18, width: "100%" }} onClick={() => navigate("/login")}>
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
          <h1 className="page-title" style={{ fontSize: 22 }}>
            Nova senha
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>Escolha uma nova senha de acesso.</p>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Nova senha</label>
          <input className="input" type="password" required minLength={6} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="field-label">Confirmar senha</label>
          <input className="input" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>

        <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
