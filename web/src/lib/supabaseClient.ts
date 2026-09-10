import { createClient } from "@supabase/supabase-js";

// A URL e a chave anon do Supabase sao publicas por design (a seguranca real
// vem das policies RLS no banco) e de qualquer forma ficam visiveis no bundle
// do front. Por isso ficam aqui como padrao: assim o deploy funciona mesmo que
// as variaveis VITE_* nao cheguem como build args (ex: EasyPanel). Em dev, o
// web/.env continua tendo prioridade.
const FALLBACK_URL = "https://siezqwhracmdsugsqtdz.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZXpxd2hyYWNtZHN1Z3NxdGR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0ODE2NjcsImV4cCI6MjEwMDA1NzY2N30.1sXtAmu4Qun0vrFkFAKeh9BsodiPmLSP7m13-9Rojqs";

function isValidJwt(value: unknown): value is string {
  return typeof value === "string" && value.split(".").length === 3 && !value.includes("...");
}

const url =
  typeof import.meta.env.VITE_SUPABASE_URL === "string" && import.meta.env.VITE_SUPABASE_URL.startsWith("http")
    ? import.meta.env.VITE_SUPABASE_URL
    : FALLBACK_URL;

const anonKey = isValidJwt(import.meta.env.VITE_SUPABASE_ANON_KEY) ? import.meta.env.VITE_SUPABASE_ANON_KEY : FALLBACK_ANON_KEY;

export const supabase = createClient(url, anonKey);
