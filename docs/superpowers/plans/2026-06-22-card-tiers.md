# Трёхтировая система карточек — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить двухтировую систему левел-ап карточек на трёхтировую (Common/Rare/Legendary) с повайтовым роллом, per-card потолками уровней и 4 новыми механиками (Энергощит, Крит, Сфера, Double Tap).

**Architecture:** Данные карт (тир, потолок, веса, иконки) выносятся в таблицы-константы. Ролл дропа в `triggerLevelUp` переписывается на взвешенный per-card выбор. Эффекты применяются в `applyUpgrade`; рантайм-хуки читают поля игрока в `_damagePlayer` (щит), блоке стрельбы (Double Tap) и новом классе `Sphere` (орбита). Визуал карт расширяется до 3 рамок.

**Tech Stack:** Phaser 3, vanilla JS, без сборщика. Глобальные переменные, порядок модулей в `index.html`.

## Global Constraints

- Никакого сборщика/импортов: все новые символы — глобальные `const`, объявленные в `constants.js`, доступны в остальных модулях по порядку загрузки. Порядок модулей в `index.html` НЕ менять.
- Эффекты карт — **порановые**: сбрасываются в начале забега, в `localStorage` не пишутся.
- В проекте **нет автоматических тестов**. Верификация каждого шага: `node --check <файл>` для синтаксиса + ручная проверка в браузере через локальный http-сервер (`python -m http.server 8000` → `http://localhost:8000/index.html`). Открывать `file://` нельзя.
- `ASSET_VER` в `index.html` поднимается на 1 **один раз, в финальной задаче** (Task 9). Между промежуточными коммитами проверяешь через hard-reload (Ctrl+F5) / DevTools «Disable cache».
- Ассеты `assets/icon_shield.png`, `icon_crit.png`, `icon_sphere.png`, `icon_doubletap.png` уже добавлены пользователем.
- Каждый коммит оставляет игру запускаемой (без исключений в консоли).

---

### Task 1: Константы — тир-мапа, веса, потолки, иконки, манифест, C.SPHERE

**Files:**
- Modify: `src/constants.js` (рядом с `UPGRADE_ICONS` ~232; блок `ABILITY`/новый блок `SPHERE` в объекте `C` ~27–54; `TEXTURE_MANIFEST` ~300–320)

**Interfaces:**
- Produces (новые глобалы): `UPGRADE_ICONS` (длина 11), `CARD_COUNT = 11`, `TIER = {COMMON:0, RARE:1, LEGENDARY:2}`, `CARD_TIER` (массив 11), `CARD_MAX_LEVEL` (массив 11), `TIER_WEIGHTS = [64,28,8]`, `C.SPHERE`.
- `LEGENDARY_UPGRADE_IDS` и `LEGENDARY_CARD_CHANCE` пока **остаются** (удаляются в Task 5).

- [ ] **Step 1: Расширить `UPGRADE_ICONS` и добавить тир-таблицы**

Найти в `src/constants.js`:
```js
const UPGRADE_ICONS = ['icon_fire', 'icon_dmg', 'icon_speed', 'icon_magnet', 'icon_hp', 'icon_blademail', 'icon_pierce'];
```
Заменить на:
```js
const UPGRADE_ICONS = ['icon_fire', 'icon_dmg', 'icon_speed', 'icon_magnet', 'icon_hp',
                       'icon_blademail', 'icon_pierce', 'icon_shield', 'icon_crit',
                       'icon_sphere', 'icon_doubletap'];

const CARD_COUNT = 11;

const TIER = { COMMON: 0, RARE: 1, LEGENDARY: 2 };

const CARD_TIER = [
  TIER.COMMON, TIER.COMMON, TIER.COMMON, TIER.COMMON, TIER.COMMON, // 0..4
  TIER.RARE,        // 5 blademail
  TIER.LEGENDARY,   // 6 pierce
  TIER.RARE,        // 7 shield
  TIER.RARE,        // 8 crit
  TIER.RARE,        // 9 sphere
  TIER.LEGENDARY,   // 10 double tap
];

const CARD_MAX_LEVEL = [
  10, Infinity, 10, 10, Infinity, // 0 fire, 1 dmg(∞), 2 speed, 3 magnet, 4 hp(∞)
  1,  // 5 blademail
  1,  // 6 pierce
  3,  // 7 shield
  1,  // 8 crit
  5,  // 9 sphere
  3,  // 10 double tap
];

const TIER_WEIGHTS = [64, 28, 8]; // common / rare / legendary
```

- [ ] **Step 2: Добавить блок `SPHERE` в объект `C`**

В объекте `C` (после блока `ABILITY: { ... },`, ~строка 54) добавить:
```js
    SPHERE: {
        RADIUS: 150,
        SIZE: 90,
        HIT_DIST_SQ: 90 * 90,
        DAMAGE_MULT: 0.5,
        HIT_CD: 0.4,
        BASE_PERIOD: 5,
    },
```

- [ ] **Step 3: Добавить иконки в `TEXTURE_MANIFEST`**

Найти строку `['icon_blademail', 'icon_blademail.png'],` в `TEXTURE_MANIFEST` и сразу после неё добавить:
```js
        ['icon_shield', 'icon_shield.png'],
        ['icon_crit', 'icon_crit.png'],
        ['icon_sphere', 'icon_sphere.png'],
        ['icon_doubletap', 'icon_doubletap.png'],
```

- [ ] **Step 4: Проверка синтаксиса**

Run: `node --check src/constants.js`
Expected: без вывода (код 0). Если `node` недоступен — `python -c "compile(open('src/constants.js').read(),'x','exec')"` НЕ годится для JS; тогда проверка только в браузере (Step 5).

- [ ] **Step 5: Проверка в браузере**

Запустить `python -m http.server 8000`, открыть `http://localhost:8000/index.html` с Ctrl+F5. Открыть DevTools → Console.
Expected: игра грузится без ошибок, в Network 4 новых `icon_*.png` отдаются со статусом 200. Левел-ап работает как раньше (старая логика ещё на месте).

- [ ] **Step 6: Commit**

```bash
git add src/constants.js
git commit -m "Карточки: тир-таблицы, потолки уровней, C.SPHERE, манифест иконок"
```

---

### Task 2: i18n — строки новых карт + ярлыки тиров

**Files:**
- Modify: `src/i18n.js` (en-блок ~93–106; ru-блок ~295–308)

**Interfaces:**
- Consumes: ничего.
- Produces: `t('upgrade_titles')[7..10]`, `t('upgrade_descs')[7..10]`, `t('upgrade_toasts')[7..10]`, `t('card_common')`, `t('card_rare')`.

- [ ] **Step 1: EN — расширить три массива и добавить ключи тиров**

В английском словаре найти `upgrade_toasts: ['UPGRADE: Fire Rate +', ... 'UNLOCKED: Pierce Shot'],` и добавить 4 элемента в конец массива:
```
'SHIELD UP', 'CRIT +10%', 'ORB', 'DOUBLE TAP'
```
Аналогично `upgrade_titles: [...]` → добавить в конец:
```
'ENERGY SHIELD', 'CRIT BOOST', 'ORB', 'DOUBLE TAP'
```
И `upgrade_descs: [...]` → добавить в конец (4 строки, в том же стиле, что соседние):
```
'Blocks 10% damage per level (max 30%)',
'+10% critical hit chance',
'Orbiting sphere: 50% damage, faster each level',
'Chance to fire twice: 15% +10%/lvl (max 35%)'
```
После `card_legendary: '★ LEGENDARY ★',` добавить:
```js
        card_common: 'COMMON',
        card_rare: '◆ RARE ◆',
```

- [ ] **Step 2: RU — то же самое в русском словаре**

`upgrade_toasts` → в конец: `'ЭНЕРГОЩИТ', 'КРИТ +10%', 'СФЕРА', 'ДВОЙНОЙ ВЫСТРЕЛ'`
`upgrade_titles` → в конец: `'ЭНЕРГОЩИТ', 'УСИЛЕНИЕ КРИТА', 'СФЕРА', 'DOUBLE TAP'`
`upgrade_descs` → в конец:
```
'Блокирует 10% урона за уровень (макс 30%)',
'+10% к шансу крита',
'Орбитальная сфера: 50% урона, ускоряется с уровнем',
'Шанс выстрелить дважды: 15% +10%/ур (макс 35%)'
```
После `card_legendary: '★ ЛЕГЕНДАРНАЯ ★',` добавить:
```js
        card_common: 'ОБЫЧНАЯ',
        card_rare: '◆ РЕДКАЯ ◆',
```

- [ ] **Step 3: Проверка синтаксиса**

Run: `node --check src/i18n.js`
Expected: код 0.

- [ ] **Step 4: Проверка, что правлены обе языковые ветки**

Run: `grep -c "card_rare" src/i18n.js`
Expected: `2` (ключ добавлен и в en, и в ru). Визуально убедиться, что в каждом из трёх массивов (`upgrade_titles`/`upgrade_descs`/`upgrade_toasts`) по 11 элементов на язык.

- [ ] **Step 5: Commit**

```bash
git add src/i18n.js
git commit -m "Карточки: i18n-строки новых карт (7-10) + ярлыки COMMON/RARE"
```

---

### Task 3: Поля рантайма игрока/врага + сброс забега

**Files:**
- Modify: `src/entities.js` (конструктор `Player` ~32–33; конструктор `Enemy` ~309)
- Modify: `src/scene.js` (init `runUpgradeLevels` ~115; сброс забега ~360 и ~409)

**Interfaces:**
- Produces: `player.damageReduction`, `player.sphereLevel`, `player.doubleTapLevel`, `enemy.sphereCd`; `runUpgradeLevels` длиной 11; корректный сброс всех полей в начале забега.

- [ ] **Step 1: Поля игрока**

В `src/entities.js` в конструкторе `Player`, после строк:
```js
        this.bladeMail = false;
        this.pierce = false;
```
добавить:
```js
        this.damageReduction = 0;
        this.sphereLevel = 0;
        this.doubleTapLevel = 0;
```

- [ ] **Step 2: Поле врага**

В конструкторе `Enemy`, после строки `this.bladeMailCd = 0;` добавить:
```js
        this.sphereCd = 0;
```

- [ ] **Step 3: `runUpgradeLevels` длиной 11**

В `src/scene.js` найти:
```js
        this.runUpgradeLevels = [0, 0, 0, 0, 0, 0, 0];
```
Заменить на:
```js
        this.runUpgradeLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
```

- [ ] **Step 4: Сброс полей игрока в начале забега**

В `src/scene.js` найти в секции ресета:
```js
        p.bladeMail = false; p.pierce = false;
```
Заменить на:
```js
        p.bladeMail = false; p.pierce = false;
        p.damageReduction = 0; p.sphereLevel = 0; p.doubleTapLevel = 0;
```

- [ ] **Step 5: Сброс `runUpgradeLevels` на всю длину**

Найти:
```js
        for (let i = 0; i < 7; i++) this.runUpgradeLevels[i] = 0;
```
Заменить на:
```js
        for (let i = 0; i < CARD_COUNT; i++) this.runUpgradeLevels[i] = 0;
```

- [ ] **Step 6: Проверка синтаксиса**

Run: `node --check src/entities.js && node --check src/scene.js`
Expected: код 0.

- [ ] **Step 7: Проверка в браузере**

Ctrl+F5, начать забег. Expected: игра идёт без ошибок в консоли; левел-ап и старые апгрейды работают как прежде (новые поля заданы, но пока ни на что не влияют).

- [ ] **Step 8: Commit**

```bash
git add src/entities.js src/scene.js
git commit -m "Карточки: поля рантайма (damageReduction/sphereLevel/doubleTapLevel/sphereCd) + сброс"
```

---

### Task 4: Повайтовый ролл дропа + applyUpgrade для всех карт

**Files:**
- Modify: `src/scene.js` (`triggerLevelUp` ~920–940; `applyUpgrade` ~942–957)

**Interfaces:**
- Consumes: `CARD_COUNT`, `CARD_TIER`, `CARD_MAX_LEVEL`, `TIER_WEIGHTS`, `TIER`, `randInt`, `this.runUpgradeLevels`.
- Produces: `this.levelUpIds` (массив длиной 1–3); `applyUpgrade(id)` обрабатывает id 0–10.
- `applyUpgrade(9)` пока **только** ставит `p.sphereLevel` (создание `Sphere` — Task 8).

- [ ] **Step 1: Переписать `triggerLevelUp`**

Заменить тело метода `triggerLevelUp()` целиком на:
```js
    triggerLevelUp() {
        const p = this.player;
        p.level++;
        p.currentXP -= p.xpToNextLevel;
        p.xpToNextLevel *= 1.5;
        p.hp = Math.min(p.maxHp, p.hp + 20);
        this.levelUpAnimTimer = 0;

        const avail = (id) => this.runUpgradeLevels[id] < CARD_MAX_LEVEL[id];
        const poolByTier = (tier, taken) => {
            const out = [];
            for (let id = 0; id < CARD_COUNT; id++)
                if (CARD_TIER[id] === tier && avail(id) && taken.indexOf(id) < 0) out.push(id);
            return out;
        };
        const rollTier = () => {
            const total = TIER_WEIGHTS[0] + TIER_WEIGHTS[1] + TIER_WEIGHTS[2];
            let r = Math.random() * total;
            for (let td = 0; td < 3; td++) { if (r < TIER_WEIGHTS[td]) return td; r -= TIER_WEIGHTS[td]; }
            return TIER.COMMON;
        };

        const ids = [];
        for (let slot = 0; slot < 3; slot++) {
            let cand = poolByTier(rollTier(), ids);
            if (cand.length === 0) {
                cand = [];
                for (let id = 0; id < CARD_COUNT; id++) if (avail(id) && ids.indexOf(id) < 0) cand.push(id);
            }
            if (cand.length === 0) break;
            ids.push(cand[randInt(cand.length)]);
        }

        if (ids.length === 0) { p.hp = p.maxHp; this.setState(GameState.PLAYING); return; }

        this.levelUpIds = ids;
        this.selectedLevelUpIndex = -1;
        this.audio.play('sfx_levelup', { volume: 0.55 });
        this.setState(GameState.LEVEL_UP);
    }
```

- [ ] **Step 2: Переписать `applyUpgrade`**

Заменить тело `applyUpgrade(id)` целиком на:
```js
    applyUpgrade(id) {
        const p = this.player;
        const lvl = this.runUpgradeLevels[id] + 1; // 1-based уровень, который выдаёт эта карта
        if (id === 0) p.shootCooldown = Math.max(0.22, p.shootCooldown * 0.93);
        else if (id === 1) p.attackDamage += 1;
        else if (id === 2 && p.speed < 400) p.speed += 20;
        else if (id === 3 && p.pickupRadius < 600) p.pickupRadius += 50;
        else if (id === 4) { p.maxHp += 10; p.hp = p.maxHp; }
        else if (id === 5) p.bladeMail = true;
        else if (id === 6) p.pierce = true;
        else if (id === 7) p.damageReduction = 0.10 * lvl;
        else if (id === 8) p.critChance += 0.10;
        else if (id === 9) p.sphereLevel = lvl;
        else if (id === 10) p.doubleTapLevel = lvl;
        p.lastUpgradeId = id;
        p.messageTimer = 2.0;
        if (id >= 0 && id < CARD_COUNT) this.runUpgradeLevels[id]++;
        this.selectedLevelUpIndex = -1;
        p.currentCooldown = Math.max(p.currentCooldown, 0.2);
        this.setState(GameState.PLAYING);
    }
```

- [ ] **Step 3: Проверка синтаксиса**

Run: `node --check src/scene.js`
Expected: код 0.

- [ ] **Step 4: Проверка в браузере**

Ctrl+F5, начать забег, набрать несколько уровней. Expected:
- На экране левел-апа теперь иногда появляются новые карты (ЭНЕРГОЩИТ/КРИТ/СФЕРА/DOUBLE TAP) с текстом из Task 2.
- Выбор «КРИТ +10%» сразу повышает крит (видно по жёлтым крит-цифрам урона чаще). Выбор «ЭНЕРГОЩИТ»/«СФЕРА»/«DOUBLE TAP» пока без видимого эффекта (рантайм в Task 6–8), но без ошибок в консоли.
- Блейдмейл и Прострел берутся как и раньше.
- Цвета рамок пока старые (поправим в Task 5) — это ожидаемо.

- [ ] **Step 5: Commit**

```bash
git add src/scene.js
git commit -m "Карточки: повайтовый ролл тиров + applyUpgrade для карт 0-10"
```

---

### Task 5: Визуал 3 тиров + счётчик уровня + динамическое число карт + HUD-бейдж

**Files:**
- Modify: `src/scene_ui.js` (`_buildLevelUp` ~487–522; hover-хэндлер LEVEL_UP ~613–617; `_runCards` ~276–285)
- Modify: `src/scene.js` (click-хэндлер LEVEL_UP — он в `scene_ui.js`? нет: `onPointerDown` в `scene_ui.js` ~666–669)
- Modify: `src/constants.js` (удалить `LEGENDARY_UPGRADE_IDS`, `LEGENDARY_CARD_CHANCE`)

**Interfaces:**
- Consumes: `CARD_TIER`, `TIER`, `CARD_MAX_LEVEL`, `t('card_common'|'card_rare'|'card_legendary')`, `this.levelUpIds`.
- Produces: рендер карт с 3 рамками, счётчиком уровня и центрированием под фактическое число карт; HUD-бейдж через `CARD_TIER`.
- После этой задачи в кодовой базе НЕТ ссылок на `LEGENDARY_UPGRADE_IDS`.

- [ ] **Step 1: Переписать тело цикла в `_buildLevelUp`**

Заменить блок от `this.levelUpCards = [];` до закрывающей `}` цикла `for` (строки ~491–520) на:
```js
        this.levelUpCards = [];
        const n = this.levelUpIds.length;
        const TIER_STYLE = [
            { fill: 0x141414, stroke: 0x9a9a9a, sw: 4, title: '#cfcfcf', badge: '#cfcfcf', badgeKey: 'card_common',    bs: '#2a2a2a' },
            { fill: 0x140028, stroke: 0x9600ff, sw: 5, title: '#00ffc8', badge: '#c890ff', badgeKey: 'card_rare',      bs: '#3a0060' },
            { fill: 0x2a2000, stroke: 0xffd200, sw: 7, title: '#ffd200', badge: '#ffd200', badgeKey: 'card_legendary', bs: '#643c00' },
        ];
        for (let i = 0; i < n; i++) {
            const uId = this.levelUpIds[i];
            const cx = W / 2 + (i - (n - 1) / 2) * 450;
            const cy = H / 2 + 50;
            const st = TIER_STYLE[CARD_TIER[uId]];
            const rect = this._mAdd(this.add.rectangle(cx, cy, 400, 550, st.fill, 240 / 255).setOrigin(0.5, 0.5).setStrokeStyle(st.sw, st.stroke));
            const title = this._mText(cx, cy - 230, t('upgrade_titles')[uId], 35, st.title, 0.5, 0);
            const icon = this._mAdd(this.add.sprite(cx, cy - 30, UPGRADE_ICONS[uId]).setOrigin(0.5, 0.5));
            const iscale = 180 / icon.width;
            icon.setScale(iscale);
            const desc = this._mText(cx, cy + 110, t('upgrade_descs')[uId], 25, '#ffffff', 0.5, 0);
            const max = CARD_MAX_LEVEL[uId];
            let label = t(st.badgeKey);
            if (max !== Infinity && max > 1) label += '   ' + (this.runUpgradeLevels[uId] + 1) + '/' + max;
            const badgeObj = this._mText(cx, cy + 215, label, 26, st.badge, 0.5, 0.5, st.bs, 3);
            const objs = [rect, title, icon, desc, badgeObj];
            const baseY = objs.map(o => o.y);
            const baseSX = [1, 1, iscale, 1, 1];
            this.levelUpCards.push({ rect, objs, baseY, baseSX, uId });
        }
```

- [ ] **Step 2: Динамические позиции в hover-хэндлере**

В `src/scene_ui.js` в `onPointerMove`/hover секции `else if (st === GameState.LEVEL_UP)` найти:
```js
                for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) ns = i; }
```
Заменить на:
```js
                const n = this.levelUpIds.length;
                for (let i = 0; i < n; i++) { const cx = W / 2 + (i - (n - 1) / 2) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) ns = i; }
```

- [ ] **Step 3: Динамические позиции в click-хэндлере**

В `onPointerDown` секции `else if (st === GameState.LEVEL_UP)` найти:
```js
                for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) { this.applyUpgrade(this.levelUpIds[i]); return; } }
```
Заменить на:
```js
                const n = this.levelUpIds.length;
                for (let i = 0; i < n; i++) { const cx = W / 2 + (i - (n - 1) / 2) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) { this.applyUpgrade(this.levelUpIds[i]); return; } }
```

- [ ] **Step 4: HUD-бейдж и список собранных карт в `_runCards`**

В `src/scene_ui.js` `_runCards` найти:
```js
        for (let id = 0; id < 7; id++) {
            if (this.runUpgradeLevels[id] > 0) {
                const badge = LEGENDARY_UPGRADE_IDS.includes(id) ? '★' : ('x' + this.runUpgradeLevels[id]);
                out.push({ key: UPGRADE_ICONS[id], badge });
            }
        }
```
Заменить на:
```js
        for (let id = 0; id < CARD_COUNT; id++) {
            if (this.runUpgradeLevels[id] > 0) {
                const badge = CARD_TIER[id] === TIER.LEGENDARY ? '★' : ('x' + this.runUpgradeLevels[id]);
                out.push({ key: UPGRADE_ICONS[id], badge });
            }
        }
```

- [ ] **Step 5: Удалить мёртвые константы**

В `src/constants.js` удалить строки:
```js
const LEGENDARY_UPGRADE_IDS = [5, 6];
const LEGENDARY_CARD_CHANCE = 0.13;
```

- [ ] **Step 6: Убедиться, что ссылок на удалённые константы не осталось**

Run: `grep -rn "LEGENDARY_UPGRADE_IDS\|LEGENDARY_CARD_CHANCE" src/`
Expected: пусто (нет совпадений).

- [ ] **Step 7: Проверка синтаксиса**

Run: `node --check src/scene_ui.js && node --check src/constants.js`
Expected: код 0.

- [ ] **Step 8: Проверка в браузере**

Ctrl+F5, набрать уровни. Expected:
- Common-карты — серая рамка, заголовок светло-серый, бейдж «ОБЫЧНАЯ».
- Rare (Блейдмейл/Энергощит/Крит/Сфера) — фиолетовая рамка, бейдж «◆ РЕДКАЯ ◆»; у Энергощита/Сферы виден счётчик «1/3», «1/5» и т.д.
- Legendary (Прострел/Double Tap) — золотая рамка, бейдж «★ ЛЕГЕНДАРНАЯ ★»; у Double Tap счётчик «1/3».
- Если все карты тира выбраны — дроп показывает 2 карты, корректно отцентрованные; клик по ним работает.
- HUD/пауза: собранные карты показывают ★ только у Прострела/Double Tap.

- [ ] **Step 9: Commit**

```bash
git add src/scene_ui.js src/constants.js
git commit -m "Карточки: рендер 3 тиров, счётчик уровня, динамическое число карт, HUD-бейдж"
```

---

### Task 6: Энергощит — снижение урона в `_damagePlayer`

**Files:**
- Modify: `src/scene.js` (`_damagePlayer` ~800–806)

**Interfaces:**
- Consumes: `player.damageReduction`.
- Produces: входящий урон умножается на `(1 - damageReduction)`, минимум 1.

- [ ] **Step 1: Вставить снижение урона**

Найти:
```js
    _damagePlayer(amount, shakeDur, shakeMag) {
        const p = this.player;
        const oldHp = p.hp;
```
Заменить на:
```js
    _damagePlayer(amount, shakeDur, shakeMag) {
        const p = this.player;
        if (p.damageReduction > 0) amount = Math.max(1, Math.round(amount * (1 - p.damageReduction)));
        const oldHp = p.hp;
```

- [ ] **Step 2: Проверка синтаксиса**

Run: `node --check src/scene.js`
Expected: код 0.

- [ ] **Step 3: Проверка в браузере**

Ctrl+F5, начать забег, взять «ЭНЕРГОЩИТ» 1–3 раза, дать врагу ударить. Expected: получаемый урон заметно меньше (например, обычный удар 20 → 18 при 1 уровне, 14 при 3 уровнях). Без щита урон прежний.

- [ ] **Step 4: Commit**

```bash
git add src/scene.js
git commit -m "Карточки: Энергощит режет входящий урон (10/20/30%)"
```

---

### Task 7: Double Tap — второй выстрел в блоке стрельбы

**Files:**
- Modify: `src/scene.js` (блок стрельбы ~559–571)

**Interfaces:**
- Consumes: `player.doubleTapLevel`, `n` (направление), `dmgMul`, `px`, `py`, `s`, `randInt`, `hasArtifact`, `ARTIFACT`, `this.spawnBullet`.
- Produces: с шансом `0.15 + 0.10*(level-1)` выпускается вторая идентичная пуля.

- [ ] **Step 1: Вставить второй выстрел**

Найти:
```js
                this.bullets.push(mb);
                this.shotsFired++;
```
Заменить на:
```js
                this.bullets.push(mb);
                this.shotsFired++;
                if (p.doubleTapLevel > 0 && Math.random() < (0.15 + 0.10 * (p.doubleTapLevel - 1))) {
                    const isCrit2 = randInt(100) < Math.floor(p.critChance * 100);
                    const dmg2 = Math.max(1, Math.floor((isCrit2 ? p.attackDamage * p.critMultiplier : p.attackDamage) * dmgMul + 0.5));
                    const db = this.spawnBullet(px, py, n.x, n.y, dmg2, isCrit2);
                    if (hasArtifact(s, ARTIFACT.ECHO_CHAMBER)) db.ricochetsLeft = 1;
                    if (p.pierce) db.pierceLeft = 1;
                    this.bullets.push(db);
                }
```

- [ ] **Step 2: Проверка синтаксиса**

Run: `node --check src/scene.js`
Expected: код 0.

- [ ] **Step 3: Проверка в браузере**

Ctrl+F5, взять «DOUBLE TAP», стрелять по врагам. Expected: часть выстрелов выпускает 2 пули вместо одной (визуально и по скорости убийств); чаще на 2–3 уровне. Без карты — всегда одна пуля.

- [ ] **Step 4: Commit**

```bash
git add src/scene.js
git commit -m "Карточки: Double Tap — шанс второго выстрела (15/25/35%)"
```

---

### Task 8: Сфера — класс-сущность, орбита и урон

**Files:**
- Create (класс в существующем файле): `src/entities.js` (новый `class Sphere` рядом с другими классами, например после `class Bullet`/в конце файла перед закрытием)
- Modify: `src/scene.js` (объявление `this.sphere = null` в `create` рядом с инициализацией коллекций; создание в `applyUpgrade(9)`; вызов `update` в игровом цикле ~577; декремент `sphereCd` ~637; уничтожение в ресете ~392)

**Interfaces:**
- Consumes: `C.SPHERE`, `player.sphereLevel`, `player.attackDamage`, `scene.enemies`, `enemy.sphereCd`, `enemy.hp`, `enemy.hitFlashTimer`, `distSq`, `Phaser.BlendModes.ADD`, `scene.addWorld`.
- Produces: `class Sphere` с методами `update(dt)` и `destroy()`; `this.sphere` в сцене.

- [ ] **Step 1: Добавить класс `Sphere` в `src/entities.js`**

В конец файла (или после класса `Bullet`) добавить:
```js
class Sphere {
    constructor(scene) {
        this.scene = scene;
        this.angle = 0;
        this.sprite = scene.addWorld(scene.add.sprite(0, 0, 'icon_sphere').setOrigin(0.5, 0.5));
        this.sprite.setDepth(12);
        this.sprite.setBlendMode(Phaser.BlendModes.ADD);
        this.sprite.setScale(C.SPHERE.SIZE / this.sprite.width);
    }
    update(dt) {
        const scene = this.scene, p = scene.player;
        const lvl = p.sphereLevel;
        if (lvl <= 0) { this.sprite.setVisible(false); return; }
        this.sprite.setVisible(true);
        const T = C.SPHERE.BASE_PERIOD - (lvl - 1); // ур.1=5с ... ур.5=1с
        this.angle += (2 * Math.PI / T) * dt;
        const ox = p.sprite.x + Math.cos(this.angle) * C.SPHERE.RADIUS;
        const oy = p.sprite.y + Math.sin(this.angle) * C.SPHERE.RADIUS;
        this.sprite.setPosition(ox, oy);
        this.sprite.rotation += dt * 4;
        const dmg = Math.max(1, Math.floor(p.attackDamage * C.SPHERE.DAMAGE_MULT + 0.5));
        for (const e of scene.enemies) {
            if (e.sphereCd > 0) continue;
            if (distSq(ox, oy, e.sprite.x, e.sprite.y) < C.SPHERE.HIT_DIST_SQ) {
                e.hp -= dmg;
                e.hitFlashTimer = 0.12;
                e.sphereCd = C.SPHERE.HIT_CD;
            }
        }
    }
    destroy() { if (this.sprite) { this.sprite.destroy(); this.sprite = null; } }
}
```

- [ ] **Step 2: Объявить `this.sphere` в `create`**

В `src/scene.js` рядом с инициализацией игровых коллекций (там же, где `this.runUpgradeLevels = [...]`, ~115) добавить:
```js
        this.sphere = null;
```

- [ ] **Step 3: Создавать сферу при взятии карты**

В `applyUpgrade` найти строку:
```js
        else if (id === 9) p.sphereLevel = lvl;
```
Заменить на:
```js
        else if (id === 9) { p.sphereLevel = lvl; if (!this.sphere) this.sphere = new Sphere(this); }
```

- [ ] **Step 4: Обновлять сферу в игровом цикле**

В `src/scene.js` найти:
```js
        for (const b of this.bullets) b.update(dt);
```
Сразу после неё добавить:
```js
        if (this.sphere) this.sphere.update(dt);
```

- [ ] **Step 5: Декремент `sphereCd` у врагов**

Найти:
```js
            if (e.bladeMailCd > 0) e.bladeMailCd -= dt;
```
Заменить на:
```js
            if (e.bladeMailCd > 0) e.bladeMailCd -= dt;
            if (e.sphereCd > 0) e.sphereCd -= dt;
```

- [ ] **Step 6: Уничтожать сферу в ресете забега**

В секции ресета найти:
```js
        if (this.portalSprite) { this.portalSprite.destroy(); this.portalSprite = null; }
```
Сразу после неё добавить:
```js
        if (this.sphere) { this.sphere.destroy(); this.sphere = null; }
```

- [ ] **Step 7: Проверка синтаксиса**

Run: `node --check src/entities.js && node --check src/scene.js`
Expected: код 0.

- [ ] **Step 8: Проверка в браузере**

Ctrl+F5, взять «СФЕРА». Expected:
- Вокруг игрока появляется светящийся орб, вращается по орбите (~1 оборот за 5с на 1 уровне).
- Орб бьёт задетых врагов (видны вспышки/урон, ~50% от урона героя).
- Каждый новый уровень «СФЕРА» ускоряет оборот; на 5 уровне орбита самая быстрая (~1с/оборот).
- После смерти/нового забега сфера исчезает и не дублируется при повторном взятии.

- [ ] **Step 9: Commit**

```bash
git add src/entities.js src/scene.js
git commit -m "Карточки: Сфера — орбитальный пассивный орб (50% урона, ускорение по уровням)"
```

---

### Task 9: Поднять ASSET_VER и финальная проверка

**Files:**
- Modify: `index.html` (константа `ASSET_VER`)

**Interfaces:**
- Consumes: всё предыдущее.
- Produces: новый `ASSET_VER`, гарантирующий сброс кэша у игроков.

- [ ] **Step 1: Поднять ASSET_VER на 1**

В `index.html` найти константу `ASSET_VER` (сейчас `'90'`) и увеличить её на 1 (`'91'`).

- [ ] **Step 2: Финальная проверка синтаксиса всех изменённых файлов**

Run: `node --check src/constants.js && node --check src/i18n.js && node --check src/entities.js && node --check src/scene.js && node --check src/scene_ui.js`
Expected: код 0 по всем.

- [ ] **Step 3: Полный прогон в браузере**

Ctrl+F5. Полный сценарий за один забег:
- Набрать ~10+ уровней, убедиться, что появляются все 3 тира с правильными цветами.
- Взять по разу: Энергощит, Крит, Сфера, Double Tap, Блейдмейл, Прострел — у всех корректный эффект (Task 6/7/8 + блейдмейл/прострел).
- Прокачать Сферу до 5 — орбита ускоряется; Энергощит до 3 — урон −30%; Double Tap до 3 — частые двойные выстрелы.
- Прокачать одну common (скорость) до 10 — карта перестаёт выпадать; урон/HP продолжают выпадать бесконечно.
- Умереть/начать новый забег — все эффекты сброшены, сфера исчезла.
- В консоли нет ошибок.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Карточки: ASSET_VER +1 (сброс кэша для 3-тировой системы)"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** тир-таблицы/веса/потолки (Task 1) ✓; i18n (Task 2) ✓; поля+сброс (Task 3) ✓; ролл+applyUpgrade (Task 4) ✓; визуал 3 тиров + динамическое число карт + HUD (Task 5) ✓; Энергощит (Task 6) ✓; Double Tap (Task 7) ✓; Сфера (Task 8) ✓; ASSET_VER (Task 9) ✓.
- **Согласованность типов:** `sphereLevel`/`doubleTapLevel`/`damageReduction` объявлены в Task 3, читаются в Task 4/6/7/8 теми же именами; `Sphere.update(dt)`/`destroy()` — единые имена; `CARD_COUNT`/`CARD_TIER`/`TIER`/`CARD_MAX_LEVEL`/`TIER_WEIGHTS` объявлены в Task 1, используются далее.
- **Удаление мёртвого кода:** `LEGENDARY_UPGRADE_IDS`/`LEGENDARY_CARD_CHANCE` удалены в Task 5 после снятия всех ссылок (Task 4 убрал их из `scene.js`, Task 5 — из `scene_ui.js`), с grep-проверкой.
- **Запускаемость между коммитами:** карты 7–10 появляются с Task 4, но их рантайм-хуки добавляются позже — промежуточный эффект «ничего не делает», без крэшей.
