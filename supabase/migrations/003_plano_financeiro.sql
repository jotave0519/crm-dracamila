-- Fase 2 do pivo para CRM de prontuario eletronico: plano de tratamento
-- (sessoes contratadas/realizadas/restantes) e financeiro por paciente.

create table treatment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  treatment_type_id uuid references treatment_types(id),
  total_sessions integer not null,
  total_price numeric(10,2),
  start_date date,
  goal text,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_treatment_plans_user on treatment_plans(user_id);

alter table schedules
  add column treatment_plan_id uuid references treatment_plans(id) on delete set null;

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  treatment_plan_id uuid references treatment_plans(id) on delete set null,
  amount numeric(10,2) not null,
  payment_date date not null default current_date,
  method text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_payments_user on payments(user_id);
create index idx_payments_plan on payments(treatment_plan_id);
