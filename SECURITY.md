# Безопасность таблицы рекордов (Supabase)

Общая таблица рекордов работает через Supabase REST/RPC. Публичный `anon`-ключ
лежит в [src/config.js](src/config.js) — **так и задумано**: ключ публичный по дизайну,
он не является секретом. Безопасность держится не на ключе, а на:

1. **RLS-политиках** (Row Level Security) таблицы `leaderboard`.
2. **Серверной валидации** внутри RPC-функций `submit_score` и `rename_player`.

> ⚠️ Клиентская фильтрация ника (длина ≤ 20, только печатные символы — см.
> `onKeyDown` в [src/scene_ui.js](src/scene_ui.js)) — это удобство, **а не граница
> безопасности**. Имея публичный `anon`-ключ, кто угодно может вызвать RPC напрямую
> с произвольными `name`/`time`. Поэтому всё перечисленное ниже **обязано**
> проверяться на сервере.

## Что должно быть настроено на стороне Supabase

### 1. RLS
- На таблице `leaderboard` включить RLS.
- Запретить прямой `INSERT`/`UPDATE`/`DELETE` под ролью `anon`.
- Разрешить `anon` только `SELECT` (для топа) — и запись исключительно через
  `SECURITY DEFINER`-функции `submit_score` / `rename_player`.

### 2. Валидация в `submit_score`
> Рейтинг ранжируется по **`time`** (меньше = быстрее прошёл главу = выше; при равенстве —
> больше `score`). Клиент отправляет результат только при ПРОХОЖДЕНИИ главы (вход в портал),
> не при смерти. RPC обязан, как минимум:
- **Ограничить `score` и `time` сверху** разумными потолками и проверить, что они —
  конечные неотрицательные числа (не `NaN`/`Infinity`). С публичным `anon`-ключом любой
  может вызвать RPC напрямую с произвольными значениями.
- **Санитизировать имя**: обрезать длину, убрать управляющие символы и переводы строк.
- **Хранить одну запись на игрока в режиме** (`name + mode`), оставляя лучший результат
  (меньшее время, при равенстве — больше очков).
- **Ограничить частоту вызовов** (rate limit) — чтобы нельзя было залить таблицу.

### 3. Валидация в `rename_player`
- Те же проверки имени, что и выше.
- Слияние записей по лучшему результату (меньшее время, при равенстве — больше очков)
  при коллизии нового имени (уже учтено клиентом как fallback, но решающее слово — за сервером).

## Готовая миграция (выполнить в Supabase → SQL Editor)

> ⚠️ **Перед запуском на боевом проекте:** сделай бэкап таблицы (или прогони на копии/
> dev-проекте). Скрипт приведён под **реальную схему** (сверено аудитом 2026-06):
> таблица `public.leaderboard` со столбцами `name text`, `mode text`, `score integer`,
> `time double precision`, `created_at timestamptz` и уникальным индексом на
> `(name, mode)`. RPC `submit_score`/`rename_player` вызывает клиент. Включение RLS
> меняет доступ к таблице — проверь, что чтение топа и отправка результата работают
> после миграции. Скрипт идемпотентен (можно повторять).

```sql
-- ============================================================================
-- AwParty — защита общей таблицы рекордов. Выполнить целиком.
-- Схема (сверено аудитом): leaderboard(id, name text, mode text, score integer,
-- time double precision, created_at timestamptz). Метрика рейтинга — time
-- (меньше = быстрее = выше; при равенстве — больше score).
-- ============================================================================

-- 0. Уникальность «одна запись на игрока в режиме» (нужно для on conflict).
create unique index if not exists leaderboard_name_mode_key
  on public.leaderboard (name, mode);

-- 1. RLS: anon может только ЧИТАТЬ. Прямая запись запрещена — только через RPC ниже.
alter table public.leaderboard enable row level security;

drop policy if exists "anon read leaderboard" on public.leaderboard;
create policy "anon read leaderboard"
  on public.leaderboard for select to anon using (true);
-- (намеренно НЕТ insert/update/delete-политик для anon)

-- 2. submit_score: валидирует вход, хранит ЛУЧШИЙ РЕЗУЛЬТАТ по времени на (name, mode).
create or replace function public.submit_score(
  p_name text, p_score integer, p_time double precision, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_mode text;
begin
  v_mode := case when p_mode = 'hardcore' then 'hardcore' else 'normal' end;

  -- score: целое неотрицательное, разумный потолок (главная защита от накрутки).
  -- Подбери верхнюю границу под реальный максимум забега.
  if p_score is null or p_score < 0 or p_score > 5000000 then
    raise exception 'invalid score';
  end if;
  -- время: конечное неотрицательное, не больше 6 часов.
  if p_time is null or p_time <> p_time or p_time < 0 or p_time > 21600 then
    raise exception 'invalid time';
  end if;
  -- имя: убрать управляющие символы, обрезать до 20.
  v_name := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 20);
  if v_name = '' then v_name := 'Anonymous'; end if;

  insert into public.leaderboard (name, score, time, mode, created_at)
  values (v_name, p_score, p_time, v_mode, now())
  on conflict (name, mode) do update
    set time  = least(leaderboard.time, excluded.time),
        score = case
                  when excluded.time < leaderboard.time then excluded.score
                  when excluded.time = leaderboard.time then greatest(leaderboard.score, excluded.score)
                  else leaderboard.score end,
        created_at = case when excluded.time < leaderboard.time
                          then now() else leaderboard.created_at end;
end; $$;

-- 3. rename_player: проверка имени + слияние по лучшему ВРЕМЕНИ в каждом режиме.
create or replace function public.rename_player(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare v_new text;
begin
  v_new := left(btrim(regexp_replace(coalesce(p_new, ''), '[[:cntrl:]]', '', 'g')), 20);
  if v_new = '' then raise exception 'invalid new name'; end if;
  if p_old is null or btrim(p_old) = '' then raise exception 'invalid old name'; end if;
  if v_new = p_old then return; end if;

  -- перенести строки старого имени под новое, слив лучший результат по времени
  insert into public.leaderboard (name, score, time, mode, created_at)
    select v_new, o.score, o.time, o.mode, o.created_at from leaderboard o where o.name = p_old
  on conflict (name, mode) do update
    set time  = least(leaderboard.time, excluded.time),
        score = case
                  when excluded.time < leaderboard.time then excluded.score
                  when excluded.time = leaderboard.time then greatest(leaderboard.score, excluded.score)
                  else leaderboard.score end,
        created_at = case when excluded.time < leaderboard.time
                          then excluded.created_at else leaderboard.created_at end;
  delete from leaderboard where name = p_old;
end; $$;

-- 4. Права: вызывать RPC может anon; тело выполняется с правами владельца (definer).
grant execute on function public.submit_score(text, integer, double precision, text) to anon;
grant execute on function public.rename_player(text, text) to anon;
```

Самое важное против накрутки — пункты 1 (RLS, нет прямой записи) и 2 (потолок `score`,
плюс `time`). Пункты 3–4 — для целостности переименования и доступа к RPC.

Rate limiting (защита от заливки таблицы спамом) тут не покрыт — его удобнее вынести
на уровень Supabase Edge Functions / сетевого прокси, либо ограничивать в RPC по
таблице-журналу вызовов.

## Облачные сейвы (бэкап прогресса по нику)

Опциональная фича: мета-прогресс (`totalCoins`, `perm*`, артефакты) бэкапится в
облако по нику. Клиент — [src/cloud_save.js](src/cloud_save.js).

> ⚠️ **Модель «по нику, без аутентификации».** Кто знает чужой ник, может прочитать
> и **перезаписать** его бэкап. Это осознанный компромисс ради простоты (без логина).
> Если нужна защита — добавь ключ/PIN: храни его в строке сейва и проверяй внутри
> `SECURITY DEFINER`-RPC `cloud_save(name, key, blob)` / `cloud_load(name, key)`,
> закрыв таблицу от прямого доступа `anon` (как сделано для `leaderboard`).

Миграция для **открытой** модели (как реализовано в коде):

```sql
-- Таблица облачных сейвов: одна строка на ник.
create table if not exists public.cloud_saves (
  name       text primary key,
  blob       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cloud_saves enable row level security;

-- Открытая модель: anon может читать, вставлять и обновлять по нику.
drop policy if exists "cloud read"   on public.cloud_saves;
drop policy if exists "cloud insert" on public.cloud_saves;
drop policy if exists "cloud update" on public.cloud_saves;
create policy "cloud read"   on public.cloud_saves for select to anon using (true);
create policy "cloud insert" on public.cloud_saves for insert to anon with check (true);
create policy "cloud update" on public.cloud_saves for update to anon using (true) with check (true);
```

Клиент шлёт `POST` с заголовком `Prefer: resolution=merge-duplicates` (upsert по
первичному ключу `name`) и читает `GET ...?name=eq.<ник>`. Пока таблицы/политик нет,
фича просто молча не работает (бэкап/восстановление вернут ошибку), на остальную
игру не влияет.

