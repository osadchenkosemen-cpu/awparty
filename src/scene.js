
class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }

    preload() {
        this.load.setPath(C.ASSET_PATH);
        this.load.on('loaderror', () => {});
        for (const [key, file] of TEXTURE_MANIFEST) this.load.image(key, file);
        for (let d = 0; d < 4; d++) {
            for (let f = 1; f <= 6; f++) {
                this.load.image('panim_' + ANIM_DIRS[d] + f, 'player_' + ANIM_DIRS[d] + '_anim' + f + '.png');
            }
        }
        AudioManager.preload(this.load);
    }

    create() {
        this.save = SaveSystem.load();
        setLanguage(this.save.language);

        if (this.input && this.input.mouse) this.input.mouse.disableContextMenu();
        this.leaderboards = { normal: {}, hardcore: {} };
        for (let c = 1; c <= CHAPTERS.length; c++) {
            this.leaderboards.normal[c] = SaveSystem.loadLeaderboard('normal', c);
            this.leaderboards.hardcore[c] = SaveSystem.loadLeaderboard('hardcore', c);
        }
        this.lbView = 'normal';
        this.lbChapter = 1;
        this.lbSort = 'time';
        this._lastRank = null;

        this.worldLayer = this.add.layer();
        this.uiLayer = this.add.layer();

        this.cameras.main.setBounds(0, 0, C.ARENA_WIDTH, C.ARENA_HEIGHT);
        this.uiCam = this.cameras.add(0, 0, C.VIEW_WIDTH, C.VIEW_HEIGHT);
        this.cameras.main.ignore(this.uiLayer);
        this.uiCam.ignore(this.worldLayer);

        this.arena = this.addWorld(this.add.tileSprite(0, 0, C.ARENA_WIDTH, C.ARENA_HEIGHT, 'floor').setOrigin(0, 0));
        this.arenaBorder = this.addWorld(this.add.rectangle(0, 0, C.ARENA_WIDTH, C.ARENA_HEIGHT).setOrigin(0, 0));
        this.arenaBorder.setStrokeStyle(15, 0xff0032);
        this.arenaBorder.isFilled = false;
        this.arenaBorder.setVisible(false);

        this.worldFx = this.addWorld(this.add.graphics());
        this.worldFx.setDepth(5);

        this.enemies = [];
        this.bullets = [];
        this.enemyProjectiles = [];
        this.gems = [];
        this.coins = [];
        this.vinyls = [];
        this.particles = [];
        this.dmgTexts = [];
        this.bossSouls = [];
        this.skulls = [];
        this.bombs = [];
        this.soundWaves = [];

        this.pools = { bullet: [], eproj: [], gem: [], coin: [], vinyl: [], particle: [], dmgText: [] };

        this.player = new Player(this);
        this.player.sprite.setDepth(10);
        this.cameras.main.startFollow(this.player.sprite, false, 1, 1);

        this.spawner = new EnemySpawner();
        this.hud = new HUD(this);
        this.shop = new Shop(this);

        this.currentState = GameState.MENU;
        this.isGameOver = false;
        this.globalTime = 0;
        this.fadeAlpha = 0;
        this.levelUpAnimTimer = 0;
        this.abilitySelectAnimTimer = 0;

        this.survivalTimer = 0;
        this.vinylSpawnTimer = 0;
        this.gamePhase = GamePhase.PHASE_1;
        this.phaseNotifTimer = 0;
        this.activeStep = 1;
        this.currentChapter = 1;
        this.phase2Timer = 0;
        this.phase2BossSpawned = false;
        this.phase3Timer = 0;
        this.phase3BossSpawned = false;
        this.phaseTransitionTimer = -1;
        this.phaseEventFired = false;
        this.phaseKills = 0;

        this.crazyMode = false;
        this.portal = null;
        this.portalSprite = null;
        this.stageStats = [];
        this._stagePrev = { time: 0, kills: 0, coins: 0, score: 0 };
        this.runScore = 0;

        this.equippedAbilities = [-1, -1, -1];
        this.abilityCooldowns = [0, 0, 0];
        this.abilityMaxCooldowns = [0, 0, 0];
        this.pendingAbilityIds = [-1, -1, -1];
        this.pendingAbilityCount = 0;

        this.slamRingTimer = -1;
        this.slamRingCenter = { x: 0, y: 0 };
        this.playerBeam = null;

        this.bloodPactHealAcc = 0;
        this.coinCarry = 0;
        this.regenTimer = 0;
        this.shotsFired = 0;

        this.runUpgradeLevels = [0, 0, 0, 0, 0, 0, 0];

        this.selectedMenuIndex = 0;
        this.selectedSettingIndex = 0;
        this.selectedPauseIndex = 0;
        this.selectedLobbyIndex = 0;
        this.selectedChapterIndex = 0;
        this.selectedLevelUpIndex = -1;
        this.selectedAbilityIndex = -1;
        this.leaderboardFromMenu = false;
        this.leaderboardNewEntryIndex = -1;
        this.nameInput = '';
        this._pendingHighlight = null;
        this._nameError = '';
        this.renameInput = '';
        this._renameError = '';
        this._renameBusy = false;
        this.levelUpIds = [0, 1, 2];
        this.cheatBuffer = '';
        this.cheatMessage = '';
        this.cheatMessageTimer = 0;

        this.keys = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D', space: 'SPACE',
        });
        this.input.keyboard.on('keydown', (e) => this.onKeyDown(e));
        this.input.on('pointerdown', (p) => this.onPointerDown(p));
        this.input.on('pointermove', (p) => this.onPointerMove(p));

        this.menuObjs = [];
        this.menuBg = this.addUI(this.add.image(0, 0, 'menu_bg').setOrigin(0, 0));
        this.menuBg.setDisplaySize(C.VIEW_WIDTH, C.VIEW_HEIGHT);
        this.lobbyPlayer = this.addUI(this.add.sprite(0, 0, 'player_front').setOrigin(0.5, 0.5));

        this._buildOverlays();

        this.audio = new AudioManager(this);

        this.fadeAlpha = 255;
        this.rebuildMenu();
        this.updateCursor();
        this.audio.playMusic(this.audio.musicForState(this.currentState));

        this._refreshRemoteLeaderboard('normal');
        this._refreshRemoteLeaderboard('hardcore');

        if (window.__awHideLoader) window.__awHideLoader();
    }

    addWorld(o) { this.worldLayer.add(o); return o; }
    addUI(o) { this.uiLayer.add(o); return o; }
    _tex(key, fallback) { return this.textures.exists(key) ? key : fallback; }
    _applyChapterEnemy(e) {
        const ch = this.chapter; if (!ch) return;
        e.hp = Math.round(e.hp * ch.hpMult); e.maxHp = Math.round(e.maxHp * ch.hpMult);
        e.damage = Math.round(e.damage * ch.dmgMult);
    }
    _applyChapterBoss(e) {
        const ch = this.chapter; if (!ch) return;
        e.hp = Math.round(e.hp * ch.bossHpMult); e.maxHp = Math.round(e.maxHp * ch.bossHpMult);
        e.damage = Math.round(e.damage * ch.dmgMult);
    }

    _updateHypeAuras(dt) {
        let auras = null, docs = null;
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (e.type === EnemyType.HYPEMAN) (auras || (auras = [])).push(e);
            else if (e.isBossDoc) (docs || (docs = [])).push(e);
        }
        const H = C.HYPEMAN, r2 = H.AURA_RADIUS * H.AURA_RADIUS;
        const D = C.BOSSDOC, dr2 = D.AURA_RADIUS * D.AURA_RADIUS;
        for (const e of this.enemies) {
            if (e.isBoss || e.type === EnemyType.HYPEMAN || e.hp <= 0) continue;
            let inside = false;
            if (auras) {
                for (const h of auras) {
                    if (distSq(e.sprite.x, e.sprite.y, h.sprite.x, h.sprite.y) <= r2) { inside = true; break; }
                }
            }
            if (inside && !e.hyped) {
                e.hyped = true; e.maxHp += H.HP_BONUS; e.hp += H.HP_BONUS;
            } else if (!inside && e.hyped) {
                e.hyped = false; e.maxHp -= H.HP_BONUS; if (e.hp > e.maxHp) e.hp = e.maxHp;
            }
            if (e.hyped && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + H.REGEN * dt);
            let dInside = false;
            if (docs) {
                for (const dd of docs) {
                    if (distSq(e.sprite.x, e.sprite.y, dd.sprite.x, dd.sprite.y) <= dr2) { dInside = true; break; }
                }
            }
            if (dInside && !e.docHyped) {
                e.docHyped = true; e.maxHp += D.HP_BONUS; e.hp += D.HP_BONUS;
            } else if (!dInside && e.docHyped) {
                e.docHyped = false; e.maxHp -= D.HP_BONUS; if (e.hp > e.maxHp) e.hp = e.maxHp;
            }
            if (e.docHyped && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + D.REGEN * dt);
        }
    }

    _updateEncircleEvent(dt) {
        if (this.crazyMode || !this.chapter || !this.chapter.encircleEvent) return;
        let ph = 0;
        if (this.gamePhase === GamePhase.PHASE_1) ph = 1;
        else if (this.gamePhase === GamePhase.PHASE_2) ph = 2;
        else if (this.gamePhase === GamePhase.PHASE_3) ph = 3;
        else return;
        if (ph !== this._encPhase) {
            this._encPhase = ph; this._encTimer = 0; this._encDone = false;
            this._encAt = 20 + Math.random() * 20;
        }
        if (this._encDone) return;
        this._encTimer += dt;
        if (this._encTimer >= this._encAt) { this._encDone = true; this._spawnEncircle(); }
    }

    _spawnEncircle() {
        const px = this.player.sprite.x, py = this.player.sprite.y;
        const R = 1150, count = 36;
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            const x = clamp(px + Math.cos(ang) * R, 40, C.ARENA_WIDTH - 40);
            const y = clamp(py + Math.sin(ang) * R, 40, C.ARENA_HEIGHT - 40);
            const e = new Enemy(this, x, y, this._enemyKey);
            e.hp = 3; e.maxHp = 3;
            this._applyChapterEnemy(e);
            this.enemies.push(e);
        }
        this.triggerShake(0.3, 30);
    }
    saveGame() { SaveSystem.save(this.save); this._scheduleCloudBackup(); }

    _scheduleCloudBackup() {
        if (!CloudSave.configured() || !this.save.playerName) return;
        if (this._cloudBackupTimer) clearTimeout(this._cloudBackupTimer);
        this._cloudBackupTimer = setTimeout(() => {
            this._cloudBackupTimer = null;
            CloudSave.push(this.save.playerName, SaveSystem.cloudBlob(this.save));
        }, 2000);
    }

    restoreFromCloud(nick, cb) {
        CloudSave.pull(nick, (res) => {
            if (res === null) { cb('offline'); return; }
            if (res === 'NOTFOUND') { cb('notfound'); return; }
            SaveSystem.applyCloudMeta(this.save, res);
            this.save.playerName = (nick || '').slice(0, 20);
            this.saveGame();
            if (this.audio) this.audio.syncFromSave();
            cb('ok');
        });
    }
    hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

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

    _filterRelease(arr, poolKey, pred) {
        const pool = this.pools[poolKey];
        for (let i = arr.length - 1; i >= 0; i--) {
            if (pred(arr[i])) { arr[i].release(); pool.push(arr[i]); arr.splice(i, 1); }
        }
    }
    _releaseAll(arr, poolKey) {
        const pool = this.pools[poolKey];
        for (const o of arr) { o.release(); pool.push(o); }
        arr.length = 0;
    }

    _buildOverlays() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this.fadeRect = this.addUI(this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0));
        this.fadeRect.setDepth(100);
        this.warnRect = this.addUI(this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0, 0));
        this.warnRect.setDepth(90);
        this.warnText = this.addUI(this.add.text(W / 2, H / 2, '', { fontFamily: FONT, fontSize: '120px', color: '#ff0000', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5, 0.5)).setDepth(92).setVisible(false);
        this.phaseOverlay = this.addUI(this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0)).setDepth(91);
        this.phaseText = this.addUI(this.add.text(W / 2, H * 0.38, '', { fontFamily: FONT, fontSize: '110px', color: '#00ffc8', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5, 0.5)).setDepth(92);
        this.clearText = this.addUI(this.add.text(W / 2, 18, '', { fontFamily: FONT, fontSize: '30px', color: '#ff5050', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0)).setDepth(92);
        this.controlsHint = this.addUI(this.add.text(48, H / 2, '', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#000', strokeThickness: 3, align: 'left', lineSpacing: 12 }).setOrigin(0, 0.5)).setDepth(92).setVisible(false);
        this.upgradeMsg = this.addWorld(this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '40px', color: '#ffff00', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0.5)).setDepth(20);
        this.upgradeMsg.setVisible(false);
        this.bossArrowFx = this.addUI(this.add.graphics());
        this.bossArrowFx.setDepth(93);
        [this.fadeRect, this.warnRect, this.phaseOverlay, this.phaseText, this.clearText].forEach(o => o.setVisible(false));
    }

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
        p.armor = s.permArmor; p.damageAcc = 0;
        p.pickupRadius = hasArtifact(s, ARTIFACT.MAGNET_CORE) ? 99999 : 50 + s.permMagnet * 50;
        p.ironSkinCharges = hasArtifact(s, ARTIFACT.IRON_SKIN) ? 3 : 0;
        p.soulLeechCritBonus = 0;
        this.bloodPactHealAcc = 0;
        this.coinCarry = 0;

        if (hasArtifact(s, ARTIFACT.GLASS_CANNON)) { p.maxHp = Math.max(10, p.maxHp - 20); p.hp = p.maxHp; }

        p.level = 1; p.currentXP = 0; p.xpToNextLevel = 5; p.shootCooldown = 0.45;
        this.regenTimer = 0; this.shotsFired = 0;
        this.killCount = 0; this.coinsThisRun = 0; this.runScore = 0;
        p.sprite.setPosition(C.ARENA_WIDTH / 2, C.ARENA_HEIGHT / 2);
        p.isInvincible = false; p.invincibilityTimer = 0;
        p.bladeMail = false; p.pierce = false;

        this.survivalTimer = 0; this.vinylSpawnTimer = 0; this.phase2BossSpawned = false; this.phase3BossSpawned = false;
        this._boss3Alive = false;
        this._firstBossKilled = false;
        this.gamePhase = GamePhase.PHASE_1; this.phaseNotifTimer = 0; this.activeStep = 1;
        this.phase2Timer = 0; this.phase3Timer = 0; this.phaseTransitionTimer = -1; this.phaseEventFired = false;
        this.phaseKills = 0;
        this._encPhase = 0; this._encTimer = 0; this._encAt = 0; this._encDone = false;

        this.chapter = getChapter(this.currentChapter);
        this._enemyKey = this._tex(this.chapter.enemyKey, 'enemy');
        this._goblinKey = this._tex(this.chapter.goblinKey, 'enemyV');
        this._boss1Key = this._tex(this.chapter.boss1Key, 'enemy');
        this._boss2Key = this._tex(this.chapter.boss2Key, 'boss2');
        this._boss3Key = this._tex(this.chapter.boss3Key, 'boss3');
        this._subwooferKey = this.chapter.subwooferKey ? this._tex(this.chapter.subwooferKey, 'enemy2_sub') : null;
        this._mosherKey = this.chapter.mosherKey ? this._tex(this.chapter.mosherKey, 'enemy2_mosher') : null;
        this._hypemanKey = this.chapter.hypemanKey ? this._tex(this.chapter.hypemanKey, 'enemy2_hype') : null;
        const fk = this._tex(this.chapter.floorKey, 'floor');
        const usingOwnFloor = (fk === this.chapter.floorKey);
        this.arena.setTexture(fk);
        if (!usingOwnFloor && this.chapter.floorTint != null) this.arena.setTint(this.chapter.floorTint);
        else this.arena.clearTint();
        const fsrc = this.textures.get(fk).getSourceImage();
        if (usingOwnFloor && this.chapter.floorMode === 'stretch' && fsrc && fsrc.width) {
            this.arena.setTileScale(C.ARENA_WIDTH / fsrc.width, C.ARENA_HEIGHT / fsrc.height);
        } else {
            this.arena.setTileScale(1, 1);
        }
        this.crazyMode = false; this.portal = null; this._crazySpawnDelay = 0;
        this._pendingPortalSubmit = false; this._nameClaimOnly = false; this._lastRank = null;
        if (this.portalSprite) { this.portalSprite.destroy(); this.portalSprite = null; }
        this.stageStats = []; this._stagePrev = { time: 0, kills: 0, coins: 0, score: 0 };
        this.slamRingTimer = -1; this.playerBeam = null; this.soundWaves.length = 0;

        this._clearArr(this.enemies);
        this._clearArr(this.bossSouls);
        this._clearArr(this.skulls);
        this._clearArr(this.bombs);
        this._releaseAll(this.bullets, 'bullet');
        this._releaseAll(this.enemyProjectiles, 'eproj');
        this._releaseAll(this.gems, 'gem');
        this._releaseAll(this.coins, 'coin');
        this._releaseAll(this.vinyls, 'vinyl');
        this._releaseAll(this.particles, 'particle');
        this._releaseAll(this.dmgTexts, 'dmgText');
        this.player.ghosts.forEach(g => g.img.destroy()); this.player.ghosts.length = 0;

        for (let i = 0; i < 7; i++) this.runUpgradeLevels[i] = 0;
        for (let i = 0; i < 3; i++) { this.equippedAbilities[i] = -1; this.abilityCooldowns[i] = 0; this.abilityMaxCooldowns[i] = 0; }
        this.pendingAbilityCount = 0;
        this.spawner.reset();

        const cx = C.ARENA_WIDTH / 2, cy = C.ARENA_HEIGHT / 2;
        const minD = 1200;
        for (let i = 0; i < 10; i++) {
            for (let a = 0; a < 20; a++) {
                const tx = randInt(C.ARENA_WIDTH), ty = randInt(C.ARENA_HEIGHT);
                if (distSq(cx, cy, tx, ty) >= minD * minD) {
                    const e = new Enemy(this, tx, ty, this._enemyKey);
                    const r = randInt(100);
                    if (r < 20) e.makeFast(); else if (r < 35) e.makeTank(1); else { e.hp = 2; e.maxHp = 2; }
                    this._applyChapterEnemy(e);
                    this.enemies.push(e);
                    break;
                }
            }
        }
        this.fadeAlpha = 255;
    }

    _clearArr(arr) { arr.forEach(o => o.destroy()); arr.length = 0; }

    setState(ns) {
        this.currentState = ns;
        if (ns !== GameState.PLAYING && this._warnSound) { this.audio.stopLoopSfx(this._warnSound); this._warnSound = null; }
        if (ns !== GameState.SETTINGS) { this._resetConfirm = false; this._resetConfirmTimer = 0; this._resetHover = false; }
        this.rebuildMenu();
        this.updateCursor();
        if (this.audio) {
            this.audio.playMusic(this.audio.musicForState(ns));
            const ducked = (ns === GameState.PAUSED || ns === GameState.LEVEL_UP || ns === GameState.ABILITY_SELECT);
            this.audio.setDuck(ducked ? 0.5 : 1);
        }
        if (ns === GameState.LEADERBOARD) this._refreshRemoteLeaderboard(this.lbView, this.lbChapter);
    }

    updateCursor() {
        const canvas = this.sys.game.canvas;
        if (!canvas) return;
        const base = C.ASSET_PATH;
        if (this.currentState === GameState.PLAYING) {
            canvas.style.cursor = 'url("' + base + 'cursor_crosshair.png") 27 24, crosshair';
        } else {
            canvas.style.cursor = 'url("' + base + 'cursor_arrow.png") 0 0, default';
        }
    }

    update(time, delta) {
        let dt = delta / 1000;
        if (dt > 0.1) dt = 0.1;
        this.globalTime += dt;


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
        if (this._resetConfirmTimer > 0) {
            this._resetConfirmTimer -= dt;
            if (this._resetConfirmTimer <= 0) { this._resetConfirmTimer = 0; this._resetConfirm = false; if (this.currentState === GameState.SETTINGS) this.rebuildMenu(); }
        }

        if (this.currentState !== GameState.PLAYING || this.isGameOver) return;

        if (this.player.currentXP >= this.player.xpToNextLevel) { this.triggerLevelUp(); return; }

        this.updatePlaying(dt);
    }

    updatePlaying(dt) {
        const p = this.player, s = this.save;
        const input = {
            left: this.keys.left.isDown, right: this.keys.right.isDown,
            up: this.keys.up.isDown, down: this.keys.down.isDown, space: this.keys.space.isDown,
        };
        p.update(dt, C.ARENA_WIDTH, C.ARENA_HEIGHT, input);

        if (hasArtifact(s, ARTIFACT.BERSERKER) && p.hp <= Math.floor(p.maxHp * 0.4))
            p.currentSpeedMultiplier = Math.max(1.0, p.currentSpeedMultiplier);

        const px = p.sprite.x, py = p.sprite.y;

        if (p.isMoving && randInt(100) < 20) {
            const dust = this.spawnParticle(px + (randInt(30) - 15), py + p.sprite.displayHeight / 2 - 10, rgb(150, 150, 150));
            dust.vx = randInt(40) - 20; dust.vy = -(randInt(50) + 20);
            dust.maxLifetime = 0.4; dust.lifetime = 0.4;
            dust.rect.setAlpha(150 / 255);
            this.particles.push(dust);
        }

        this.survivalTimer += dt;
        if (this.phaseNotifTimer < 3.5) this.phaseNotifTimer += dt;

        this._updateEncircleEvent(dt);

        if (s.permRegen > 0 && p.hp < p.maxHp) {
            this.regenTimer += dt;
            const interval = 8 - s.permRegen;
            if (this.regenTimer >= interval) { this.regenTimer = 0; p.hp = Math.min(p.hp + 10, p.maxHp); }
        }

        this._updatePhaseProgression(dt, px, py);

        if (this.crazyMode && this.portal &&
            distSq(px, py, this.portal.x, this.portal.y) < C.PORTAL_RADIUS * C.PORTAL_RADIUS) {
            this._enterPortal();
            return;
        }

        this.vinylSpawnTimer += dt;
        if (this.vinylSpawnTimer >= 60) {
            this.vinyls.push(this.spawnVinyl(randInt(C.ARENA_WIDTH), randInt(C.ARENA_HEIGHT)));
            this.vinylSpawnTimer = 0;
        }

        this._updateSpawning(dt, px, py);

        if (!p.isMoving && p.currentCooldown <= 0 && p.stunTimer <= 0) {
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
                if (hasArtifact(s, ARTIFACT.GLASS_CANNON)) dmgMul *= 1.3;
                if (hasArtifact(s, ARTIFACT.BERSERKER) && p.hp <= Math.floor(p.maxHp * 0.4)) dmgMul *= 1.5;
                const finalDmg = Math.max(1, Math.floor((isCrit ? p.attackDamage * p.critMultiplier : p.attackDamage) * dmgMul + 0.5));
                const n = normalize(dx, dy);
                const mb = this.spawnBullet(px, py, n.x, n.y, finalDmg, isCrit);
                if (hasArtifact(s, ARTIFACT.ECHO_CHAMBER)) mb.ricochetsLeft = 1;
                if (p.pierce) mb.pierceLeft = 1;
                this.bullets.push(mb);
                this.shotsFired++;
                if (s.permMultishot > 0 && this.shotsFired % 8 === 0) {
                    const ang = 18 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
                    const sd = { x: n.x * ca - n.y * sa, y: n.x * sa + n.y * ca };
                    const sb = this.spawnBullet(px, py, sd.x, sd.y, finalDmg, isCrit);
                    if (hasArtifact(s, ARTIFACT.ECHO_CHAMBER)) sb.ricochetsLeft = 1;
                    if (p.pierce) sb.pierceLeft = 1;
                    this.bullets.push(sb);
                }
                p.currentCooldown = p.shootCooldown;
                this.audio.play('sfx_player_shot', { volume: 0.33, minGap: 40 });
            }
        }

        for (const b of this.bullets) b.update(dt);

        for (const sk of this.skulls) sk.update(dt);
        this._filterDestroy(this.skulls, sk => sk.dead);

        for (const bm of this.bombs) bm.update(dt);
        this._filterDestroy(this.bombs, bm => bm.dead);

        this._updateHypeAuras(dt);

        for (const e of this.enemies) {
            e.update(dt, px, py, C.ARENA_WIDTH, C.ARENA_HEIGHT);
            if (e.spawning) continue;

            if (e.justThrew) {
                const pr = this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.throwTargetPos.x, e.throwTargetPos.y);
                pr.damage = e.damage;
                this.enemyProjectiles.push(pr);
            }
            if (e.justThrewStun) {
                const pr = this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.throwTargetPos.x, e.throwTargetPos.y);
                pr.damage = C.BOSSDOC.STUN_DAMAGE;
                pr.isStun = true;
                pr.vx *= C.BOSSDOC.STUN_PROJ_SPEED_MULT;
                pr.vy *= C.BOSSDOC.STUN_PROJ_SPEED_MULT;
                this.enemyProjectiles.push(pr);
            }
            if (e.justSoundWave) {
                const SW = C.SUBWOOFER;
                this.soundWaves.push({
                    x: e.sprite.x, y: e.sprite.y,
                    angle: Math.atan2(py - e.sprite.y, px - e.sprite.x),
                    radius: 0, maxRadius: SW.WAVE_RADIUS * (e.waveRadiusMult || 1), halfArc: SW.WAVE_HALF_ARC,
                    timer: 0, hit: false, damage: e.damage,
                });
                this.audio.play('sfx_slam', { volume: 0.3, minGap: 80 });
            }
            if (e.justFiredVolley) {
                for (let v = 0; v < 12; v++) {
                    const ang = v * (2 * Math.PI / 12);
                    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
                    const pr = this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.sprite.x + dir.x * 500, e.sprite.y + dir.y * 500);
                    pr.damage = e.damage;
                    this.enemyProjectiles.push(pr);
                }
            }

            const attackDist = e.isBoss ? C.COLLISION.BOSS_HIT_SQ : (e.type === EnemyType.GOBLIN ? C.COLLISION.GOBLIN_ATTACK_SQ : C.COLLISION.ENEMY_ATTACK_SQ);
            if (distSq(e.sprite.x, e.sprite.y, px, py) < attackDist) {
                this._damagePlayer(e.damage, 0.2, 2 * e.damage);
                if (e.type === EnemyType.FAST) e.hp = 0;

                if (p.bladeMail && !(e.bladeMailCd > 0)) {
                    const thorns = Math.max(25, p.attackDamage * 2);
                    e.hp -= thorns;
                    e.hitFlashTimer = 0.12;
                    e.bladeMailCd = 0.5;
                    this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, thorns, false));
                }
            }
            if (e.bladeMailCd > 0) e.bladeMailCd -= dt;

            if (e.isBoss3 && e.beamActive) {
                const bx = e.sprite.x, by = e.sprite.y;
                const dirx = Math.cos(e.beamAngle), diry = Math.sin(e.beamAngle);
                const rx = px - bx, ry = py - by;
                const proj = rx * dirx + ry * diry;
                if (proj > 0 && proj < e.beamLen) {
                    const perp = Math.abs(rx * -diry + ry * dirx);
                    if (perp < e.beamWidth / 2 + C.STROBE_BEAM_HIT_MARGIN) {
                        this._damagePlayer(C.STROBE_BEAM_DAMAGE, 0.25, 80);
                    }
                }
            }

        }

        this._buildEnemyGrid();
        this._bulletEnemyCollisions();
        this.separateEnemies(px, py);
        this.handleEnemyDeaths(px, py);

        this._filterDestroy(this.enemies, e => e.hp <= 0);

        if (hasArtifact(s, ARTIFACT.ECHO_CHAMBER)) {
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

        this._checkPhaseTransitions();

        for (const g of this.gems) {
            g.update(dt, px, py, p.pickupRadius);
            if (distSq(g.sprite.x, g.sprite.y, px, py) < C.COLLISION.GEM_PICKUP_SQ) { g.isCollected = true; p.gainXP(1); }
        }
        this._filterRelease(this.gems, 'gem', g => g.isCollected);

        const coinReward = s.isHardcoreMode ? C.HARDCORE_COIN_MULT : 1;
        for (const c of this.coins) {
            c.update(dt, px, py, p.pickupRadius);
            if (distSq(c.sprite.x, c.sprite.y, px, py) < C.COLLISION.COIN_PICKUP_SQ) {
                c.isCollected = true;
                this.coinCarry += coinReward;
                const whole = Math.floor(this.coinCarry);
                s.totalCoins += whole;
                this.coinCarry -= whole;
                this.coinsThisRun += whole;
            }
        }
        this._filterRelease(this.coins, 'coin', c => c.isCollected);

        for (const v of this.vinyls) {
            v.update(dt);
            if (distSq(v.sprite.x, v.sprite.y, px, py) < C.COLLISION.VINYL_PICKUP_SQ) { v.isCollected = true; if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.2)); }
        }
        this._filterRelease(this.vinyls, 'vinyl', v => v.isCollected);

        for (const pr of this.enemyProjectiles) pr.update(dt, C.ARENA_WIDTH, C.ARENA_HEIGHT);
        for (const pr of this.enemyProjectiles) {
            if (pr.isDestroyed) continue;
            if (distSq(pr.sprite.x, pr.sprite.y, px, py) < C.COLLISION.PROJECTILE_HIT_SQ) {
                pr.isDestroyed = true;
                const wasVuln = (p.iFrames <= 0 && !p.isDashing && !p.isInvincible);
                this._damagePlayer(pr.damage, 0.15, 15);
                if (pr.isStun && wasVuln) p.stunTimer = C.BOSSDOC.STUN_DURATION;
            }
        }
        this._filterRelease(this.enemyProjectiles, 'eproj', pr => pr.isDestroyed);

        for (const d of this.dmgTexts) d.update(dt);
        this._filterRelease(this.dmgTexts, 'dmgText', d => d.lifetime <= 0);
        for (const pa of this.particles) pa.update(dt);
        this._filterRelease(this.particles, 'particle', pa => pa.lifetime <= 0);

        if (this.slamRingTimer >= 0) { this.slamRingTimer += dt; if (this.slamRingTimer >= C.SLAM_RING_DURATION) this.slamRingTimer = -1; }
        if (this.playerBeam) { this.playerBeam.timer -= dt; if (this.playerBeam.timer <= 0) this.playerBeam = null; }

        if (this.soundWaves.length) {
            const SW = C.SUBWOOFER;
            for (const w of this.soundWaves) {
                w.timer += dt;
                w.radius = w.maxRadius * clamp(w.timer / SW.WAVE_EXPAND, 0, 1);
                if (w.hit) continue;
                const dx = p.sprite.x - w.x, dy = p.sprite.y - w.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1 && dist <= w.radius) {
                    let da = Math.atan2(dy, dx) - w.angle;
                    da = Math.atan2(Math.sin(da), Math.cos(da));
                    if (Math.abs(da) <= w.halfArc) {
                        w.hit = true;
                        p.sprite.x = clamp(p.sprite.x + (dx / dist) * SW.WAVE_KNOCKBACK, 0, C.ARENA_WIDTH);
                        p.sprite.y = clamp(p.sprite.y + (dy / dist) * SW.WAVE_KNOCKBACK, 0, C.ARENA_HEIGHT);
                        this._damagePlayer(w.damage, 0.3, 60);
                    }
                }
            }
            for (let i = this.soundWaves.length - 1; i >= 0; i--) {
                if (this.soundWaves[i].timer >= SW.WAVE_EXPAND + 0.15) this.soundWaves.splice(i, 1);
            }
        }

        for (const soul of this.bossSouls) {
            if (soul.isCollected) continue;
            soul.update(dt, this.globalTime);
            if (distSq(soul.sprite.x, soul.sprite.y, px, py) < C.COLLISION.SOUL_PICKUP_SQ) {
                let nextSlot = -1;
                for (let si = 0; si < 3; si++) if (this.equippedAbilities[si] < 0) { nextSlot = si; break; }
                if (nextSlot >= 0) {
                    soul.isCollected = true;
                    if (soul.soulType === 1) { this.pendingAbilityIds = [0, 1, -1]; this.pendingAbilityCount = 2; }
                    else if (soul.soulType === 3) { this.pendingAbilityIds = [3, -1, -1]; this.pendingAbilityCount = 1; }
                    else if (soul.soulType === 4) { this.pendingAbilityIds = [4, -1, -1]; this.pendingAbilityCount = 1; }
                    else if (soul.soulType === 5) { this.pendingAbilityIds = [5, -1, -1]; this.pendingAbilityCount = 1; }
                    else if (soul.soulType === 6) { this.pendingAbilityIds = [6, -1, -1]; this.pendingAbilityCount = 1; }
                    else { this.pendingAbilityIds = [2, -1, -1]; this.pendingAbilityCount = 1; }
                    this.pendingSlot = nextSlot;
                    this.abilitySelectAnimTimer = 0;
                    this.selectedAbilityIndex = -1;
                    this.setState(GameState.ABILITY_SELECT);
                    return;
                }
            }
        }
        this._filterDestroy(this.bossSouls, s2 => s2.isCollected);

        for (let i = 0; i < 3; i++) if (this.abilityCooldowns[i] > 0) this.abilityCooldowns[i] -= dt;

        let bossExists = false, bossHpPct = 0;
        for (const e of this.enemies) {
            if (e.isBoss) {
                bossExists = true; bossHpPct = Math.max(0, e.hp / e.maxHp);
                const bn = e.isBoss3 ? t('boss3_name') : e.isBoss2 ? t('boss2_name') : t('boss_name');
                if (this._lastBossName !== bn) { this._lastBossName = bn; this.hud.bossName.setText(bn); }
                break;
            }
        }
        this._bossExists = bossExists;
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

    _damagePlayer(amount, shakeDur, shakeMag) {
        const p = this.player;
        const oldHp = p.hp;
        p.takeDamage(amount);
        if (p.hp < oldHp) { this.triggerShake(shakeDur, shakeMag); this.audio.play('sfx_player_hurt'); }
        if (p.hp <= 0 && !this.isGameOver) this.onPlayerDeath();
    }


    activateAbility(slot) {
        if (slot < 0 || slot > 2) return;
        const id = this.equippedAbilities[slot];
        if (id < 0 || this.abilityCooldowns[slot] > 0) return;
        const p = this.player, px = p.sprite.x, py = p.sprite.y;

        const A = C.ABILITY;
        if (id === 0) { p.isInvincible = true; p.invincibilityTimer = A.INVINCIBLE_DURATION; }
        else if (id === 1) {
            const slamDmg = A.SLAM_DAMAGE;
            for (const e of this.enemies) {
                const dq = distSq(e.sprite.x, e.sprite.y, px, py);
                if (dq < C.SLAM_RADIUS * C.SLAM_RADIUS && dq > 0.001) {
                    e.hp -= slamDmg; e.hitFlashTimer = 0.12;
                    const d = Math.sqrt(dq);
                    e.sprite.x += (e.sprite.x - px) / d * A.SLAM_KNOCKBACK;
                    e.sprite.y += (e.sprite.y - py) / d * A.SLAM_KNOCKBACK;
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
            this.slamRingColor = rgb(255, 160, 0); this.slamRingColor2 = rgb(255, 220, 80); this.slamRingRadius = C.SLAM_RADIUS;
            this.triggerShake(0.4, 30);
            this.audio.play('sfx_slam', { volume: 0.8 });
        } else if (id === 2) {
            for (let d = 0; d < A.DISC_COUNT; d++) {
                const angle = d * (2 * Math.PI / A.DISC_COUNT);
                this.bullets.push(this.spawnBullet(px, py, Math.cos(angle), Math.sin(angle), A.DISC_DAMAGE, false));
            }
        } else if (id === 3) {
            const ptr = this.input.activePointer;
            const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
            let dx = wp.x - px, dy = wp.y - py;
            if (dx * dx + dy * dy < 1e-6) { dx = 1; dy = 0; }
            const n = normalize(dx, dy);
            const len = A.LASER_LENGTH, halfW = A.LASER_HALF_WIDTH, dmg = A.LASER_DAMAGE;
            for (const e of this.enemies) {
                const rx = e.sprite.x - px, ry = e.sprite.y - py;
                const proj = rx * n.x + ry * n.y;
                if (proj > 0 && proj < len) {
                    const perp = Math.abs(rx * -n.y + ry * n.x);
                    const hitR = e.isBoss ? A.LASER_BOSS_HIT_RADIUS : A.LASER_HIT_RADIUS;
                    if (perp < halfW + hitR) {
                        e.hp -= dmg; e.hitFlashTimer = 0.12;
                        this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, dmg, true));
                    }
                }
            }
            this.playerBeam = { x: px, y: py, nx: n.x, ny: n.y, len: len, timer: 0.28 };
            this.triggerShake(0.2, 22);
            this.audio.play('sfx_slam', { volume: 0.5 });
        } else if (id === 4) {
            const ptr = this.input.activePointer;
            const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
            let dx = wp.x - px, dy = wp.y - py;
            if (dx * dx + dy * dy < 1e-6) { dx = 1; dy = 0; }
            let first = null, bestD = C.ABILITY.SKULL_SEEK_RADIUS * C.ABILITY.SKULL_SEEK_RADIUS;
            for (const e of this.enemies) {
                if (e.hp <= 0 || e.spawning) continue;
                const dq = distSq(wp.x, wp.y, e.sprite.x, e.sprite.y);
                if (dq < bestD) { bestD = dq; first = e; }
            }
            this.skulls.push(new SkullProjectile(this, px, py, dx, dy, first));
            this.audio.play('sfx_slam', { volume: 0.5 });
        } else if (id === 5) {
            const SR = C.ABILITY.SONIC_RADIUS, dmg = C.ABILITY.SONIC_DAMAGE, kb = C.ABILITY.SONIC_KNOCKBACK;
            for (const e of this.enemies) {
                if (e.spawning) continue;
                const dq = distSq(e.sprite.x, e.sprite.y, px, py);
                if (dq < SR * SR && dq > 0.001) {
                    e.hp -= dmg; e.hitFlashTimer = 0.12;
                    const d = Math.sqrt(dq);
                    e.sprite.x = clamp(e.sprite.x + (e.sprite.x - px) / d * kb, 0, C.ARENA_WIDTH);
                    e.sprite.y = clamp(e.sprite.y + (e.sprite.y - py) / d * kb, 0, C.ARENA_HEIGHT);
                    this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, dmg, false));
                }
            }
            for (let i = 0; i < 50; i++) {
                const angle = randInt(360) * Math.PI / 180;
                const part = this.spawnParticle(px, py, randInt(2) === 0 ? rgb(0, 230, 255) : rgb(120, 200, 255));
                const spd = randInt(400) + 250;
                part.vx = Math.cos(angle) * spd; part.vy = Math.sin(angle) * spd;
                part.maxLifetime = 0.5; part.lifetime = 0.5;
                this.particles.push(part);
            }
            this.slamRingCenter = { x: px, y: py };
            this.slamRingTimer = 0;
            this.slamRingColor = rgb(0, 160, 255); this.slamRingColor2 = rgb(150, 230, 255); this.slamRingRadius = SR;
            this.triggerShake(0.35, 26);
            this.audio.play('sfx_slam', { volume: 0.7 });
        } else if (id === 6) {
            const ptr = this.input.activePointer;
            const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
            let dx = wp.x - px, dy = wp.y - py;
            if (dx * dx + dy * dy < 1e-6) { dx = 1; dy = 0; }
            this.bombs.push(new ShatterBomb(this, px, py, dx, dy));
            this.audio.play('sfx_slam', { volume: 0.5 });
        }
        this.abilityCooldowns[slot] = ABILITY_COOLDOWNS[id] || 1;
        this.abilityMaxCooldowns[slot] = this.abilityCooldowns[slot];
    }

    triggerLevelUp() {
        const p = this.player;
        p.level++;
        p.currentXP -= p.xpToNextLevel;
        p.xpToNextLevel *= 1.5;
        p.hp = Math.min(p.maxHp, p.hp + 20);
        this.levelUpAnimTimer = 0;
        const pool = [0, 1, 2, 3, 4];
        for (const lid of LEGENDARY_UPGRADE_IDS) {
            if (this.runUpgradeLevels[lid] === 0 && Math.random() < LEGENDARY_CARD_CHANCE) pool.push(lid);
        }
        const ids = [];
        while (ids.length < 3) {
            const c = pool[randInt(pool.length)];
            if (!ids.includes(c)) ids.push(c);
        }
        this.levelUpIds = ids;
        this.selectedLevelUpIndex = -1;
        this.audio.play('sfx_levelup', { volume: 0.55 });
        this.setState(GameState.LEVEL_UP);
    }

    applyUpgrade(id) {
        const p = this.player;
        if (id === 0) p.shootCooldown = Math.max(0.22, p.shootCooldown * 0.93);
        else if (id === 1) p.attackDamage += 1;
        else if (id === 2 && p.speed < 400) p.speed += 20;
        else if (id === 3 && p.pickupRadius < 600) p.pickupRadius += 50;
        else if (id === 4) { p.maxHp += 10; p.hp = p.maxHp; }
        else if (id === 5) p.bladeMail = true;
        else if (id === 6) p.pierce = true;
        p.lastUpgradeId = id;
        p.messageTimer = 2.0;
        if (id >= 0 && id < 7) this.runUpgradeLevels[id]++;
        this.selectedLevelUpIndex = -1;
        p.currentCooldown = Math.max(p.currentCooldown, 0.2);
        this.setState(GameState.PLAYING);
    }

    drawPlayingOverlays() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, p = this.player;

        if (p.messageTimer > 0 && !this.isGameOver) {
            const str = t('upgrade_toasts')[p.lastUpgradeId] || '';
            this.upgradeMsg.setText(str).setVisible(true);
            this.upgradeMsg.setPosition(p.sprite.x, p.sprite.y - 80 - (2.0 - p.messageTimer) * 20);
            this.upgradeMsg.setAlpha(p.messageTimer / 2.0);
        } else this.upgradeMsg.setVisible(false);

        if (this.phaseTransitionTimer >= 0) {
            const t = this.phaseTransitionTimer;
            const fadeIn = Math.min(t / 0.7, 1);
            const fadeOut = (t > 0.7) ? 1 - Math.min((t - 0.7) / 0.8, 1) : 1;
            this.fadeRect.setVisible(true).setFillStyle(0x000000, Math.min(fadeIn, fadeOut));
        } else if (this.fadeAlpha <= 0) {
            this.fadeRect.setVisible(false);
        }

        if (this.activeStep > 0 && this.phaseNotifTimer < 3.5 && !this.isGameOver) {
            const alpha = this.phaseNotifTimer > 2.5 ? 1 - (this.phaseNotifTimer - 2.5) : 1;
            let col = '#00ffc8', label = t('phase') + '  ' + this.activeStep;
            if (this.activeStep === 2) col = '#ff5050';
            else if (this.activeStep === 3) col = '#ff8c00';
            else if (this.activeStep === 4) { col = '#ff0064'; label = t('crazy_title'); }
            this.phaseOverlay.setVisible(true).setFillStyle(0x000000, 170 / 255 * alpha);
            this.phaseText.setVisible(true).setText(label).setColor(col).setAlpha(alpha);
        } else { this.phaseOverlay.setVisible(false); this.phaseText.setVisible(false); }

        if (this.crazyMode && !this.isGameOver) {
            const blink = 0.6 + 0.4 * Math.sin(this.globalTime * 6);
            this.clearText.setVisible(true).setText(t('crazy_hint'))
                .setColor('#00e6ff').setAlpha(blink);
            this.clearText.y = 163;
        } else if ((this.gamePhase === GamePhase.CLEARING || (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)) && !this.isGameOver) {
            this.clearText.setVisible(true).setText(t('clear_all') + '  [' + this.enemies.length + ']').setColor('#ff5050').setAlpha(1);
            this.clearText.y = this._bossExists ? 18 : 163;
        } else this.clearText.setVisible(false);

        if (this.survivalTimer < 10 && !this.isGameOver) {
            const a = this.survivalTimer > 8.5 ? Math.max(0, 1 - (this.survivalTimer - 8.5) / 1.5) : 1;
            this.controlsHint.setVisible(true)
                .setText([t('hint_move'), t('hint_aim'), t('hint_dash'), t('hint_ability'), t('hint_pause')].join('\n'))
                .setAlpha(a);
        } else this.controlsHint.setVisible(false);

        let warning = false, warnCol = '#ff0000';
        const bossImminent = (timer, step, bossSpawned) =>
            !bossSpawned && !this.isGameOver &&
            (timer > C.BOSS_TIME_CAP - 3 || this.phaseKills >= this._bossKillReq(step) - C.BOSS_WARN_KILLS);
        if (this.gamePhase === GamePhase.PHASE_1 && bossImminent(this.survivalTimer, 1, this.spawner.bossSpawned)) {
            warning = true; warnCol = '#ff0000';
        } else if (this.gamePhase === GamePhase.PHASE_2 && bossImminent(this.phase2Timer, 2, this.phase2BossSpawned)) {
            warning = true; warnCol = '#b46bff';
        } else if (this.gamePhase === GamePhase.PHASE_3 && bossImminent(this.phase3Timer, 3, this.phase3BossSpawned)) {
            warning = true; warnCol = '#00e6ff';
        }
        this.warnRect.setVisible(false);
        if (warning) {
            const pulse = 0.65 + 0.35 * Math.abs(Math.sin(this.globalTime * 6));
            this.warnText.setVisible(true).setText('Attention').setColor(warnCol).setAlpha(pulse);
        } else this.warnText.setVisible(false);
        if (warning) {
            if (!this._warnSound) this._warnSound = this.audio.playLoopSfx('sfx_boss_warning', { volume: 0.8 });
        } else if (this._warnSound) { this.audio.releaseLoopSfx(this._warnSound); this._warnSound = null; }

        this._drawBossArrow();
    }

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

}
