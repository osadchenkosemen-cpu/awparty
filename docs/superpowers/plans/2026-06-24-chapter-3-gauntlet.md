# Глава 3 «Гаунтлет» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить главу 3 в «гаунтлет», переиспользующий всех врагов и боссов глав 1–2, с бесшовным сценарием из 3 этапов (мид-боссы, передышки, финальный дуэт) на арене 5000×5000.

**Architecture:** Изолированный «режиссёр» главы 3 (`src/scene_chapter3.js`, методы `MainScene.prototype.*`) владеет логикой этапов 2–3; главы 1–2 не меняются — в существующий драйвер добавлены guard'ы `if (chapter.custom === 'CH3')`. Размер арены становится свойством забега (`this.arenaW/this.arenaH`). Гейтинг спец-мобов делается через присвоение `this._mosherKey/_subwooferKey` (спавнер уже читает эти ключи — правок в нём нет).

**Tech Stack:** Vanilla JS (ES6+), Phaser 3, без сборщика. Глобальные переменные, порядок загрузки модулей в `index.html`.

## Global Constants

- После правки любого `src/*.js` поднимать `ASSET_VER` в `index.html` (иначе кэш отдаст старый код). Текущее значение: `'203'`.
- Hot path: только `distSq()` (без `Math.sqrt`); объекты в game loop — из `this.pools.*`; магические числа — в `C` (`constants.js`).
- Кириллица в UI — шрифт `'Exo 2'` (Orbitron её не содержит); тексты через `t('key')` из `i18n.js`.
- Новые `scene_*`-файлы добавлять в `MODULES` (`index.html`) после `scene` и до `main`.
- Арт главы 3 переиспользует существующие спрайты глав 1/2; новый ассет — только фон `assets/floor3.jpg` (уже добавлен, JPEG 1024×1024).
- Боссы главы 3 и арт: B1 «НАДЗИРАТЕЛЬ» (`makeBoss`, арт `enemy`); B2 «БАС-ДРОП» (`makeBoss2`, арт `boss2`); Носорог=Bass-rush (`makeBossBass`, арт `c2_boss2`); Врач (`makeBossDoctor`, арт `c2_boss1`); Телепортёр «СТРОБ» (`makeBoss3`, арт `boss3`).
- Сценарий: этап 1 — мобы гл.1 + B1 в конце; этап 2 — +Мошер/Сабвуфер, B2 на 50% кап-убийств, передышка, переход на 100%; этап 3 — Носорог на 50%, передышка, добить мобов до 100%, затем дуэт Врач+Телепортёр, после смерти обоих — портал.

---

## File Structure

| Файл | Изменение | Ответственность |
|---|---|---|
| `src/scene_chapter3.js` | **создать** | Режиссёр главы 3: state-machine этапов, мид-боссы, передышки, дуэт, триггер портала |
| `src/constants.js` | изменить | `CHAPTERS[2]` (переиспользование арта, `custom:'CH3'`, `arenaW/H`), блок `C.CHAPTER3`, чистка `TEXTURE_MANIFEST` |
| `src/i18n.js` | изменить | Имена `rhino_name`, `boss_duet` (en/ru) |
| `src/scene.js` | изменить | Арена пер-глава (`this.arenaW/H`), ресайз в `resetGame`, инициализация полей режиссёра, combined boss-бар |
| `src/scene_spawndriver.js` | изменить | Арена пер-глава; guard'ы делегирования режиссёру; учёт `_ch3NoSpawn` в `spawningActive` |
| `src/scene_combat.js` | изменить | Арена пер-глава; guard на `_startCrazyMode` для финала гл.3 |
| `src/scene_fx.js` | изменить | Арена пер-глава (фон-сетка) |
| `src/entities.js` | изменить | Арена пер-глава в `Skull.update`/`ShatterBomb.update` (`this.scene.arenaW/H`) |
| `src/hud.js` | без изменений | (combined-бар считается в `scene.js`, HUD уже принимает `bossHpPct`) |
| `index.html` | изменить | `scene_chapter3` в `MODULES`; бамп `ASSET_VER` |

---

## Task 1: Арена как свойство забега (чистый рефактор, поведение не меняется)

Заменяем глобальные `C.ARENA_WIDTH/HEIGHT` на `this.arenaW/this.arenaH` (для энтити — `this.scene.arenaW/H`). По умолчанию = 3000, поэтому главы 1/2/3 играются идентично текущему. Это фундамент под арену 5000×5000.

**Files:**
- Modify: `src/scene.js`
- Modify: `src/scene_spawndriver.js`
- Modify: `src/scene_combat.js`
- Modify: `src/scene_fx.js`
- Modify: `src/entities.js`
- Modify: `index.html` (бамп `ASSET_VER`)

**Interfaces:**
- Produces: `this.arenaW`, `this.arenaH` (числа) на `MainScene` — размер текущей арены. Все системы (камера, грид, спавн, клэмпы) читают их.

- [ ] **Step 1: scene.js — заменить все `C.ARENA_WIDTH/HEIGHT` на `this.arenaW/H`**

В `src/scene.js` выполнить два replace_all:
- `C.ARENA_WIDTH` → `this.arenaW`
- `C.ARENA_HEIGHT` → `this.arenaH`

(Затрагивает строки ~35, 40, 41, 251, 252, 376, 405, 435, 439, 520, 556, 619, 698, 700, 706, 737, 772, 773, 925, 926.)

- [ ] **Step 2: scene.js — задать дефолт `arenaW/H` в `create()` перед первым использованием**

После replace_all строка установки камеры выглядит так. Заменить:

```js
        this.worldLayer = this.add.layer();
        this.uiLayer = this.add.layer();

        this.cameras.main.setBounds(0, 0, this.arenaW, this.arenaH);
```

на:

```js
        this.worldLayer = this.add.layer();
        this.uiLayer = this.add.layer();

        this.arenaW = C.ARENA_WIDTH; this.arenaH = C.ARENA_HEIGHT;
        this.cameras.main.setBounds(0, 0, this.arenaW, this.arenaH);
```

- [ ] **Step 3: scene.js — в `resetGame()` выставить размер арены по главе и ресайзнуть мир**

В начале `resetGame()` строка:

```js
    resetGame() {
        this.isGameOver = false;
        const p = this.player, s = this.save;
```

Заменить на:

```js
    resetGame() {
        this.isGameOver = false;
        const p = this.player, s = this.save;

        this.chapter = getChapter(this.currentChapter);
        this.arenaW = this.chapter.arenaW || C.ARENA_WIDTH;
        this.arenaH = this.chapter.arenaH || C.ARENA_HEIGHT;
        this.cameras.main.setBounds(0, 0, this.arenaW, this.arenaH);
        this.arena.setSize(this.arenaW, this.arenaH);
        this.arenaBorder.setSize(this.arenaW, this.arenaH);
```

- [ ] **Step 4: scene.js — убрать дублирующую установку `this.chapter` ниже**

Дальше в `resetGame()` есть повторная строка (теперь `this.chapter` уже задан в Step 3). Заменить:

```js
        this.chapter = getChapter(this.currentChapter);
        this._enemyKey = this._tex(this.chapter.enemyKey, 'enemy');
```

на:

```js
        this._enemyKey = this._tex(this.chapter.enemyKey, 'enemy');
```

- [ ] **Step 5: scene_spawndriver.js — заменить `C.ARENA_WIDTH/HEIGHT` на `this.arenaW/H`**

В `src/scene_spawndriver.js` два replace_all: `C.ARENA_WIDTH`→`this.arenaW`, `C.ARENA_HEIGHT`→`this.arenaH` (строки ~29, 44, 69, 98).

- [ ] **Step 6: scene_combat.js — заменить `C.ARENA_WIDTH/HEIGHT` на `this.arenaW/H`**

В `src/scene_combat.js` два replace_all: `C.ARENA_WIDTH`→`this.arenaW`, `C.ARENA_HEIGHT`→`this.arenaH` (строки ~4, 5, 109, 110, 148, 149).

- [ ] **Step 7: scene_fx.js — заменить `C.ARENA_WIDTH/HEIGHT` на `this.arenaW/H`**

В `src/scene_fx.js` строка 3:

```js
        const W = C.ARENA_WIDTH, H = C.ARENA_HEIGHT, tm = this.globalTime;
```

заменить на:

```js
        const W = this.arenaW, H = this.arenaH, tm = this.globalTime;
```

- [ ] **Step 8: entities.js — заменить на `this.scene.arenaW/H`**

В `src/entities.js` две строки. Строка ~1265 (в `Skull.update`):

```js
        if (this.x < -150 || this.y < -150 || this.x > C.ARENA_WIDTH + 150 || this.y > C.ARENA_HEIGHT + 150) this.dead = true;
```

на:

```js
        if (this.x < -150 || this.y < -150 || this.x > this.scene.arenaW + 150 || this.y > this.scene.arenaH + 150) this.dead = true;
```

Строка ~1314 (в `ShatterBomb.update`):

```js
        const out = (this.x < 0 || this.y < 0 || this.x > C.ARENA_WIDTH || this.y > C.ARENA_HEIGHT);
```

на:

```js
        const out = (this.x < 0 || this.y < 0 || this.x > this.scene.arenaW || this.y > this.scene.arenaH);
```

- [ ] **Step 9: Проверить, что остались только намеренные фолбэки**

Run: `grep -rn "C.ARENA_WIDTH\|C.ARENA_HEIGHT" src/`
Expected: ровно две строки в `src/scene.js` — дефолт в `create()` (`this.arenaW = C.ARENA_WIDTH; this.arenaH = C.ARENA_HEIGHT;`) и фолбэк в `resetGame()` (`this.chapter.arenaW || C.ARENA_WIDTH`, `... || C.ARENA_HEIGHT`). В остальных файлах — пусто.

- [ ] **Step 10: Синтаксис-проверка всех изменённых файлов**

Run: `node --check src/scene.js && node --check src/scene_spawndriver.js && node --check src/scene_combat.js && node --check src/scene_fx.js && node --check src/entities.js`
Expected: без ошибок (тихо).

- [ ] **Step 11: index.html — бамп ASSET_VER**

В `index.html` заменить `var ASSET_VER = '203';` на `var ASSET_VER = '204';`.

- [ ] **Step 12: Ручная проверка (регресс глав 1/2)**

Run: `python -m http.server 8000` → открыть `http://localhost:8000/index.html` (DevTools → Network → Disable cache).
Проверить: глава 1 и глава 2 запускаются и играются как раньше (арена 3000, камера, спавн, коллизии, портал в конце). В консоли нет ошибок про `arenaW`.

- [ ] **Step 13: Commit**

```bash
git add src/scene.js src/scene_spawndriver.js src/scene_combat.js src/scene_fx.js src/entities.js index.html
git commit -m "refactor: размер арены как свойство забега (this.arenaW/H)"
```

---

## Task 2: Конфиг и ассеты главы 3

Переписываем `CHAPTERS[2]` на переиспользование арта глав 1/2, арену 5000×5000 и флаг `custom:'CH3'`; добавляем константы `C.CHAPTER3`; чистим мёртвые записи манифеста; добавляем имена боссов в i18n. После задачи глава 3 грузится на арене 5000 с фоном `floor3` и мобами гл.1; боссы пока спавнятся дефолтным драйвером (режиссёр — в Task 4).

**Files:**
- Modify: `src/constants.js`
- Modify: `src/i18n.js`
- Modify: `index.html` (бамп `ASSET_VER`)

**Interfaces:**
- Produces: `CHAPTERS[2].custom === 'CH3'` (флаг делегирования режиссёру); `CHAPTERS[2].arenaW/arenaH = 5000`; `C.CHAPTER3 = { STAGE2_KILLS, STAGE3_KILLS, BREATHER, HARDCORE_KILL_MULT, mosherKey, subwooferKey, rhinoArt, doctorArt, teleporterArt }`; `t('rhino_name')`, `t('boss_duet')`.

- [ ] **Step 1: constants.js — переписать `CHAPTERS[2]`**

Заменить блок главы 3:

```js
    { id: 3, hue: 0xff5050,
      floorKey: 'floor3', floorTint: 0xff6464, floorMode: 'stretch',
      enemyKey: 'enemy3', goblinKey: 'enemyV3', subwooferKey: 'enemy3_sub', mosherKey: 'enemy3_mosher', hypemanKey: 'enemy3_hype',
      boss1Key: 'c3_boss1', boss2Key: 'c3_boss2', boss3Key: 'c3_boss3', encircleEvent: true,
      hpMult: 2.4, dmgMult: 1.8, spawnMult: 1.4, bossHpMult: 2.6 },
```

на:

```js
    { id: 3, hue: 0xff5050,
      floorKey: 'floor3', floorTint: 0xff6464, floorMode: 'stretch',
      enemyKey: 'enemy', goblinKey: 'enemyV',
      boss1Key: 'enemy', boss2Key: 'boss2', boss3Key: 'boss3',
      arenaW: 5000, arenaH: 5000, custom: 'CH3', encircleEvent: true,
      hpMult: 2.4, dmgMult: 1.8, spawnMult: 1.4, bossHpMult: 2.6 },
```

(Спец-мобы намеренно не заданы — их включает режиссёр на этапе 2; `boss*Key` указывают на реальный арт гл.1.)

- [ ] **Step 2: constants.js — добавить блок `C.CHAPTER3`**

Сразу после массива `CHAPTERS` и функции `getChapter` (после строки `function getChapter(id) { ... }`) добавить:

```js
C.CHAPTER3 = {
    STAGE2_KILLS: 60,       // кап убийств этапа 2 (мид-босс B2 на половине)
    STAGE3_KILLS: 70,       // кап убийств этапа 3 (Носорог на половине, затем дуэт)
    BREATHER: 4,            // сек паузы спавна после смерти мид-босса
    HARDCORE_KILL_MULT: 1.5,
    mosherKey: 'enemy2_mosher',
    subwooferKey: 'enemy2_sub',
    rhinoArt: 'c2_boss2',   // Носорог = Bass-rush
    doctorArt: 'c2_boss1',  // Врач
    teleporterArt: 'boss3', // Телепортёр (СТРОБ)
};
```

- [ ] **Step 3: constants.js — убрать мёртвые записи из `TEXTURE_MANIFEST`**

Удалить строки (файлов на диске нет, ключи больше не используются):

```js
    ['enemy3', 'enemy3.png'],
    ['enemyV3', 'enemyV3.png'],
    ['enemy3_sub', 'enemy3_sub.png'],
    ['enemy3_mosher', 'enemy3_mosher.png'],
    ['enemy3_hype', 'enemy3_hype.png'],
    ['c3_boss1', 'c3_boss1.png'],
    ['c3_boss2', 'c3_boss2.png'],
    ['c3_boss3', 'c3_boss3.png'],
```

(Строку `['floor3', 'floor3.jpg'],` оставить — файл существует и нужен.)

- [ ] **Step 4: i18n.js — добавить имена боссов (en)**

В английском словаре после строки `boss3_name: 'STROBE',` добавить:

```js
        rhino_name: 'RHINO',
        boss_duet: 'DOCTOR + TELEPORTER',
```

- [ ] **Step 5: i18n.js — добавить имена боссов (ru)**

В русском словаре после строки `boss3_name: 'СТРОБ',` добавить:

```js
        rhino_name: 'НОСОРОГ',
        boss_duet: 'ВРАЧ + ТЕЛЕПОРТЁР',
```

- [ ] **Step 6: Синтаксис-проверка**

Run: `node --check src/constants.js && node --check src/i18n.js`
Expected: без ошибок.

- [ ] **Step 7: index.html — бамп ASSET_VER**

Заменить `var ASSET_VER = '204';` на `var ASSET_VER = '205';`.

- [ ] **Step 8: Ручная проверка**

Запустить http-сервер, в консоли разблокировать главу 3:
```js
const s = JSON.parse(localStorage.getItem('awparty_save')); s.maxChapterUnlocked = 3; localStorage.setItem('awparty_save', JSON.stringify(s));
```
Перезагрузить, выбрать главу 3, начать забег. Проверить: арена заметно больше (5000×5000), фон красный (`floor3`), спавнятся мобы гл.1 (нет сабвуферов/мошеров на этапе 1). Бои и коллизии работают на всей арене.

- [ ] **Step 9: Commit**

```bash
git add src/constants.js src/i18n.js index.html
git commit -m "feat: конфиг главы 3 (арена 5000, переиспользование арта, C.CHAPTER3)"
```

---

## Task 3: Общий HP-бар на дуэт + имя Носорога (только глава 3)

Меняем расчёт боссового HUD-бара в `scene.js`: для главы 3 показываем суммарный HP всех живых боссов (для дуэта — одна общая полоса) и корректное имя (Носорог / дуэт). Главы 1/2 — без изменений (отдельная ветка). До появления режиссёра (Task 4) глава 3 никогда не имеет двух боссов, так что визуально ничего не меняется — код задела готов.

**Files:**
- Modify: `src/scene.js`

**Interfaces:**
- Consumes: `this.chapter.custom`, `e.isBoss/isBoss2/isBoss3`, флаг `e._ch3Rhino` (ставит режиссёр в Task 4), `t('rhino_name')`, `t('boss_duet')`.
- Produces: переменные `bossExists`, `bossHpPct`, текст `this.hud.bossName` для общего/одиночного бара.

- [ ] **Step 1: scene.js — заменить блок расчёта боссового бара**

Найти блок:

```js
        let bossExists = false, bossHpPct = 0;
        for (const e of this.enemies) {
            if (e.isBoss) {
                bossExists = true; bossHpPct = Math.max(0, e.hp / e.maxHp);
                const bn = e.isBoss3 ? t('boss3_name') : e.isBoss2 ? t('boss2_name') : t('boss_name');
                if (this._lastBossName !== bn) { this._lastBossName = bn; this.hud.bossName.setText(bn); }
                break;
            }
        }
```

Заменить на:

```js
        let bossExists = false, bossHpPct = 0;
        if (this.chapter && this.chapter.custom === 'CH3') {
            let curHp = 0, maxHp = 0, count = 0, single = null;
            for (const e of this.enemies) {
                if (e.isBoss && e.hp > 0) { count++; curHp += e.hp; maxHp += e.maxHp; if (!single) single = e; }
            }
            if (count > 0) {
                bossExists = true;
                bossHpPct = maxHp > 0 ? curHp / maxHp : 0;
                const bn = count >= 2 ? t('boss_duet')
                    : (single._ch3Rhino ? t('rhino_name')
                        : single.isBoss3 ? t('boss3_name')
                            : single.isBoss2 ? t('boss2_name') : t('boss_name'));
                if (this._lastBossName !== bn) { this._lastBossName = bn; this.hud.bossName.setText(bn); }
            }
        } else {
            for (const e of this.enemies) {
                if (e.isBoss) {
                    bossExists = true; bossHpPct = Math.max(0, e.hp / e.maxHp);
                    const bn = e.isBoss3 ? t('boss3_name') : e.isBoss2 ? t('boss2_name') : t('boss_name');
                    if (this._lastBossName !== bn) { this._lastBossName = bn; this.hud.bossName.setText(bn); }
                    break;
                }
            }
        }
```

- [ ] **Step 2: Синтаксис-проверка**

Run: `node --check src/scene.js`
Expected: без ошибок.

- [ ] **Step 3: index.html — бамп ASSET_VER**

Заменить `var ASSET_VER = '205';` на `var ASSET_VER = '206';`.

- [ ] **Step 4: Ручная проверка**

Глава 3, дойти до дефолтного босса этапа 1 (B1) — бар показывает имя «НАДЗИРАТЕЛЬ» и одиночный HP. Регресс: глава 1 — бар боссов как раньше.

- [ ] **Step 5: Commit**

```bash
git add src/scene.js index.html
git commit -m "feat: общий HP-бар боссов и имя Носорога для главы 3"
```

---

## Task 4: Режиссёр главы 3 (мид-боссы, передышки, дуэт) + guard'ы

Создаём `src/scene_chapter3.js` и подключаем его; добавляем guard'ы в драйвер и в обработку смерти босса. После этой задачи глава 3 играется по полному сценарию.

**Files:**
- Create: `src/scene_chapter3.js`
- Modify: `src/scene.js` (инициализация полей режиссёра в `resetGame`)
- Modify: `src/scene_spawndriver.js` (делегирование + учёт `_ch3NoSpawn`)
- Modify: `src/scene_combat.js` (guard на `_startCrazyMode`)
- Modify: `index.html` (`scene_chapter3` в `MODULES`, бамп `ASSET_VER`)

**Interfaces:**
- Consumes: `this.gamePhase`, `this.phaseKills`, `this.phaseTransitionTimer`, `this.phaseEventFired`, `this.enemies`, `this.save.isHardcoreMode`, `this.arenaW/H`, `C.CHAPTER3`, `findSpawnPos`, `Enemy`, `this._applyChapterBoss`, `this._tex`, `this._startCrazyMode`, `GamePhase`.
- Produces (на `MainScene`):
  - `this._updateChapter3(dt, px, py)` — главный апдейт режиссёра.
  - `this._ch3SpawnMidBoss(kind, px, py)` — `kind ∈ {'B2','RHINO'}`.
  - `this._ch3SpawnDuet(px, py)`.
  - Поля: `this._ch3Beat` (string), `this._ch3NoSpawn` (bool), `this._ch3Breather` (number), `this._ch3LastPhase` (string).
  - Метки на врагах: `e._ch3MidBoss` (bool), `e._ch3Rhino` (bool).

- [ ] **Step 1: scene.js — инициализировать поля режиссёра в `resetGame()`**

Найти строку в `resetGame()`:

```js
        this._encPhase = 0; this._encTimer = 0; this._encAt = 0; this._encDone = false;
```

Заменить на:

```js
        this._encPhase = 0; this._encTimer = 0; this._encAt = 0; this._encDone = false;
        this._ch3Beat = 'S2_MOBS'; this._ch3NoSpawn = false; this._ch3Breather = 0;
        this._ch3LastPhase = GamePhase.PHASE_1;
```

- [ ] **Step 2: Создать `src/scene_chapter3.js`**

```js

// Режиссёр главы 3 («Гаунтлет»). Владеет логикой этапов 2–3: гейтинг ростера,
// мид-боссы на половине кап-убийств, передышки, финальный дуэт и триггер портала.
// Этап 1 идёт штатным драйвером (B1 в конце фазы). Вызывается из
// _updatePhaseProgression только при chapter.custom === 'CH3'.

MainScene.prototype._updateChapter3 = function(dt, px, py) {
        // Режиссёр активен только на этапах 2–3. Этап 1 (PHASE_1) и переход
        // (CLEARING) ведёт штатный драйвер — иначе init-такт спавнил бы B2 ещё
        // на этапе 1, как только phaseKills дойдёт до N2/2.
        if (this.gamePhase !== GamePhase.PHASE_2 && this.gamePhase !== GamePhase.PHASE_3) return;

        const C3 = C.CHAPTER3;
        const hc = this.save.isHardcoreMode ? C3.HARDCORE_KILL_MULT : 1;
        const N2 = Math.round(C3.STAGE2_KILLS * hc);
        const N3 = Math.round(C3.STAGE3_KILLS * hc);

        // Обратный отсчёт передышки.
        if (this._ch3Breather > 0) {
            this._ch3Breather -= dt;
            if (this._ch3Breather <= 0) { this._ch3Breather = 0; this._ch3NoSpawn = false; }
        }

        // Вход в новый этап: включить ростер гл.2 и сбросить такт.
        if (this.gamePhase !== this._ch3LastPhase) {
            this._ch3LastPhase = this.gamePhase;
            if (this.gamePhase === GamePhase.PHASE_2) {
                this._mosherKey = C3.mosherKey;
                this._subwooferKey = C3.subwooferKey;
                this._ch3Beat = 'S2_MOBS'; this._ch3NoSpawn = false;
            } else if (this.gamePhase === GamePhase.PHASE_3) {
                this._ch3Beat = 'S3_MOBS'; this._ch3NoSpawn = false;
            }
        }

        const midAlive = this.enemies.some(e => e._ch3MidBoss && e.hp > 0);

        switch (this._ch3Beat) {
            case 'S2_MOBS':
                if (this.phaseKills >= Math.floor(N2 / 2)) {
                    this._ch3SpawnMidBoss('B2', px, py);
                    this._ch3Beat = 'S2_MIDBOSS';
                }
                break;
            case 'S2_MIDBOSS':
                if (!midAlive) {
                    this._ch3Breather = C3.BREATHER; this._ch3NoSpawn = true;
                    this._ch3Beat = 'S2_CLEAR';
                }
                break;
            case 'S2_CLEAR':
                if (this._ch3Breather <= 0 && this.phaseKills >= N2) {
                    // Запуск штатного перехода PHASE_2 → PHASE_3 (часть (a) драйвера).
                    this.phaseTransitionTimer = 0; this.phaseEventFired = false;
                    this._ch3Beat = 'S2_DONE';
                }
                break;
            case 'S3_MOBS':
                if (this.phaseKills >= Math.floor(N3 / 2)) {
                    this._ch3SpawnMidBoss('RHINO', px, py);
                    this._ch3Beat = 'S3_MIDBOSS';
                }
                break;
            case 'S3_MIDBOSS':
                if (!midAlive) {
                    this._ch3Breather = C3.BREATHER; this._ch3NoSpawn = true;
                    this._ch3Beat = 'S3_CLEAR';
                }
                break;
            case 'S3_CLEAR':
                if (this._ch3Breather <= 0 && this.phaseKills >= N3) {
                    this._ch3SpawnDuet(px, py);
                    this._ch3NoSpawn = true; // подавляем мобов на время боя дуэта
                    this._ch3Beat = 'S3_DUET';
                }
                break;
            case 'S3_DUET':
                if (!this.enemies.some(e => e.isBoss && e.hp > 0)) {
                    this._ch3NoSpawn = false; // вернуть спавн для crazy-режима
                    this._ch3Beat = 'DONE';
                    this._startCrazyMode();
                }
                break;
        }
    };

MainScene.prototype._ch3SpawnMidBoss = function(kind, px, py) {
        const bp = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
        let boss;
        if (kind === 'B2') {
            const art = this._tex('boss2', 'boss2');
            boss = new Enemy(this, bp.x, bp.y, art);
            boss.makeBoss2(art);
        } else { // 'RHINO' = Bass-rush
            const art = this._tex(C.CHAPTER3.rhinoArt, 'c2_boss2');
            boss = new Enemy(this, bp.x, bp.y, art);
            boss.makeBossBass(art);
            boss._ch3Rhino = true;
        }
        boss._ch3MidBoss = true;
        this._applyChapterBoss(boss);
        if (this.save.isHardcoreMode) { boss.speed *= 1.5; boss.hp *= 2; boss.maxHp *= 2; }
        this.enemies.push(boss);
    };

MainScene.prototype._ch3SpawnDuet = function(px, py) {
        const da = this._tex(C.CHAPTER3.doctorArt, 'c2_boss1');
        const ta = this._tex(C.CHAPTER3.teleporterArt, 'boss3');
        const p1 = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
        const doc = new Enemy(this, p1.x, p1.y, da); doc.makeBossDoctor(da);
        const p2 = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
        const tp = new Enemy(this, p2.x, p2.y, ta); tp.makeBoss3(ta);
        for (const b of [doc, tp]) {
            this._applyChapterBoss(b);
            if (this.save.isHardcoreMode) { b.speed *= 1.3; b.hp *= 2; b.maxHp *= 2; }
            this.enemies.push(b);
        }
    };
```

- [ ] **Step 3: scene_spawndriver.js — делегировать главе 3 в `_updatePhaseProgression`**

Найти начало боссовой части (после блока `phaseTransitionTimer`, перед `if (this.gamePhase === GamePhase.PHASE_3)`):

```js
            if (this.phaseTransitionTimer >= 1.5) { this.phaseTransitionTimer = -1; this.phaseEventFired = false; }
        }

        if (this.gamePhase === GamePhase.PHASE_3) {
```

Заменить на:

```js
            if (this.phaseTransitionTimer >= 1.5) { this.phaseTransitionTimer = -1; this.phaseEventFired = false; }
        }

        if (this.chapter && this.chapter.custom === 'CH3') { this._updateChapter3(dt, px, py); return; }

        if (this.gamePhase === GamePhase.PHASE_3) {
```

(Часть (a) — переходы фаз — отрабатывает выше для всех глав, включая CLEARING→PHASE_2 после B1. Дефолтный спавн боссов фаз 2/3 ниже для гл.3 пропускается.)

- [ ] **Step 4: scene_spawndriver.js — guard перехода PHASE_2 в `_checkPhaseTransitions`**

Найти:

```js
MainScene.prototype._checkPhaseTransitions = function() {
        if (this.gamePhase === GamePhase.CLEARING && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
        if (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
    };
```

Заменить на:

```js
MainScene.prototype._checkPhaseTransitions = function() {
        if (this.gamePhase === GamePhase.CLEARING && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
        if (this.chapter && this.chapter.custom === 'CH3') return;
        if (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
    };
```

(CLEARING→PHASE_2 после B1 нужен и главе 3, поэтому первый `if` остаётся общим. PHASE_2→PHASE_3 для гл.3 ведёт режиссёр.)

- [ ] **Step 5: scene_spawndriver.js — учесть передышку/финал в `spawningActive`**

Найти:

```js
        const spawningActive = (this.gamePhase !== GamePhase.CLEARING)
            && !(this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)
            && !(this.gamePhase === GamePhase.PHASE_3 && this._boss3Alive)
            && !(this.crazyMode && this._crazySpawnDelay > 0)
            && (this.phaseTransitionTimer < 0);
```

Заменить на:

```js
        const spawningActive = (this.gamePhase !== GamePhase.CLEARING)
            && !(this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)
            && !(this.gamePhase === GamePhase.PHASE_3 && this._boss3Alive)
            && !(this.crazyMode && this._crazySpawnDelay > 0)
            && !this._ch3NoSpawn
            && (this.phaseTransitionTimer < 0);
```

(`_ch3NoSpawn` для глав 1/2 всегда `false` — поведение не меняется.)

- [ ] **Step 6: scene_combat.js — guard на `_startCrazyMode` для финала главы 3**

Найти в `handleEnemyDeaths` (ветка `isBoss3`, внутри `if (isFinal && !this.crazyMode)`):

```js
                    for (let k = 0; k < 3; k++) this.vinyls.push(this.spawnVinyl(ex + randInt(80) - 40, ey + randInt(80) - 40));
                    this._startCrazyMode();
                } else {
```

Заменить на:

```js
                    for (let k = 0; k < 3; k++) this.vinyls.push(this.spawnVinyl(ex + randInt(80) - 40, ey + randInt(80) - 40));
                    // Гл.3: портал/crazy запускает режиссёр, когда оба босса дуэта мертвы.
                    if (!(this.chapter && this.chapter.custom === 'CH3')) this._startCrazyMode();
                } else {
```

(Душа и награды за Телепортёра падают как обычно; только сам запуск портала откладывается до смерти Врача — это делает `_updateChapter3` → ветка `S3_DUET`.)

- [ ] **Step 7: index.html — подключить модуль и бампнуть ASSET_VER**

Найти:

```js
                'scene', 'scene_fx', 'scene_combat', 'scene_spawndriver', 'scene_records', 'scene_ui', 'main',
```

Заменить на:

```js
                'scene', 'scene_fx', 'scene_combat', 'scene_spawndriver', 'scene_chapter3', 'scene_records', 'scene_ui', 'main',
```

И заменить `var ASSET_VER = '206';` на `var ASSET_VER = '207';`.

- [ ] **Step 8: Синтаксис-проверка**

Run: `node --check src/scene_chapter3.js && node --check src/scene.js && node --check src/scene_spawndriver.js && node --check src/scene_combat.js`
Expected: без ошибок.

- [ ] **Step 9: Ручная проверка полного сценария главы 3**

Запустить http-сервер, открыть игру (Disable cache). Для ускорения можно временно занизить капы в `C.CHAPTER3` (`STAGE2_KILLS`, `STAGE3_KILLS`) через DevTools перед стартом, либо просто играть.

Проверить по этапам:
- **Этап 1:** только мобы гл.1; в конце — B1 «НАДЗИРАТЕЛЬ»; после убийства — переход на этап 2.
- **Этап 2:** появляются Мошер (распадается) и Сабвуфер; на ~половине убийств — B2 «БАС-ДРОП» (одиночный бар); после убийства — пауза спавна (~4с); добив до капа → переход на этап 3.
- **Этап 3:** на ~половине — Носорог (бар «НОСОРОГ», rush-поведение); после убийства — пауза; добив до капа → одновременно Врач + Телепортёр, **общий** бар «ВРАЧ + ТЕЛЕПОРТЁР».
- **Финал:** убийство только одного из дуэта НЕ открывает портал; портал/crazyMode появляется лишь после смерти **обоих**.
- Нет ошибок в консоли. Арена 5000×5000, фон `floor3`.

- [ ] **Step 10: Регресс глав 1/2**

Пройти боссов главы 1 (B1 в конце эт.1, B2 в конце эт.2, B3 в конце эт.3 → портал) и главы 2 (Doctor/Bass/Split, encircle-событие). Поведение и тайминги — как до изменений.

- [ ] **Step 11: Commit**

```bash
git add src/scene_chapter3.js src/scene.js src/scene_spawndriver.js src/scene_combat.js index.html
git commit -m "feat: режиссёр главы 3 — мид-боссы, передышки, финальный дуэт"
```

---

## Self-Review

**Spec coverage:**
- Этап 1 = мобы гл.1 + B1 → Task 4 (штатный драйвер, ростер без спец-мобов из Task 2). ✓
- Этап 2 +Мошер/Сабвуфер, B2 на 50%, передышка, переход на 100% → Task 4 (`S2_*`). ✓
- Этап 3: Носорог на 50%, передышка, добить мобов, дуэт Врач+Телепортёр, портал после обоих → Task 4 (`S3_*`). ✓
- Носорог = Bass-rush → `_ch3SpawnMidBoss('RHINO')`. ✓
- Арена 5000×5000 пер-глава → Task 1 + `CHAPTERS[2].arenaW/H` (Task 2). ✓
- Переиспользование арта, новый фон `floor3` → Task 2. ✓
- Общий HP-бар на дуэт, имя Носорога → Task 3. ✓
- Перехват `_startCrazyMode` → Task 4 Step 6. ✓
- Чистка манифеста, i18n имена → Task 2. ✓
- `ASSET_VER` бамп + порядок модулей → каждый таск / Task 4 Step 7. ✓

**Placeholder scan:** плейсхолдеров нет — все шаги содержат конкретный код/команды.

**Type consistency:** имена методов и полей согласованы между задачами: `_updateChapter3`, `_ch3SpawnMidBoss('B2'|'RHINO')`, `_ch3SpawnDuet`, `_ch3Beat`, `_ch3NoSpawn`, `_ch3Breather`, `_ch3Finale`, `_ch3LastPhase`, `_ch3MidBoss`, `_ch3Rhino`, `this.arenaW/this.arenaH`, `C.CHAPTER3.*`, `t('rhino_name')`, `t('boss_duet')`. Флаг `custom: 'CH3'` используется одинаково в guard'ах (scene/spawndriver/combat) и в режиссёре.

**Риски (из спеки) учтены:** crazy-guard (Task 4.6), передышки (`_ch3NoSpawn`), `encircleEvent` оставлен включённым (спавнит `_enemyKey`='enemy' — совместимо с этапом 1), спатиал-грид реаллоцируется под 5000 автоматически (`_buildEnemyGrid` проверяет размер).
