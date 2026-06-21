// scene_spawndriver.js — драйвер прогрессии забега MainScene (вынесено из updatePlaying / scene.js).
// Методы навешиваются на MainScene.prototype (класс объявлен в scene.js, грузится раньше).
// Сюда входят: переходы этапов + спавн боссов 2/3, гейт обычного спавна, запуск перехода при
// зачистке этапа, и «безумный» этап / портал (снимок этапа, старт безумия, вход в портал).
// Портал-чек с ранним return остаётся в updatePlaying — управление потоком не выносим.

// Прогрессия фаз: фейд-переход между этапами + спавн боссов фаз 2 и 3.
MainScene.prototype._updatePhaseProgression = function(dt, px, py) {
        const s = this.save;
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
                this._boss3Alive = true; // снимается в handleEnemyDeaths при смерти босса-3
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
    };

// Гейт обычного спавна по фазе: пока не CLEARING, не во время босса фазы 2/3 и не в переходе.
MainScene.prototype._updateSpawning = function(dt, px, py) {
        const s = this.save;
        const spawningActive = (this.gamePhase !== GamePhase.CLEARING)
            && !(this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)
            && !(this.gamePhase === GamePhase.PHASE_3 && this._boss3Alive)
            && (this.phaseTransitionTimer < 0);
        if (spawningActive) {
            const p2 = this.gamePhase === GamePhase.PHASE_2;
            const p3 = this.gamePhase === GamePhase.PHASE_3;
            const spawnTime = p3 ? this.phase3Timer : (p2 ? this.phase2Timer : this.survivalTimer);
            this.spawner.update(this, dt, spawnTime, C.ARENA_WIDTH, C.ARENA_HEIGHT, px, py, this.enemies,
                s.isHardcoreMode, this._enemyKey, this._goblinKey, p2, this.phase2Timer, p3, this.activeStep);
        }
    };

// Запуск перехода фаз, когда этап зачищен (CLEARING пуст / босс фазы 2 убит и врагов нет).
MainScene.prototype._checkPhaseTransitions = function() {
        if (this.gamePhase === GamePhase.CLEARING && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
        if (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
    };

// ===================== БЕЗУМНЫЙ ЭТАП / ПОРТАЛ =====================
// Записать итоги завершившегося этапа как дельту от прошлого снимка.
MainScene.prototype._snapshotStage = function() {
        this.stageStats.push({
            time: this.survivalTimer - this._stagePrev.time,
            kills: this.killCount - this._stagePrev.kills,
            coins: this.coinsThisRun - this._stagePrev.coins,
            score: this.runScore - this._stagePrev.score,
        });
        this._stagePrev = { time: this.survivalTimer, kills: this.killCount, coins: this.coinsThisRun, score: this.runScore };
    };

// Третий босс убит: этап сходит с ума (x5 HP мобам, монет больше нет),
// по центру вверху карты открывается портал — единственный выход.
MainScene.prototype._startCrazyMode = function() {
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
    };

// Игрок вошёл в портал — фиксируем результат и показываем итоги 3 этапов.
MainScene.prototype._enterPortal = function() {
        this.audio.play('sfx_menu_click');
        // Глава пройдена — открываем следующую (если есть) и сохраняем прогресс.
        const next = this.currentChapter + 1;
        if (next <= CHAPTERS.length && this.save.maxChapterUnlocked < next) this.save.maxChapterUnlocked = next;
        this.saveGame();
        // Рекорд пишется ТОЛЬКО здесь (пройдены все 3 этапа). Есть ник — сразу записываем
        // результат и считаем место; нет ника — просим ввести, запись после подтверждения.
        if (this.save.playerName) {
            this._submitChapterResult(this.save.playerName); // внутри: submit + место + STAGE_CLEAR
        } else {
            this._pendingPortalSubmit = true;
            this.nameInput = '';
            this._nameError = '';
            this.setState(GameState.NAME_INPUT);
        }
    };
