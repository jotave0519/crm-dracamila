import { useNavigate, useLocation } from "react-router-dom";
import { BellIcon } from "./icons";

const TITLES: Record<string, string> = {
  "/": "Início",
  "/agenda": "Agenda",
  "/pacientes": "Pacientes",
  "/conversas": "Conversas",
  "/tipos-atendimento": "Tipos de Atendimento",
  "/horarios-clinica": "Horários da Clínica",
  "/financeiro": "Financeiro",
  "/estoque": "Estoque",
  "/lembretes": "Lembretes",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
};

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = TITLES[location.pathname] || "Clínica";

  return (
    <header className="mobile-header">
      <div className="mobile-header-title">{title}</div>
      <button className="mobile-icon-btn" onClick={() => navigate("/lembretes")}>
        <BellIcon />
      </button>
    </header>
  );
}
