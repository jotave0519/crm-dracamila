-- Configuracao do Assistente IA (singleton, id=1) - liga/desliga e ajusta
-- recursos do agente de WhatsApp sem precisar editar codigo.
create table ai_settings (
  id integer primary key default 1 check (id = 1),

  master_enabled boolean not null default true,

  greeting_enabled boolean not null default true,

  confirmation_enabled boolean not null default false,
  confirmation_hours_before integer[] not null default '{24}',

  reminder_enabled boolean not null default false,
  reminder_minutes_before integer not null default 120,

  away_enabled boolean not null default false,
  away_first_minutes integer not null default 5,
  away_first_message text not null default 'Percebi que você ficou ausente 😊

Se ainda quiser continuar seu atendimento é só responder esta mensagem.',
  away_second_minutes integer not null default 5,
  away_second_message text not null default 'Como não recebi resposta, vou encerrar este atendimento por enquanto.

Quando quiser continuar, basta enviar uma nova mensagem.',

  business_hours_only_enabled boolean not null default false,
  business_hours_message text not null default 'Recebemos sua mensagem 😊

No momento estamos fora do horário de atendimento.

Assim que retornarmos teremos prazer em ajudá-lo.',

  human_handoff_enabled boolean not null default true,

  reactivation_enabled boolean not null default false,
  reactivation_days_threshold integer not null default 30,
  reactivation_message text not null default 'Olá! Faz um tempinho que não nos vemos 😊

Que tal agendar um retorno? Será um prazer te atender novamente.',

  waitlist_enabled boolean not null default false,

  post_session_enabled boolean not null default false,
  post_session_hours_after integer not null default 2,
  post_session_message text not null default 'Olá!

Gostaríamos de saber como você está após a sessão de hoje 😊',

  pre_anamnesis_enabled boolean not null default false,

  scheduling_enabled boolean not null default true,
  cancellation_enabled boolean not null default true,
  rescheduling_enabled boolean not null default true,

  notifications_enabled boolean not null default false,

  updated_at timestamptz not null default now()
);

insert into ai_settings (id) values (1);
