-- Modulo Financeiro completo: substitui a tabela "payments" (vinculada
-- apenas a planos de tratamento, so receita) por um lancamento generico
-- de receita/despesa, com categoria, forma de pagamento e status.
-- Nao ha dado real de producao em "payments" (so testes ja limpos).

drop table payments;

create table financial_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receita', 'despesa')),
  description text not null,
  category text not null,
  patient_id uuid references users(id) on delete set null,
  payment_method text not null,
  transaction_date date not null default current_date,
  amount numeric(10,2) not null,
  status text not null default 'Pago' check (status in ('Pago', 'Pendente')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_financial_transactions_date on financial_transactions(transaction_date);
create index idx_financial_transactions_patient on financial_transactions(patient_id);
