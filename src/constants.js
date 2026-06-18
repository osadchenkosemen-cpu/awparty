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

    // --- Meta-progression caps (Game.h) ---
    MAX_PERM_MAXHP: 10,
    MAX_PERM_DAMAGE: 10,
    MAX_PERM_SPEED_LEVEL: 5,
    MAX_PERM_DASH_LEVEL: 5,

    // --- FPS limit options (Game.cpp constructor) ---
    FPS_LIMITS: [30, 60, 120, 240, 0],

    // Множитель монет в hardcore-режиме (награда за повышенную сложность).
    HARDCORE_COIN_MULT: 1.5,

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
};

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
};

// Boss / Goblin FSM states (Enemy.h)
const BossState = { WALKING: 0, PREPARING: 1, JUMPING: 2, RECOVERING: 3 };
const GoblinState = { WALKING: 0, PREPARING: 1, THROWING: 2, RECOVERING: 3 };

// In-run upgrade icons (тексты названий/описаний — в i18n.js: upgrade_titles / upgrade_descs)
const UPGRADE_ICONS = ['icon_fire', 'icon_dmg', 'icon_speed', 'icon_magnet', 'icon_hp'];

// Ability data (AbilitySelectUI.cpp). Названия — в i18n.js: ability_names.
const ABILITY_COOLDOWNS = { 0: 25, 1: 15, 2: 12 };
const ABILITY_ICONS = { '-10': 'ability_dash', 0: 'ability_invincible', 1: 'ability_slam', 2: 'ability_disc' };

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
];

// Player walk animation frames: dir -> [6 keys] (Game.cpp constructor)
const ANIM_DIRS = ['front', 'back', 'left', 'right'];
