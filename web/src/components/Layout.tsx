import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Início" },
      { to: "/agenda", label: "Agenda" },
      { to: "/pacientes", label: "Pacientes" },
      { to: "/conversas", label: "Conversas" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/tipos-atendimento", label: "Tipos de Atendimento" },
      { to: "/horarios-clinica", label: "Horários da Clínica" },
    ],
  },
];

export function Layout() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const email = session?.user.email || "";
  const initials = email.slice(0, 2).toUpperCase();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100%" }}>
        <MobileHeader />
        <main className="main">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <span>D</span>
          </div>
          <div>
            <div className="sidebar-brand-name">Dra. Camila</div>
            <div className="sidebar-brand-sub">Fisioterapia</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: "auto" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button className="sidebar-footer" onClick={() => navigate("/configuracoes")}>
          <div className="sidebar-footer-avatar">{initials || "?"}</div>
          <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Configurações</div>
          </div>
        </button>
      </aside>

      <div className="main-column">
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
