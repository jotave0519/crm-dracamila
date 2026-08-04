alter table schedules
  add column calendar_sync_status text not null default 'synced' check (calendar_sync_status in ('synced', 'pending'));
