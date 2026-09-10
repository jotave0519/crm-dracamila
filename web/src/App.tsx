import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { InstallPrompt } from "./components/InstallPrompt";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { AuthProvider } from "./context/AuthContext";
import { ClinicProvider } from "./context/ClinicContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { Agenda } from "./pages/Agenda";
import { AssistenteIA } from "./pages/AssistenteIA";
import { Configuracoes } from "./pages/Configuracoes";
import { Conversas } from "./pages/Conversas";
import { Dashboard } from "./pages/Dashboard";
import { Estoque } from "./pages/Estoque";
import { Financeiro } from "./pages/Financeiro";
import { HorariosClinica } from "./pages/HorariosClinica";
import { Lembretes } from "./pages/Lembretes";
import { Login } from "./pages/Login";
import { Pacientes } from "./pages/Pacientes";
import { PatientDetail } from "./pages/PatientDetail";
import { Relatorios } from "./pages/Relatorios";
import { TiposAtendimento } from "./pages/TiposAtendimento";
import { WhatsappIA } from "./pages/WhatsappIA";

export function App() {
  // Some a splash critica (ver index.html) assim que o React montou - evita
  // o "flash" de tela vazia e o piscar de tema entre o HTML e o app.
  useEffect(() => {
    const splash = document.getElementById("app-splash");
    if (!splash) return;
    splash.classList.add("splash-hide");
    const timeout = setTimeout(() => splash.remove(), 250);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <ThemeProvider>
      <InstallPrompt />
      <UpdatePrompt />
      <BrowserRouter>
        <AuthProvider>
          <ClinicProvider>
          <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/pacientes" element={<Pacientes />} />
                <Route path="/pacientes/:id" element={<PatientDetail />} />
                <Route path="/conversas" element={<Conversas />} />
                <Route path="/whatsapp-ia" element={<WhatsappIA />} />
                <Route path="/assistente-ia" element={<AssistenteIA />} />
                <Route path="/tipos-atendimento" element={<TiposAtendimento />} />
                <Route path="/horarios-clinica" element={<HorariosClinica />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/lembretes" element={<Lembretes />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
          </Routes>
          </ToastProvider>
          </ClinicProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
