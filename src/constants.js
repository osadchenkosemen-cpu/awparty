// Global tuning constants — ported 1:1 from the C++ source (Game.h / Game.cpp).
// All gameplay magic numbers live here so the JS port stays faithful.

const C = {
    // --- Arena / view (Game.h) ---
    ARENA_WIDTH: 3000,
    ARENA_HEIGHT: 3000,
    VIEW_WIDTH: 1920,
    VIEW_HEIGHT: 1080,
    CELL_SIZE: 150,

    // --- Ground Slam (Game.h) ---
    SLAM_RADIUS: 300,
    SLAM_RING_DURATION: 0.45,

    // --- Радиусы коллизий ---
    // Хранятся как КВАДРАТЫ расстояний (сравнение без sqrt). Значения подобраны под
    // текущие размеры спрайтов (указаны в комментариях) — при смене арта правьте здесь,
    // в одном месте, а не по коду. Радиус в px = sqrt(значения).
    COLLISION: {
        GEM_PICKUP_SQ: 1600,           // 40px — подбор кристалла опыта
        COIN_PICKUP_SQ: 1600,          // 40px — подбор монеты
        VINYL_PICKUP_SQ: 2500,         // 50px — подбор пластинки (лечение)
        PROJECTILE_HIT_SQ: 1600,       // 40px — вражеский снаряд по игроку
        SOUL_PICKUP_SQ: 4000,          // ~63px — подбор души босса
        ENEMY_ATTACK_SQ: 3600,         // 60px — обычный враг бьёт игрока (спрайт ~90px)
        GOBLIN_ATTACK_SQ: 2500,        // 50px — контактный урон гоблина-стрелка
        BOSS_HIT_SQ: 22500,            // 150px — радиус босса (спрайт ~270px)
        BULLET_HIT_SQ: 2500,           // 50px — пуля по обычному врагу (спрайт ~90px)
        SEPARATION_ACTIVE_SQ: 1440000, // 1200px — сепарация считается только вблизи игрока
        OVERLAP_NORMAL: 70,            // мин. зазор между обычными врагами (px)
        OVERLAP_BOSS: 200,             // мин. зазор, если в паре есть босс (px)
    },

    // --- Параметры способностей игрока (activateAbility) ---
    ABILITY: {
        INVINCIBLE_DURATION: 2,        // НЕУЯЗВИМОСТЬ — секунды
        SLAM_DAMAGE: 8,                // УДАР ОЗЕМЬ — урон в радиусе SLAM_RADIUS
        SLAM_KNOCKBACK: 380,           // отбрасывание врагов (px)
        DISC_COUNT: 12,                // ВИХРЬ ДИСКОВ — число дисков по кругу
        DISC_DAMAGE: 5,                // урон одного диска
        LASER_LENGTH: 1500,            // ЛАЗЕР — длина луча (px)
        LASER_HALF_WIDTH: 70,          // половина ширины луча (px)
        LASER_DAMAGE: 60,              // урон луча
        LASER_HIT_RADIUS: 45,          // радиус попадания по обычному врагу (px)
        LASER_BOSS_HIT_RADIUS: 150,    // радиус попадания по боссу (px)
    },

    // STROBE (босс 3 этапа): урон лазерного луча и допуск ширины при попадании по игроку.
    STROBE_BEAM_DAMAGE: 40,
    STROBE_BEAM_HIT_MARGIN: 40,

    // Сабвуфер: направленная звуковая волна (сектор 90° в сторону игрока, малый радиус),
    // которая отбрасывает игрока и наносит урон. Урон берётся из enemy.damage.
    SUBWOOFER: {
        WAVE_RADIUS: 340,            // макс. радиус волны, px
        WAVE_HALF_ARC: Math.PI / 4,  // полу-угол сектора (45° → раствор 90°)
        WAVE_EXPAND: 0.32,           // время раскрытия до макс. радиуса, сек
        WAVE_KNOCKBACK: 322,         // импульс отбрасывания игрока, px (−30% от прежних 460)
        APPROACH_RANGE: 300,         // сближается с игроком до этой дистанции, прежде чем бить
        REARM: 1.5,                  // мин. перезарядка между волнами, сек
    },

    // --- Meta-progression caps (Game.h) ---
    MAX_PERM_MAXHP: 10,
    MAX_PERM_DAMAGE: 10,
    MAX_PERM_SPEED_LEVEL: 5,
    MAX_PERM_DASH_LEVEL: 5,

    // --- FPS limit options (Game.cpp constructor) ---
    FPS_LIMITS: [30, 60, 120, 240, 0],

    // Множитель монет в hardcore-режиме (награда за повышенную сложность).
    HARDCORE_COIN_MULT: 1.5,

    // Очки за убийство (счёт забега → рекорды). Боссы дают существенно больше.
    // В безумном этапе очки не начисляются (см. crazyMode) — защита от фарма.
    SCORE: {
        NORMAL: 10,
        FAST: 15,
        TANK: 20,
        GOBLIN: 50,
        SUBWOOFER: 40,
        MOSHER: 25,
        MOSHERLING: 5,
        BOSS1: 500,
        BOSS2: 1000,
        BOSS3: 2000,
    },

    // «Безумный» этап после убийства третьего босса: у всех мобов x5 HP (урон/скорость
    // не трогаем), монеты больше не выпадают (защита от гринда), сверху по центру карты
    // открывается портал — единственный выход на следующий уровень.
    CRAZY_HP_MULT: 5,
    PORTAL_TOP_MARGIN: 280,  // отступ портала от верхнего края арены
    PORTAL_RADIUS: 140,      // радиус срабатывания входа в портал

    // Asset base path (assets live in the repo root so it's self-contained)
    ASSET_PATH: 'assets/',
};

// GameState enum (Game.h)
const GameState = {
    MENU: 'MENU',
    LOBBY: 'LOBBY',
    SHOP: 'SHOP',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    SETTINGS: 'SETTINGS',
    LEVEL_UP: 'LEVEL_UP',
    ABILITY_SELECT: 'ABILITY_SELECT',
    NAME_INPUT: 'NAME_INPUT',
    RENAME_INPUT: 'RENAME_INPUT',
    LEADERBOARD: 'LEADERBOARD',
    CLOUD_RESTORE: 'CLOUD_RESTORE', // ввод ника для восстановления прогресса из облака
    STAGE_CLEAR: 'STAGE_CLEAR',     // итоги 3 этапов после входа в портал (кнопка «в хаб»)
    CHAPTER_SELECT: 'CHAPTER_SELECT', // выбор главы (между хабом и забегом)
};

// Главы. Каждая глава — забег из 3 этапов. Карточка рисуется вектором (без фоновой
// картинки): hue задаёт неон-тему. id используется как this.currentChapter в забеге.
// Блокировка вычисляется из save.maxChapterUnlocked (id > unlocked → закрыта).
//
// Контент-поля (развилка по главам):
//   floorKey/floorTint — текстура пола арены; если файла нет, берётся 'floor' с тинтом.
//   floorMode          — 'tile' (бесшовное замощение, для паттерн-текстур) или
//                        'stretch' (одна картинка на всю арену, для цельных сцен — без швов).
//   enemyKey/goblinKey — спрайты рядовых врагов/гоблинов (фолбэк на ch1, если файла нет).
//   boss1/2/3Key       — спрайты боссов 3 этапов (фолбэк на ch1, если файла нет).
//   subwooferKey       — если задан, в главе спавнятся Сабвуферы (волна баса); иначе нет.
//   mosherKey          — если задан, в главе спавнятся Мошеры (распад на мини при смерти).
//   hpMult/dmgMult/spawnMult/bossHpMult — множители сложности относительно главы 1.
// Все *Key c фолбэком: глава играбельна ДО появления арта (см. _tex в scene.js).
const CHAPTERS = [
    { id: 1, hue: 0x00e6ff,
      floorKey: 'floor', floorTint: null, floorMode: 'tile',
      enemyKey: 'enemy', goblinKey: 'enemyV',
      boss1Key: 'enemy', boss2Key: 'boss2', boss3Key: 'boss3',
      hpMult: 1, dmgMult: 1, spawnMult: 1, bossHpMult: 1 },
    { id: 2, hue: 0xc800ff,
      floorKey: 'floor2', floorTint: 0x9a6cff, floorMode: 'stretch',
      enemyKey: 'enemy2', goblinKey: 'enemyV2', subwooferKey: 'enemy2_sub', mosherKey: 'enemy2_mosher',
      boss1Key: 'c2_boss1', boss2Key: 'c2_boss2', boss3Key: 'c2_boss3',
      hpMult: 1.6, dmgMult: 1.35, spawnMult: 1.2, bossHpMult: 1.8 },
    { id: 3, hue: 0xff5050,
      floorKey: 'floor3', floorTint: 0xff6464, floorMode: 'stretch',
      enemyKey: 'enemy3', goblinKey: 'enemyV3', subwooferKey: 'enemy3_sub', mosherKey: 'enemy3_mosher',
      boss1Key: 'c3_boss1', boss2Key: 'c3_boss2', boss3Key: 'c3_boss3',
      hpMult: 2.4, dmgMult: 1.8, spawnMult: 1.4, bossHpMult: 2.6 },
];
function getChapter(id) { return CHAPTERS.find(c => c.id === id) || CHAPTERS[0]; }

// GamePhase enum (Game.h)
const GamePhase = {
    PHASE_1: 'PHASE_1',
    CLEARING: 'CLEARING',
    PHASE_2: 'PHASE_2',
    PHASE_3: 'PHASE_3',
};

// EnemyType enum (Enemy.h)
const EnemyType = {
    NORMAL: 'NORMAL',
    FAST: 'FAST',
    TANK: 'TANK',
    BOSS: 'BOSS',
    GOBLIN: 'GOBLIN',
    SUBWOOFER: 'SUBWOOFER', // глава 2+: медленный танк-колонка, бьёт радиальной волной баса
    MOSHER: 'MOSHER',       // глава 2+: чейзер, при смерти распадается на мини-мошеров
    MOSHERLING: 'MOSHERLING', // мелкий быстрый осколок мошера (не делится)
};

// Boss / Goblin FSM states (Enemy.h)
const BossState = { WALKING: 0, PREPARING: 1, JUMPING: 2, RECOVERING: 3 };
const GoblinState = { WALKING: 0, PREPARING: 1, THROWING: 2, RECOVERING: 3 };

// In-run upgrade icons (тексты названий/описаний — в i18n.js: upgrade_titles / upgrade_descs)
const UPGRADE_ICONS = ['icon_fire', 'icon_dmg', 'icon_speed', 'icon_magnet', 'icon_hp', 'icon_blademail', 'icon_pierce'];

// Легендарные карточки (золотая рамка, без этапов прокачки, выпадают реже обычных).
// id 5 = блейдмейл, id 6 = прострел.
const LEGENDARY_UPGRADE_IDS = [5, 6];
// Шанс, что конкретная легендарная карта вообще попадёт в пул выбора при ап-левеле.
// 0.13 даёт ~12% левел-апов, на которых показывается хотя бы одна легендарка
// (с учётом последующего отбора 3 карт из пула). Понижено с 0.27 — легендарки реже.
const LEGENDARY_CARD_CHANCE = 0.13;

// Ability data (AbilitySelectUI.cpp). Названия — в i18n.js: ability_names.
const ABILITY_COOLDOWNS = { 0: 25, 1: 15, 2: 12, 3: 14 };
const ABILITY_ICONS = { '-10': 'ability_dash', 0: 'ability_invincible', 1: 'ability_slam', 2: 'ability_disc', 3: 'ability_laser' };

// Artifact info (ShopUI.cpp)
const ARTIFACTS = [
    { name: 'BLOOD PACT', desc: 'Kill heals 2 HP', cost: 800 },
    { name: 'GLASS CANNON', desc: '+30% dmg, Max HP -20', cost: 1000 },
    { name: 'ECHO CHAMBER', desc: 'Bullets ricochet off walls', cost: 1100 },
    { name: 'SOUL LEECH', desc: '+0.5% crit/kill  (max +5%)', cost: 1400 },
    { name: 'BERSERKER', desc: 'HP<=40%: dmg x1.5, no dash slow', cost: 1500 },
    { name: 'IRON SKIN', desc: 'First 3 hits/run blocked', cost: 1700 },
    { name: 'MAGNET CORE', desc: 'Infinite pickup range', cost: 5000 },
];

// Texture manifest: key -> file (Game.cpp constructor)
const TEXTURE_MANIFEST = [
    ['floor', 'floor.jpg'],
    ['menu_bg', 'menu_bg.jpg'],
    ['player_front', 'player.png'],
    ['player_back', 'playerback.png'],
    ['player_left', 'playerleft.png'],
    ['player_right', 'playerright.png'],
    ['enemy', 'enemy.png'],
    ['bullet', 'bullet.png'],
    ['vinyl', 'Vinyl.png'],
    ['coin', 'Coin.png'],
    ['enemyV', 'enemyV.png'],
    ['weaponEnemyV', 'WeaponEnemyV.png'],
    ['boss2', 'boss2.png'],
    ['boss3', 'boss3.png'],
    ['portal', 'portal.png'],
    // Текстуры глав 2/3 (опциональны: 404 заглушается в preload через loaderror).
    // Пока файлов нет — движок использует фолбэк на ассеты главы 1 (см. _tex / floorTint).
    ['floor2', 'floor2.jpg'],
    ['enemy2', 'enemy2.png'],
    ['enemyV2', 'enemyV2.png'],
    ['enemy2_sub', 'enemy2_sub.png'],
    ['enemy2_mosher', 'enemy2_mosher.png'],
    ['c2_boss1', 'c2_boss1.png'],
    ['c2_boss2', 'c2_boss2.png'],
    ['c2_boss3', 'c2_boss3.png'],
    ['floor3', 'floor3.jpg'],
    ['enemy3', 'enemy3.png'],
    ['enemyV3', 'enemyV3.png'],
    ['enemy3_sub', 'enemy3_sub.png'],
    ['enemy3_mosher', 'enemy3_mosher.png'],
    ['c3_boss1', 'c3_boss1.png'],
    ['c3_boss2', 'c3_boss2.png'],
    ['c3_boss3', 'c3_boss3.png'],
    ['ability_laser', 'laser.png'],
    ['gem', 'gem.png'],
    ['boss_soul', 'boss_soul.png'],
    ['ability_dash', 'dash.png'],
    ['ability_invincible', 'Invincibility.png'],
    ['ability_slam', 'ground_slam.png'],
    ['ability_disc', 'disc_storm.png'],
    ['icon_fire', 'icon_fire.png'],
    ['icon_dmg', 'icon_dmg.png'],
    ['icon_speed', 'icon_speed.png'],
    ['icon_magnet', 'icon_magnet.png'],
    ['icon_hp', 'icon_hp.png'],
    ['icon_blademail', 'icon_blademail.png'],
    ['icon_pierce', 'icon_pierce.png'],
    // Иконки артефактов (магазин). Файлы опциональны: если их нет, карточка
    // рисуется без иконки (graceful fallback в shop.js через textures.exists).
    ['art_bloodpact', 'art_bloodpact.png'],
    ['art_glasscannon', 'art_glasscannon.png'],
    ['art_echo', 'art_echo.png'],
    ['art_soulleech', 'art_soulleech.png'],
    ['art_berserker', 'art_berserker.png'],
    ['art_ironskin', 'art_ironskin.png'],
    ['art_magnetcore', 'art_magnetcore.png'],
    // Иконки узлов дерева навыков (индекс = branch*3 + row).
    ['node_damage', 'node_damage.png'],
    ['node_crit', 'node_crit.png'],
    ['node_multishot', 'node_multishot.png'],
    ['node_maxhp', 'node_maxhp.png'],
    ['node_regen', 'node_regen.png'],
    ['node_armor', 'node_armor.png'],
    ['node_speed', 'node_speed.png'],
    ['node_dash', 'node_dash.png'],
    ['node_magnet', 'node_magnet.png'],
];

// Player walk animation frames: dir -> [6 keys] (Game.cpp constructor)
const ANIM_DIRS = ['front', 'back', 'left', 'right'];
