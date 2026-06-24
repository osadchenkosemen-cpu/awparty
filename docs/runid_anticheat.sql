-- ============================================================================
-- AwParty — серверный runid (nonce) + анти-чит лидерборда.
-- Дизайн: docs/superpowers/specs/2026-06-24-runid-anticheat-design.md
--
-- РАСКАТ В 2 ПРИЁМА (чтобы не сломать живой лидерборд):
--   ФАЗА 1 (ниже, СЕЙЧАС): применить целиком. p_runid опционален — старый
--           задеплоенный клиент (шлёт 5 аргументов) продолжает работать.
--   ФАЗА 3 (в самом низу, ПОСЛЕ обновления клиента): заменить submit_score на
--           enforcing-версию, которая ТРЕБУЕТ валидный токен.
--
-- Схема leaderboard сверена по SECURITY.md: (name text, mode text, score integer,
-- time numeric, chapter int default 1, created_at timestamptz), unique(name,mode,chapter).
-- Метрика рейтинга — time (меньше = быстрее = выше; при равенстве — больше score).
-- Идемпотентно (можно повторять).
-- ============================================================================


-- ─────────────────────────── ФАЗА 1 (применить сейчас) ───────────────────────────

-- 1. Журнал выданных нонсов. Доступ только через SECURITY DEFINER RPC ниже.
create table if not exists public.run_tokens (
  runid     uuid primary key default gen_random_uuid(),
  cid       text,                                  -- анонимный id игрока (тот же, что в аналитике)
  mode      text not null,
  chapter   integer not null,
  issued_at timestamptz not null default now(),
  used_at   timestamptz,                           -- null = активный/непогашенный
  status    text not null default 'active'
);
create index if not exists run_tokens_cid_issued_idx on public.run_tokens (cid, issued_at);

alter table public.run_tokens enable row level security;
-- (намеренно НЕТ политик для anon — таблицу трогают только функции-definer)


-- 2. start_run: выдаёт нонс на старте забега + мягкий rate-limit по cid.
create or replace function public.start_run(
  p_cid text, p_mode text, p_chapter integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mode text; v_chapter integer; v_id uuid; v_recent integer;
begin
  v_mode    := case when p_mode = 'hardcore' then 'hardcore' else 'normal' end;
  v_chapter := case when p_chapter between 1 and 3 then p_chapter else 1 end;

  -- rate-limit: не больше 60 токенов на cid за час (забег идёт минуты — с большим запасом).
  -- Мягкий: cid живёт в localStorage и ротируется; отсекает наивный спам, не упорного читера.
  select count(*) into v_recent
    from public.run_tokens
   where cid = p_cid and issued_at > now() - interval '1 hour';
  if v_recent >= 60 then raise exception 'rate limit'; end if;

  insert into public.run_tokens (cid, mode, chapter)
  values (left(coalesce(p_cid, ''), 64), v_mode, v_chapter)
  returning runid into v_id;
  return v_id;
end; $$;


-- 3. submit_score (ТРАНЗИТНАЯ версия): p_runid опционален.
--    Сначала убрать старую 5-арг сигнатуру, иначе PostgREST может путать overload.
--    Проверить, какие сигнатуры реально задеплоены:
--      select oid::regprocedure from pg_proc where proname = 'submit_score';
--    Дропаем оба вероятных 5-арг варианта (тип p_time мог быть numeric ИЛИ double precision):
drop function if exists public.submit_score(text, integer, numeric, text, integer);
drop function if exists public.submit_score(text, integer, double precision, text, integer);

create or replace function public.submit_score(
  p_name text, p_score integer, p_time numeric, p_mode text, p_chapter integer,
  p_runid uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_mode text; v_chapter integer; v_tok public.run_tokens%rowtype; v_min numeric;
begin
  if p_runid is not null then
    -- НОВЫЙ путь: атомарно гасим активный токен (update вернёт строку только если он есть и не использован).
    update public.run_tokens set used_at = now(), status = 'used'
     where runid = p_runid and used_at is null
     returning * into v_tok;
    if not found then raise exception 'invalid or used run token'; end if;
    if now() - v_tok.issued_at > interval '6 hours' then raise exception 'run token expired'; end if;
    -- глава/режим — из токена (анти-подмена), клиентские игнорируем.
    v_mode := v_tok.mode; v_chapter := v_tok.chapter;
  else
    -- ЛЕГАСИ путь (только Фаза 1): старый клиент без токена. Поведение как сейчас.
    v_mode    := case when p_mode = 'hardcore' then 'hardcore' else 'normal' end;
    v_chapter := case when p_chapter between 1 and 3 then p_chapter else 1 end;
  end if;

  -- Потолки значений (общие для обоих путей).
  if p_score is null or p_score < 0 or p_score > 5000000 then raise exception 'invalid score'; end if;
  if p_time is null or p_time <> p_time or p_time < 0 or p_time > 21600 then raise exception 'invalid time'; end if;

  -- Пол минимально-правдоподобного времени — только для нового пути (у токена достоверная глава).
  -- КАЛИБРОВАТЬ по аналитике (см. запрос в конце файла). Стартовые пороги консервативно низкие.
  if p_runid is not null then
    v_min := case v_chapter when 1 then 60 when 2 then 75 when 3 then 90 else 60 end;
    if v_mode = 'hardcore' then v_min := v_min * 1.2; end if;
    if p_time < v_min then raise exception 'time below plausible floor'; end if;
  end if;

  -- Имя: убрать управляющие символы, обрезать до 20.
  v_name := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 20);
  if v_name = '' then v_name := 'Anonymous'; end if;

  -- Запись лучшего результата (как в текущем submit_score).
  insert into public.leaderboard (name, score, time, mode, chapter, created_at)
  values (v_name, p_score, p_time, v_mode, v_chapter, now())
  on conflict (name, mode, chapter) do update
    set time  = least(leaderboard.time, excluded.time),
        score = case when excluded.time < leaderboard.time then excluded.score
                     when excluded.time = leaderboard.time then greatest(leaderboard.score, excluded.score)
                     else leaderboard.score end,
        created_at = case when excluded.time < leaderboard.time then now() else leaderboard.created_at end;
end; $$;

grant execute on function public.start_run(text, text, integer) to anon;
grant execute on function public.submit_score(text, integer, numeric, text, integer, uuid) to anon;


-- ─────────────────────────── ПРОВЕРКА Фазы 1 (по желанию) ───────────────────────────
-- select public.start_run('test-cid', 'normal', 1);            -- вернёт uuid
-- select public.submit_score('Tester', 1000, 120, 'normal', 1, '<uuid-сверху>');  -- ок
-- select public.submit_score('Tester', 1000, 120, 'normal', 1, '<тот же uuid>');  -- ошибка: invalid or used
-- select public.submit_score('Tester', 1000, 120, 'normal', 1, gen_random_uuid()); -- ошибка: invalid or used
-- select public.submit_score('Tester', 1000,  10, 'normal', 1, public.start_run('t','normal',1)); -- ошибка: floor


-- ============================================================================
-- ФАЗА 3 — АКТИВНА. Клиент 227 шлёт runid (проверено: токены идут в run_tokens).
-- Делает токен обязательным: сабмит без валидного нонса отклоняется.
-- Применить этот блок в Supabase → SQL Editor (заменяет транзитный submit_score выше).
-- ============================================================================
create or replace function public.submit_score(
  p_name text, p_score integer, p_time numeric, p_mode text, p_chapter integer,
  p_runid uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_mode text; v_chapter integer; v_tok public.run_tokens%rowtype; v_min numeric;
begin
  -- Токен ОБЯЗАТЕЛЕН.
  update public.run_tokens set used_at = now(), status = 'used'
   where runid = p_runid and used_at is null
   returning * into v_tok;
  if not found then raise exception 'invalid or used run token'; end if;
  if now() - v_tok.issued_at > interval '6 hours' then raise exception 'run token expired'; end if;
  v_mode := v_tok.mode; v_chapter := v_tok.chapter;

  if p_score is null or p_score < 0 or p_score > 5000000 then raise exception 'invalid score'; end if;
  if p_time is null or p_time <> p_time or p_time < 0 or p_time > 21600 then raise exception 'invalid time'; end if;

  v_min := case v_chapter when 1 then 60 when 2 then 75 when 3 then 90 else 60 end;
  if v_mode = 'hardcore' then v_min := v_min * 1.2; end if;
  if p_time < v_min then raise exception 'time below plausible floor'; end if;

  v_name := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 20);
  if v_name = '' then v_name := 'Anonymous'; end if;

  insert into public.leaderboard (name, score, time, mode, chapter, created_at)
  values (v_name, p_score, p_time, v_mode, v_chapter, now())
  on conflict (name, mode, chapter) do update
    set time  = least(leaderboard.time, excluded.time),
        score = case when excluded.time < leaderboard.time then excluded.score
                     when excluded.time = leaderboard.time then greatest(leaderboard.score, excluded.score)
                     else leaderboard.score end,
        created_at = case when excluded.time < leaderboard.time then now() else leaderboard.created_at end;
end; $$;

-- Откат (если enforcing что-то ломает): повторно выполнить транзитный submit_score
-- из блока «ФАЗА 1» выше — он принимает и сабмиты без токена (p_runid опционален).


-- ─────────────────────────── КАЛИБРОВКА пола времени ───────────────────────────
-- После накопления данных: самый быстрый реальный clear по главам — порог ставить ниже него.
-- select props->>'chapter' as chapter, min((props->>'time')::numeric) as fastest_clear
-- from public.analytics_events
-- where event = 'run_end' and props->>'outcome' = 'clear'
-- group by 1 order by 1;


-- ─────────────────────────── УБОРКА журнала (по желанию) ───────────────────────────
-- delete from public.run_tokens where issued_at < now() - interval '1 day';
