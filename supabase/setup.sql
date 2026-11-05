-- =====================================================================
-- Banco de dados do site do casamento de Isabely & João Victor
-- Cole tudo no SQL Editor do Supabase e clique em "Run".
-- Pode ser executado mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas (ninguém lê ou grava direto; só pelas funções abaixo)
-- ---------------------------------------------------------------------
create table if not exists public.gift_selections (
  gift_id     integer primary key check (gift_id between 1 and 80),
  token_hash  text not null,
  guest_name  text not null check (char_length(guest_name) between 2 and 80),
  client_hash text,
  selected_at timestamptz not null default now()
);

create table if not exists public.wedding_attendance (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  guest_name  text not null check (char_length(guest_name) between 2 and 80),
  attending   boolean not null,
  companions  text[] not null default '{}',
  client_hash text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- E-mails que podem entrar na área admin
create table if not exists public.admin_emails (
  email text primary key check (email = lower(btrim(email)))
);

alter table public.gift_selections    enable row level security;
alter table public.wedding_attendance enable row level security;
alter table public.admin_emails       enable row level security;
revoke all on public.gift_selections, public.wedding_attendance, public.admin_emails from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções auxiliares (internas)
-- ---------------------------------------------------------------------
create or replace function public._hash(value text) returns text
language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(value, 'UTF8')), 'hex')
$$;

-- Identifica a conexão do visitante (guardada só como código, nunca o IP em si)
create or replace function public._client_hash() returns text
language plpgsql stable set search_path = '' as $$
declare
  headers json;
  ip text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  ip := coalesce(headers->>'cf-connecting-ip', headers->>'x-real-ip', split_part(headers->>'x-forwarded-for', ',', 1));
  ip := nullif(btrim(ip), '');
  return case when ip is null then null else public._hash('casamento:' || ip) end;
end $$;

-- A conta logada é admin? (e-mail cadastrado e confirmado)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

-- ---------------------------------------------------------------------
-- Lista de presentes (público)
-- ---------------------------------------------------------------------
-- Só informa QUAIS presentes foram escolhidos, nunca por quem.
create or replace function public.list_selected_gifts()
returns table (gift_id integer)
language sql stable security definer set search_path = '' as $$
  select g.gift_id from public.gift_selections g order by g.gift_id
$$;

-- Reserva um presente. Retorna false se outra pessoa já escolheu.
create or replace function public.select_wedding_gift(p_gift_id integer, p_token uuid, p_guest_name text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_guest_name, ''));
  v_client text := public._client_hash();
  v_rows integer;
begin
  if p_gift_id is null or p_gift_id < 1 or p_gift_id > 80 or p_token is null then
    raise exception 'dados_invalidos';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'nome_invalido';
  end if;
  -- Proteção contra abuso: no máximo 5 presentes por conexão a cada hora.
  if v_client is not null and (
    select count(*) from public.gift_selections
    where client_hash = v_client and selected_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'limite_presentes';
  end if;

  insert into public.gift_selections (gift_id, token_hash, guest_name, client_hash)
  values (p_gift_id, public._hash(p_token::text), v_name, v_client)
  on conflict (gift_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

-- Cancela a própria escolha (só quem tem o código guardado no navegador).
create or replace function public.release_wedding_gift(p_gift_id integer, p_token uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_rows integer;
begin
  delete from public.gift_selections
  where gift_id = p_gift_id and token_hash = public._hash(p_token::text);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

-- ---------------------------------------------------------------------
-- Confirmação de presença (público, cada convidado só vê a própria)
-- ---------------------------------------------------------------------
create or replace function public.save_wedding_attendance_with_companions(
  p_token uuid, p_guest_name text, p_attending boolean, p_companions text[]
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_guest_name, ''));
  v_hash text;
  v_client text := public._client_hash();
  v_companions text[];
  v_companion text;
begin
  if p_token is null or p_attending is null then
    raise exception 'dados_invalidos';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'nome_invalido';
  end if;

  v_companions := '{}';
  if p_attending then
    foreach v_companion in array coalesce(p_companions, '{}') loop
      v_companion := btrim(coalesce(v_companion, ''));
      if char_length(v_companion) < 2 or char_length(v_companion) > 80 then
        raise exception 'acompanhante_invalido';
      end if;
      v_companions := v_companions || v_companion;
    end loop;
    if cardinality(v_companions) > 10 then
      raise exception 'acompanhantes_demais';
    end if;
  end if;

  v_hash := public._hash(p_token::text);

  -- Proteção contra abuso: no máximo 10 respostas novas por conexão a cada hora.
  if v_client is not null
     and not exists (select 1 from public.wedding_attendance where token_hash = v_hash)
     and (select count(*) from public.wedding_attendance
          where client_hash = v_client and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'limite_respostas';
  end if;

  insert into public.wedding_attendance (token_hash, guest_name, attending, companions, client_hash)
  values (v_hash, v_name, p_attending, v_companions, v_client)
  on conflict (token_hash) do update
    set guest_name = excluded.guest_name,
        attending  = excluded.attending,
        companions = excluded.companions,
        updated_at = now();
  return true;
end $$;

create or replace function public.get_wedding_attendance_with_companions(p_token uuid)
returns table (guest_name text, attending boolean, companions text[])
language sql stable security definer set search_path = '' as $$
  select a.guest_name, a.attending, a.companions
  from public.wedding_attendance a
  where a.token_hash = public._hash(p_token::text)
$$;

-- ---------------------------------------------------------------------
-- Área admin (só contas cadastradas em admin_emails)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_attendance()
returns table (id uuid, guest_name text, attending boolean, companions text[], updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'sem_permissao'; end if;
  return query
    select a.id, a.guest_name, a.attending, a.companions, a.updated_at
    from public.wedding_attendance a
    order by a.updated_at desc;
end $$;

create or replace function public.admin_delete_attendance(p_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  if not public.is_admin() then raise exception 'sem_permissao'; end if;
  delete from public.wedding_attendance where id = p_id;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create or replace function public.admin_list_gifts()
returns table (gift_id integer, guest_name text, selected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'sem_permissao'; end if;
  return query
    select g.gift_id, g.guest_name, g.selected_at
    from public.gift_selections g
    order by g.gift_id;
end $$;

create or replace function public.admin_release_gift(p_gift_id integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  if not public.is_admin() then raise exception 'sem_permissao'; end if;
  delete from public.gift_selections where gift_id = p_gift_id;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

-- ---------------------------------------------------------------------
-- Permissões: cada função só pode ser usada por quem deve
-- ---------------------------------------------------------------------
revoke all on function
  public._hash(text), public._client_hash(), public.is_admin(),
  public.list_selected_gifts(), public.select_wedding_gift(integer, uuid, text), public.release_wedding_gift(integer, uuid),
  public.save_wedding_attendance_with_companions(uuid, text, boolean, text[]), public.get_wedding_attendance_with_companions(uuid),
  public.admin_list_attendance(), public.admin_delete_attendance(uuid), public.admin_list_gifts(), public.admin_release_gift(integer)
from public, anon, authenticated;

-- Visitantes do site
grant execute on function
  public.list_selected_gifts(), public.select_wedding_gift(integer, uuid, text), public.release_wedding_gift(integer, uuid),
  public.save_wedding_attendance_with_companions(uuid, text, boolean, text[]), public.get_wedding_attendance_with_companions(uuid)
to anon, authenticated;

-- Contas logadas (cada função confere se é admin)
grant execute on function
  public.is_admin(), public.admin_list_attendance(), public.admin_delete_attendance(uuid),
  public.admin_list_gifts(), public.admin_release_gift(integer)
to authenticated;

-- ---------------------------------------------------------------------
-- Admins: troque/adicione os e-mails de quem pode ver as confirmações
-- ---------------------------------------------------------------------
insert into public.admin_emails (email) values
  ('andreyoliveirat123@gmail.com'),
  ('joaovictor2005aj@gmail.com'),
  ('isammsreserva@gmail.com')
on conflict do nothing;
