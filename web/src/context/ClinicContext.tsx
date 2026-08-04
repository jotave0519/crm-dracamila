import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

interface ClinicContextValue {
  clinicName: string;
  professionalName: string;
}

const DEFAULTS: ClinicContextValue = { clinicName: "Clínica", professionalName: "Profissional" };

const ClinicContext = createContext<ClinicContextValue>(DEFAULTS);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [clinic, setClinic] = useState<ClinicContextValue>(DEFAULTS);

  useEffect(() => {
    if (!session) return;
    api
      .get<{ clinic: { name: string; responsible_name: string | null } }>("/settings")
      .then((r) => setClinic({ clinicName: r.clinic.name || DEFAULTS.clinicName, professionalName: r.clinic.responsible_name || DEFAULTS.professionalName }))
      .catch(() => {});
  }, [session]);

  return <ClinicContext.Provider value={clinic}>{children}</ClinicContext.Provider>;
}

export function useClinic(): ClinicContextValue {
  return useContext(ClinicContext);
}
