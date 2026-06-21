# Дизайн: таблицы рекордов по главам + глобальный ранг

Дата: 2026-06-21
Статус: одобрено, в реализации

## Цель
Переписать систему рекордов: таблицы разбиваются по главам (Глава 1/2/3) × режим
(normal/hardcore). Рекорд пишется только при прохождении главы (выход в портал). После
отправки игроку показывается его **глобальное место** в таблице (даже если он не в топ-10).

## Решения (из брейнсторма)
- **Бэкенд:** пользователь применит SQL в Supabase → полноценные онлайн-таблицы по главам
  и настоящий глобальный ранг (count-запрос).
- **Оси:** глава × режим (3×2 = 6 досок).
- **Метрика:** время прохождения (↑ быстрее = выше), tie-break очки (↓). Без изменений.
- **Смерть после 1-го босса:** только закрепляет ник (локально), рекорд НЕ пишет. Меняет
  недавнюю фичу: на смерти больше нет отправки результата.
- **Оффлайн/без Supabase:** локальные топ-10 показываем; место — НЕ показываем.

## Модель данных

### Онлайн (Supabase) — SQL для пользователя
```sql
-- 1) колонка главы
alter table public.leaderboard add column if not exists chapter int not null default 1;

-- 2) одна запись на игрока в связке (name, mode, chapter)
--    (снять старое ограничение на (name, mode), если было; добавить новое)
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'leaderboard_name_mode_key') then
    alter table public.leaderboard drop constraint leaderboard_name_mode_key;
  end if;
end $$;
create unique index if not exists leaderboard_name_mode_chapter_key
  on public.leaderboard (name, mode, chapter);

-- 3) submit_score с главой: upsert по (name, mode, chapter), хранит лучший (time asc, score desc)
create or replace function public.submit_score(
  p_name text, p_score int, p_time numeric, p_mode text, p_chapter int
) returns void language plpgsql security definer as $$
begin
  insert into public.leaderboard (name, score, time, mode, chapter, created_at)
  values (p_name, p_score, p_time, p_mode, p_chapter, now())
  on conflict (name, mode, chapter) do update
    set score = excluded.score, time = excluded.time, created_at = now()
    where excluded.time < public.leaderboard.time
       or (excluded.time = public.leaderboard.time and excluded.score > public.leaderboard.score);
end $$;
```
Ранг считаем без нового RPC — count-запросом PostgREST (см. ниже). RLS должен разрешать
`select`/`count` (как сейчас для топ-10). Существующие строки получат `chapter = 1`.

### Локально (фолбэк офлайн)
Ключи `localStorage`: `awparty_lb_v4_<mode>_<chapter>` (например `awparty_lb_v4_normal_2`),
по 10 записей `{name, score, time, day, month, year}`. Миграция: старые `awparty_leaderboard_v3`
→ `(normal, ch1)`, `awparty_leaderboard_hc_v3` → `(hardcore, ch1)`. Офлайн ранг не показываем.

## Поток: запись результата (только портал)
`MainScene._enterPortal` (все 3 этапа пройдены):
1. `mode = _runMode()`, `chapter = currentChapter`.
2. Нет `save.playerName` → `NAME_INPUT` (флаг `_pendingSubmit = {chapter, mode}`), после ввода
   submit. Есть ник → submit сразу.
3. После `submit` — `fetchRank(chapter, mode, time, score)` → сохранить `this._lastRank`.
4. Перейти на `STAGE_CLEAR`, показать «Ваше место: #X» (если онлайн и ранг получен).

`_submitScore(name, chapter, mode, showBoard)` — добавить параметры chapter/mode; локально
кладёт в нужную доску, онлайн шлёт `submit(name, score, time, mode, chapter)`.

## Поток: смерть после 1-го босса (только ник)
`MainScene.onPlayerDeath`: если `_firstBossKilled` и `!save.playerName` → `NAME_INPUT` в
режиме `_nameClaimOnly = true`. В `_confirmNameInput`: при `_nameClaimOnly` — проверить
занятость (`nameTaken`), сохранить `save.playerName`, вернуться на экран Game Over.
**Результат/очки не отправляются.** (Раньше добавленный `_submitScore` на смерти — убрать.)

## Глобальный ранг
`RemoteLeaderboard.fetchRank(chapter, mode, time, score, cb)`:
```
GET /leaderboard?chapter=eq.C&mode=eq.M
    &or=(time.lt.T,and(time.eq.T,score.gt.S))&select=name&limit=1
header: Prefer: count=exact
```
Читаем `Content-Range` (`*/N`) → `betterCount = N` → `rank = N + 1`. Ошибка/офлайн/без
конфига → `cb(null)`.

## API RemoteLeaderboard (изменения)
- `fetchTop(limit, mode, chapter, cb)` — добавить фильтр `chapter=eq.C`.
- `submit(name, score, time, mode, chapter, cb)` — добавить `p_chapter`.
- `nameTaken(name, cb)` — без изменений (ник глобально уникален по игроку).
- `fetchRank(chapter, mode, time, score, cb)` — новый.

## Хранилище в сцене
`this.leaderboards` → структура по ключу `mode + '_' + chapter` (или вложенный объект
`{normal:{1:[],2:[],3:[]}, hardcore:{...}}`). Текущий просмотр: `this.lbChapter` (1..3) +
`this.lbView` (mode). Загрузка локальных досок лениво/при входе на экран.

## UI
`_buildLeaderboard`: заголовок главы `t('lb_chapter') + N` + переключатель режима; топ-10
выбранной доски. Подсказки: «← → глава», «↑ ↓ режим». Клавиши в обработчике `LEADERBOARD`:
`left/right` → смена главы (циклично 1..3), `up/down` → смена режима, с `rebuildMenu`.
`STAGE_CLEAR`: добавить строку «Ваше место: #X» (если `_lastRank != null`).

## Затрагиваемые файлы
`leaderboard_remote.js`, `save.js`, `scene.js` (init/загрузка досок), `scene_records.js`
(submit/death/confirm/rank), `scene_ui.js` (LB-экран + STAGE_CLEAR + клавиши), `i18n.js`
(строки: lb_chapter, lb_your_place, lb_hint_chapter, lb_hint_mode), `index.html` (ASSET_VER).
Метрика `lbCompare` — без изменений.

## Критерии приёмки
1. Экран рекордов: ←/→ переключает главу, ↑/↓ — режим; показывается топ-10 нужной доски.
2. Рекорд пишется ТОЛЬКО при выходе в портал, в доску (currentChapter, mode).
3. После прохождения на `STAGE_CLEAR` показано «Ваше место: #X» (онлайн), вне топ-10 — тоже.
4. Смерть после 1-го босса даёт ввод ника (закрепить), но НЕ пишет рекорд/очки.
5. Без Supabase: локальные топ-10 показываются, место скрыто, игра не падает.
6. Дан SQL для Supabase; `ASSET_VER` поднят.
