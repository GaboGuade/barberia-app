-- ============================================================
-- Barbería - Esquema de base de datos para Supabase (PostgreSQL)
-- Ejecuta este script en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- Tabla principal de citas
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  service text not null check (service in ('corte', 'corte_barba')),
  appointment_date date not null,
  appointment_time time not null,
  price_usd numeric(10,2) not null check (price_usd > 0),
  payment_currency text not null check (payment_currency in ('USD','VES')),
  payment_method text not null,
  notes text,
  status text not null default 'agendada'
    check (status in ('agendada','completada','cancelada','no_asistio')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Migración: barbero específico + extras personalizados
-- ------------------------------------------------------------
alter table public.appointments
  add column if not exists barber text;

alter table public.appointments
  add column if not exists extra_mask boolean not null default false;

alter table public.appointments
  add column if not exists extra_massage boolean not null default false;

alter table public.appointments
  add column if not exists drink text;

-- Si quedan filas viejas sin barbero, asignamos uno por defecto
update public.appointments set barber = 'jose' where barber is null;

-- Token secreto para que el cliente pueda cancelar su propia cita
alter table public.appointments
  add column if not exists cancel_token uuid not null default gen_random_uuid();

alter table public.appointments
  alter column barber set not null;

alter table public.appointments
  drop constraint if exists appointments_barber_chk;
alter table public.appointments
  add constraint appointments_barber_chk
  check (barber in ('jose','gabriel','alejandro'));

alter table public.appointments
  drop constraint if exists appointments_drink_chk;
alter table public.appointments
  add constraint appointments_drink_chk
  check (drink is null or drink in ('cerveza','malta','coca_cola'));

-- Solo se permiten citas en intervalos de 1 hora exactos (minutos = 0)
alter table public.appointments
  drop constraint if exists appointments_hourly_slot_chk;
alter table public.appointments
  add constraint appointments_hourly_slot_chk
  check (extract(minute from appointment_time) = 0
         and extract(second from appointment_time) = 0);

-- Horario de atención: Lun-Sáb 9:00-19:00 (último slot 18:00)
alter table public.appointments
  drop constraint if exists appointments_business_hours_chk;
alter table public.appointments
  add constraint appointments_business_hours_chk
  check (
    extract(dow from appointment_date) <> 0  -- 0 = domingo, cerrado
    and appointment_time >= time '09:00'
    and appointment_time <= time '18:00'
  );

-- Índice para consultas por fecha (disponibilidad y listados)
create index if not exists appointments_date_time_idx
  on public.appointments (appointment_date, appointment_time);

-- ============================================================
-- Capacidad: cada barbero solo puede tener UNA cita por (fecha, hora).
-- Implementado vía función + trigger porque PostgreSQL no permite
-- restricciones de "conteo" con CHECK ni índices únicos parciales
-- referenciando status fácilmente desde el cliente.
-- ============================================================
create or replace function public.enforce_appointment_capacity()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  -- No contar canceladas. Limitamos a 1 por (barbero, fecha, hora).
  select count(*) into v_count
  from public.appointments
  where appointment_date = new.appointment_date
    and appointment_time = new.appointment_time
    and barber = new.barber
    and status <> 'cancelada'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= 1 then
    raise exception 'BARBER_BUSY: el barbero % ya tiene cita en %, %',
      new.barber, new.appointment_date, new.appointment_time
      using errcode = '23505';
  end if;

  -- Horario bloqueado por el barbero o por la barbería (solo aplica a citas activas)
  if new.status <> 'cancelada' and exists (
    select 1 from public.blocked_slots bs
    where bs.block_date = new.appointment_date
      and (bs.block_time is null or bs.block_time = new.appointment_time)
      and (bs.barber is null or bs.barber = new.barber)
  ) then
    raise exception 'BARBER_BUSY: horario bloqueado para % en %, %',
      new.barber, new.appointment_date, new.appointment_time
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_capacity on public.appointments;
create trigger trg_enforce_capacity
  before insert or update on public.appointments
  for each row execute function public.enforce_appointment_capacity();

-- ============================================================
-- BLOQUEO DE HORARIOS (almuerzo, día libre, vacaciones...)
-- barber = null  -> aplica a TODOS los barberos
-- block_time = null -> aplica a TODO el día
-- ============================================================
create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  barber text check (barber is null or barber in ('jose','gabriel','alejandro')),
  block_date date not null,
  block_time time check (
    block_time is null
    or (extract(minute from block_time) = 0 and extract(second from block_time) = 0)
  ),
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists blocked_slots_date_idx
  on public.blocked_slots (block_date);

-- ============================================================
-- CONFIGURACIÓN DEL NEGOCIO (una sola fila)
-- shop_commission_pct: % de cada cita que se queda la barbería.
-- El resto es para el barbero.
-- ============================================================
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  shop_commission_pct numeric(5,2) not null default 50
    check (shop_commission_pct >= 0 and shop_commission_pct <= 100),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

-- ============================================================
-- STAFF: empleados (barberos) y administrador (dueño)
-- Cada fila corresponde a un usuario de Supabase Auth.
-- ============================================================
create table if not exists public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'barbero')),
  barber_key text check (barber_key in ('jose', 'gabriel', 'alejandro')),
  created_at timestamptz not null default now()
);

-- Un barbero de la app solo puede estar vinculado a un usuario
create unique index if not exists staff_barber_key_uidx
  on public.staff (barber_key)
  where barber_key is not null;

alter table public.staff enable row level security;

-- Cada usuario autenticado puede leer su propio perfil de staff
drop policy if exists "staff_select_self" on public.staff;
create policy "staff_select_self"
  on public.staff for select
  to authenticated
  using (auth.uid() = id);

-- Helper: ¿el usuario actual es staff? ¿es admin?
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.staff where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- Disponibilidad pública SIN exponer datos de clientes.
-- El formulario de reservas (anónimo) solo necesita saber qué
-- (hora, barbero) están ocupados en una fecha.
-- ============================================================
create or replace function public.get_booked_slots(p_date date)
returns table (appointment_time time, barber text)
language sql
security definer
set search_path = public
stable
as $$
  -- Citas activas
  select a.appointment_time, a.barber
  from public.appointments a
  where a.appointment_date = p_date
    and a.status <> 'cancelada'
  union
  -- Horarios bloqueados (expandiendo "todo el día" y "todos los barberos")
  select
    coalesce(bs.block_time, make_time(h.h, 0, 0)) as appointment_time,
    b.name as barber
  from public.blocked_slots bs
  cross join generate_series(9, 18) as h(h)
  cross join unnest(
    case when bs.barber is not null then array[bs.barber]
         else array['jose','gabriel','alejandro'] end
  ) as b(name)
  where bs.block_date = p_date;
$$;

grant execute on function public.get_booked_slots(date) to anon, authenticated;

-- ============================================================
-- RPC: reservar cita (anónimo). Devuelve id + cancel_token para
-- que el cliente pueda cancelar después. Necesario porque anon
-- no tiene SELECT sobre appointments (RETURNING requiere SELECT).
-- ============================================================
create or replace function public.book_appointment(
  p_name text,
  p_phone text,
  p_service text,
  p_barber text,
  p_date date,
  p_time time,
  p_price numeric,
  p_currency text,
  p_method text,
  p_mask boolean,
  p_massage boolean,
  p_drink text,
  p_notes text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token uuid;
begin
  if length(trim(p_name)) < 3 then
    raise exception 'INVALID: nombre demasiado corto';
  end if;
  if length(regexp_replace(p_phone, '\D', '', 'g')) < 10 then
    raise exception 'INVALID: teléfono inválido';
  end if;
  if p_date < current_date then
    raise exception 'INVALID: la fecha ya pasó';
  end if;

  insert into public.appointments (
    customer_name, customer_phone, service, barber,
    appointment_date, appointment_time, price_usd,
    payment_currency, payment_method,
    extra_mask, extra_massage, drink, notes, status
  ) values (
    trim(p_name), trim(p_phone), p_service, p_barber,
    p_date, p_time, p_price,
    p_currency, p_method,
    coalesce(p_mask, false), coalesce(p_massage, false),
    nullif(p_drink, ''), nullif(trim(coalesce(p_notes, '')), ''), 'agendada'
  )
  returning id, cancel_token into v_id, v_token;

  return json_build_object('id', v_id, 'cancel_token', v_token);
end;
$$;

grant execute on function public.book_appointment(
  text, text, text, text, date, time, numeric, text, text, boolean, boolean, text, text
) to anon, authenticated;

-- ============================================================
-- RPC: cancelar cita por parte del cliente (con su token secreto).
-- Solo citas 'agendada' y que no hayan pasado.
-- ============================================================
create or replace function public.cancel_appointment(p_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  update public.appointments
  set status = 'cancelada'
  where id = p_id
    and cancel_token = p_token
    and status = 'agendada'
    and (appointment_date > current_date
         or (appointment_date = current_date and appointment_time > localtime))
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

grant execute on function public.cancel_appointment(uuid, uuid) to anon, authenticated;

-- ============================================================
-- Row Level Security de appointments
-- - anon: SOLO puede insertar (reservar). Ya no puede leer datos
--   de clientes; la disponibilidad sale de get_booked_slots().
-- - staff autenticado: puede leer todo y actualizar estados.
-- ============================================================
alter table public.appointments enable row level security;

drop policy if exists "appointments_insert_anon" on public.appointments;
create policy "appointments_insert_anon"
  on public.appointments for insert
  to anon
  with check (status = 'agendada');

-- Quitamos el SELECT público (protege datos de clientes)
drop policy if exists "appointments_select_anon" on public.appointments;

drop policy if exists "appointments_select_staff" on public.appointments;
create policy "appointments_select_staff"
  on public.appointments for select
  to authenticated
  using (public.is_staff());

drop policy if exists "appointments_update_authenticated" on public.appointments;
drop policy if exists "appointments_update_staff" on public.appointments;
create policy "appointments_update_staff"
  on public.appointments for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ============================================================
-- RLS de blocked_slots: solo staff puede ver y gestionar
-- ============================================================
alter table public.blocked_slots enable row level security;

drop policy if exists "blocked_select_staff" on public.blocked_slots;
create policy "blocked_select_staff"
  on public.blocked_slots for select
  to authenticated
  using (public.is_staff());

drop policy if exists "blocked_insert_staff" on public.blocked_slots;
create policy "blocked_insert_staff"
  on public.blocked_slots for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "blocked_delete_staff" on public.blocked_slots;
create policy "blocked_delete_staff"
  on public.blocked_slots for delete
  to authenticated
  using (public.is_staff());

-- ============================================================
-- RLS de app_settings: staff lee, solo admin modifica
-- ============================================================
alter table public.app_settings enable row level security;

drop policy if exists "settings_select_staff" on public.app_settings;
create policy "settings_select_staff"
  on public.app_settings for select
  to authenticated
  using (public.is_staff());

drop policy if exists "settings_update_admin" on public.app_settings;
create policy "settings_update_admin"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- CÓMO CREAR LOS USUARIOS (una sola vez):
-- 1) Supabase Dashboard → Authentication → Users → "Add user"
--    Crea el usuario con email + password y marca "Auto Confirm".
--    Ej: dueno@barberia.com, jose@barberia.com, etc.
-- 2) Copia el UUID de cada usuario creado y ejecuta:
--
-- insert into public.staff (id, display_name, role, barber_key) values
--   ('UUID-DEL-DUENO',     'Dueño',     'admin',   null),
--   ('UUID-DE-JOSE',       'Jose',      'barbero', 'jose'),
--   ('UUID-DE-GABRIEL',    'Gabriel',   'barbero', 'gabriel'),
--   ('UUID-DE-ALEJANDRO',  'Alejandro', 'barbero', 'alejandro')
-- on conflict (id) do update
--   set display_name = excluded.display_name,
--       role = excluded.role,
--       barber_key = excluded.barber_key;
-- ============================================================
