// MainScene — порт Game.cpp: машина состояний, игровой цикл, рендер, меню.

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }

    // ===================== ЗАГРУЗКА =====================
    preload() {
        this.load.setPath(C.ASSET_PATH);
        // Часть иконок магазина опциональна — глушим ошибку загрузки отсутствующих
        // файлов, чтобы не засорять консоль 404-ми (карточка нарисуется без иконки).
        this.load.on('loaderror', () => {});
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
        setLanguage(this.save.language); // применить выбранный язык интерфейса

        // Отключаем контекстное меню браузера на canvas (ПКМ используется в игре)
        if (this.input && this.input.mouse) this.input.mouse.disableContextMenu();
        // Две таблицы рекордов: обычная и hardcore. lbView — какая сейчас показывается.
        this.leaderboards = { normal: SaveSystem.loadLeaderboard(false), hardcore: SaveSystem.loadLeaderboard(true) };
        this.lbView = 'normal';

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
        // Стены рисуются как анимированные звуковые волны в drawWorldFx — статичную
        // красную рамку прячем (оставляем объект, чтобы не трогать остальной код).
        this.arenaBorder.setVisible(false);

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
        this.soundWaves = []; // направленные звуковые волны Сабвуфера (отбрасывают игрока)

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
        this.currentChapter = 1;         // выбранная глава (1..3); забег = 3 этапа главы
        this.phase2Timer = 0;
        this.phase2BossSpawned = false;
        this.phase3Timer = 0;
        this.phase3BossSpawned = false;
        this.phaseTransitionTimer = -1;
        this.phaseEventFired = false;

        // «Безумный» этап после третьего босса
        this.crazyMode = false;          // x5 HP мобам, монеты не падают, открыт портал
        this.portal = null;              // { x, y } — позиция портала-выхода в мире
        this.portalSprite = null;        // спрайт портала (portal.png), если ассет загружен
        this.stageStats = [];            // итоги по 3 этапам: [{ time, kills, coins, score }]
        this._stagePrev = { time: 0, kills: 0, coins: 0, score: 0 }; // снимок на начало этапа
        this.runScore = 0;               // счёт забега (метрика рекордов)

        // Способности
        this.equippedAbilities = [-1, -1, -1];
        this.abilityCooldowns = [0, 0, 0];
        this.abilityMaxCooldowns = [0, 0, 0];
        this.pendingAbilityIds = [-1, -1, -1];
        this.pendingAbilityCount = 0;

        // Слэм-кольцо
        this.slamRingTimer = -1;
        this.slamRingCenter = { x: 0, y: 0 };
        this.playerBeam = null; // визуал лазера игрока (затухает по таймеру)

        // Артефакт-аккумуляторы / реген
        this.bloodPactHealAcc = 0;
        this.coinCarry = 0; // дробный остаток множителя монет (hardcore)
        this.regenTimer = 0;
        this.shotsFired = 0;

        // Уровни прокачек в забеге
        this.runUpgradeLevels = [0, 0, 0, 0, 0, 0, 0];

        // Индексы выбора в меню
        this.selectedMenuIndex = 0;
        this.selectedSettingIndex = 0;
        this.selectedPauseIndex = 0;
        this.selectedLobbyIndex = 0;
        this.selectedChapterIndex = 0;
        this.selectedLevelUpIndex = -1;
        this.selectedAbilityIndex = -1;
        this.leaderboardFromMenu = false;
        this.leaderboardNewEntryIndex = -1;
        this.nameInput = ''; // ввод ника на экране NAME_INPUT
        this._pendingHighlight = null; // имя игрока, чью строку подсветить после отправки
        this._nameError = '';          // сообщение об ошибке на экране ввода ника
        this.renameInput = '';         // ввод нового ника на экране RENAME_INPUT
        this._renameError = '';        // сообщение об ошибке на экране переименования
        this._renameBusy = false;      // запрос переименования в процессе
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

        // Подтянуть оба общих топа заранее, чтобы проверка рекорда шла против облака.
        this._refreshRemoteLeaderboard('normal');
        this._refreshRemoteLeaderboard('hardcore');
    }

    // ===================== ХЕЛПЕРЫ =====================
    addWorld(o) { this.worldLayer.add(o); return o; }
    addUI(o) { this.uiLayer.add(o); return o; }
    // Текстура с фолбэком: вернёт key, если он загружен, иначе fallback. Используется
    // для ассетов глав 2/3, файлы которых могут отсутствовать (тогда берётся арт главы 1).
    _tex(key, fallback) { return this.textures.exists(key) ? key : fallback; }
    // Множители сложности главы (для главы 1 все = 1, значения не меняются).
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

    // Аура Хайпмена: врагам в радиусе даёт бонус к макс. HP (флэт, снимается при выходе)
    // и лечит их со временем. Toggle на вход/выход — без накопления/дрейфа.
    _updateHypeAuras(dt) {
        let auras = null;
        for (const e of this.enemies) {
            if (e.type === EnemyType.HYPEMAN && e.hp > 0) (auras || (auras = [])).push(e);
        }
        const H = C.HYPEMAN, r2 = H.AURA_RADIUS * H.AURA_RADIUS;
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
        }
    }

    // Событие «окружение»: раз за боевой этап в случайный момент вокруг игрока по кольцу
    // спавнятся обычные мобы со всех краёв и сжимаются к нему (двигаются как чейзеры).
    _updateEncircleEvent(dt) {
        if (this.crazyMode || !this.chapter || !this.chapter.encircleEvent) return; // только главы с encircleEvent
        let ph = 0;
        if (this.gamePhase === GamePhase.PHASE_1) ph = 1;
        else if (this.gamePhase === GamePhase.PHASE_2) ph = 2;
        else if (this.gamePhase === GamePhase.PHASE_3) ph = 3;
        else return; // CLEARING и прочее — пропускаем
        if (ph !== this._encPhase) {
            // Новый этап — планируем событие на случайный момент, но НЕ раньше 20 c от начала
            // этапа: иначе кольцо может прийти до первого левел-апа и его не пройти. (20..40 c)
            this._encPhase = ph; this._encTimer = 0; this._encDone = false;
            this._encAt = 20 + Math.random() * 20;
        }
        if (this._encDone) return;
        this._encTimer += dt;
        if (this._encTimer >= this._encAt) { this._encDone = true; this._spawnEncircle(); }
    }

    _spawnEncircle() {
        const px = this.player.sprite.x, py = this.player.sprite.y;
        const R = 1150, count = 36; // кольцо за пределами видимости; по мере сближения уплотняется
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            const x = clamp(px + Math.cos(ang) * R, 40, C.ARENA_WIDTH - 40);
            const y = clamp(py + Math.sin(ang) * R, 40, C.ARENA_HEIGHT - 40);
            const e = new Enemy(this, x, y, this._enemyKey);
            e.hp = 3; e.maxHp = 3; // обычные, чуть живучее — чтобы кольцо держалось
            this._applyChapterEnemy(e);
            this.enemies.push(e);
        }
        this.audio.play('sfx_boss_warning', { volume: 0.6 });
        this.triggerShake(0.3, 30);
    }
    saveGame() { SaveSystem.save(this.save); this._scheduleCloudBackup(); }

    // Авто-бэкап мета-прогресса в облако (если задан ник). Дебаунс: серия сохранений
    // (покупки в магазине и т.п.) схлопывается в один пуш через 2 с после последнего.
    _scheduleCloudBackup() {
        if (!CloudSave.configured() || !this.save.playerName) return;
        if (this._cloudBackupTimer) clearTimeout(this._cloudBackupTimer);
        this._cloudBackupTimer = setTimeout(() => {
            this._cloudBackupTimer = null;
            CloudSave.push(this.save.playerName, SaveSystem.cloudBlob(this.save));
        }, 2000);
    }

    // Восстановить прогресс из облака по нику. cb('ok'|'notfound'|'offline').
    restoreFromCloud(nick, cb) {
        CloudSave.pull(nick, (res) => {
            if (res === null) { cb('offline'); return; }
            if (res === 'NOTFOUND') { cb('notfound'); return; }
            SaveSystem.applyCloudMeta(this.save, res);  // мутирует this.save на месте (shop.s остаётся валиден)
            this.save.playerName = (nick || '').slice(0, 20); // ник закрепляется за устройством
            this.saveGame();
            if (this.audio) this.audio.syncFromSave();
            cb('ok');
        });
    }
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
        // Стрелка-индикатор направления на босса (когда он за пределами экрана). UI-слой.
        this.bossArrowFx = this.addUI(this.add.graphics());
        this.bossArrowFx.setDepth(93);
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
        p.armor = s.permArmor; p.damageAcc = 0;
        p.pickupRadius = ((s.permActiveArtifacts >> 6) & 1) ? 99999 : 50 + s.permMagnet * 50;
        p.ironSkinCharges = ((s.permActiveArtifacts >> 5) & 1) ? 3 : 0;
        p.soulLeechCritBonus = 0;
        this.bloodPactHealAcc = 0;
        this.coinCarry = 0;

        if ((s.permActiveArtifacts >> 1) & 1) { p.maxHp = Math.max(10, p.maxHp - 20); p.hp = p.maxHp; }

        p.level = 1; p.currentXP = 0; p.xpToNextLevel = 5; p.shootCooldown = 0.45;
        this.regenTimer = 0; this.shotsFired = 0;
        this.killCount = 0; this.coinsThisRun = 0; this.runScore = 0; // статистика забега (для паузы/итогов/рекордов)
        p.sprite.setPosition(C.ARENA_WIDTH / 2, C.ARENA_HEIGHT / 2);
        p.isInvincible = false; p.invincibilityTimer = 0;
        p.bladeMail = false; p.pierce = false; // карточки: блейдмейл (шипы) / прострел (пробитие)

        this.survivalTimer = 0; this.vinylSpawnTimer = 0; this.phase2BossSpawned = false; this.phase3BossSpawned = false;
        this.gamePhase = GamePhase.PHASE_1; this.phaseNotifTimer = 0; this.activeStep = 1;
        this.phase2Timer = 0; this.phase3Timer = 0; this.phaseTransitionTimer = -1; this.phaseEventFired = false;
        this._encPhase = 0; this._encTimer = 0; this._encAt = 0; this._encDone = false; // событие «окружение» (раз за этап)

        // Контент текущей главы: пол + резолв ключей спрайтов (с фолбэком на главу 1).
        this.chapter = getChapter(this.currentChapter);
        this._enemyKey = this._tex(this.chapter.enemyKey, 'enemy');
        this._goblinKey = this._tex(this.chapter.goblinKey, 'enemyV');
        this._boss1Key = this._tex(this.chapter.boss1Key, 'enemy');
        this._boss2Key = this._tex(this.chapter.boss2Key, 'boss2');
        this._boss3Key = this._tex(this.chapter.boss3Key, 'boss3');
        // Сабвуфер/Мошер/Хайпмен: ключ только если глава их поддерживает (иначе null — не спавнятся).
        // Фолбэк — на спрайты главы 2 (а не на обычного врага): пока нет арта enemy3_*, силуэт
        // хотя бы читается как «бас/мошер/хайпмен», а не как рядовой моб.
        this._subwooferKey = this.chapter.subwooferKey ? this._tex(this.chapter.subwooferKey, 'enemy2_sub') : null;
        this._mosherKey = this.chapter.mosherKey ? this._tex(this.chapter.mosherKey, 'enemy2_mosher') : null;
        this._hypemanKey = this.chapter.hypemanKey ? this._tex(this.chapter.hypemanKey, 'enemy2_hype') : null;
        // Пол: своя текстура, если есть; иначе 'floor' перекрашиваем тинтом главы.
        const fk = this._tex(this.chapter.floorKey, 'floor');
        const usingOwnFloor = (fk === this.chapter.floorKey);
        this.arena.setTexture(fk);
        if (!usingOwnFloor && this.chapter.floorTint != null) this.arena.setTint(this.chapter.floorTint);
        else this.arena.clearTint();
        // Режим пола: 'stretch' — растягиваем ОДНУ картинку на всю арену (для цельных
        // сцен — без повтора и швов); иначе бесшовное замощение в натуральном размере.
        const fsrc = this.textures.get(fk).getSourceImage();
        if (usingOwnFloor && this.chapter.floorMode === 'stretch' && fsrc && fsrc.width) {
            this.arena.setTileScale(C.ARENA_WIDTH / fsrc.width, C.ARENA_HEIGHT / fsrc.height);
        } else {
            this.arena.setTileScale(1, 1);
        }
        this.crazyMode = false; this.portal = null; this._stageClearAfterName = false;
        if (this.portalSprite) { this.portalSprite.destroy(); this.portalSprite = null; }
        this.stageStats = []; this._stagePrev = { time: 0, kills: 0, coins: 0, score: 0 };
        this.slamRingTimer = -1; this.playerBeam = null; this.soundWaves.length = 0;

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

        for (let i = 0; i < 7; i++) this.runUpgradeLevels[i] = 0;
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

    // ===================== СМЕНА СОСТОЯНИЯ =====================
    setState(ns) {
        this.currentState = ns;
        // Глушим зацикленный сигнал тревоги при уходе из боя (оверлей-функция там не вызывается).
        if (ns !== GameState.PLAYING && this._warnSound) { this.audio.stopLoopSfx(this._warnSound); this._warnSound = null; }
        // Сбрасываем подтверждение/ховер кнопки сброса при уходе из настроек.
        if (ns !== GameState.SETTINGS) { this._resetConfirm = false; this._resetConfirmTimer = 0; this._resetHover = false; }
        this.rebuildMenu();
        this.updateCursor();
        if (this.audio) {
            this.audio.playMusic(this.audio.musicForState(ns));
            // Приглушаем боевую музыку в модальных оверлеях поверх игры.
            const ducked = (ns === GameState.PAUSED || ns === GameState.LEVEL_UP || ns === GameState.ABILITY_SELECT);
            this.audio.setDuck(ducked ? 0.5 : 1);
        }
        // При открытии таблицы — тянем свежий общий топ показываемого режима.
        if (ns === GameState.LEADERBOARD) this._refreshRemoteLeaderboard(this.lbView);
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
        // Сброс подтверждения кнопки «Сбросить персонажа», если игрок не нажал второй раз.
        if (this._resetConfirmTimer > 0) {
            this._resetConfirmTimer -= dt;
            if (this._resetConfirmTimer <= 0) { this._resetConfirmTimer = 0; this._resetConfirm = false; if (this.currentState === GameState.SETTINGS) this.rebuildMenu(); }
        }

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

        // Событие «окружение» (раз за этап, в случайный момент)
        this._updateEncircleEvent(dt);

        // Реген
        if (s.permRegen > 0 && p.hp < p.maxHp) {
            this.regenTimer += dt;
            const interval = 8 - s.permRegen; // макс уровень (3): 1 HP / 5 сек = 0.2 HP/с
            if (this.regenTimer >= interval) { this.regenTimer = 0; p.hp = Math.min(p.hp + 10, p.maxHp); }
        }

        // Переход фаз
        if (this.phaseTransitionTimer >= 0) {
            this.phaseTransitionTimer += dt;
            if (!this.phaseEventFired && this.phaseTransitionTimer >= 0.7) {
                this.phaseEventFired = true;
                if (this.gamePhase === GamePhase.CLEARING) {
                    this._snapshotStage(); // итоги этапа 1
                    this.gamePhase = GamePhase.PHASE_2; this.phaseNotifTimer = 0; this.activeStep = 2; this.phase2Timer = 0; this.spawner.resetForPhase2();
                } else if (this.gamePhase === GamePhase.PHASE_2) {
                    this._snapshotStage(); // итоги этапа 2
                    this.gamePhase = GamePhase.PHASE_3; this.phaseNotifTimer = 0; this.activeStep = 3; this.phase3Timer = 0; this.spawner.resetForPhase2();
                }
            }
            if (this.phaseTransitionTimer >= 1.5) { this.phaseTransitionTimer = -1; this.phaseEventFired = false; }
        }

        if (this.gamePhase === GamePhase.PHASE_3) {
            this.phase3Timer += dt;
            if (this.phase3Timer >= 60 && !this.phase3BossSpawned) {
                const bp = findSpawnPos(px, py, C.ARENA_WIDTH, C.ARENA_HEIGHT, 800);
                const boss3 = new Enemy(this, bp.x, bp.y, this._boss3Key);
                boss3.makeBoss3(this._boss3Key);
                this._applyChapterBoss(boss3);
                if (s.isHardcoreMode) { boss3.speed *= 1.3; boss3.hp *= 2; boss3.maxHp *= 2; }
                this.enemies.push(boss3);
                this.phase3BossSpawned = true;
            }
        }

        if (this.gamePhase === GamePhase.PHASE_2) {
            this.phase2Timer += dt;
            if (this.phase2Timer >= 60 && !this.phase2BossSpawned) {
                // Не у стены: гарантируем дистанцию от игрока, иначе босс появлялся внутри него.
                const bp = findSpawnPos(px, py, C.ARENA_WIDTH, C.ARENA_HEIGHT, 800);
                const bx = bp.x, by = bp.y;
                const boss2 = new Enemy(this, bx, by, this._boss2Key);
                boss2.makeBoss2(this._boss2Key);
                this._applyChapterBoss(boss2);
                if (s.isHardcoreMode) { boss2.speed *= 1.5; boss2.hp *= 2; boss2.maxHp *= 2; }
                this.enemies.push(boss2);
                this.phase2BossSpawned = true;
            }
        }

        // Вход в портал (безумный этап): игрок дошёл до портала — показываем итоги 3 этапов.
        if (this.crazyMode && this.portal &&
            distSq(px, py, this.portal.x, this.portal.y) < C.PORTAL_RADIUS * C.PORTAL_RADIUS) {
            this._enterPortal();
            return;
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
            && !(this.gamePhase === GamePhase.PHASE_3 && this.enemies.some(e => e.isBoss3))
            && (this.phaseTransitionTimer < 0);
        if (spawningActive) {
            const p2 = this.gamePhase === GamePhase.PHASE_2;
            const p3 = this.gamePhase === GamePhase.PHASE_3;
            const spawnTime = p3 ? this.phase3Timer : (p2 ? this.phase2Timer : this.survivalTimer);
            this.spawner.update(this, dt, spawnTime, C.ARENA_WIDTH, C.ARENA_HEIGHT, px, py, this.enemies,
                s.isHardcoreMode, this._enemyKey, this._goblinKey, p2, this.phase2Timer, p3, this.activeStep);
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
                if (p.pierce) mb.pierceLeft = 1;
                this.bullets.push(mb);
                this.shotsFired++;
                if (s.permMultishot > 0 && this.shotsFired % 8 === 0) {
                    const ang = 18 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
                    const sd = { x: n.x * ca - n.y * sa, y: n.x * sa + n.y * ca };
                    const sb = this.spawnBullet(px, py, sd.x, sd.y, finalDmg, isCrit);
                    if ((s.permActiveArtifacts >> 2) & 1) sb.ricochetsLeft = 1;
                    if (p.pierce) sb.pierceLeft = 1;
                    this.bullets.push(sb);
                }
                p.currentCooldown = p.shootCooldown;
                this.audio.play('sfx_player_shot', { volume: 0.33, minGap: 40 });
            }
        }

        for (const b of this.bullets) b.update(dt);

        // Аура Хайпмена: +HP/реген союзникам в радиусе (до обновления врагов).
        this._updateHypeAuras(dt);

        // Враги + снаряды/коллизии
        for (const e of this.enemies) {
            e.update(dt, px, py, C.ARENA_WIDTH, C.ARENA_HEIGHT);

            if (e.justThrew) {
                const pr = this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.throwTargetPos.x, e.throwTargetPos.y);
                pr.damage = e.damage; // снаряд наследует урон стрелка (10/20/30 по этапу)
                this.enemyProjectiles.push(pr);
            }
            if (e.justSoundWave) {
                // Сабвуфер: направленная звуковая волна (сектор 90°) от врага к игроку.
                const SW = C.SUBWOOFER;
                this.soundWaves.push({
                    x: e.sprite.x, y: e.sprite.y,
                    angle: Math.atan2(py - e.sprite.y, px - e.sprite.x),
                    radius: 0, maxRadius: SW.WAVE_RADIUS, halfArc: SW.WAVE_HALF_ARC,
                    timer: 0, hit: false, damage: e.damage,
                });
                // НЕ sfx_boss_warning: иначе на главе 2+ «сигнал босса» звучит при каждом
                // ударе Сабвуфера, хотя босс давно мёртв. Глухой «бум» уместнее для волны баса.
                this.audio.play('sfx_slam', { volume: 0.3, minGap: 80 });
            }
            if (e.justFiredVolley) {
                for (let v = 0; v < 12; v++) {
                    const ang = v * (2 * Math.PI / 12);
                    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
                    const pr = this.spawnEnemyProjectile(e.sprite.x, e.sprite.y, e.sprite.x + dir.x * 500, e.sprite.y + dir.y * 500);
                    pr.damage = e.damage; // волна босса: урон = урон босса
                    this.enemyProjectiles.push(pr);
                }
            }

            const attackDist = e.isBoss ? C.COLLISION.BOSS_HIT_SQ : (e.type === EnemyType.GOBLIN ? C.COLLISION.GOBLIN_ATTACK_SQ : C.COLLISION.ENEMY_ATTACK_SQ);
            if (distSq(e.sprite.x, e.sprite.y, px, py) < attackDist) {
                const oldHp = p.hp;
                p.takeDamage(e.damage);
                if (p.hp < oldHp) { this.triggerShake(0.2, 2 * e.damage); this.audio.play('sfx_player_hurt'); }
                if (p.hp <= 0 && !this.isGameOver) this.onPlayerDeath();

                // Блейдмейл (шипы): враг, врезавшийся в героя, получает урон.
                // Кулдаун на враге, чтобы контакт не сливал HP каждый кадр.
                if (p.bladeMail && !(e.bladeMailCd > 0)) {
                    const thorns = Math.max(25, p.attackDamage * 2);
                    e.hp -= thorns;
                    e.hitFlashTimer = 0.12;
                    e.bladeMailCd = 0.5;
                    this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, thorns, false));
                }
            }
            if (e.bladeMailCd > 0) e.bladeMailCd -= dt;

            // Лазерный луч STROBE: урон, если игрок на линии луча (i-frames в takeDamage не дают слить HP)
            if (e.isBoss3 && e.beamActive) {
                const bx = e.sprite.x, by = e.sprite.y;
                const dirx = Math.cos(e.beamAngle), diry = Math.sin(e.beamAngle);
                const rx = px - bx, ry = py - by;
                const proj = rx * dirx + ry * diry; // позиция вдоль луча
                if (proj > 0 && proj < e.beamLen) {
                    const perp = Math.abs(rx * -diry + ry * dirx); // отступ от линии
                    if (perp < e.beamWidth / 2 + C.STROBE_BEAM_HIT_MARGIN) {
                        const oldHp = p.hp;
                        p.takeDamage(C.STROBE_BEAM_DAMAGE);
                        if (p.hp < oldHp) { this.triggerShake(0.25, 80); this.audio.play('sfx_player_hurt'); }
                        if (p.hp <= 0 && !this.isGameOver) this.onPlayerDeath();
                    }
                }
            }

            for (const b of this.bullets) {
                if (b.isDestroyed || b.lastHit === e) continue;
                const hitDist = e.isBoss ? C.COLLISION.BOSS_HIT_SQ : C.COLLISION.BULLET_HIT_SQ;
                if (distSq(e.sprite.x, e.sprite.y, b.sprite.x, b.sprite.y) < hitDist) {
                    e.hp -= b.damage;
                    e.hitFlashTimer = 0.08;
                    this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, b.damage, b.isCrit));
                    // Прострел: пуля проходит насквозь, следующему врагу — 50% урона.
                    if (b.pierceLeft > 0) {
                        b.pierceLeft--;
                        b.lastHit = e; // не бить того же врага повторно
                        b.damage = Math.max(1, Math.floor(b.damage * 0.5));
                    } else {
                        b.isDestroyed = true;
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
            if (distSq(g.sprite.x, g.sprite.y, px, py) < C.COLLISION.GEM_PICKUP_SQ) { g.isCollected = true; p.gainXP(1); }
        }
        this._filterRelease(this.gems, 'gem', g => g.isCollected);

        // Монеты (в hardcore — множитель; дробный остаток копится, чтобы totalCoins был целым)
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

        // Пластинки
        for (const v of this.vinyls) {
            v.update(dt);
            if (distSq(v.sprite.x, v.sprite.y, px, py) < C.COLLISION.VINYL_PICKUP_SQ) { v.isCollected = true; if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 10); }
        }
        this._filterRelease(this.vinyls, 'vinyl', v => v.isCollected);

        // Снаряды врагов
        for (const pr of this.enemyProjectiles) pr.update(dt, C.ARENA_WIDTH, C.ARENA_HEIGHT);
        for (const pr of this.enemyProjectiles) {
            if (pr.isDestroyed) continue;
            if (distSq(pr.sprite.x, pr.sprite.y, px, py) < C.COLLISION.PROJECTILE_HIT_SQ) {
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
        if (this.playerBeam) { this.playerBeam.timer -= dt; if (this.playerBeam.timer <= 0) this.playerBeam = null; }

        // Звуковые волны Сабвуфера: раскрываются; при достижении игрока (внутри сектора)
        // один раз отбрасывают его от центра и наносят урон.
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
                    da = Math.atan2(Math.sin(da), Math.cos(da)); // нормализация в [-π, π]
                    if (Math.abs(da) <= w.halfArc) {
                        w.hit = true;
                        p.sprite.x = clamp(p.sprite.x + (dx / dist) * SW.WAVE_KNOCKBACK, 0, C.ARENA_WIDTH);
                        p.sprite.y = clamp(p.sprite.y + (dy / dist) * SW.WAVE_KNOCKBACK, 0, C.ARENA_HEIGHT);
                        const oldHp = p.hp;
                        p.takeDamage(w.damage);
                        if (p.hp < oldHp) { this.triggerShake(0.3, 60); this.audio.play('sfx_player_hurt'); }
                        if (p.hp <= 0 && !this.isGameOver) this.onPlayerDeath();
                    }
                }
            }
            this.soundWaves = this.soundWaves.filter(w => w.timer < SW.WAVE_EXPAND + 0.15);
        }

        // Души боссов
        for (const soul of this.bossSouls) {
            if (soul.isCollected) continue;
            soul.update(dt, this.globalTime);
            if (distSq(soul.sprite.x, soul.sprite.y, px, py) < C.COLLISION.SOUL_PICKUP_SQ) {
                let nextSlot = -1;
                for (let si = 0; si < 3; si++) if (this.equippedAbilities[si] < 0) { nextSlot = si; break; }
                // Поглощаем душу только при наличии свободного слота. Если все 3 заняты —
                // душа остаётся в мире (не исчезает впустую, давая ложную обратную связь).
                if (nextSlot >= 0) {
                    soul.isCollected = true;
                    if (soul.soulType === 1) { this.pendingAbilityIds = [0, 1, -1]; this.pendingAbilityCount = 2; }
                    else if (soul.soulType === 3) { this.pendingAbilityIds = [3, -1, -1]; this.pendingAbilityCount = 1; }
                    else { this.pendingAbilityIds = [2, -1, -1]; this.pendingAbilityCount = 1; }
                    this.pendingSlot = nextSlot;
                    this.abilitySelectAnimTimer = 0;
                    this.selectedAbilityIndex = -1;
                    this.setState(GameState.ABILITY_SELECT);
                    // Состояние сменилось на ABILITY_SELECT, а rebuildMenu уже спрятал
                    // оверлеи фазы (ЭТАП/затемнение). Выходим из updatePlaying, чтобы
                    // drawPlayingOverlays ниже не показал их снова поверх карточки выбора.
                    return;
                }
            }
        }
        this._filterDestroy(this.bossSouls, s2 => s2.isCollected);

        // Кулдауны способностей
        for (let i = 0; i < 3; i++) if (this.abilityCooldowns[i] > 0) this.abilityCooldowns[i] -= dt;

        // HUD
        let bossExists = false, bossHpPct = 0;
        for (const e of this.enemies) {
            if (e.isBoss) {
                bossExists = true; bossHpPct = Math.max(0, e.hp / e.maxHp);
                // setText только при смене имени — текстура текста иначе перегенерируется каждый кадр.
                const bn = e.isBoss3 ? t('boss3_name') : e.isBoss2 ? t('boss2_name') : t('boss_name');
                if (this._lastBossName !== bn) { this._lastBossName = bn; this.hud.bossName.setText(bn); }
                break;
            }
        }
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

    // separateEnemies / handleEnemyDeaths / _scoreFor вынесены в scene_combat.js

    // ===================== БЕЗУМНЫЙ ЭТАП / ПОРТАЛ =====================
    // Записать итоги завершившегося этапа как дельту от прошлого снимка.
    _snapshotStage() {
        this.stageStats.push({
            time: this.survivalTimer - this._stagePrev.time,
            kills: this.killCount - this._stagePrev.kills,
            coins: this.coinsThisRun - this._stagePrev.coins,
            score: this.runScore - this._stagePrev.score,
        });
        this._stagePrev = { time: this.survivalTimer, kills: this.killCount, coins: this.coinsThisRun, score: this.runScore };
    }

    // Третий босс убит: этап сходит с ума (x5 HP мобам, монет больше нет),
    // по центру вверху карты открывается портал — единственный выход.
    _startCrazyMode() {
        if (this.crazyMode) return;
        this._snapshotStage(); // итоги этапа 3 (до начала безумия)
        this.crazyMode = true;
        this.portal = { x: C.ARENA_WIDTH / 2, y: C.PORTAL_TOP_MARGIN };
        // Спрайт портала (если ассет есть) — под игроком (depth 8), с неоновым ореолом из вектора.
        if (this.textures.exists('portal')) {
            this.portalSprite = this.addWorld(this.add.image(this.portal.x, this.portal.y, 'portal')).setDepth(8);
            this.portalSprite.setDisplaySize(C.PORTAL_RADIUS * 2.6, C.PORTAL_RADIUS * 2.6);
            this._portalBaseScale = this.portalSprite.scaleX;
        }
        this.phaseNotifTimer = 0; // переиспользуем уведомление под «БЕЗУМИЕ»
        this.activeStep = 4;      // 4 — специальный шаг для подписи «БЕЗУМИЕ»
        this.audio.play('sfx_boss_warning', { volume: 0.7 });
    }

    // Игрок вошёл в портал — фиксируем результат и показываем итоги 3 этапов.
    _enterPortal() {
        this.audio.play('sfx_menu_click');
        // Глава пройдена — открываем следующую (если есть) и сохраняем прогресс.
        const next = this.currentChapter + 1;
        if (next <= CHAPTERS.length && this.save.maxChapterUnlocked < next) this.save.maxChapterUnlocked = next;
        this.saveGame();
        // Результат проходит в таблицу: если ник уже есть — тихо отправляем и показываем итоги.
        // Если ника ещё нет (первый забег) — просим ввести, а итоги покажем после ввода.
        if (this.qualifiesForLeaderboard(this.runScore, this.survivalTimer, this._runMode())) {
            if (this.save.playerName) {
                this._submitScore(this.save.playerName, false);
            } else {
                this._stageClearAfterName = true; // после ввода ника вернуться к итогам, а не к таблице
                this.nameInput = '';
                this._nameError = '';
                this.setState(GameState.NAME_INPUT);
                return;
            }
        }
        this.setState(GameState.STAGE_CLEAR);
    }

    // ===================== СПОСОБНОСТИ (activateAbility) =====================
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
            this.triggerShake(0.4, 30);
            this.audio.play('sfx_slam', { volume: 0.8 });
        } else if (id === 2) {
            for (let d = 0; d < A.DISC_COUNT; d++) {
                const angle = d * (2 * Math.PI / A.DISC_COUNT);
                this.bullets.push(this.spawnBullet(px, py, Math.cos(angle), Math.sin(angle), A.DISC_DAMAGE, false));
            }
        } else if (id === 3) {
            // ЛАЗЕР: мгновенный пробивающий луч в сторону курсора
            const ptr = this.input.activePointer;
            const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
            let dx = wp.x - px, dy = wp.y - py;
            if (dx * dx + dy * dy < 1e-6) { dx = 1; dy = 0; }
            const n = normalize(dx, dy);
            const len = A.LASER_LENGTH, halfW = A.LASER_HALF_WIDTH, dmg = A.LASER_DAMAGE;
            for (const e of this.enemies) {
                const rx = e.sprite.x - px, ry = e.sprite.y - py;
                const proj = rx * n.x + ry * n.y;           // расстояние вдоль луча
                if (proj > 0 && proj < len) {
                    const perp = Math.abs(rx * -n.y + ry * n.x); // отступ от линии
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
        p.hp = Math.min(p.maxHp, p.hp + 20); // не полное восстановление, а +20 HP
        this.levelUpAnimTimer = 0;
        // Пул: стакаемые карты 0..4 всегда доступны. Легендарные (блейдмейл/прострел) —
        // только пока не взяты и лишь по редкому ролу, поэтому выпадают заметно реже обычных.
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
        // Скорострельность: множительная прибавка с затуханием и более высоким полом —
        // стак только этой карты больше не делает забег слишком быстрым.
        if (id === 0) p.shootCooldown = Math.max(0.22, p.shootCooldown * 0.93);
        else if (id === 1) p.attackDamage += 1;
        else if (id === 2 && p.speed < 400) p.speed += 20;
        else if (id === 3 && p.pickupRadius < 600) p.pickupRadius += 50;
        else if (id === 4) { p.maxHp += 10; p.hp = p.maxHp; }
        else if (id === 5) p.bladeMail = true; // блейдмейл: враг при контакте получает урон
        else if (id === 6) p.pierce = true;    // прострел: пуля пробивает врага насквозь
        p.lastUpgradeId = id;
        p.messageTimer = 2.0;
        if (id >= 0 && id < 7) this.runUpgradeLevels[id]++;
        this.selectedLevelUpIndex = -1;
        this.setState(GameState.PLAYING);
    }

    // ===================== ОВЕРЛЕИ ИГРЫ (Game::render) =====================
    // (мировой рендер FX — drawWorldFx / _drawSoundWaveWalls / _drawPortal / _drawBossArrow —
    //  вынесен в scene_fx.js)
    drawPlayingOverlays() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, p = this.player;

        // Сообщение об апгрейде над игроком
        if (p.messageTimer > 0 && !this.isGameOver) {
            const str = t('upgrade_toasts')[p.lastUpgradeId] || '';
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

        // Уведомление о фазе (шаг 4 — «БЕЗУМИЕ» после третьего босса)
        if (this.activeStep > 0 && this.phaseNotifTimer < 3.5 && !this.isGameOver) {
            const alpha = this.phaseNotifTimer > 2.5 ? 1 - (this.phaseNotifTimer - 2.5) : 1;
            let col = '#00ffc8', label = t('phase') + '  ' + this.activeStep;
            if (this.activeStep === 2) col = '#ff5050';
            else if (this.activeStep === 3) col = '#ff8c00';
            else if (this.activeStep === 4) { col = '#ff0064'; label = t('crazy_title'); }
            this.phaseOverlay.setVisible(true).setFillStyle(0x000000, 170 / 255 * alpha);
            this.phaseText.setVisible(true).setText(label).setColor(col).setAlpha(alpha);
        } else { this.phaseOverlay.setVisible(false); this.phaseText.setVisible(false); }

        // Подсказка: зачистка / уход в портал (безумный этап)
        if (this.crazyMode && !this.isGameOver) {
            const blink = 0.6 + 0.4 * Math.sin(this.globalTime * 6);
            this.clearText.setVisible(true).setText(t('crazy_hint'))
                .setColor('#00e6ff').setAlpha(blink);
        } else if ((this.gamePhase === GamePhase.CLEARING || (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)) && !this.isGameOver) {
            this.clearText.setVisible(true).setText(t('clear_all') + '  [' + this.enemies.length + ']').setColor('#ff5050').setAlpha(1);
        } else this.clearText.setVisible(false);

        // Предупреждения перед боссом
        let warnA = 0, warnCol = 0xff0000;
        if (this.survivalTimer > 60 && this.survivalTimer < 63 && !this.isGameOver) {
            warnA = Math.abs(Math.sin(this.survivalTimer * 10)) * 100 / 255; warnCol = 0xff0000;
        } else if (this.gamePhase === GamePhase.PHASE_2 && this.phase2Timer > 57 && this.phase2Timer < 60 && !this.phase2BossSpawned && !this.isGameOver) {
            warnA = Math.abs(Math.sin(this.phase2Timer * 10)) * 110 / 255; warnCol = 0x8200ff;
        } else if (this.gamePhase === GamePhase.PHASE_3 && this.phase3Timer > 57 && this.phase3Timer < 60 && !this.phase3BossSpawned && !this.isGameOver) {
            warnA = Math.abs(Math.sin(this.phase3Timer * 10)) * 110 / 255; warnCol = 0x00e6ff;
        }
        this.warnRect.setVisible(warnA > 0).setFillStyle(warnCol, warnA);
        // Звук «внимание» — зациклен, пока мерцает экран; стоп, когда мерцание гаснет.
        if (warnA > 0) {
            if (!this._warnSound) this._warnSound = this.audio.playLoopSfx('sfx_boss_warning', { volume: 0.8 });
        } else if (this._warnSound) { this.audio.releaseLoopSfx(this._warnSound); this._warnSound = null; }

        this._drawBossArrow(); // определён в scene_fx.js
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

}
