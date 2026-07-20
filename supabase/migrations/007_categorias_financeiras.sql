-- Categorias do Financeiro deixam de ser uma lista fixa no codigo e viram
-- um cadastro de verdade (criar/editar/excluir). financial_transactions.category
-- continua texto livre (sem FK) - excluir uma categoria nao afeta lancamentos
-- ja criados, so tira a opcao da lista pra novos lancamentos.

create table financial_categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receita', 'despesa')),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index idx_financial_categories_type_name on financial_categories(type, name);

insert into financial_categories (type, name) values
  ('receita', 'Sessão'),
  ('receita', 'Pacote'),
  ('receita', 'Avaliação'),
  ('receita', 'Venda de produto'),
  ('receita', 'Outro'),
  ('despesa', 'Aluguel'),
  ('despesa', 'Funcionário'),
  ('despesa', 'Material'),
  ('despesa', 'Impostos'),
  ('despesa', 'Energia'),
  ('despesa', 'Água'),
  ('despesa', 'Internet'),
  ('despesa', 'Marketing'),
  ('despesa', 'Outros');
