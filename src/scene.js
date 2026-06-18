// MainScene — порт Game.cpp: машина состояний, игровой цикл, рендер, меню.

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }

    // ===================== ЗАГРУЗКА =====================
    preload() {
        this.load.setPath(C.ASSET_PATH);
        for (const [key, file] of TEXTURE_MANIFEST) this.load.image(key, file);
        // Кадры анимации игрока: panim_<dir><1..6>
        for (let d = 0; d < 4; d++) {
            for (let f = 1; f <= 6; f++) {
                this.load.image('panim_' + ANIM_DIRS[d] + f, 'player_' + ANIM_DIRS[d] + '_anim' + f + '.png');
            }
        }
        AudioManager.preload(this.load);
    }

    // ===================== СОЗДАНИЕ =====================
    create() {
        // Сейв
        this.save = SaveSystem.load();
        this.leaderboard = SaveSystem.loadLeaderboard();

        // Слои: мир и интерфейс
        this.worldLayer = this.add.layer();
        this.uiLayer = this.add.layer();

        // Камеры: основная следит за игроком; UI фиксированная
        this.cameras.main.setBounds(0, 0, C.ARENA_WIDTH, C.ARENA_HEIGHT);
        this.uiCam = this.cameras.add(0, 0, C.VIEW_WIDTH, C.VIEW_HEIGHT);
        this.cameras.main.ignore(this.uiLayer);
        this.uiCam.ignore(this.worldLayer);

        // Арена (пол + рамка)
        this.arena = this.addWorld(this.add.tileSprite(0, 0, C.ARENA_WIDTH, C.ARENA_HEIGHT, 'floor').setOrigin(0, 0));
        this.arenaBorder = this.addWorld(this.add.rectangle(0, 0, C.ARENA_WIDTH, C.ARENA_HEIGHT).setOrigin(0, 0));
        this.arenaBorder.setStrokeStyle(15, 0xff0032);
        this.arenaBorder.isFilled = false;

        // Фоновая графика мира (трейлы пуль, кольцо слэма)
        this.worldFx = this.addWorld(this.add.graphics());
        this.worldFx.setDepth(5);

        // Массивы сущностей
        this.enemies = [];
        this.bullets = [];
        this.enemyProjectiles = [];
        this.gems = [];
        this.coins = [];
        this.vinyls = [];
        this.particles = [];
        this.dmgTexts = [];
        this.bossSouls = [];

        // Пулы переиспользуемых объектов (снижают нагрузку на GC)
        this.pools = { bullet: [], eproj: [], gem: [], coin: [], vinyl: [], particle: [], dmgText: [] };

        // Игрок
        this.player = new Player(this);
        this.player.sprite.setDepth(10);
        this.cameras.main.startFollow(this.player.sprite, false, 1, 1);

        // Системы
        this.spawner = new EnemySpawner();
        this.hud = new HUD(this);
        this.shop = new Shop(this);

        // Состояние
        this.currentState = GameState.MENU;
        this.isGameOver = false;
        this.globalTime = 0;
        this.fadeAlpha = 0;
        this.levelUpAnimTimer = 0;
        this.abilitySelectAnimTimer = 0;

        // Фаза / прогрессия
        this.survivalTimer = 0;
        this.vinylSpawnTimer = 0;
        this.gamePhase = GamePhase.PHASE_1;
        this.phaseNotifTimer = 0;
        this.activeStep = 1;
        this.phase2Timer = 0;
        this.phase2BossSpawned = false;
        this.phase3Timer = 0;
        this.phaseTransitionTimer = -1;
        this.phaseEventFired = false;

        // Способности
        this.equippedAbilities = [-1, -1, -1];
        this.abilityCooldowns = [0, 0, 0];
        this.abilityMaxCooldowns = [0, 0, 0];
        this.pendingAbilityIds = [-1, -1, -1];
        this.pendingAbilityCount = 0;

        // Слэм-кольцо
        this.slamRingTimer = -1;
        this.slamRingCenter = { x: 0, y: 0 };

        // Артефакт-аккумуляторы / реген
        this.bloodPactHealAcc = 0;
        this.regenTimer = 0;
        this.shotsFired = 0;

        // Уровни прокачек в забеге
        this.runUpgradeLevels = [0, 0, 0, 0, 0];

        // Индексы выбора в меню
        this.selectedMenuIndex = 0;
        this.selectedSettingIndex = 0;
        this.selectedPauseIndex = 0;
        this.selectedLobbyIndex = 0;
        this.selectedLevelUpIndex = -1;
        this.selectedAbilityIndex = -1;
        this.leaderboardFromMenu = false;
        this.leaderboardNewEntryIndex = -1;
        this.nameInput = ''; // ввод ника на экране NAME_INPUT
        this._pendingHighlight = null; // имя игрока, чью строку подсветить после отправки
        this.levelUpIds = [0, 1, 2];
        this.cheatBuffer = '';
        this.cheatMessage = '';
        this.cheatMessageTimer = 0;

        // Ввод
        this.keys = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D', space: 'SPACE',
        });
        this.input.keyboard.on('keydown', (e) => this.onKeyDown(e));
        this.input.on('pointerdown', (p) => this.onPointerDown(p));
        this.input.on('pointermove', (p) => this.onPointerMove(p));

        // Меню-объекты (статические, перестраиваются при смене состояния/выбора)
        this.menuObjs = [];
        this.menuBg = this.addUI(this.add.image(0, 0, 'menu_bg').setOrigin(0, 0));
        this.menuBg.setDisplaySize(C.VIEW_WIDTH, C.VIEW_HEIGHT);
        this.lobbyPlayer = this.addUI(this.add.sprite(0, 0, 'player_front').setOrigin(0.5, 0.5));

        // Постоянные оверлеи поверх игры
        this._buildOverlays();

        // Аудио
        this.audio = new AudioManager(this);

        // Стартовый фейд
        this.fadeAlpha = 255;
        this.rebuildMenu();
        this.updateCursor();
        this.audio.playMusic(this.audio.musicForState(this.currentState));

        // Подтянуть общий топ заранее, чтобы проверка рекорда шла против облака.
        this._refreshRemoteLeaderboard();
    }

    // ===================== ХЕЛПЕРЫ =====================
    addWorld(o) { this.worldLayer.add(o); return o; }
    addUI(o) { this.uiLayer.add(o); return o; }
    saveGame() { SaveSystem.save(this.save); }
    hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

    // --- Фабрики из пулов: берут из пула (reinit) или создают новый ---
    spawnBullet(x, y, dx, dy, dmg, crit) {
        const p = this.pools.bullet;
        return p.length ? p.pop().reinit(x, y, dx, dy, dmg, crit) : new Bullet(this, x, y, dx, dy, dmg, crit);
    }
    spawnEnemyProjectile(x, y, tx, ty) {
        const p = this.pools.eproj;
        return p.length ? p.pop().reinit(x, y, tx, ty) : new EnemyProjectile(this, x, y, tx, ty);
    }
    spawnGem(x, y) {
        const p = this.pools.gem;
        return p.length ? p.pop().reinit(x, y) : new Gem(this, x, y);
    }
    spawnCoin(x, y) {
        const p = this.pools.coin;
        return p.length ? p.pop().reinit(x, y) : new Coin(this, x, y);
    }
    spawnVinyl(x, y) {
        const p = this.pools.vinyl;
        return p.length ? p.pop().reinit(x, y) : new Vinyl(this, x, y);
    }
    spawnParticle(x, y, color) {
        const p = this.pools.particle;
        return p.length ? p.pop().reinit(x, y, color) : new Particle(this, x, y, color);
    }
    spawnDamageText(x, y, dmg, crit) {
        const p = this.pools.dmgText;
        return p.length ? p.pop().reinit(x, y, dmg, crit) : new DamageText(this, x, y, dmg, crit);
    }

    // Фильтрация массива с возвратом удалённых в пул
    _filterRelease(arr, poolKey, pred) {
        const pool = this.pools[poolKey];
        for (let i = arr.length - 1; i >= 0; i--) {
            if (pred(arr[i])) { arr[i].release(); pool.push(arr[i]); arr.splice(i, 1); }
        }
    }
    // Полный сброс массива в пул (для resetGame)
    _releaseAll(arr, poolKey) {
        const pool = this.pools[poolKey];
        for (const o of arr) { o.release(); pool.push(o); }
        arr.length = 0;
    }

    _buildOverlays() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        // Затемнение/фейд (фаза-переход + стартовый)
        this.fadeRect = this.addUI(this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0));
        this.fadeRect.setDepth(100);
        // Предупреждение (красное/фиолетовое мигание)
        this.warnRect = this.addUI(this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0, 0));
        this.warnRect.setDepth(90);
        // Уведомление о фазе
        this.phaseOverlay = this.addUI(this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0)).setDepth(91);
        this.phaseText = this.addUI(this.add.text(W / 2, H * 0.38, '', { fontFamily: FONT, fontSize: '110px', color: '#00ffc8', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5, 0.5)).setDepth(92);
        // Подсказка зачистки
        this.clearText = this.addUI(this.add.text(W / 2, 18, '', { fontFamily: FONT, fontSize: '30px', color: '#ff5050', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0)).setDepth(92);
        // Сообщение об апгрейде над игроком (world space)
        this.upgradeMsg = this.addWorld(this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '40px', color: '#ffff00', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0.5)).setDepth(20);
        this.upgradeMsg.setVisible(false);
        // Группа GAME OVER / PAUSE / LEVEL_UP / ABILITY строится динамически в menuObjs
        [this.fadeRect, this.warnRect, this.phaseOverlay, this.phaseText, this.clearText].forEach(o => o.setVisible(false));
    }

    // ===================== СБРОС ЗАБЕГА (resetGame) =====================
    resetGame() {
        this.isGameOver = false;
        const p = this.player, s = this.save;

        p.maxHp = s.permMaxHp; p.hp = s.permMaxHp;
        p.attackDamage = s.permDamage; p.speed = s.permSpeed;

        p.dashLevel = s.permDashLevel;
        if (s.permDashLevel > 0) {
            p.hasDashUnlocked = true;
            p.dashSpeed = 600 + (s.permDashLevel - 1) * 150;
            p.dashCooldown = 10.0 - (s.permDashLevel - 1) * 1.25;
        } else p.hasDashUnlocked = false;

        p.currentSpeedMultiplier = 1.0; p.dashPenaltyTimer = 0;
        p.baseCritChance = 0.03 + s.permCritChance * 0.05;
        p.critChance = p.baseCritChance;
        p.armor = s.permArmor;
        p.pickupRadius = ((s.permActiveArtifacts >> 6) & 1) ? 99999 : 100 + s.permMagnet * 100;
        p.ironSkinCharges = ((s.permActiveArtifacts >> 5) & 1) ? 3 : 0;
        p.soulLeechCritBonus = 0;
        this.bloodPactHealAcc = 0;

        if ((s.permActiveArtifacts >> 1) & 1) { p.maxHp = Math.max(1, p.maxHp - 2); p.hp = p.maxHp; }

        p.level = 1; p.currentXP = 0; p.xpToNextLevel = 5; p.shootCooldown = 0.45;
        this.regenTimer = 0; this.shotsFired = 0;
        p.sprite.setPosition(C.ARENA_WIDTH / 2, C.ARENA_HEIGHT / 2);
        p.isInvincible = false; p.invincibilityTimer = 0;

        this.survivalTimer = 0; this.vinylSpawnTimer = 0; this.phase2BossSpawned = false;
        this.gamePhase = GamePhase.PHASE_1; this.phaseNotifTimer = 0; this.activeStep = 1;
        this.phase2Timer = 0; this.phase3Timer = 0; this.phaseTransitionTimer = -1; this.phaseEventFired = false;
        this.slamRingTimer = -1;

        // Очистка сущностей (пулируемые — в пул, остальные — уничтожаем)
        this._clearArr(this.enemies);
        this._clearArr(this.bossSouls);
        this._releaseAll(this.bullets, 'bullet');
        this._releaseAll(this.enemyProjectiles, 'eproj');
        this._releaseAll(this.gems, 'gem');
        this._releaseAll(this.coins, 'coin');
        this._releaseAll(this.vinyls, 'vinyl');
        this._releaseAll(this.particles, 'particle');
        this._releaseAll(this.dmgTexts, 'dmgText');
        this.player.ghosts.forEach(g => g.img.destroy()); this.player.ghosts.length = 0;

        for (let i = 0; i < 5; i++) this.runUpgradeLevels[i] = 0;
        for (let i = 0; i < 3; i++) { this.equippedAbilities[i] = -1; this.abilityCooldowns[i] = 0; this.abilityMaxCooldowns[i] = 0; }
        this.pendingAbilityCount = 0;
        this.spawner.reset();

        // Пре-спавн врагов за пределами видимости (>1200 от центра арены)
        const cx = C.ARENA_WIDTH / 2, cy = C.ARENA_HEIGHT / 2;
        const minD = 1200;
        for (let i = 0; i < 10; i++) {
            for (let a = 0; a < 20; a++) {
                const tx = randInt(C.ARENA_WIDTH), ty = randInt(C.ARENA_HEIGHT);
                if (distSq(cx, cy, tx, ty) >= minD * minD) {
                    const e = new Enemy(this, tx, ty, 'enemy');
                    const r = randInt(100);
                    if (r < 20) e.makeFast(); else if (r < 35) e.makeTank(1); else { e.hp = 2; e.maxHp = 2; }
                    this.enemies.push(e);
                    break;
                }
            }
        }
        this.fadeAlpha = 255;
    }

    _clearArr(arr) { arr.forEach(o => o.destroy()); arr.length = 0; }

    // ===================== СМЕНА СОСТОЯНИЯ =====================
    setState(ns) {
        this.currentState = ns;
        this.rebuildMenu();
        this.updateCursor();
        if (this.audio) {
            this.audio.playMusic(this.audio.musicForState(ns));
            // Приглушаем боевую музыку в модальных оверлеях поверх игры.
            const ducked = (ns === GameState.PAUSED || ns === GameState.LEVEL_UP || ns === GameState.ABILITY_SELECT);
            this.audio.setDuck(ducked ? 0.5 : 1);
        }
        // При открытии таблицы — тянем свежий общий топ из облака.
        if (ns === GameState.LEADERBOARD) this._refreshRemoteLeaderboard();
    }

    // Кастомный курсор канваса (порт setMouseCursor: прицел в игре, стрелка в меню)
    updateCursor() {
        const canvas = this.sys.game.canvas;
        if (!canvas) return;
        const base = C.ASSET_PATH;
        if (this.currentState === GameState.PLAYING) {
            // прицел с хотспотом по центру (55x48 -> 27,24)
            canvas.style.cursor = 'url("' + base + 'cursor_crosshair.png") 27 24, crosshair';
        } else {
            canvas.style.cursor = 'url("' + base + 'cursor_arrow.png") 0 0, default';
        }
    }

    // ===================== ГЛАВНЫЙ ЦИКЛ =====================
    update(time, delta) {
        let dt = delta / 1000;
        if (dt > 0.1) dt = 0.1;
        this.globalTime += dt;

        // Курсор/камера-режимы можно опустить — браузерный курсор по умолчанию

        if (this.fadeAlpha > 0) {
            this.fadeAlpha -= dt * 400;
            if (this.fadeAlpha < 0) this.fadeAlpha = 0;
        }
        this.fadeRect.setVisible(this.fadeAlpha > 0);
        this.fadeRect.setFillStyle(0x000000, this.fadeAlpha / 255);

        if (this.currentState === GameState.LEVEL_UP) {
            if (this.levelUpAnimTimer < 1) { this.levelUpAnimTimer += dt * 2.5; if (this.levelUpAnimTimer > 1) this.levelUpAnimTimer = 1; }
            this._animateLevelUp();
            return;
        }
        if (this.currentState === GameState.ABILITY_SELECT) { this.abilitySelectAnimTimer += dt; return; }
        if (this.currentState === GameState.LEADERBOARD) return;

        if (this.cheatMessageTimer > 0) { this.cheatMessageTimer -= dt; if (this.cheatMessageTimer < 0) this.cheatMessageTimer = 0; }

        if (this.currentState !== GameState.PLAYING || this.isGameOver) return;

        if (this.player.currentXP >= this.player.xpToNextLevel) { this.triggerLevelUp(); return; }

        this.updatePlaying(dt);
    }

    // ===================== ЛОГИКА ИГРЫ (Game::update) =====================
    updatePlaying(dt) {
        const p = this.player, s = this.save;
        const input = {
            left: this.keys.left.isDown, right: this.keys.right.isDown,
            up: this.keys.up.isDown, down: this.keys.down.isDown, space: this.keys.space.isDown,
        };
        p.update(dt, C.ARENA_WIDTH, C.ARENA_HEIGHT, input);

        // Berserker
        if (((s.permActiveArtifacts >> 4) & 1) && p.hp <= Math.floor(p.maxHp * 0.4))
            p.currentSpeedMultiplier = Math.max(1.0, p.currentSpeedMultiplier);

        const px = p.sprite.x, py = p.sprite.y;

        // Пыль при движении
        if (p.isMoving && randInt(100) < 20) {
            const dust = this.spawnParticle(px + (randInt(30) - 15), py + p.sprite.displayHeight / 2 - 10, rgb(150, 150, 150));
            dust.vx = randInt(40) - 20; dust.vy = -(randInt(50) + 20);
            dust.maxLifetime = 0.4; dust.lifetime = 0.4;
            dust.rect.setAlpha(150 / 255);
            this.particles.push(dust);
        }

        this.survivalTimer += dt;
        if (this.phaseNotifTimer < 3.5) this.phaseNotifTimer += dt;

        // Реген
        if (s.permRegen > 0 && p.hp < p.maxHp) {
            this.regenTimer += dt;
            const interval = 8 - s.permRegen * 2;
            if (this.regenTimer >= interval) { this.regenTimer = 0; p.hp = Math.min(p.hp + 1, p.maxHp); }
        }

        // Переход фаз
        if (this.phaseTransitionTimer >= 0) {
            this.phaseTransitionTimer += dt;
            if (!this.phaseEventFired && this.phaseTransitionTimer >= 0.7) {
                this.phaseEventFired = true;
                if (this.gamePhase === GamePhase.CLEARING) {
                    this.gamePhase = GamePhase.PHASE_2; this.phaseNotifTimer = 0; this.activeStep = 2; this.phase2Timer = 0; this.spawner.resetForPhase2();
                } else if (this.gamePhase === GamePhase.PHASE_2) {
                    this.gamePhase = GamePhase.PHASE_3; this.phaseNotifTimer = 0; this.activeStep = 3; this.phase3Timer = 0; this.spawner.resetForPhase2();
                }
            }
            if (this.phaseTransitionTimer >= 1.5) { this.phaseTransitionTimer = -1; this.phaseEventFired = false; }
        }

        if (this.gamePhase === GamePhase.PHASE_3) this.phase3Timer += dt;

        if (this.gamePhase === GamePhase.PHASE_2) {
            this.phase2Timer += dt;
            if (this.phase2Timer >= 60 && !this.phase2BossSpawned) {
                const bx = clamp(px + 800, 0, C.ARENA_WIDTH);
                const by = clamp(py, 0, C.ARENA_HEIGHT);
                const boss2 = new Enemy(this, bx, by, 'boss2');
                boss2.makeBoss2('boss2');
                if (s.isHardcoreMode) boss2.speed *= 1.5;
                this.enemies.push(boss2);
                this.phase2BossSpawned = true;
            }
        }

        // Vinyl спавн каждые 60с
        this.vinylSpawnTimer += dt;
        if (this.vinylSpawnTimer >= 60) {
            this.vinyls.push(this.spawnVinyl(randInt(C.ARENA_WIDTH), randInt(C.ARENA_HEIGHT)));
            this.vinylSpawnTimer = 0;
        }

        // Спавн врагов
        const spawningActive = (this.gamePhase !== GamePhase.CLEARING)
            && !(this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)
            && (this.phaseTransitionTimer < 0);
        if (spawningActive) {
            const p2 = this.gamePhase === GamePhase.PHASE_2;
            const p3 = this.gamePhase === GamePhase.PHASE_3;
            const spawnTime = p3 ? this.phase3Timer : (p2 ? this.phase2Timer : this.survivalTimer);
            this.spawner.update(this, dt, spawnTime, C.ARENA_WIDTH, C.ARENA_HEIGHT, px, py, this.enemies,
                s.isHardcoreMode, 'enemy', 'enemyV', p2, this.phase2Timer, p3);
        }

        // Стрельба (только когда игрок стоит)
        if (!p.isMoving && p.currentCooldown <= 0) {
            const ptr = this.input.activePointer;
            const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
            let target = null, minSq = 250 * 250;
            for (const e of this.enemies) {
                const dq = distSq(wp.x, wp.y, e.sprite.x, e.sprite.y);
                if (dq < minSq) { minSq = dq; target = e; }
            }
            const tx = target ? target.sprite.x : wp.x;
            const ty = target ? target.sprite.y : wp.y;
            let dx = tx - px, dy = ty - py;
            if (dx * dx + dy * dy > 1e-8) {
                const isCrit = randInt(100) < Math.floor(p.critChance * 100);
                let dmgMul = 1;
                if ((s.permActiveArtifacts >> 1) & 1) dmgMul *= 1.3;
                if (((s.permActiveArtifacts >> 4) & 1) && p.hp <= Math.floor(p.maxHp * 0.4)) dmgMul *= 1.5;
                const finalDmg = Math.max(1, Math.floor((isCrit ? p.attackDamage * p.critMultiplier : p.attackDamage) * dmgMul + 0.5));
                const n = normalize(dx, dy);
                const mb = this.spawnBullet(px, py, n.x, n.y, finalDmg, isCrit);
                if ((s.permActiveArtifacts >> 2) & 1) mb.ricochetsLeft = 1;
                this.bullets.push(mb);
                this.shotsFired++;
                if (s.permMultishot > 0 && this.shotsFired % 8 === 0) {
                    const ang = 18 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
                    const sd = { x: n.x * ca - n.y * sa, y: n.x * sa + n.y * ca };
                    const sb = this.spawnBullet(px, py, sd.x, sd.y, finalDmg, isCrit);
                    if ((s.permActiveArtifacts >> 2) & 1) sb.ricochetsLeft = 1;
                    this.bullets.push(sb);
                }
                p.currentCooldown = p.shootCooldown;
                this.audio.play('sfx_player_shot', { volume: 0.33, minGap: 40 });
            }
        }

        for (const b of this.bullets) b.update(dt);

        // Враги + снаряды/коллизии
        for (const e of this.enemies) {
            e.update(dt, px, py, C.ARENA_WIDTH, C.ARENA_HEIGHT);

            if (e.justThrew) {
                const pr = this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.throwTargetPos.x, e.throwTargetPos.y);
                this.enemyProjectiles.push(pr);
            }
            if (e.justFiredVolley) {
                for (let v = 0; v < 12; v++) {
                    const ang = v * (2 * Math.PI / 12);
                    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
                    this.enemyProjectiles.push(this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.sprite.x + dir.x * 500, e.sprite.y + dir.y * 500));
                }
            }

            const attackDist = e.isBoss ? 150 * 150 : (e.type === EnemyType.GOBLIN ? 2500 : 3600);
            if (distSq(e.sprite.x, e.sprite.y, px, py) < attackDist) {
                const oldHp = p.hp;
                p.takeDamage(e.damage);
                if (p.hp < oldHp) { this.triggerShake(0.2, 20 * e.damage); this.audio.play('sfx_player_hurt'); }
                if (p.hp <= 0 && !this.isGameOver) this.onPlayerDeath();
            }

            for (const b of this.bullets) {
                if (b.isDestroyed) continue;
                const hitDist = e.isBoss ? 150 * 150 : 2500;
                if (distSq(e.sprite.x, e.sprite.y, b.sprite.x, b.sprite.y) < hitDist) {
                    e.hp -= b.damage;
                    b.isDestroyed = true;
                    e.hitFlashTimer = 0.08;
                    this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, b.damage, b.isCrit));
                    if (((s.permActiveArtifacts >> 0) & 1) && b.isCrit) {
                        this.bloodPactHealAcc += 0.2;
                        if (this.bloodPactHealAcc >= 1) {
                            const heal = Math.floor(this.bloodPactHealAcc);
                            p.hp = Math.min(p.maxHp, p.hp + heal);
                            this.bloodPactHealAcc -= heal;
                        }
                    }
                }
            }
        }

        this.separateEnemies(px, py);
        this.handleEnemyDeaths(px, py);

        // Удаление мёртвых врагов
        this._filterDestroy(this.enemies, e => e.hp <= 0);

        // Echo Chamber: рикошет пуль от стен
        if ((s.permActiveArtifacts >> 2) & 1) {
            for (const b of this.bullets) {
                if (b.isDestroyed || b.ricochetsLeft <= 0) continue;
                let x = b.sprite.x, y = b.sprite.y, hit = false;
                if (x <= 0) { b.vx = Math.abs(b.vx); x = 1; hit = true; }
                else if (x >= C.ARENA_WIDTH) { b.vx = -Math.abs(b.vx); x = C.ARENA_WIDTH - 1; hit = true; }
                if (y <= 0) { b.vy = Math.abs(b.vy); y = 1; hit = true; }
                else if (y >= C.ARENA_HEIGHT) { b.vy = -Math.abs(b.vy); y = C.ARENA_HEIGHT - 1; hit = true; }
                if (hit) { b.ricochetsLeft--; b.sprite.setPosition(x, y); }
            }
        }
        this._filterRelease(this.bullets, 'bullet', b => {
            const x = b.sprite.x, y = b.sprite.y;
            return b.isDestroyed || (b.ricochetsLeft <= 0 && (x < 0 || x > C.ARENA_WIDTH || y < 0 || y > C.ARENA_HEIGHT));
        });

        // Запуск перехода фаз
        if (this.gamePhase === GamePhase.CLEARING && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
        if (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }

        // Кристаллы
        for (const g of this.gems) {
            g.update(dt, px, py, p.pickupRadius);
            if (distSq(g.sprite.x, g.sprite.y, px, py) < 1600) { g.isCollected = true; p.gainXP(1); }
        }
        this._filterRelease(this.gems, 'gem', g => g.isCollected);

        // Монеты
        for (const c of this.coins) {
            c.update(dt, px, py, p.pickupRadius);
            if (distSq(c.sprite.x, c.sprite.y, px, py) < 1600) { c.isCollected = true; s.totalCoins += 1; }
        }
        this._filterRelease(this.coins, 'coin', c => c.isCollected);

        // Пластинки
        for (const v of this.vinyls) {
            v.update(dt);
            if (distSq(v.sprite.x, v.sprite.y, px, py) < 2500) { v.isCollected = true; if (p.hp < p.maxHp) p.hp += 1; }
        }
        this._filterRelease(this.vinyls, 'vinyl', v => v.isCollected);

        // Снаряды врагов
        for (const pr of this.enemyProjectiles) pr.update(dt, C.ARENA_WIDTH, C.ARENA_HEIGHT);
        for (const pr of this.enemyProjectiles) {
            if (pr.isDestroyed) continue;
            if (distSq(pr.sprite.x, pr.sprite.y, px, py) < 1600) {
                pr.isDestroyed = true;
                const oldHp = p.hp;
                p.takeDamage(pr.damage);
                if (p.hp < oldHp) { this.triggerShake(0.15, 15); this.audio.play('sfx_player_hurt'); }
                if (p.hp <= 0 && !this.isGameOver) this.onPlayerDeath();
            }
        }
        this._filterRelease(this.enemyProjectiles, 'eproj', pr => pr.isDestroyed);

        // Damage texts / particles
        for (const d of this.dmgTexts) d.update(dt);
        this._filterRelease(this.dmgTexts, 'dmgText', d => d.lifetime <= 0);
        for (const pa of this.particles) pa.update(dt);
        this._filterRelease(this.particles, 'particle', pa => pa.lifetime <= 0);

        // Слэм-кольцо
        if (this.slamRingTimer >= 0) { this.slamRingTimer += dt; if (this.slamRingTimer >= C.SLAM_RING_DURATION) this.slamRingTimer = -1; }

        // Души боссов
        for (const soul of this.bossSouls) {
            if (soul.isCollected) continue;
            soul.update(dt, this.globalTime);
            if (distSq(soul.sprite.x, soul.sprite.y, px, py) < 4000) {
                soul.isCollected = true;
                let nextSlot = -1;
                for (let si = 0; si < 3; si++) if (this.equippedAbilities[si] < 0) { nextSlot = si; break; }
                if (nextSlot >= 0) {
                    if (soul.soulType === 1) { this.pendingAbilityIds = [0, 1, -1]; this.pendingAbilityCount = 2; }
                    else { this.pendingAbilityIds = [2, -1, -1]; this.pendingAbilityCount = 1; }
                    this.pendingSlot = nextSlot;
                    this.abilitySelectAnimTimer = 0;
                    this.selectedAbilityIndex = -1;
                    this.setState(GameState.ABILITY_SELECT);
                }
            }
        }
        this._filterDestroy(this.bossSouls, s2 => s2.isCollected);

        // Кулдауны способностей
        for (let i = 0; i < 3; i++) if (this.abilityCooldowns[i] > 0) this.abilityCooldowns[i] -= dt;

        // HUD
        let bossExists = false, bossHpPct = 0;
        for (const e of this.enemies) { if (e.isBoss) { bossExists = true; bossHpPct = Math.max(0, e.hp / e.maxHp); break; } }
        this.hud.update(p, s.totalCoins, bossExists, bossHpPct, formatTime(this.survivalTimer),
            this.runUpgradeLevels, this.equippedAbilities, this.abilityCooldowns, this.abilityMaxCooldowns);

        this.drawWorldFx();
        this.drawPlayingOverlays();
    }

    _filterDestroy(arr, pred) {
        for (let i = arr.length - 1; i >= 0; i--) {
            if (pred(arr[i])) { arr[i].destroy(); arr.splice(i, 1); }
        }
    }

    triggerShake(dur, mag) { this.cameras.main.shake(dur * 1000, mag / C.VIEW_WIDTH, true); }

    onPlayerDeath() {
        this.isGameOver = true;
        this.audio.play('sfx_player_death', { volume: 0.9 });
        this.saveGame();
        if (this.qualifiesForLeaderboard(this.survivalTimer)) {
            if (this.save.playerName) {
                // Ник уже задан — молча отправляем лучший результат, показываем Game Over.
                this._submitScore(this.save.playerName, false);
                this.rebuildMenu();
            } else {
                // Первый раз — просим ввести ник.
                this.nameInput = '';
                this.setState(GameState.NAME_INPUT);
            }
        } else {
            this.rebuildMenu();
        }
    }

    // Записать результат. showBoard=true — открыть таблицу с подсветкой; false — молча.
    _submitScore(name, showBoard) {
        name = (name || '').trim() || 'Anonymous';
        if (name !== 'Anonymous') { this.save.playerName = name; this.saveGame(); } // запоминаем ник
        this.tryAddToLeaderboard(this.survivalTimer, name); // локальный кэш/фолбэк (дедуп по имени)
        // Общий рейтинг: одна запись на игрока, хранит лучшее время (см. RPC submit_score).
        RemoteLeaderboard.submit(name, this.survivalTimer, () => {
            if (showBoard && this.currentState === GameState.LEADERBOARD) this._refreshRemoteLeaderboard();
        });
        if (showBoard) {
            this.leaderboardFromMenu = false;
            this._pendingHighlight = name;
            this.audio.play('sfx_menu_click');
            this.setState(GameState.LEADERBOARD);
        }
    }

    _confirmNameInput() { this._submitScore(this.nameInput, true); }

    // Сепарация врагов через сетку (Game::update)
    separateEnemies(px, py) {
        const CELL = C.CELL_SIZE;
        const cols = Math.ceil(C.ARENA_WIDTH / CELL);
        const rows = Math.ceil(C.ARENA_HEIGHT / CELL);
        const grid = new Array(cols * rows);
        const idx = (x, y) => {
            let c = Math.floor(x / CELL), r = Math.floor(y / CELL);
            c = clamp(c, 0, cols - 1); r = clamp(r, 0, rows - 1);
            return r * cols + c;
        };
        for (const e of this.enemies) {
            const i = idx(e.sprite.x, e.sprite.y);
            (grid[i] || (grid[i] = [])).push(e);
        }
        const R = 1440000;
        for (let ei = 0; ei < this.enemies.length; ei++) {
            const e = this.enemies[ei];
            if (distSq(e.sprite.x, e.sprite.y, px, py) > R) continue;
            const col = Math.floor(e.sprite.x / CELL), row = Math.floor(e.sprite.y / CELL);
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = col - 1; c <= col + 1; c++) {
                    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
                    const cell = grid[r * cols + c];
                    if (!cell) continue;
                    for (const other of cell) {
                        if (e === other) continue;
                        if (e._id >= other._id) continue; // обрабатываем пару один раз (замена &enemy >= other)
                        if (distSq(other.sprite.x, other.sprite.y, px, py) > R) continue;
                        const dq = distSq(e.sprite.x, e.sprite.y, other.sprite.x, other.sprite.y);
                        const minOverlap = (e.isBoss || other.isBoss) ? 200 : 70;
                        if (dq < minOverlap * minOverlap && dq > 0.001) {
                            const d = Math.sqrt(dq);
                            const pdx = (e.sprite.x - other.sprite.x) / d;
                            const pdy = (e.sprite.y - other.sprite.y) / d;
                            const overlap = minOverlap - d;
                            if (e.isBoss) { other.sprite.x -= pdx * overlap * 0.5; other.sprite.y -= pdy * overlap * 0.5; }
                            else if (other.isBoss) { e.sprite.x += pdx * overlap * 0.5; e.sprite.y += pdy * overlap * 0.5; }
                            else {
                                e.sprite.x += pdx * overlap * 0.1; e.sprite.y += pdy * overlap * 0.1;
                                other.sprite.x -= pdx * overlap * 0.1; other.sprite.y -= pdy * overlap * 0.1;
                            }
                        }
                    }
                }
            }
        }
    }

    handleEnemyDeaths(px, py) {
        const s = this.save, p = this.player;
        for (const e of this.enemies) {
            if (e.hp > 0) continue;
            if ((s.permActiveArtifacts >> 3) & 1) {
                const cap = p.baseCritChance * 10;
                p.critChance = Math.min(cap, p.critChance + 0.005);
            }
            const ex = e.sprite.x, ey = e.sprite.y;
            if (e.type === EnemyType.GOBLIN) {
                for (let i = 0; i < 30; i++) this.particles.push(this.spawnParticle(ex, ey, randInt(2) === 0 ? rgb(180, 0, 255) : rgb(255, 0, 200)));
                for (let k = 0; k < 3; k++) this.gems.push(this.spawnGem(ex + randInt(40) - 20, ey + randInt(40) - 20));
                this.coins.push(this.spawnCoin(ex, ey));
                if (randInt(100) < 35) this.vinyls.push(this.spawnVinyl(ex, ey));
                continue;
            }
            const particleCount = e.isBoss2 ? 300 : (e.isBoss ? 200 : 15);
            const c1 = e.isBoss2 ? rgb(200, 0, 255) : rgb(255, 20, 50);
            const c2 = e.isBoss2 ? rgb(255, 100, 0) : rgb(255, 0, 150);
            for (let i = 0; i < particleCount; i++) this.particles.push(this.spawnParticle(ex, ey, randInt(2) === 0 ? c1 : c2));

            if (e.isBoss2) {
                this.triggerShake(0.8, 60);
                this.audio.play('sfx_boss_death', { volume: 1 });
                this.bossSouls.push(new BossSoul(this, ex, ey, 2));
                for (let k = 0; k < 17; k++) {
                    this.gems.push(this.spawnGem(ex + randInt(150) - 75, ey + randInt(150) - 75));
                    this.coins.push(this.spawnCoin(ex + randInt(150) - 75, ey + randInt(150) - 75));
                }
                for (let k = 0; k < 2; k++) this.vinyls.push(this.spawnVinyl(ex + randInt(80) - 40, ey + randInt(80) - 40));
            } else if (e.isBoss) {
                this.triggerShake(0.6, 40);
                this.audio.play('sfx_boss_death', { volume: 0.9 });
                for (let k = 0; k < 15; k++) {
                    this.gems.push(this.spawnGem(ex + randInt(150) - 75, ey + randInt(150) - 75));
                    this.coins.push(this.spawnCoin(ex + randInt(150) - 75, ey + randInt(150) - 75));
                }
                for (let k = 0; k < 2; k++) this.vinyls.push(this.spawnVinyl(ex + randInt(80) - 40, ey + randInt(80) - 40));
                this.bossSouls.push(new BossSoul(this, ex, ey, 1));
                if (this.gamePhase === GamePhase.PHASE_1) this.gamePhase = GamePhase.CLEARING;
            } else {
                this.gems.push(this.spawnGem(ex, ey));
                if (randInt(100) < 30) this.coins.push(this.spawnCoin(ex, ey));
                if (randInt(100) < 2) this.vinyls.push(this.spawnVinyl(ex, ey));
            }
        }
    }

    // ===================== СПОСОБНОСТИ (activateAbility) =====================
    activateAbility(slot) {
        if (slot < 0 || slot > 2) return;
        const id = this.equippedAbilities[slot];
        if (id < 0 || this.abilityCooldowns[slot] > 0) return;
        const p = this.player, px = p.sprite.x, py = p.sprite.y;

        if (id === 0) { p.isInvincible = true; p.invincibilityTimer = 2; }
        else if (id === 1) {
            const slamDmg = 8;
            for (const e of this.enemies) {
                const dq = distSq(e.sprite.x, e.sprite.y, px, py);
                if (dq < C.SLAM_RADIUS * C.SLAM_RADIUS && dq > 0.001) {
                    e.hp -= slamDmg; e.hitFlashTimer = 0.12;
                    const d = Math.sqrt(dq);
                    e.sprite.x += (e.sprite.x - px) / d * 380;
                    e.sprite.y += (e.sprite.y - py) / d * 380;
                    this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, slamDmg, false));
                }
            }
            for (let i = 0; i < 60; i++) {
                const angle = randInt(360) * Math.PI / 180;
                const part = this.spawnParticle(px, py, randInt(2) === 0 ? rgb(255, 140, 0) : rgb(255, 60, 0));
                const spd = randInt(350) + 200;
                part.vx = Math.cos(angle) * spd; part.vy = Math.sin(angle) * spd;
                part.maxLifetime = 0.5; part.lifetime = 0.5;
                this.particles.push(part);
            }
            this.slamRingCenter = { x: px, y: py };
            this.slamRingTimer = 0;
            this.triggerShake(0.4, 30);
            this.audio.play('sfx_slam', { volume: 0.8 });
        } else if (id === 2) {
            for (let d = 0; d < 12; d++) {
                const angle = d * (2 * Math.PI / 12);
                this.bullets.push(this.spawnBullet(px, py, Math.cos(angle), Math.sin(angle), 5, false));
            }
        }
        this.abilityCooldowns[slot] = ABILITY_COOLDOWNS[id] || 1;
        this.abilityMaxCooldowns[slot] = this.abilityCooldowns[slot];
    }

    // ===================== LEVEL UP =====================
    triggerLevelUp() {
        const p = this.player;
        p.level++;
        p.currentXP -= p.xpToNextLevel;
        p.xpToNextLevel *= 1.5;
        p.hp = p.maxHp;
        this.levelUpAnimTimer = 0;
        const id1 = randInt(5);
        let id2, id3;
        do { id2 = randInt(5); } while (id2 === id1);
        do { id3 = randInt(5); } while (id3 === id1 || id3 === id2);
        this.levelUpIds = [id1, id2, id3];
        this.selectedLevelUpIndex = -1;
        this.audio.play('sfx_levelup', { volume: 0.55 });
        this.setState(GameState.LEVEL_UP);
    }

    applyUpgrade(id) {
        const p = this.player;
        if (id === 0 && p.shootCooldown > 0.15) p.shootCooldown -= 0.05;
        else if (id === 1) p.attackDamage += 1;
        else if (id === 2 && p.speed < 400) p.speed += 20;
        else if (id === 3 && p.pickupRadius < 600) p.pickupRadius += 100;
        else if (id === 4) { p.maxHp += 1; p.hp = p.maxHp; }
        p.lastUpgradeId = id;
        p.messageTimer = 2.0;
        if (id >= 0 && id < 5) this.runUpgradeLevels[id]++;
        this.selectedLevelUpIndex = -1;
        this.setState(GameState.PLAYING);
    }

    // ===================== ТАБЛИЦА РЕКОРДОВ =====================
    // Подтянуть общий топ-10 из Supabase (если настроен) и обновить экран.
    _refreshRemoteLeaderboard() {
        if (!RemoteLeaderboard.configured()) return;
        RemoteLeaderboard.fetchTop(10, (rows) => {
            if (!rows) return; // ошибка/оффлайн — оставляем локальную таблицу
            const lb = [];
            for (let i = 0; i < 10; i++) lb.push(rows[i] || { name: '', time: 0, day: 0, month: 0, year: 0 });
            this.leaderboard = lb;
            this.leaderboardNewEntryIndex = -1;
            const h = this._pendingHighlight; // имя игрока (одна запись на игрока)
            if (h) for (let i = 0; i < 10; i++) {
                if (lb[i].name === h) { this.leaderboardNewEntryIndex = i; break; }
            }
            if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
        });
    }

    qualifiesForLeaderboard(time) {
        for (let i = 0; i < 10; i++) if (this.leaderboard[i].time === 0 || time > this.leaderboard[i].time) return true;
        return false;
    }
    tryAddToLeaderboard(time, name) {
        let n = name || 'Anonymous';
        if (n.length > 23) n = n.slice(0, 23);
        const d = new Date();
        const entry = { name: n, time, day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
        // Действующие записи без пустышек.
        let list = this.leaderboard.filter(e => e.time > 0);
        // Одна запись на игрока — оставляем лучшее время.
        const existing = list.find(e => e.name === n);
        if (!existing) list.push(entry);
        else if (time > existing.time) { list = list.filter(e => e.name !== n); list.push(entry); }
        list.sort((a, b) => b.time - a.time);
        list = list.slice(0, 10);
        this.leaderboardNewEntryIndex = list.findIndex(e => e.name === n);
        while (list.length < 10) list.push({ name: '', time: 0, day: 0, month: 0, year: 0 });
        this.leaderboard = list;
        SaveSystem.saveLeaderboard(this.leaderboard);
    }

    // ===================== РЕНДЕР МИРА (FX) =====================
    drawWorldFx() {
        const g = this.worldFx;
        g.clear();
        // Трейлы пуль (PlayState.cpp: круги радиусом 8*ratio, alpha 180*ratio)
        for (const b of this.bullets) {
            const h = b.history;
            const n = h.length;
            if (n <= 0) continue;
            for (let i = 0; i < n; i++) {
                const ratio = i / n;
                const radius = 8 * ratio;
                const alpha = (180 * ratio) / 255;
                const col = b.isCrit ? rgb(255, 200, 0) : rgb(0, 255, 255);
                g.fillStyle(col, alpha);
                g.fillCircle(h[i].x, h[i].y, radius);
            }
        }
        // Кольцо Ground Slam
        if (this.slamRingTimer >= 0) {
            const t = this.slamRingTimer / C.SLAM_RING_DURATION;
            const r = C.SLAM_RADIUS * t;
            const alpha = (1 - t * t);
            g.lineStyle(8, rgb(255, 160, 0), alpha * 0.5);
            g.strokeCircle(this.slamRingCenter.x, this.slamRingCenter.y, r + 6);
            g.lineStyle(3, rgb(255, 220, 80), alpha);
            g.strokeCircle(this.slamRingCenter.x, this.slamRingCenter.y, r);
        }
    }

    // ===================== ОВЕРЛЕИ ИГРЫ (Game::render) =====================
    drawPlayingOverlays() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, p = this.player;

        // Сообщение об апгрейде над игроком
        if (p.messageTimer > 0 && !this.isGameOver) {
            const titles = ['UPGRADE: Fire Rate +', 'UPGRADE: Damage +', 'UPGRADE: Speed +', 'UPGRADE: Magnet +', 'UPGRADE: Max HP +1'];
            const str = titles[p.lastUpgradeId] || '';
            this.upgradeMsg.setText(str).setVisible(true);
            this.upgradeMsg.setPosition(p.sprite.x, p.sprite.y - 80 - (2.0 - p.messageTimer) * 20);
            this.upgradeMsg.setAlpha(p.messageTimer / 2.0);
        } else this.upgradeMsg.setVisible(false);

        // Фейд перехода фаз
        if (this.phaseTransitionTimer >= 0) {
            const t = this.phaseTransitionTimer;
            const fadeIn = Math.min(t / 0.7, 1);
            const fadeOut = (t > 0.7) ? 1 - Math.min((t - 0.7) / 0.8, 1) : 1;
            this.fadeRect.setVisible(true).setFillStyle(0x000000, Math.min(fadeIn, fadeOut));
        } else if (this.fadeAlpha <= 0) {
            this.fadeRect.setVisible(false);
        }

        // Уведомление о фазе
        if (this.activeStep > 0 && this.phaseNotifTimer < 3.5 && !this.isGameOver) {
            const alpha = this.phaseNotifTimer > 2.5 ? 1 - (this.phaseNotifTimer - 2.5) : 1;
            let col = '#00ffc8';
            if (this.activeStep === 2) col = '#ff5050'; else if (this.activeStep === 3) col = '#ff8c00';
            this.phaseOverlay.setVisible(true).setFillStyle(0x000000, 170 / 255 * alpha);
            this.phaseText.setVisible(true).setText('PHASE  ' + this.activeStep).setColor(col).setAlpha(alpha);
        } else { this.phaseOverlay.setVisible(false); this.phaseText.setVisible(false); }

        // Подсказка зачистки
        if ((this.gamePhase === GamePhase.CLEARING || (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)) && !this.isGameOver) {
            this.clearText.setVisible(true).setText('CLEAR ALL ENEMIES  [' + this.enemies.length + ' left]');
        } else this.clearText.setVisible(false);

        // Предупреждения перед боссом
        let warnA = 0, warnCol = 0xff0000;
        if (this.survivalTimer > 60 && this.survivalTimer < 63 && !this.isGameOver) {
            warnA = Math.abs(Math.sin(this.survivalTimer * 10)) * 100 / 255; warnCol = 0xff0000;
        } else if (this.gamePhase === GamePhase.PHASE_2 && this.phase2Timer > 57 && this.phase2Timer < 60 && !this.phase2BossSpawned && !this.isGameOver) {
            warnA = Math.abs(Math.sin(this.phase2Timer * 10)) * 110 / 255; warnCol = 0x8200ff;
        }
        this.warnRect.setVisible(warnA > 0).setFillStyle(warnCol, warnA);
    }

    // ===================== АНИМАЦИЯ LEVEL UP =====================
    _animateLevelUp() {
        if (!this.levelUpCards) return;
        const t = this.levelUpAnimTimer;
        const easeOut = 1 - (1 - t) * (1 - t) * (1 - t);
        const yOffset = (1 - easeOut) * 1000;
        for (let i = 0; i < 3; i++) {
            const card = this.levelUpCards[i];
            let scale = 0.95 + 0.05 * easeOut;
            if (this.selectedLevelUpIndex === i) scale = 1.05;
            card.objs.forEach((o, idx) => {
                o.y = card.baseY[idx] + yOffset;
                o.setScale(scale * (card.baseSX ? card.baseSX[idx] : 1));
            });
            card.rect.setStrokeStyle(5, this.selectedLevelUpIndex === i ? 0xffc800 : 0x9600ff);
        }
    }

    // ===================== МЕНЮ / UI =====================
    _clearMenu() { this.menuObjs.forEach(o => o.destroy()); this.menuObjs = []; }
    _mAdd(o) { this.addUI(o); this.menuObjs.push(o); return o; }
    _mText(x, y, str, size, color, ox, oy, stroke, strokeW) {
        const t = this.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: color, stroke: stroke || '#000', strokeThickness: strokeW === undefined ? 2 : strokeW, align: 'center' });
        t.setOrigin(ox === undefined ? 0.5 : ox, oy === undefined ? 0.5 : oy);
        return this._mAdd(t);
    }

    rebuildMenu() {
        this._clearMenu();
        if (this.shop) this.shop.hide();
        const st = this.currentState;
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;

        const showBg = (st === GameState.MENU || st === GameState.SETTINGS || st === GameState.LOBBY || st === GameState.LEADERBOARD);
        this.menuBg.setVisible(showBg);
        this.lobbyPlayer.setVisible(st === GameState.LOBBY);
        const hudVisible = (st === GameState.PLAYING || st === GameState.PAUSED || st === GameState.LEVEL_UP || st === GameState.ABILITY_SELECT);
        this.hud.setVisible(hudVisible);

        // Скрыть динамические оверлеи вне активной игры
        if (st !== GameState.PLAYING) {
            this.phaseText.setVisible(false);
            this.phaseOverlay.setVisible(false);
            this.clearText.setVisible(false);
            this.warnRect.setVisible(false);
            this.upgradeMsg.setVisible(false);
        }

        if (st === GameState.MENU) this._buildMenuScreen();
        else if (st === GameState.LOBBY) this._buildLobby();
        else if (st === GameState.SHOP) this.shop.show();
        else if (st === GameState.SETTINGS) this._buildSettings();
        else if (st === GameState.LEADERBOARD) this._buildLeaderboard();
        else if (st === GameState.PAUSED) this._buildPause();
        else if (st === GameState.LEVEL_UP) this._buildLevelUp();
        else if (st === GameState.ABILITY_SELECT) this._buildAbilitySelect();
        else if (st === GameState.NAME_INPUT) this._buildNameInput();
        else if (st === GameState.PLAYING && this.isGameOver) this._buildGameOver();
    }

    _buildMenuScreen() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mText(W / 2, H * 0.15, 'AwParty', 150, '#00ffc8', 0.5, 0.5, '#ffffff', 2);
        const items = ['Play', 'Records', 'Settings'];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedMenuIndex;
            this._mText(W / 2, H * 0.45 + i * 110, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 75 : 60, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2);
        }
    }

    _buildLobby() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this.lobbyPlayer.setPosition(W * 0.25, H * 0.55).setScale(1.2);
        this._mText(W * 0.7, H * 0.15, 'HUB', 100, '#00ffc8', 0.5, 0.5, '#ff0096', 4);
        const coin = this._mAdd(this.add.sprite(W * 0.7 - 70, H * 0.27, 'coin').setOrigin(0.5, 0.5));
        coin.setDisplaySize(50, 50);
        this._mText(W * 0.7 - 30, H * 0.25, '' + this.save.totalCoins, 50, '#ffff00', 0, 0.5);
        const items = ['START RUN', 'UPGRADES & SHOP', 'Back to Menu'];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedLobbyIndex;
            this._mText(W * 0.7, H * 0.45 + i * 110, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 75 : 60, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2);
        }
    }

    _buildSettings() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, s = this.save;
        this._mText(W / 2, H * 0.15, 'AwParty', 150, '#00ffc8', 0.5, 0.5, '#ffffff', 2);
        const fps = C.FPS_LIMITS[s.currentFpsIndex];
        const items = [
            'Hardcore Mode: ' + (s.isHardcoreMode ? 'ON' : 'OFF'),
            'FPS Limit: < ' + (fps === 0 ? 'UNCAPPED' : fps) + ' >',
            'Window Mode: < ' + (s.isFullscreen ? 'FULLSCREEN' : 'WINDOWED') + ' >',
            'Sound: < ' + s.soundVolume + '% >',
            'Effects: < ' + s.effectsVolume + '% >',
            'Back',
        ];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedSettingIndex;
            this._mText(W / 2, H * 0.30 + i * 110, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 65 : 55, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2);
        }
        if (this.cheatMessageTimer > 0) this._mText(50, H - 110, this.cheatMessage, 28, '#ffff00', 0, 0);
    }

    _buildLeaderboard() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x000000, 160 / 255).setOrigin(0, 0));
        this._mText(W / 2, 50, 'RECORDS', 100, '#ffd700', 0.5, 0, '#b40050', 5);
        const rowY0 = 195, rowH = 56;
        const colX = [W * 0.10, W * 0.20, W * 0.58, W * 0.78];
        const hdrs = ['#', 'NAME', 'TIME', 'DATE'];
        for (let i = 0; i < 4; i++) this._mText(colX[i], rowY0 - 40, hdrs[i], 26, '#00ffc8', 0, 0);
        for (let i = 0; i < 10; i++) {
            const y = rowY0 + i * rowH;
            const e = this.leaderboard[i];
            const isNew = i === this.leaderboardNewEntryIndex;
            const col = e.time > 0 ? (isNew ? '#ffd700' : '#dcd7eb') : '#504b5f';
            this._mText(colX[0], y, '' + (i + 1), 30, col, 0, 0);
            if (e.time > 0) {
                this._mText(colX[1], y, e.name, 30, col, 0, 0);
                this._mText(colX[2], y, formatTime(e.time), 30, col, 0, 0);
                const pad = (n) => (n < 10 ? '0' + n : '' + n);
                this._mText(colX[3], y, pad(e.day) + '.' + pad(e.month) + '.' + e.year, 30, col, 0, 0);
            } else this._mText(colX[1], y, '---', 30, col, 0, 0);
        }
        this._mText(W / 2, H * 0.9, '[ ESC / ENTER  -  Back ]', 36, '#00ffc8', 0.5, 0);
    }

    _buildPause() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 200 / 255).setOrigin(0, 0));
        this._mText(W / 2, H / 2 - 150, 'PAUSED', 130, '#ffffff', 0.5, 0.5, '#000', 3);
        const items = ['Resume', 'Restart', 'Quit to Hub'];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedPauseIndex;
            this._mText(W / 2, H / 2 + 50 + i * 100, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 70 : 55, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2);
        }
    }

    _buildGameOver() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x1e000a, 220 / 255).setOrigin(0, 0));
        this._mText(W / 2, H / 2, "GAME OVER\nPress 'R' to Restart\nPress 'Q' for Hub", 80, '#ffffff', 0.5, 0.5, '#000', 3);
        this._mText(W / 2, H / 2 + 220, 'L  -  View Records', 32, '#00ffc8', 0.5, 0);
    }

    _buildNameInput() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 230 / 255).setOrigin(0, 0));
        this._mText(W / 2, H * 0.22, 'NEW RECORD!', 110, '#ffd700', 0.5, 0.5, '#b40050', 5);
        this._mText(W / 2, H * 0.36, 'Time Survived:  ' + formatTime(this.survivalTimer), 46, '#00ffc8', 0.5, 0.5, '#000', 3);
        this._mText(W / 2, H * 0.48, 'Enter your name:', 38, '#dcd7eb', 0.5, 0.5, '#000', 2);

        // Поле ввода + текст с курсором-подчёркиванием.
        const boxW = 760, boxH = 96, boxY = H * 0.58;
        this._mAdd(this.add.rectangle(W / 2, boxY, boxW, boxH, 0x140028, 1).setOrigin(0.5, 0.5).setStrokeStyle(3, 0x9600ff));
        this._mText(W / 2, boxY, this.nameInput + '_', 50, '#ffffff', 0.5, 0.5, '#000', 2);

        this._mText(W / 2, H * 0.74, 'ENTER  -  Confirm        BACKSPACE  -  Erase', 30, '#7d78a0', 0.5, 0.5, '#000', 2);
    }

    _buildLevelUp() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 220 / 255).setOrigin(0, 0));
        this._mText(W / 2, 150, 'LEVEL UP!', 100, '#ffff00', 0.5, 0.5, '#ff0096', 5);
        this.levelUpCards = [];
        for (let i = 0; i < 3; i++) {
            const uId = this.levelUpIds[i];
            const cx = W / 2 + (i - 1) * 450;
            const cy = H / 2 + 50;
            const rect = this._mAdd(this.add.rectangle(cx, cy, 400, 550, 0x140028, 240 / 255).setOrigin(0.5, 0.5).setStrokeStyle(5, 0x9600ff));
            const title = this._mText(cx, cy - 230, UPGRADE_TITLES[uId], 35, '#00ffc8', 0.5, 0);
            const icon = this._mAdd(this.add.sprite(cx, cy - 30, UPGRADE_ICONS[uId]).setOrigin(0.5, 0.5));
            const iscale = 180 / icon.width;
            icon.setScale(iscale);
            const desc = this._mText(cx, cy + 110, UPGRADE_DESCS[uId], 25, '#ffffff', 0.5, 0);
            let starsObj = null;
            const cnt = this.runUpgradeLevels[uId];
            if (cnt > 0) {
                let stars = '';
                for (let s = 0; s < cnt; s++) stars += '*';
                starsObj = this._mText(cx, cy + 215, stars, 28, '#ffd200', 0.5, 0.5, '#643c00', 2);
            }
            const objs = [rect, title, icon, desc]; if (starsObj) objs.push(starsObj);
            const baseY = objs.map(o => o.y);
            const baseSX = [1, 1, iscale, 1]; if (starsObj) baseSX.push(1);
            this.levelUpCards.push({ rect, objs, baseY, baseSX, uId });
        }
        this._animateLevelUp();
    }

    _buildAbilitySelect() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x080014, 210 / 255).setOrigin(0, 0));
        this._mText(W / 2, 130, 'CHOOSE AN ABILITY', 80, '#dcb4ff', 0.5, 0.5, '#000', 4);
        const count = this.pendingAbilityCount;
        const gap = 430, cardW = 360, cardH = 560;
        const totalW = (count - 1) * gap;
        const startX = W / 2 - totalW / 2;
        const cy = H / 2 + 20;
        const keyLabels = ['[Q]', '[E]', '[R]'];
        const colHex = { 0: '#ffd700', 1: '#ff5000', 2: '#b400ff' };
        this.abilityCards = [];
        for (let i = 0; i < count; i++) {
            const id = this.pendingAbilityIds[i];
            const cx = startX + i * gap;
            const rect = this._mAdd(this.add.rectangle(cx, cy, cardW, cardH, 0x120024, 245 / 255).setOrigin(0.5, 0.5).setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(colHex[id]).color));
            const title = this._mText(cx, cy - cardH / 2 + 28, ABILITY_NAMES[id], 38, colHex[id], 0.5, 0, '#000', 3);
            const objs = [rect, title];
            const baseSX = [1, 1];
            const iconKey = ABILITY_ICONS[id];
            if (iconKey && this.textures.exists(iconKey)) {
                const icon = this._mAdd(this.add.sprite(cx, cy - cardH / 2 + 160, iconKey).setOrigin(0.5, 0.5));
                const iscale = 110 / Math.max(icon.width, icon.height);
                icon.setScale(iscale);
                objs.push(icon); baseSX.push(iscale);
            }
            const cd = ABILITY_COOLDOWNS[id];
            let desc = '';
            if (id === 0) desc = 'Become invulnerable\nfor 2 seconds.\n\nCooldown: ' + cd + 's';
            else if (id === 1) desc = 'Slam the ground to\ndamage and knock back\nnearby enemies.\n\nCooldown: ' + cd + 's';
            else if (id === 2) desc = 'Unleash 12 vinyl discs\nin all directions.\n\nCooldown: ' + cd + 's';
            const descObj = this._mText(cx, cy - cardH / 2 + 295, desc, 22, '#c8c3dc', 0.5, 0, '#000', 2);
            const slot = this.pendingSlot;
            const keyObj = this._mText(cx, cy + cardH / 2 - 70, (slot >= 0 && slot < 3) ? keyLabels[slot] : '[?]', 32, '#00f0c8', 0.5, 0, '#000', 2);
            objs.push(descObj, keyObj); baseSX.push(1, 1);
            this.abilityCards.push({ rect, id, cx, cy, w: cardW, h: cardH, objs, baseSX, stroke: Phaser.Display.Color.HexStringToColor(colHex[id]).color });
        }
        this._highlightAbility();
    }

    _highlightAbility() {
        if (!this.abilityCards) return;
        for (let i = 0; i < this.abilityCards.length; i++) {
            const card = this.abilityCards[i];
            const sel = (i === this.selectedAbilityIndex);
            const scale = sel ? 1.05 : 1;
            card.objs.forEach((o, idx) => o.setScale(scale * card.baseSX[idx]));
            card.rect.setStrokeStyle(sel ? 6 : 4, sel ? 0xffffff : card.stroke);
        }
    }

    // ===================== ВВОД =====================
    onPointerMove(p) {
        const st = this.currentState;
        const x = p.x, y = p.y;
        const hit = (rx, ry, rw, rh) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;

        if (st === GameState.MENU) {
            let ns = -1;
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 200, H * 0.45 + i * 110 - 40, 400, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedMenuIndex) { this.selectedMenuIndex = ns; this.rebuildMenu(); }
        } else if (st === GameState.SETTINGS) {
            let ns = -1;
            for (let i = 0; i < 6; i++) if (hit(W / 2 - 300, H * 0.30 + i * 110 - 40, 600, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedSettingIndex) { this.selectedSettingIndex = ns; this.rebuildMenu(); }
        } else if (st === GameState.LOBBY) {
            let ns = -1;
            for (let i = 0; i < 3; i++) if (hit(W * 0.7 - 250, H * 0.45 + i * 110 - 40, 500, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedLobbyIndex) { this.selectedLobbyIndex = ns; this.rebuildMenu(); }
        } else if (st === GameState.PAUSED) {
            let ns = -1;
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 250, H / 2 + 50 + i * 100 - 40, 500, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedPauseIndex) { this.selectedPauseIndex = ns; this.rebuildMenu(); }
        } else if (st === GameState.SHOP) {
            this.shop.updateHover(x, y);
        } else if (st === GameState.LEVEL_UP) {
            if (this.levelUpAnimTimer >= 1) {
                let ns = -1;
                for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) ns = i; }
                this.selectedLevelUpIndex = ns;
            }
        } else if (st === GameState.ABILITY_SELECT) {
            if (this.abilitySelectAnimTimer >= 0.5 && this.abilityCards) {
                let ns = -1;
                for (let i = 0; i < this.abilityCards.length; i++) {
                    const card = this.abilityCards[i];
                    if (hit(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h)) ns = i;
                }
                if (ns !== this.selectedAbilityIndex) { this.selectedAbilityIndex = ns; this._highlightAbility(); }
            }
        }
    }

    onPointerDown(p) {
        const st = this.currentState;
        const x = p.x, y = p.y;
        const hit = (rx, ry, rw, rh) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;

        if (st === GameState.MENU) {
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 200, H * 0.45 + i * 110 - 40, 400, 80)) { this.selectedMenuIndex = i; this._menuActivate(); return; }
        } else if (st === GameState.LEADERBOARD) {
            if (hit(W / 2 - 150, H * 0.9 - 30, 300, 60)) this.setState(this.leaderboardFromMenu ? GameState.MENU : GameState.LOBBY);
        } else if (st === GameState.SETTINGS) {
            for (let i = 0; i < 6; i++) if (hit(W / 2 - 300, H * 0.30 + i * 110 - 40, 600, 80)) { this.selectedSettingIndex = i; this._settingsActivate(); return; }
        } else if (st === GameState.PAUSED) {
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 250, H / 2 + 50 + i * 100 - 40, 500, 80)) { this.selectedPauseIndex = i; this._pauseActivate(); return; }
        } else if (st === GameState.LOBBY) {
            for (let i = 0; i < 3; i++) if (hit(W * 0.7 - 250, H * 0.45 + i * 110 - 40, 500, 80)) { this.selectedLobbyIndex = i; this._lobbyActivate(); return; }
        } else if (st === GameState.SHOP) {
            const r = this.shop.handleClick(x, y);
            if (r === 'back') { this.audio.play('sfx_menu_click'); this.saveGame(); this.setState(GameState.LOBBY); }
        } else if (st === GameState.LEVEL_UP) {
            if (this.levelUpAnimTimer >= 1) {
                for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) { this.applyUpgrade(this.levelUpIds[i]); return; } }
            }
        } else if (st === GameState.ABILITY_SELECT) {
            if (this.abilitySelectAnimTimer >= 0.5 && this.abilityCards) {
                for (const card of this.abilityCards) {
                    if (hit(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h)) { this._chooseAbility(card.id); return; }
                }
            }
        }
    }

    _chooseAbility(id) {
        for (let sIdx = 0; sIdx < 3; sIdx++) {
            if (this.equippedAbilities[sIdx] < 0) {
                this.equippedAbilities[sIdx] = id;
                this.abilityCooldowns[sIdx] = 0;
                this.abilityMaxCooldowns[sIdx] = ABILITY_COOLDOWNS[id] || 1;
                break;
            }
        }
        this.pendingAbilityCount = 0;
        this.setState(GameState.PLAYING);
    }

    _menuActivate() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedMenuIndex;
        if (i === 0) this.setState(GameState.LOBBY);
        else if (i === 1) { this.leaderboardFromMenu = true; this.leaderboardNewEntryIndex = -1; this._pendingHighlight = null; this.setState(GameState.LEADERBOARD); }
        else if (i === 2) this.setState(GameState.SETTINGS);
    }
    _lobbyActivate() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedLobbyIndex;
        if (i === 0) { this.resetGame(); this.setState(GameState.PLAYING); }
        else if (i === 1) { this.shop.reset(); this.setState(GameState.SHOP); }
        else if (i === 2) { this.saveGame(); this.setState(GameState.MENU); }
    }
    _settingsActivate() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedSettingIndex, s = this.save;
        if (i === 0) { s.isHardcoreMode = !s.isHardcoreMode; this.saveGame(); this.rebuildMenu(); }
        else if (i === 1) { s.currentFpsIndex = (s.currentFpsIndex + 1) % 5; this.saveGame(); this.rebuildMenu(); }
        else if (i === 2) { s.isFullscreen = !s.isFullscreen; if (s.isFullscreen) { if (!this.scale.isFullscreen) this.scale.startFullscreen(); } else if (this.scale.isFullscreen) this.scale.stopFullscreen(); this.saveGame(); this.rebuildMenu(); }
        else if (i === 3) { this._adjustVolume('sound', +1); }
        else if (i === 4) { this._adjustVolume('effects', +1); }
        else if (i === 5) { this.saveGame(); this.setState(GameState.MENU); }
    }

    // Изменить громкость на dir*10 (с обёрткой 0..100), применить к аудио и сохранить.
    _adjustVolume(which, dir) {
        const s = this.save;
        if (which === 'sound') {
            s.soundVolume = (s.soundVolume + dir * 10 + 110) % 110;
            this.audio.setMusicVolume(s.soundVolume / 100);
        } else {
            s.effectsVolume = (s.effectsVolume + dir * 10 + 110) % 110;
            this.audio.sfxVolume = s.effectsVolume / 100;
            this.audio.play('sfx_menu_click'); // звуковой предпросмотр громкости SFX
        }
        this.saveGame();
        this.rebuildMenu();
    }
    _pauseActivate() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedPauseIndex;
        if (i === 0) this.setState(GameState.PLAYING);
        else if (i === 1) { this.resetGame(); this.setState(GameState.PLAYING); }
        else if (i === 2) { this.saveGame(); this.setState(GameState.LOBBY); }
    }

    onKeyDown(e) {
        const st = this.currentState;
        const code = e.code; // 'KeyW' и т.п.
        const up = (code === 'KeyW' || code === 'ArrowUp');
        const down = (code === 'KeyS' || code === 'ArrowDown');
        const left = (code === 'KeyA' || code === 'ArrowLeft');
        const right = (code === 'KeyD' || code === 'ArrowRight');
        const enter = (code === 'Enter' || code === 'Space');
        const esc = (code === 'Escape');

        if (st === GameState.MENU) {
            if (up) { this.selectedMenuIndex = (this.selectedMenuIndex + 2) % 3; this.rebuildMenu(); }
            if (down) { this.selectedMenuIndex = (this.selectedMenuIndex + 1) % 3; this.rebuildMenu(); }
            if (enter) this._menuActivate();
        } else if (st === GameState.LOBBY) {
            if (up) { this.selectedLobbyIndex = (this.selectedLobbyIndex + 2) % 3; this.rebuildMenu(); }
            if (down) { this.selectedLobbyIndex = (this.selectedLobbyIndex + 1) % 3; this.rebuildMenu(); }
            if (enter) this._lobbyActivate();
            if (esc) { this.saveGame(); this.setState(GameState.MENU); }
        } else if (st === GameState.SHOP) {
            if (up) { this.shop.navigate(-1, 0); this.shop.redraw(); }
            if (down) { this.shop.navigate(1, 0); this.shop.redraw(); }
            if (left) { this.shop.navigate(0, -1); this.shop.redraw(); }
            if (right) { this.shop.navigate(0, 1); this.shop.redraw(); }
            if (enter) { this.shop._buyAndNotify(); this.saveGame(); this.shop.redraw(); }
            if (esc) { this.audio.play('sfx_menu_click'); this.saveGame(); this.setState(GameState.LOBBY); }
        } else if (st === GameState.SETTINGS) {
            if (up) { this.selectedSettingIndex = (this.selectedSettingIndex + 5) % 6; this.rebuildMenu(); }
            if (down) { this.selectedSettingIndex = (this.selectedSettingIndex + 1) % 6; this.rebuildMenu(); }
            if (left && this.selectedSettingIndex === 1) { this.save.currentFpsIndex = (this.save.currentFpsIndex + 4) % 5; this.saveGame(); this.rebuildMenu(); }
            if (right && this.selectedSettingIndex === 1) { this.save.currentFpsIndex = (this.save.currentFpsIndex + 1) % 5; this.saveGame(); this.rebuildMenu(); }
            if (this.selectedSettingIndex === 3) { if (left) this._adjustVolume('sound', -1); if (right) this._adjustVolume('sound', +1); }
            if (this.selectedSettingIndex === 4) { if (left) this._adjustVolume('effects', -1); if (right) this._adjustVolume('effects', +1); }
            if (enter) this._settingsActivate();
            if (esc) { this.saveGame(); this.setState(GameState.MENU); }
            // Чит-код 'givecoin'
            if (e.key && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                this.cheatBuffer = (this.cheatBuffer + e.key.toLowerCase()).slice(-32);
                if (this.cheatBuffer.indexOf('givecoin') !== -1) {
                    this.save.totalCoins += 500; this.cheatMessage = 'Gave 500 coins'; this.cheatMessageTimer = 3;
                    this.saveGame(); this.cheatBuffer = ''; this.rebuildMenu();
                }
            }
        } else if (st === GameState.LEADERBOARD) {
            if (esc || code === 'Enter') this.setState(this.leaderboardFromMenu ? GameState.MENU : GameState.LOBBY);
        } else if (st === GameState.NAME_INPUT) {
            if (code === 'Backspace') { this.nameInput = this.nameInput.slice(0, -1); this.rebuildMenu(); if (e.preventDefault) e.preventDefault(); }
            else if (code === 'Enter' || code === 'Escape') { this._confirmNameInput(); }
            else if (e.key && e.key.length === 1) {
                const cc = e.key.charCodeAt(0);
                if (cc >= 32 && cc <= 126 && this.nameInput.length < 20) { this.nameInput += e.key; this.rebuildMenu(); }
            }
        } else if (st === GameState.PLAYING) {
            if (this.isGameOver) {
                if (code === 'KeyR') { this.saveGame(); this.resetGame(); this.rebuildMenu(); }
                if (code === 'KeyQ') { this.saveGame(); this.setState(GameState.LOBBY); }
                if (code === 'KeyL') { this.leaderboardFromMenu = false; this._pendingHighlight = null; this.setState(GameState.LEADERBOARD); }
            } else {
                if (esc) { this.selectedPauseIndex = 0; this.setState(GameState.PAUSED); }
                if (code === 'KeyQ') this.activateAbility(0);
                if (code === 'KeyE') this.activateAbility(1);
                if (code === 'KeyR') this.activateAbility(2);
            }
        } else if (st === GameState.PAUSED) {
            if (esc) this.setState(GameState.PLAYING);
            if (up) { this.selectedPauseIndex = (this.selectedPauseIndex + 2) % 3; this.rebuildMenu(); }
            if (down) { this.selectedPauseIndex = (this.selectedPauseIndex + 1) % 3; this.rebuildMenu(); }
            if (enter) this._pauseActivate();
        }
    }
}
