-- Schema inicial: agente WhatsApp + CRM para clinica de fisioterapia (MVP).
-- Uma unica profissional, sessoes agendadas uma a uma (sem pacotes/recorrencia),
-- sem convenio. Modelo de horarios ja nasce no formato de slots explicitos por
-- dia da semana (sem geracao automatica), licao ja aprendida noutro projeto.

create extension if not exists "pgcrypto";

-- Staff (autenticacao via Supabase Auth, so a fisioterapeuta como admin inicial)
create table staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'admin' check (role in ('admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pacientes
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  phone text not null unique,
  email text,
  active boolean not null default true,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tipos de atendimento (era "procedimentos" na clinica de estetica)
create table treatment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  price numeric(10,2),
  description text,
  duration_minutes integer,
  notes text,
  pre_instructions text,
  post_instructions text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dados da clinica (singleton, id=1)
create table clinic_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'Clínica de Fisioterapia',
  responsible_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip_code text,
  whatsapp text,
  instagram text,
  website text,
  about_text text,
  general_notes text,
  updated_at timestamptz not null default now()
);
insert into clinic_settings (id) values (1);

-- Horarios de atendimento: slots explicitos por dia da semana, sem geracao automatica
create table business_hours (
  weekday integer primary key check (weekday between 0 and 6),
  enabled boolean not null default true
);
insert into business_hours (weekday, enabled)
  values (0, false), (1, true), (2, true), (3, true), (4, true), (5, true), (6, false);

create table business_hour_slots (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null references business_hours(weekday) on delete cascade check (weekday between 0 and 6),
  time time not null,
  created_at timestamptz not null default now(),
  unique (weekday, time)
);
create index idx_business_hour_slots_weekday on business_hour_slots(weekday, time);

create table business_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  type text not null check (type in ('holiday', 'block', 'special')),
  closed boolean not null default true,
  slots jsonb,
  note text,
  created_at timestamptz not null default now()
);

-- Sessoes (agendamentos)
create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  patient_name text not null,
  phone text not null,
  procedure text not null,
  date date not null,
  time time not null,
  notes text,
  evolution_note text,
  google_event_id text,
  status text not null default 'Agendado' check (status in ('Agendado', 'Cancelado', 'Concluido', 'Faltou')),
  duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_schedules_user on schedules(user_id);
create index idx_schedules_date on schedules(date);

-- Conversas do WhatsApp (motor de conversa da IA)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'ai' check (status in ('ai', 'human', 'closed')),
  state text not null default 'MENU',
  state_data jsonb not null default '{}',
  last_user_message_at timestamptz,
  nudge_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_conversations_user on conversations(user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  automated boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_messages_conversation on messages(conversation_id, created_at);
