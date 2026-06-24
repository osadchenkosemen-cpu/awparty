
const C = {
    ARENA_WIDTH: 3000,
    ARENA_HEIGHT: 3000,
    VIEW_WIDTH: 1920,
    VIEW_HEIGHT: 1080,
    CELL_SIZE: 150,

    SLAM_RADIUS: 300,
    SLAM_RING_DURATION: 0.45,

    COLLISION: {
        GEM_PICKUP_SQ: 1600,
        COIN_PICKUP_SQ: 1600,
        VINYL_PICKUP_SQ: 2500,
        PROJECTILE_HIT_SQ: 1600,
        SOUL_PICKUP_SQ: 4000,
        ENEMY_ATTACK_SQ: 3600,
        GOBLIN_ATTACK_SQ: 2500,
        BOSS_HIT_SQ: 22500,
        BULLET_HIT_SQ: 2500,
        SEPARATION_ACTIVE_SQ: 1440000,
        OVERLAP_NORMAL: 70,
        OVERLAP_BOSS: 200,
    },

    ABILITY: {
        INVINCIBLE_DURATION: 2,
        SLAM_DAMAGE: 8,
        SLAM_KNOCKBACK: 380,
        DISC_COUNT: 12,
        DISC_DAMAGE: 5,
        LASER_LENGTH: 1500,
        LASER_HALF_WIDTH: 70,
        LASER_DAMAGE: 60,
        LASER_HIT_RADIUS: 45,
        LASER_BOSS_HIT_RADIUS: 150,
        SKULL_DAMAGE_MULT: 1.0,
        SKULL_BOUNCE_BONUS: 0.2,
        SKULL_MAX_HITS: 5,
        SKULL_SPEED: 950,
        SKULL_SEEK_RADIUS: 750,
        SKULL_HIT_RADIUS: 60,
        SKULL_LIFETIME: 2.5,
        SKULL_SIZE: 64,
        SONIC_DAMAGE: 25,
        SONIC_RADIUS: 420,
        SONIC_KNOCKBACK: 450,
        SHATTER_FRAGMENTS: 14,
        SHATTER_DAMAGE: 18,
        SHATTER_SPEED: 850,
        SHATTER_RANGE: 620,
        SHATTER_SIZE: 44,
    },

    SPHERE: {
        RADIUS: 115,
        SIZE: 60,
        HIT_DIST_SQ: 90 * 90,
        DAMAGE_MULT: 0.5,
        HIT_CD: 0.4,
        BASE_PERIOD: 5,
    },

    STROBE_BEAM_DAMAGE: 40,
    STROBE_BEAM_HIT_MARGIN: 40,

    SUBWOOFER: {
        WAVE_RADIUS: 340,
        WAVE_HALF_ARC: Math.PI / 4,
        WAVE_EXPAND: 0.32,
        WAVE_KNOCKBACK: 250,
        APPROACH_RANGE: 300,
        REARM: 1.5,
    },

    HYPEMAN: {
        AURA_RADIUS: 200,
        HP_BONUS: 5,
        REGEN: 1,
        FLEE_DIST: 150,
    },

    BOSSDOC: {
        AURA_RADIUS: 275,
        HP_BONUS: 10,
        REGEN: 3,
        STANDOFF: 275,
        FLEE_DIST: 225,
        STUN_INTERVAL: 3.5,
        TELEGRAPH: 0.6,
        STUN_DURATION: 0.5,
        STUN_DAMAGE: 18,
        STUN_PROJ_SPEED_MULT: 1.5,
    },

    ENEMY: {
        BASE_SIZE: 90,
        NORMAL:     { hp: 2,  speed: 100, damage: 20 },
        FAST:       { hp: 1,  speed: 216, damage: 20, scale: 0.7 },
        TANK:       { hpBase: 10, hpPerLevel: 2, speed: 55, damage: 20, scale: 1.5 },
        GOBLIN:     { hp: 5,  speed: 80,  damage: 20, size: 105 },
        SUBWOOFER:  { hp: 20, speed: 42,  damage: 25, size: 130 },
        MOSHER:     { hp: 8,  speed: 130, damage: 20, size: 130, splitMin: 2, splitMax: 3 },
        MOSHERLING: { hp: 1,  speed: 210, damage: 15, size: 130, scale: 0.65 },
        HYPEMAN:    { hp: 12, speed: 120, damage: 10, size: 130 },
    },

    BOSS: {
        B1: { hp: 50,  speed: 130, damage: 50, scale: 3.0 },
        B2: { hp: 100, speed: 150, damage: 60, scale: 3.5 },
        B3: { hp: 180, speed: 140, damage: 40, scale: 3.2 },
        BD: { hp: 180, speed: 110, damage: 50, scale: 3.2 },
        BB: { hp: 130, speed: 150, damage: 60, scale: 3.5 },
        BS: { hp: 220, speed: 180, damage: 60, scale: 3.6 }, // split-босс = Босс 3 главы 2 (чуть крупнее обычного B3)
    },

    BOSSBASS: {
        WAVE_RANGE: 520,
        WAVE_TELEGRAPH: 0.6,
        WAVE_RADIUS_MULT: 1.8,
        RUSH_WINDUP: 0.8,
        RUSH_DURATION: 0.7,
        RUSH_SPEED: 1500,
        RECOVER: 1.0,
        ATTACK_GAP: 1.2,
    },

    BOSSSPLIT: {
        SHOVE_RADIUS: 170,
        SHOVE_FORCE: 300,
        CHARGE_BURST: 0.7,
        CHARGE_MULT: 1.8,
        TIERS: [
            { hpMult: 1.0,  dmgMult: 1.0, scaleMult: 1.0,  splits: 2 },
            { hpMult: 0.45, dmgMult: 0.6, scaleMult: 0.65, splits: 3 },
            { hpMult: 0.22, dmgMult: 0.4, scaleMult: 0.42, splits: 0 },
        ],
    },

    SPAWN: {
        ENEMY_DURATION: 0.45,
        BOSS1_DURATION: 1.4,
        BOSS2_DURATION: 1.2,
        BOSS3_DURATION: 1.6,
        BOSSDOC_DURATION: 1.4,
    },

    // Анимация смерти обычных врагов («падение/распад вниз»). Боссов не трогает.
    // DARK_TINT — hex, а не rgb(): constants.js грузится до utils.js, где живёт rgb.
    // 0x2D2D37 == rgb(45,45,55).
    DEATH_FX: {
        DURATION: 0.3,     // сек
        END_SCALE_Y: 0.2,  // во сколько ужать высоту к концу
        WIDEN: 0.1,        // насколько раздуть ширину в начале (расплющивание)
        FLASH_K: 0.15,     // доля анимации с белой вспышкой
        FADE_START: 0.55,  // с какого k начинается затухание alpha
        DARK_TINT: 0x2D2D37,
    },

    MAX_PERM_MAXHP: 10,
    MAX_PERM_DAMAGE: 10,
    MAX_PERM_SPEED_LEVEL: 5,
    MAX_PERM_DASH_LEVEL: 5,

    HARDCORE_COIN_MULT: 1.5,

    SCORE: {
        NORMAL: 10,
        FAST: 15,
        TANK: 20,
        GOBLIN: 50,
        SUBWOOFER: 40,
        MOSHER: 25,
        MOSHERLING: 5,
        HYPEMAN: 60,
        BOSS1: 500,
        BOSS2: 1000,
        BOSS3: 2000,
    },

    CRAZY_HP_MULT: 5,

    BOSS_KILL_REQ: [85, 95, 110],
    BOSS_TIME_CAP: 60,
    BOSS_KILL_MIN_TIME: 30,
    BOSS_WARN_KILLS: 8,

    // Линейная кривая опыта: cost(L) = XP_BASE + XP_STEP * (L - 1)
    // Калибровка под боссов: lvl 5 у б1, lvl 10 у б2, lvl ~15 у б3.
    XP_BASE: 20,   // цена 1-го уровня (XP)
    XP_STEP: 1,    // прирост цены за каждый следующий уровень (XP)

    PORTAL_TOP_MARGIN: 280,
    PORTAL_RADIUS: 140,

    ASSET_PATH: 'assets/',
};

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
    CLOUD_RESTORE: 'CLOUD_RESTORE',
    STAGE_CLEAR: 'STAGE_CLEAR',
    CHAPTER_SELECT: 'CHAPTER_SELECT',
};

const CHAPTERS = [
    { id: 1, hue: 0x00e6ff,
      floorKey: 'floor', floorTint: null, floorMode: 'tile',
      enemyKey: 'enemy', goblinKey: 'enemyV',
      boss1Key: 'enemy', boss2Key: 'boss2', boss3Key: 'boss3',
      hpMult: 1, dmgMult: 1, spawnMult: 1, bossHpMult: 1 },
    { id: 2, hue: 0xc800ff,
      floorKey: 'floor2', floorTint: 0x9a6cff, floorMode: 'stretch',
      enemyKey: 'enemy2', goblinKey: 'enemyV2', subwooferKey: 'enemy2_sub', mosherKey: 'enemy2_mosher', hypemanKey: 'enemy2_hype',
      boss1Key: 'c2_boss1', boss2Key: 'c2_boss2', boss3Key: 'c2_boss3', boss1Type: 'DOCTOR', boss2Type: 'BASS', boss3Type: 'SPLIT', encircleEvent: true,
      hpMult: 1.6, dmgMult: 1.35, spawnMult: 1.2, bossHpMult: 1.8 },
    { id: 3, hue: 0xff5050,
      floorKey: 'floor3', floorTint: 0xff6464, floorMode: 'stretch',
      enemyKey: 'enemy', goblinKey: 'enemyV',
      boss1Key: 'enemy', boss2Key: 'boss2', boss3Key: 'boss3',
      cardBosses: ['boss3', 'c2_boss1', 'c2_boss2'], // карточка-гаунтлет: центр + слева/справа
      arenaW: 4000, arenaH: 4000, custom: 'CH3', encircleEvent: true,
      hpMult: 2.4, dmgMult: 1.8, spawnMult: 1.4, bossHpMult: 2.6 },
];
function getChapter(id) { return CHAPTERS.find(c => c.id === id) || CHAPTERS[0]; }

// Стрелки к оставшимся врагам показываются, когда живых не-боссов не больше этого.
C.LAST_ENEMY_ARROW_MAX = 3;

// Функциональные потолки in-run карт: speed упирается в 400, magnet — в 600
// (при MAGNET_CORE pickupRadius=99999 → тоже выше). Достигнув их, карта больше
// не предлагается (иначе выбор тратился бы впустую: уровень растёт, эффекта нет).
C.SPEED_CARD_CAP = 400;
C.MAGNET_CARD_CAP = 600;

C.CHAPTER3 = {
    STAGE2_KILLS: 60,       // кап убийств этапа 2 (мид-босс B2 на половине)
    STAGE3_KILLS: 70,       // этап 3: Носорог на половине (STAGE3_KILLS/2)
    AFTER_RHINO_KILLS: 50,  // после Носорога убить столько мобов -> финальный дуэт
    BREATHER: 4,            // сек паузы спавна после смерти мид-босса
    BOSS_WARN_LEAD: 6,      // макс сек предупреждения «Attention»: если за это время
                            // игрок не доубил мобов до порога — форс-спавн босса
                            // (иначе кемпящий игрок держал бы варн бесконечно)
    HARDCORE_KILL_MULT: 1.5,
    mosherKey: 'enemy2_mosher',
    subwooferKey: 'enemy2_sub',
    rhinoArt: 'c2_boss2',   // Носорог = Bass-rush
    doctorArt: 'c2_boss1',  // Врач
    teleporterArt: 'boss3', // Телепортёр (СТРОБ)
};

const GamePhase = {
    PHASE_1: 'PHASE_1',
    CLEARING: 'CLEARING',
    PHASE_2: 'PHASE_2',
    PHASE_3: 'PHASE_3',
};

const EnemyType = {
    NORMAL: 'NORMAL',
    FAST: 'FAST',
    TANK: 'TANK',
    BOSS: 'BOSS',
    GOBLIN: 'GOBLIN',
    SUBWOOFER: 'SUBWOOFER',
    MOSHER: 'MOSHER',
    MOSHERLING: 'MOSHERLING',
    HYPEMAN: 'HYPEMAN',
};

const BossState = { WALKING: 0, PREPARING: 1, JUMPING: 2, RECOVERING: 3 };
const GoblinState = { WALKING: 0, PREPARING: 1, THROWING: 2, RECOVERING: 3 };

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

const ABILITY_COOLDOWNS = { 0: 25, 1: 15, 2: 12, 3: 14, 4: 16, 5: 14, 6: 15 };
const ABILITY_ICONS = { '-10': 'ability_dash', 0: 'ability_invincible', 1: 'ability_slam', 2: 'ability_disc', 3: 'ability_laser', 4: 'ability_skull', 5: 'ability_sonic', 6: 'ability_shatter' };

const ARTIFACTS = [
    { name: 'BLOOD PACT', desc: 'Kill heals 2 HP', cost: 800 },
    { name: 'GLASS CANNON', desc: '+30% dmg, Max HP -20', cost: 1000 },
    { name: 'ECHO CHAMBER', desc: 'Bullets ricochet off walls', cost: 1100 },
    { name: 'SOUL LEECH', desc: '+0.5% crit/kill  (max +5%)', cost: 1400 },
    { name: 'BERSERKER', desc: 'HP<=40%: dmg x1.5, no dash slow', cost: 1500 },
    { name: 'IRON SKIN', desc: 'First 3 hits/run blocked', cost: 1700 },
    { name: 'MAGNET CORE', desc: 'Infinite pickup range', cost: 5000 },
];

const ARTIFACT = {
    BLOOD_PACT:   1 << 0,
    GLASS_CANNON: 1 << 1,
    ECHO_CHAMBER: 1 << 2,
    SOUL_LEECH:   1 << 3,
    BERSERKER:    1 << 4,
    IRON_SKIN:    1 << 5,
    MAGNET_CORE:  1 << 6,
};
function hasArtifact(save, flag) { return (save.permActiveArtifacts & flag) !== 0; }

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
    ['floor2', 'floor2.jpg'],
    ['enemy2', 'enemy2.png'],
    ['enemyV2', 'enemyV2.png'],
    ['enemy2_sub', 'enemy2_sub.png'],
    ['enemy2_mosher', 'enemy2_mosher.png'],
    ['enemy2_hype', 'enemy2_hype.png'],
    ['c2_boss1', 'c2_boss1.png'],
    ['c2_boss2', 'c2_boss2.png'],
    ['c2_boss3', 'c2_boss3.png'],
    ['floor3', 'floor3.jpg'],
    ['ability_laser', 'laser.png'],
    ['gem', 'gem.png'],
    ['boss_soul', 'boss_soul.png'],
    ['ability_dash', 'dash.png'],
    ['ability_invincible', 'Invincibility.png'],
    ['ability_slam', 'ground_slam.png'],
    ['ability_disc', 'disc_storm.png'],
    ['ability_skull', 'ability_skull.png'],
    ['ability_sonic', 'ability_sonic.png'],
    ['ability_shatter', 'ability_shatter.png'],
    ['icon_fire', 'icon_fire.png'],
    ['icon_dmg', 'icon_dmg.png'],
    ['icon_speed', 'icon_speed.png'],
    ['icon_magnet', 'icon_magnet.png'],
    ['icon_hp', 'icon_hp.png'],
    ['icon_blademail', 'icon_blademail.png'],
    ['icon_pierce', 'icon_pierce.png'],
    ['icon_shield', 'icon_shield.png'],
    ['icon_crit', 'icon_crit.png'],
    ['icon_sphere', 'icon_sphere.png'],
    ['icon_doubletap', 'icon_doubletap.png'],
    ['art_bloodpact', 'art_bloodpact.png'],
    ['art_glasscannon', 'art_glasscannon.png'],
    ['art_echo', 'art_echo.png'],
    ['art_soulleech', 'art_soulleech.png'],
    ['art_berserker', 'art_berserker.png'],
    ['art_ironskin', 'art_ironskin.png'],
    ['art_magnetcore', 'art_magnetcore.png'],
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

const ANIM_DIRS = ['front', 'back', 'left', 'right'];
