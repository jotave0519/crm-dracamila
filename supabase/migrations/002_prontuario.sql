-- Fase 1 do pivo para CRM de prontuario eletronico: campos clinicos do
-- paciente, anexos, cor por tipo de atendimento e vinculo schedule -> tipo.

alter table treatment_types
  add column color text not null default '#8FA98F',
  add column materials_used text;

alter table schedules
  add column treatment_type_id uuid references treatment_types(id);

update schedules s
  set treatment_type_id = tt.id
  from treatment_types tt
  where s.procedure = tt.name and s.treatment_type_id is null;

alter table schedules drop constraint schedules_status_check;
alter table schedules add constraint schedules_status_check
  check (status in ('Agendado', 'Confirmado', 'Cancelado', 'Concluido', 'Faltou'));

alter table users
  add column profession text,
  add column health_insurance text,
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column main_complaint text,
  add column medical_conditions text,
  add column surgeries text,
  add column medications text,
  add column allergies text,
  add column pain_scale integer check (pain_scale between 0 and 10),
  add column muscle_strength text,
  add column mobility text,
  add column treatment_goals text,
  add column notes text;

create table patient_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category text not null check (category in ('foto', 'exame', 'documento')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  uploaded_at timestamptz not null default now()
);
create index idx_patient_attachments_user on patient_attachments(user_id);

-- Passo manual (fora deste SQL): criar o bucket "patient-attachments" no
-- Storage do Supabase (privado - o backend usa a service_role key e acessa
-- via URL assinada, nao precisa de politica publica).
