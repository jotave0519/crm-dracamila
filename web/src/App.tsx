import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Agenda } from "./pages/Agenda";
import { Configuracoes } from "./pages/Configuracoes";
import { Conversas } from "./pages/Conversas";
import { Dashboard } from "./pages/Dashboard";
import { Estoque } from "./pages/Estoque";
import { HorariosClinica } from "./pages/HorariosClinica";
import { Lembretes } from "./pages/Lembretes";
import { Login } from "./pages/Login";
import { Pacientes } from "./pages/Pacientes";
import { PatientDetail } from "./pages/PatientDetail";
import { Relatorios } from "./pages/Relatorios";
import { TiposAtendimento } from "./pages/TiposAtendimento";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/pacientes" element={<Pacientes />} />
                <Route path="/pacientes/:id" element={<PatientDetail />} />
                <Route path="/conversas" element={<Conversas />} />
                <Route path="/tipos-atendimento" element={<TiposAtendimento />} />
                <Route path="/horarios-clinica" element={<HorariosClinica />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/lembretes" element={<Lembretes />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
