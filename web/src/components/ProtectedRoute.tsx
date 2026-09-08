import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { session, loading, error } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-state" style={{ minHeight: "100dvh", textAlign: "center", maxWidth: 360, margin: "0 auto" }}>
        <p style={{ color: "var(--text)" }}>{error}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
