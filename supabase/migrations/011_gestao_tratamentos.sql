alter table treatment_plans
  add column diagnosis text,
  add column next_reassessment_date date;

alter table clinical_evolutions
  add column mobility_score integer check (mobility_score between 0 and 10),
  add column strength_score integer check (strength_score between 0 and 10),
  add column rom_score integer check (rom_score between 0 and 10);

create table patient_timeline_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  staff_id uuid references staff(id),
  event_date date not null default current_date,
  note text not null,
  created_at timestamptz not null default now()
);
create index idx_timeline_notes_user on patient_timeline_notes(user_id, event_date desc);
