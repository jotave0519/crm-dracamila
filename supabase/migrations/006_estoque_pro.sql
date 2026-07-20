-- Estoque profissional: valor unitario, fornecedor e historico de
-- movimentacao auditavel (toda entrada/saida/ajuste vira um registro).

alter table inventory_items
  add column unit_price numeric(10,2),
  add column supplier text;

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  type text not null check (type in ('entrada', 'saida', 'ajuste', 'consumo_interno')),
  quantity numeric(10,2) not null,
  supplier text,
  staff_id uuid references staff(id),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_inventory_movements_item on inventory_movements(item_id, created_at desc);
