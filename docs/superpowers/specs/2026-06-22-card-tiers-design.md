# Дизайн: 3-тировая система карточек левел-апа

Дата: 2026-06-22

## Цель

Заменить нынешнюю двухтировую систему левел-ап карточек (обычные/легендарные)
на трёхтировую: **Common (серый) / Rare (фиолетовый) / Legendary (золотой)**.
Добавить 4 новые механики (Энергощит, Крит, Сфера, Double Tap), перенести
Блейдмейл из легендарных в редкие, ввести повайтовый ролл тира и per-card
потолки уровней.

Все эффекты — **порановые** (живут только в текущем забеге, в `localStorage`
не сохраняются), как и нынешние `runUpgradeLevels`.

## Текущее состояние (что меняем)

- 7 ID карт (0–6) в [src/constants.js](../../../src/constants.js):
  `UPGRADE_ICONS = ['icon_fire','icon_dmg','icon_speed','icon_magnet','icon_hp','icon_blademail','icon_pierce']`.
- `LEGENDARY_UPGRADE_IDS = [5, 6]`, `LEGENDARY_CARD_CHANCE = 0.13`.
- Ролл дропа в `triggerLevelUp()` ([src/scene.js](../../../src/scene.js) ~920):
  пул `[0,1,2,3,4]`, легендарки 5/6 подмешиваются по 13% если ещё не взяты,
  выбираются 3 различных ID.
- Применение в `applyUpgrade(id)` (~942): switch по id, `runUpgradeLevels[id]++`.
- Рендер карт в [src/scene_ui.js](../../../src/scene_ui.js) `_buildLevelUp()` (~491):
  булева `isLegendary` → золотая/фиолетовая рамка.
- Игрок уже имеет `critChance = 0.03`, `critMultiplier = 2.0`, `bladeMail`,
  `pierce` ([src/entities.js](../../../src/entities.js) ~23–33).
- Единый чок-поинт урона по игроку: `_damagePlayer(amount, shakeDur, shakeMag)`
  ([src/scene.js](../../../src/scene.js) ~800).
- Стрельба игрока: [src/scene.js](../../../src/scene.js) ~541–574, `spawnBullet(...)`.

## Раскладка ID и тиров

| ID | Карта | Тир | Макс. ур. | Арт |
|----|-------|-----|-----------|-----|
| 0 | Скорострельность | Common | 10 | есть (`icon_fire`) |
| 1 | Урон | Common | 10 | есть (`icon_dmg`) |
| 2 | Скорость | Common | 10 (стат-кап 400) | есть (`icon_speed`) |
| 3 | Магнит | Common | 10 (стат-кап 600) | есть (`icon_magnet`) |
| 4 | HP + лечение | Common | 10 | есть (`icon_hp`) |
| 5 | Блейдмейл | Rare | 1 | есть (`icon_blademail`) |
| 6 | Прострел | Legendary | 1 | есть (`icon_pierce`) |
| 7 | Энергощит | Rare | 3 | **новый `icon_shield`** |
| 8 | Крит +10% | Rare | 1 | **новый `icon_crit`** |
| 9 | Сфера | Rare | 5 (1 база + 4 апа) | **новый `icon_sphere`** |
| 10 | Double Tap | Legendary | 3 | **новый `icon_doubletap`** |

Common — потолок 10 уровней (после 10 карта выбывает из пула, как и остальные).
У скорости/магнита прежний стат-кап (400/600) достигается раньше 10 уровней —
карта продолжает выпадать до 10, но сверх стат-капа эффект уже не растёт
(поведение не меняем). На многоуровневые карты теперь выводится счётчик уровня
(см. раздел «Визуал карт»).

## Константы (constants.js)

Новые структуры рядом с `UPGRADE_ICONS`:

```js
const UPGRADE_ICONS = ['icon_fire','icon_dmg','icon_speed','icon_magnet','icon_hp',
                       'icon_blademail','icon_pierce','icon_shield','icon_crit',
                       'icon_sphere','icon_doubletap'];

const CARD_COUNT = 11;

const TIER = { COMMON: 0, RARE: 1, LEGENDARY: 2 };

const CARD_TIER = [
  TIER.COMMON, TIER.COMMON, TIER.COMMON, TIER.COMMON, TIER.COMMON,
  TIER.RARE,        // 5 blademail
  TIER.LEGENDARY,   // 6 pierce
  TIER.RARE,        // 7 shield
  TIER.RARE,        // 8 crit
  TIER.RARE,        // 9 sphere
  TIER.LEGENDARY,   // 10 double tap
];

const CARD_MAX_LEVEL = [
  10, 10, 10, 10, 10, // commons (потолок 10)
  1,  // 5 blademail
  1,  // 6 pierce
  3,  // 7 shield
  1,  // 8 crit
  5,  // 9 sphere
  3,  // 10 double tap
];

const TIER_WEIGHTS = [64, 28, 8]; // common / rare / legendary
```

`LEGENDARY_UPGRADE_IDS` / `LEGENDARY_CARD_CHANCE` удаляются (заменены тир-мапой).
HUD-бейдж (scene_ui ~280), который сейчас опирается на `LEGENDARY_UPGRADE_IDS`,
переключается на `CARD_TIER[id] === TIER.LEGENDARY`.

`TEXTURE_MANIFEST` дополняется 4 записями:
`['icon_shield','icon_shield.png']`, `['icon_crit','icon_crit.png']`,
`['icon_sphere','icon_sphere.png']`, `['icon_doubletap','icon_doubletap.png']`.

## Ролл дропа (повайтовый, scene.js triggerLevelUp)

```
доступна(id)  := runUpgradeLevels[id] < CARD_MAX_LEVEL[id]
poolByTier(t) := [id : CARD_TIER[id]==t и доступна(id)]

ids = []
для каждого из 3 слотов:
  tier = взвешенный_выбор(TIER_WEIGHTS)
  cand = poolByTier(tier) минус уже взятые в ids
  // откат вниз, затем вверх, по всем доступным картам
  если cand пуст: cand = (все id с доступна(id)) минус ids
  если cand пуст: break   // больше доступных карт нет
  ids.push(случайный из cand)
```

Без повторов одной карты внутри дропа. Разные тиры в одном дропе допустимы.

**Исчерпание пула (с потолком 10 у Common пул конечен).** Если доступных карт
меньше 3 — экран показывает столько карт, сколько доступно (1–2). Если доступных
карт нет совсем (всё прокачано до максимума — экстремальный длинный ран) —
экран левел-апа пропускается, вместо него полный хил (`p.hp = p.maxHp`) и сразу
возврат в `PLAYING`. Это устраняет софт-лок без «пустых» карт-ноупов.

## Механики (applyUpgrade + рантайм)

Поля игрока (entities.js, инициализация + сброс в начале рана scene.js ~360):
`p.damageReduction = 0`, `p.sphereLevel = 0`, `p.doubleTapLevel = 0`.
Сфера-сущность хранится в сцене (`this.sphere = null`).

`applyUpgrade(id)` — новые/изменённые ветки (значение берём из `runUpgradeLevels[id]`
ПОСЛЕ инкремента, чтобы уровень был 1-based):

- **7 Энергощит:** `p.damageReduction = 0.10 * lvl` (10/20/30%).
- **8 Крит:** `p.critChance += 0.10` (один раз; складывается с базой 3% и шопом).
- **9 Сфера:** `p.sphereLevel = lvl`; если `this.sphere` нет — создать.
  Период оборота `T = 6 - lvl` сек (lvl1=5с … lvl5=1с).
- **10 Double Tap:** `p.doubleTapLevel = lvl` (шанс считается на лету).
- **5 Блейдмейл:** `p.bladeMail = true` (тир сменился на Rare, логика прежняя).

`runUpgradeLevels` расширяется до длины 11; сброс рана меняет цикл
`for (i<7)` на `for (i<CARD_COUNT)`.

### Энергощит — в `_damagePlayer`

```js
_damagePlayer(amount, shakeDur, shakeMag) {
  const p = this.player;
  if (p.damageReduction > 0) amount = Math.max(1, Math.round(amount * (1 - p.damageReduction)));
  ...
}
```

### Double Tap — в блоке стрельбы (после основной пули, scene.js ~562)

```js
if (p.doubleTapLevel > 0) {
  const chance = 0.15 + 0.10 * (p.doubleTapLevel - 1); // 15/25/35%
  if (Math.random() < chance) {
    const isCrit2 = randInt(100) < Math.floor(p.critChance * 100); // независимый ролл
    const dmg2 = Math.max(1, Math.floor((isCrit2 ? p.attackDamage * p.critMultiplier : p.attackDamage) * dmgMul + 0.5));
    const db = this.spawnBullet(px, py, n.x, n.y, dmg2, isCrit2);
    if (hasArtifact(s, ARTIFACT.ECHO_CHAMBER)) db.ricochetsLeft = 1;
    if (p.pierce) db.pierceLeft = 1;
    this.bullets.push(db);
  }
}
```

То же направление, что и основная пуля; наследует pierce/echo.

### Сфера — новый класс `Sphere` (entities.js) + апдейт в сцене

- Спрайт `icon_sphere`, additive-бленд, в `worldLayer`. Орбита вокруг игрока
  на радиусе ~140px, угол `angle += (2π / T) * dt`. Позиция =
  `(player.x + R*cos, player.y + R*sin)`.
- Урон: каждый кадр перебор врагов в радиусе попадания (~`SPHERE_HIT` ≈ 55px²-дист),
  у кого `e.sphereCd <= 0` → `e.hp -= floor(p.attackDamage * 0.5)`,
  `e.hitFlashTimer = 0.12`, `e.sphereCd = 0.4`. Декремент `e.sphereCd` в апдейте врага
  (рядом с существующим `bladeMailCd`).
- Создаётся при первом взятии карты 9, живёт до конца рана, уничтожается в ресете.
- Новые константы в `C.SPHERE`: `RADIUS`, `HIT_DIST_SQ`, `DAMAGE_MULT = 0.5`,
  `HIT_CD = 0.4`, `BASE_PERIOD = 5`.

В мире для орба используем текстуру `icon_sphere` (масштаб ~0.12, tint неон),
fallback не требуется — ассет добавляется вместе с фичей.

## Визуал карт (scene_ui.js `_buildLevelUp`, ~491–519)

Замена булевой `isLegendary` на `const tier = CARD_TIER[uId];` и таблицу стилей:

| Тир | fill | stroke | strokeW | titleCol | бейдж |
|-----|------|--------|---------|----------|-------|
| Common | `0x141414` | `0x9a9a9a` | 4 | `#cfcfcf` | `card_common` |
| Rare | `0x140028` | `0x9600ff` | 5 | `#00ffc8` | `card_rare` |
| Legendary | `0x2a2000` | `0xffd200` | 7 | `#ffd200` | `card_legendary` |

Бейдж тира рисуется для всех тиров (раньше — только для легендарок). Для
многоуровневых карт с макс > 1 (это 7 Энергощит, 9 Сфера, 10 Double Tap) к
описанию/бейджу добавляется счётчик `ур. {runUpgradeLevels[id]+1}/{max}`
(следующий уровень, который выдаёт карта). Одноуровневые карты (5, 6, 8)
счётчик не показывают.

**Динамическое число карт.** Рендер и клик-хэндлер сейчас жёстко рассчитаны на 3
карты (`cx = W/2 + (i-1)*450`, цикл `i<3`). С потолком 10 у Common дроп может
содержать 1–2 карты при исчерпании пула. Оба места переводятся на
`n = this.levelUpIds.length`: позиция `cx = W/2 + (i - (n-1)/2) * 450`, циклы по `n`.

## i18n (i18n.js, en + ru)

Расширить массивы `upgrade_titles`, `upgrade_descs`, `upgrade_toasts` индексами 7–10:

- 7 Энергощит / ENERGY SHIELD — «Блокирует 10% урона за уровень (макс 30%)».
- 8 Крит / CRIT BOOST — «+10% к шансу крита».
- 9 Сфера / ORB — «Орбитальная сфера: 50% урона, ускоряется с уровнем».
- 10 Double Tap / DOUBLE TAP — «Шанс выстрелить дважды: 15% +10%/ур (макс 35%)».

Новые ключи: `card_common` («COMMON» / «ОБЫЧНАЯ»), `card_rare` («◆ RARE ◆» /
«◆ РЕДКАЯ ◆»). `card_legendary` уже есть.

## Затрагиваемые файлы

- `src/constants.js` — тир-мапа, веса, макс-уровни, `UPGRADE_ICONS`, `C.SPHERE`,
  4 записи `TEXTURE_MANIFEST`, удаление `LEGENDARY_*`.
- `src/scene.js` — `triggerLevelUp` (новый ролл), `applyUpgrade` (ветки 7–10),
  `_damagePlayer` (щит), блок стрельбы (Double Tap), сброс рана (длина 11 + новые
  поля + уничтожение сферы), апдейт/рендер сферы.
- `src/entities.js` — поля игрока (`damageReduction`, `sphereLevel`,
  `doubleTapLevel`), `e.sphereCd` + декремент, класс `Sphere`.
- `src/scene_ui.js` — 3-тировый рендер карт, HUD-бейдж через `CARD_TIER`.
- `src/i18n.js` — строки 7–10, `card_common`, `card_rare`.
- `index.html` — `ASSET_VER` +1 (порядок модулей не трогаем).
- `assets/` — 4 новых PNG: `icon_shield.png`, `icon_crit.png`, `icon_sphere.png`,
  `icon_doubletap.png`.

## Дефолты (зафиксированы)

- Веса тиров: **64 / 28 / 8**.
- Common-карты — потолок **10** уровней; после макса **убираются из пула**
  (как и все остальные карты).
- Исчерпание пула: <3 доступных → меньше карт на экране; 0 → пропуск экрана +
  полный хил.
- Сфера: **постоянная орбита**, период `6 − level` (5→1с), урон 50%, i-frame 0.4с.
- Энергощит режет урон **до** применения; min 1.
- Double Tap катит крит **независимо** от основной пули.

## Промты для нейросети (арт 4 новых иконок)

Стиль матчим существующие иконки (`icon_dmg`, `icon_pierce`, `icon_blademail`):
неоновая фуксия + электрический циан, тёмный/прозрачный фон, взрывные осколки и
молнии, высокодетальный digital-painting, объект строго по центру, квадрат,
PNG с прозрачным фоном.

Общий префикс стиля (добавлять к каждому):
`game ability icon, single centered object, explosive neon magenta and electric
cyan energy, sharp crystalline shards, crackling lightning, dramatic rim light,
glossy high-detail digital painting, dark transparent background, square 1:1,
symmetrical, no text, no border frame`

1. **Энергощит (`icon_shield.png`):**
   `a hexagonal energy barrier shield, glowing translucent force-field plates,
   sparks of deflected impacts, hexagon honeycomb pattern, protective dome,
   {{префикс стиля}}`

2. **Крит (`icon_crit.png`):**
   `a glowing crosshair / target reticle with a critical-strike spark burst at
   the center, sharp impact star, percentage-energy aura, precision aim,
   {{префикс стиля}}`

3. **Сфера (`icon_sphere.png`):**
   `a radiant orbiting energy orb / plasma sphere with a swirling motion trail
   ring around it, concentric orbital arcs, glowing core, comet-like tail,
   {{префикс стиля}}`

4. **Double Tap (`icon_doubletap.png`):**
   `two parallel glowing energy bullets / twin projectiles firing in unison,
   double muzzle-flash burst, fast motion streaks, dual tracer rounds,
   {{префикс стиля}}`

Рекомендация: генерить квадрат 1024×1024 с прозрачным фоном, затем не
ресайзить вручную — движок сам масштабирует спрайт на карте.
