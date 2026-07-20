-- Modulo Evolucao Clinica: substitui a ficha em papel. Cada sessao pode
-- gerar um registro clinico estruturado, vinculado opcionalmente a uma
-- sessao da agenda. Anexos reaproveitam patient_attachments.

create table clinical_evolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  schedule_id uuid references schedules(id) on delete set null,
  staff_id uuid references staff(id),
  evolution_date date not null default current_date,
  main_complaint text,
  pain_scale integer check (pain_scale between 0 and 10),
  treated_region text,
  treatment_performed text,
  techniques_used text,
  observations text,
  treatment_response text,
  guidance_given text,
  next_goals text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clinical_evolutions_user on clinical_evolutions(user_id, evolution_date desc);

alter table patient_attachments
  add column evolution_id uuid references clinical_evolutions(id) on delete set null;
