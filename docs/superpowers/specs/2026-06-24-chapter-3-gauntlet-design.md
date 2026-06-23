# Глава 3 — «Гаунтлет»: дизайн

**Дата:** 2026-06-24
**Статус:** утверждён к реализации

## Идея

Глава 3 — это «лучшее из пройденного»: в ней встречаются **все враги и все боссы**
из глав 1 и 2, выстроенные в бесшовный сценарий из 3 этапов с мид-боссами,
передышками и финальным боем сразу против двух боссов. Арена расширена до
**5000×5000**, фон новый (красная тема).

Контент **переиспользует существующие спрайты** глав 1/2 — нового арта врагов/боссов
не требуется. Единственный новый ассет — фон арены (`floor3.jpg`).

## Сценарий главы 3

Каждый этап = текущая фаза (`PHASE_1 / PHASE_2 / PHASE_3`). «Половина этапа» считается
по `phaseKills` (счётчик убийств сбрасывается на входе в каждую фазу; смерть босса тоже
инкрементит `phaseKills` — это учтено в порогах).

### Этап 1 (`PHASE_1`) — как глава 1, этап 1
- Спавн только мобов главы 1: `NORMAL / FAST / TANK / GOBLIN`.
  Спец-мобы (`SUBWOOFER / MOSHER / HYPEMAN`) **не спавнятся**.
- По достижении кап-таргета (`_bossKillReq(1)` или тайм-кап — штатная логика спавнера) →
  **Босс B1 «НАДЗИРАТЕЛЬ»** (`makeBoss`, арт `enemy`).
- Смерть B1 → штатный `PHASE_1 → CLEARING → PHASE_2` (существующий код).

### Этап 2 (`PHASE_2`) — кап `N2`
- Спавн: мобы главы 1 **+ MOSHER + SUBWOOFER** (поверх; HYPEMAN не добавляется).
- `phaseKills ≥ N2/2` → **Босс B2 «БАС-ДРОП»** (`makeBoss2`, арт `boss2`). Мид-босс,
  мобы продолжают спавниться, пока он жив.
- Смерть B2 → **передышка** (`BREATHER` секунд без спавна) → добиваем вторую половину.
- `phaseKills ≥ N2` **и** B2 мёртв → переход в `PHASE_3`.

### Этап 3 (`PHASE_3`) — кап `N3`
- Спавн: тот же ростер (мобы гл.1 + MOSHER + SUBWOOFER).
- `phaseKills ≥ N3/2` → **Носорог = Bass-rush** (`makeBossBass`, арт `c2_boss2`).
  Имя в HUD — отдельное («НОСОРОГ»), чтобы не дублировать «БАС-ДРОП».
- Смерть Носорога → **передышка** → добиваем вторую половину.
- `phaseKills ≥ N3` **и** Носорог мёртв → **финальный дуэт** одновременно:
  - **Врач** (`makeBossDoctor`, арт `c2_boss1`) — `isBoss`, душа 4.
  - **Телепортёр B3 «СТРОБ»** (`makeBoss3`, арт `boss3`) — `isBoss3`, душа 3.
  - Во время дуэта мобы не спавнятся (это финальный бой).
- **Оба** мертвы → `_startCrazyMode()` / портал (забег пройден).

Используемые боссы: B1, B2, Bass (Носорог), Doctor, B3 — все боссы глав 1/2, кроме
Split. Все арт-ключи существуют на диске (`enemy`, `boss2`, `boss3`, `c2_boss1`,
`c2_boss2`).

## Архитектура: изолированный «режиссёр» главы 3

Выбран вариант **изоляции** (отдельный модуль) вместо декларативного скрипт-движка
(избыточно для одной главы, YAGNI) и вместо разбросанных `if (currentChapter===3)`
(грязно). Существующий путь глав 1/2 **не меняется** — только добавляются guard'ы
«если глава 3 — делегировать режиссёру».

### Новый файл `src/scene_chapter3.js`
Методы `MainScene.prototype.*`, владеющие всей логикой главы 3:
- **State-machine этапа** (по `phaseKills` против порогов `N/2` и `N`): спавн мид-боссов,
  таймеры передышек, продвижение фаз `PHASE_2 → PHASE_3`, финальный дуэт, триггер
  crazyMode.
- **Гейтинг ростера:** на входе в этап 2 режиссёр присваивает
  `scene._mosherKey = 'enemy2_mosher'` и `scene._subwooferKey = 'enemy2_sub'`.
  Спавнер уже спавнит эти типы **только если ключ задан** — правок в `spawner.js` ноль.
  На этапе 1 ключи пустые (в этап заходим с `null`).
- **Спавн боссов** с явными арт-ключами (см. сценарий выше).
- **Передышка:** флаг/таймер `ch3Breather`, который читает проверка `spawningActive`.
- **Перехват финала:** при спавне дуэта ставится `_ch3Finale = true`; crazyMode
  стартует только когда оба финальных босса мертвы (см. ниже).

Подключение: добавить `scene_chapter3.js` в `MODULES` (`index.html`) **после** `scene`
и **до** `main`. Поднять `ASSET_VER`.

### Guard'ы в существующем коде
- `scene_spawndriver.js` — `_updatePhaseProgression`: при `currentChapter===3` пропускать
  дефолтный спавн боссов фазы 2/3 и дефолтные `CLEARING/PHASE_2/PHASE_3` переходы;
  вместо этого вызывать метод режиссёра.
- `scene_spawndriver.js` — `_checkPhaseTransitions`: guard на главу 3 (переходы фаз 2/3
  ведёт режиссёр).
- `scene_spawndriver.js` — `_updateSpawning`: учесть `ch3Breather` в `spawningActive`.
- `scene_combat.js` — `handleEnemyDeaths`, ветка `isBoss3` crazy-trigger
  ([scene_combat.js:159](../../../src/scene_combat.js)): guard — для финала главы 3 не
  стартовать crazy, если жив второй босс дуэта (`_ch3Finale && другой босс жив`).
  Режиссёр в своём `update` детектит «оба мертвы» и сам вызывает `_startCrazyMode()`.

## Арена пер-глава (5000×5000 для главы 3)

Сейчас `C.ARENA_WIDTH/HEIGHT = 3000` — глобальные константы. Делаем размер арены
свойством забега:
- На старте забега: `this.arenaW = chapter.arenaW || C.ARENA_WIDTH`,
  `this.arenaH = chapter.arenaH || C.ARENA_HEIGHT`.
- Заменить прямые `C.ARENA_WIDTH/HEIGHT` на `this.arenaW/this.arenaH` в:
  - камера-bounds, аллокация спатиал-грида (`_sepCols/_sepRows`), позиция портала
    (`scene.js`, `scene_spawndriver.js`);
  - клэмпы в `scene_combat.js` (split-clamp строки 148-149 — для корректности, хотя
    Split в гл.3 не используется).
- `spawner.js` уже принимает `arenaW/arenaH` параметрами — просто передавать
  `this.arenaW/this.arenaH`.
- Аудит: найти **все** вхождения `C.ARENA_WIDTH`/`C.ARENA_HEIGHT` и развести по
  `this.arenaW/H` (глобальные константы остаются дефолтом для глав 1/2).

## HUD: общий HP-бар на дуэт

Финальный дуэт показывает **одну общую полосу**: значение = `Σ текущих HP` живых
боссов дуэта / `Σ max HP`. Лейбл — общий заголовок финала (напр. «ФИНАЛ» или
«ВРАЧ + ТЕЛЕПОРТЁР»). Детали рендера — по факту в `hud.js` при реализации.

## Изменения данных и ассетов

### `constants.js`
- Переписать `CHAPTERS[2]` на переиспользование арта:
  ```js
  { id: 3, hue: 0xff5050,
    floorKey: 'floor3', floorTint: 0xff6464, floorMode: 'stretch',
    enemyKey: 'enemy', goblinKey: 'enemyV',
    boss1Key: 'enemy', boss2Key: 'boss2', boss3Key: 'boss3',
    arenaW: 5000, arenaH: 5000, custom: 'CH3',
    hpMult: 2.4, dmgMult: 1.8, spawnMult: 1.4, bossHpMult: 2.6 }
  ```
  (спец-мобы в конфиге не задаём — их включает режиссёр; `encircleEvent` — см. риски).
- Новый блок констант:
  ```js
  C.CHAPTER3 = {
    STAGE2_KILLS: 60, STAGE3_KILLS: 70,   // стартовые значения, тюнятся по плейтесту
    BREATHER: 4,                          // сек паузы спавна после мид-босса
    HARDCORE_KILL_MULT: 1.5,              // как в _bossKillReq
    mosherKey: 'enemy2_mosher', subwooferKey: 'enemy2_sub',
    rhinoArt: 'c2_boss2', doctorArt: 'c2_boss1', teleporterArt: 'boss3',
  };
  ```
- `TEXTURE_MANIFEST`: убрать мёртвые `enemy3*`, `enemyV3`, `c3_boss1/2/3` (файлов нет);
  оставить/добавить `['floor3','floor3.jpg']` (новый фон).

### `i18n.js`
- Добавить имя Носорога: `rhino_name: 'RHINO'` / `'НОСОРОГ'`.
- (Опц.) заголовок финала дуэта.

### Ассеты
- Новый файл `assets/floor3.jpg` (фон 5000×5000, красная тема). Промт — см. ниже.

## Промт для фона (`floor3.jpg`)

> **Top-down arena floor, seamless, no characters.** A vast hellish underground rave
> bunker seen directly from above. Cracked dark-crimson concrete and scorched metal
> grating, glowing molten-red fissures and ember veins running through the floor, faint
> hexagonal tech panels and worn neon-red hazard stripes, scattered scuff marks and
> dust. Dark moody industrial lighting with deep red ambient glow, subtle volumetric
> haze. High detail, 4K, evenly lit for tiling, orthographic top-down perspective, no
> walls, no objects casting tall shadows, no text. Color palette: blood red, charcoal
> black, ember orange accents.

`floorMode: 'stretch'` растянет изображение на 5000×5000.

## Баланс (тюнится по плейтесту)
- `N2 = 60`, `N3 = 70` (половина = `floor/2` = 30 / 35).
- Множители главы 3 (`hp×2.4, dmg×1.8, bossHp×2.6, spawn×1.4`) — оставить.
- Hardcore: пороги убийств ×1.5.

## Риски и крайние случаи
- **`_startCrazyMode` на дуэте:** Телепортёр (`isBoss3`) триггерит crazy при смерти —
  обязателен guard, иначе портал откроется при живом Враче. Решение — `_ch3Finale` +
  проверка «оба мертвы» в режиссёре.
- **Две души подряд:** дуэт даёт две `BossSoul` (4 и 3) → два экрана `ABILITY_SELECT`
  подряд. Поведение приемлемо (штатная очередь душ), проверить на плейтесте.
- **`encircleEvent: true` у главы 3:** проверить, что событие «окружение» не конфликтует
  с бесшовным сценарием режиссёра; при конфликте — отключить для гл.3.
- **Спатиал-грид 5000×5000:** больше ячеек (`(5000/150)² ≈ 1111` против `400`) — проверить,
  что аллокация и очистка `_sepTouched` не дают просадок (сепарация всё равно считается
  только в радиусе ~1200px от игрока).
- **Продвижение фазы без убийства мид-босса:** переход этапа гейтить на
  `phaseKills ≥ N` **И** мид-босс мёртв (иначе игрок «проскочит» босса, докрутив мобов).

## Проверка (ручная, через локальный http-сервер)
- Разблокировать главу 3 (`save.maxChapterUnlocked = 3` в localStorage), пройти все 3
  этапа: проверить ростер мобов по этапам, тайминги мид-боссов (50%), передышки, дуэт,
  общий HP-бар, открытие портала только после смерти обоих финальных боссов.
- Регресс: главы 1 и 2 проходятся без изменений (арена 3000, прежние боссы/переходы).
