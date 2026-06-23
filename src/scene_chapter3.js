
// Режиссёр главы 3 («Гаунтлет»). Владеет логикой этапов 2–3: гейтинг ростера,
// мид-боссы на половине кап-убийств, передышки, финальный дуэт и триггер портала.
// Этап 1 идёт штатным драйвером (B1 в конце фазы). Вызывается из
// _updatePhaseProgression только при chapter.custom === 'CH3'.

MainScene.prototype._updateChapter3 = function(dt, px, py) {
        // Режиссёр активен только на этапах 2–3. Этап 1 (PHASE_1) и переход
        // (CLEARING) ведёт штатный драйвер — иначе init-такт спавнил бы B2 ещё
        // на этапе 1, как только phaseKills дойдёт до N2/2.
        if (this.gamePhase !== GamePhase.PHASE_2 && this.gamePhase !== GamePhase.PHASE_3) return;

        const C3 = C.CHAPTER3;
        const hc = this.save.isHardcoreMode ? C3.HARDCORE_KILL_MULT : 1;
        const N2 = Math.round(C3.STAGE2_KILLS * hc);
        const N3 = Math.round(C3.STAGE3_KILLS * hc);

        // Обратный отсчёт передышки.
        if (this._ch3Breather > 0) {
            this._ch3Breather -= dt;
            if (this._ch3Breather <= 0) { this._ch3Breather = 0; this._ch3NoSpawn = false; }
        }

        // Вход в новый этап: включить ростер гл.2 и сбросить такт.
        if (this.gamePhase !== this._ch3LastPhase) {
            this._ch3LastPhase = this.gamePhase;
            if (this.gamePhase === GamePhase.PHASE_2) {
                this._mosherKey = C3.mosherKey;
                this._subwooferKey = C3.subwooferKey;
                this._ch3Beat = 'S2_MOBS'; this._ch3NoSpawn = false;
            } else if (this.gamePhase === GamePhase.PHASE_3) {
                this._ch3Beat = 'S3_MOBS'; this._ch3NoSpawn = false;
            }
        }

        const midAlive = this.enemies.some(e => e._ch3MidBoss && e.hp > 0);

        switch (this._ch3Beat) {
            case 'S2_MOBS':
                if (this.phaseKills >= Math.floor(N2 / 2)) {
                    this._ch3SpawnMidBoss('B2', px, py);
                    this._ch3Beat = 'S2_MIDBOSS';
                }
                break;
            case 'S2_MIDBOSS':
                if (!midAlive) {
                    this._ch3Breather = C3.BREATHER; this._ch3NoSpawn = true;
                    this._ch3Beat = 'S2_CLEAR';
                }
                break;
            case 'S2_CLEAR':
                if (this._ch3Breather <= 0 && this.phaseKills >= N2) {
                    // Запуск штатного перехода PHASE_2 → PHASE_3 (часть (a) драйвера).
                    this.phaseTransitionTimer = 0; this.phaseEventFired = false;
                    this._ch3Beat = 'S2_DONE';
                }
                break;
            case 'S3_MOBS':
                if (this.phaseKills >= Math.floor(N3 / 2)) {
                    this._ch3SpawnMidBoss('RHINO', px, py);
                    this._ch3Beat = 'S3_MIDBOSS';
                }
                break;
            case 'S3_MIDBOSS':
                if (!midAlive) {
                    this._ch3Breather = C3.BREATHER; this._ch3NoSpawn = true;
                    this._ch3Beat = 'S3_CLEAR';
                }
                break;
            case 'S3_CLEAR':
                if (this._ch3Breather <= 0 && this.phaseKills >= N3) {
                    this._ch3SpawnDuet(px, py);
                    this._ch3NoSpawn = true; // подавляем мобов на время боя дуэта
                    this._ch3Beat = 'S3_DUET';
                }
                break;
            case 'S3_DUET':
                if (!this.enemies.some(e => e.isBoss && e.hp > 0)) {
                    this._ch3NoSpawn = false; // вернуть спавн для crazy-режима
                    this._ch3Beat = 'DONE';
                    this._startCrazyMode();
                }
                break;
        }
    };

MainScene.prototype._ch3SpawnMidBoss = function(kind, px, py) {
        const bp = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
        let boss;
        if (kind === 'B2') {
            const art = this._tex('boss2', 'boss2');
            boss = new Enemy(this, bp.x, bp.y, art);
            boss.makeBoss2(art);
        } else { // 'RHINO' = Bass-rush
            const art = this._tex(C.CHAPTER3.rhinoArt, 'c2_boss2');
            boss = new Enemy(this, bp.x, bp.y, art);
            boss.makeBossBass(art);
            boss._ch3Rhino = true;
        }
        boss._ch3MidBoss = true;
        this._applyChapterBoss(boss);
        if (this.save.isHardcoreMode) { boss.speed *= 1.5; boss.hp *= 2; boss.maxHp *= 2; }
        this.enemies.push(boss);
    };

MainScene.prototype._ch3SpawnDuet = function(px, py) {
        const da = this._tex(C.CHAPTER3.doctorArt, 'c2_boss1');
        const ta = this._tex(C.CHAPTER3.teleporterArt, 'boss3');
        const p1 = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
        const doc = new Enemy(this, p1.x, p1.y, da); doc.makeBossDoctor(da);
        const p2 = findSpawnPos(px, py, this.arenaW, this.arenaH, 800);
        const tp = new Enemy(this, p2.x, p2.y, ta); tp.makeBoss3(ta);
        for (const b of [doc, tp]) {
            this._applyChapterBoss(b);
            if (this.save.isHardcoreMode) { b.speed *= 1.3; b.hp *= 2; b.maxHp *= 2; }
            this.enemies.push(b);
        }
    };
