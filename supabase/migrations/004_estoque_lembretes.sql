-- Fase 3 do pivo para CRM de prontuario eletronico: estoque e limite
-- configuravel do lembrete de "paciente sem retorno". Lembretes e
-- relatorios sao computados on-the-fly, sem tabela propria.

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  quantity numeric(10,2) not null default 0,
  unit text,
  min_quantity numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clinic_settings
  add column days_without_return_threshold integer not null default 30;
