const globals = require('globals');

module.exports = [
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                Phaser: 'readonly',

                C: 'readonly', GameState: 'readonly', GamePhase: 'readonly',
                EnemyType: 'readonly', BossState: 'readonly', GoblinState: 'readonly',
                CHAPTERS: 'readonly', getChapter: 'readonly', TEXTURE_MANIFEST: 'readonly',
                ANIM_DIRS: 'readonly', UPGRADE_ICONS: 'readonly',
                LEGENDARY_UPGRADE_IDS: 'readonly', LEGENDARY_CARD_CHANCE: 'readonly',
                ABILITY_COOLDOWNS: 'readonly', ABILITY_ICONS: 'readonly', ARTIFACTS: 'readonly',
                ARTIFACT: 'readonly', hasArtifact: 'readonly',

                t: 'readonly', setLanguage: 'readonly', detectLang: 'readonly',

                distSq: 'readonly', dist: 'readonly', normalize: 'readonly', randInt: 'readonly',
                rgb: 'readonly', clamp8: 'readonly', clamp: 'readonly', fmtNum: 'readonly',
                lbCompare: 'readonly', lbEmptyEntry: 'readonly', formatTime: 'readonly',

                SaveSystem: 'readonly',

                Player: 'readonly', Enemy: 'readonly', Bullet: 'readonly',
                EnemyProjectile: 'readonly', BossSoul: 'readonly', Gem: 'readonly',
                Coin: 'readonly', Vinyl: 'readonly', Particle: 'readonly', DamageText: 'readonly',
                DEG: 'readonly',

                EnemySpawner: 'readonly', findSpawnPos: 'readonly',

                HUD: 'readonly', FONT: 'readonly',

                Shop: 'readonly', ARTIFACT_ICONS: 'readonly',

                AudioManager: 'readonly',

                SUPABASE_URL: 'readonly', SUPABASE_ANON_KEY: 'readonly',

                RemoteLeaderboard: 'readonly', CloudSave: 'readonly',

                MainScene: 'readonly',
            },
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': 'off',
            'no-redeclare': ['error', { builtinGlobals: false }],
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-unreachable': 'warn',
        },
    },
];
