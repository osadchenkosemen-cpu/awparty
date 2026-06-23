
MainScene.prototype._bossKillReq = function(step) {
        const base = C.BOSS_KILL_REQ[Math.max(1, step | 0) - 1] || C.BOSS_KILL_REQ[C.BOSS_KILL_REQ.length - 1];
        const sm = (this.chapter && this.chapter.spawnMult) || 1;
        const hc = this.save.isHardcoreMode ? 1.5 : 1;
        return Math.round(base * sm * hc);
    };

MainScene.prototype._updatePhaseProgression = function(dt, px, py) {
        const s = this.save;
        if (this.phaseTransitionTimer >= 0) {
            this.phaseTransitionTimer += dt;
            if (!this.phaseEventFired && this.phaseTransitionTimer >= 0.7) {
                this.phaseEventFired = true;
                if (this.gamePhase === GamePhase.CLEARING) {
                    this._snapshotStage();
                    this.gamePhase = GamePhase.PHASE_2; this.phaseNotifTimer = 0; this.activeStep = 2; this.phase2Timer = 0; this.phaseKills = 0; this.spawner.resetForPhase2();
                } else if (this.gamePhase === GamePhase.PHASE_2) {
                    this._snapshotStage();
                    this.gamePhase = GamePhase.PHASE_3; this.phaseNotifTimer = 0; this.activeStep = 3; this.phase3Timer = 0; this.phaseKills = 0; this.spawner.resetForPhase2();
                }
            }
            if (this.phaseTransitionTimer >= 1.5) { this.phaseTransitionTimer = -1; this.phaseEventFired = false; }
        }

        if (this.chapter && this.chapter.custom === 'CH3') { this._updateChapter3(dt, px, py); return; }

        if (this.gamePhase === GamePhase.PHASE_3) {
            this.phase3Timer += dt;
            if ((this.phase3Timer >= C.BOSS_TIME_CAP || (this.phase3Timer >= C.BOSS_KILL_MIN_TIME && this.phaseKills >= this._bossKillReq(3))) && !this.phase3BossSpawned) {
                const bp = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
                const boss3 = new Enemy(this, bp.x, bp.y, this._boss3Key);
                if (this.chapter && this.chapter.boss3Type === 'SPLIT') boss3.makeBossSplit(this._boss3Key, 0);
                else boss3.makeBoss3(this._boss3Key);
                this._applyChapterBoss(boss3);
                if (s.isHardcoreMode) { boss3.speed *= 1.3; boss3.hp *= 2; boss3.maxHp *= 2; }
                this.enemies.push(boss3);
                this.phase3BossSpawned = true;
                this._boss3Alive = true;
            }
        }

        if (this.gamePhase === GamePhase.PHASE_2) {
            this.phase2Timer += dt;
            if ((this.phase2Timer >= C.BOSS_TIME_CAP || (this.phase2Timer >= C.BOSS_KILL_MIN_TIME && this.phaseKills >= this._bossKillReq(2))) && !this.phase2BossSpawned) {
                const bp = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
                const bx = bp.x, by = bp.y;
                const boss2 = new Enemy(this, bx, by, this._boss2Key);
                if (this.chapter && this.chapter.boss2Type === 'BASS') boss2.makeBossBass(this._boss2Key);
                else boss2.makeBoss2(this._boss2Key);
                this._applyChapterBoss(boss2);
                if (s.isHardcoreMode) { boss2.speed *= 1.5; boss2.hp *= 2; boss2.maxHp *= 2; }
                this.enemies.push(boss2);
                this.phase2BossSpawned = true;
            }
        }
    };

MainScene.prototype._updateSpawning = function(dt, px, py) {
        const s = this.save;
        if (this._crazySpawnDelay > 0) this._crazySpawnDelay -= dt;
        const spawningActive = (this.gamePhase !== GamePhase.CLEARING)
            && !(this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned)
            && !(this.gamePhase === GamePhase.PHASE_3 && this._boss3Alive)
            && !(this.crazyMode && this._crazySpawnDelay > 0)
            && !this._ch3NoSpawn
            && (this.phaseTransitionTimer < 0);
        if (spawningActive) {
            const p2 = this.gamePhase === GamePhase.PHASE_2;
            const p3 = this.gamePhase === GamePhase.PHASE_3;
            const spawnTime = p3 ? this.phase3Timer : (p2 ? this.phase2Timer : this.survivalTimer);
            this.spawner.update(this, dt, spawnTime, this.arenaW, this.arenaH, px, py, this.enemies,
                s.isHardcoreMode, this._enemyKey, this._goblinKey, p2, this.phase2Timer, p3, this.activeStep);
        }
    };

MainScene.prototype._checkPhaseTransitions = function() {
        if (this.gamePhase === GamePhase.CLEARING && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
        if (this.chapter && this.chapter.custom === 'CH3') return;
        if (this.gamePhase === GamePhase.PHASE_2 && this.phase2BossSpawned && this.enemies.length === 0 && this.phaseTransitionTimer < 0) {
            this.phaseTransitionTimer = 0; this.phaseEventFired = false;
        }
    };

MainScene.prototype._snapshotStage = function() {
        this.stageStats.push({
            time: this.survivalTimer - this._stagePrev.time,
            kills: this.killCount - this._stagePrev.kills,
            coins: this.coinsThisRun - this._stagePrev.coins,
            score: this.runScore - this._stagePrev.score,
        });
        this._stagePrev = { time: this.survivalTimer, kills: this.killCount, coins: this.coinsThisRun, score: this.runScore };
    };

MainScene.prototype._startCrazyMode = function() {
        if (this.crazyMode) return;
        this._snapshotStage();
        this.crazyMode = true;
        this._crazySpawnDelay = 10;
        this.portal = { x: this.arenaW / 2, y: C.PORTAL_TOP_MARGIN };
        if (this.textures.exists('portal')) {
            this.portalSprite = this.addWorld(this.add.image(this.portal.x, this.portal.y, 'portal')).setDepth(8);
            this.portalSprite.setDisplaySize(C.PORTAL_RADIUS * 2.6, C.PORTAL_RADIUS * 2.6);
            this._portalBaseScale = this.portalSprite.scaleX;
        }
        this.phaseNotifTimer = 0;
        this.activeStep = 4;
        this.audio.play('sfx_boss_warning', { volume: 0.7 });
    };

MainScene.prototype._enterPortal = function() {
        this.audio.play('sfx_menu_click');
        const next = this.currentChapter + 1;
        if (next <= CHAPTERS.length && this.save.maxChapterUnlocked < next) this.save.maxChapterUnlocked = next;
        this.saveGame();
        if (this.save.playerName) {
            this._submitChapterResult(this.save.playerName);
        } else {
            this._pendingPortalSubmit = true;
            this.nameInput = '';
            this._nameError = '';
            this.setState(GameState.NAME_INPUT);
        }
    };
