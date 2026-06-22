
MainScene.prototype._buildEnemyGrid = function() {
        const CELL = C.CELL_SIZE;
        const cols = Math.ceil(C.ARENA_WIDTH / CELL);
        const rows = Math.ceil(C.ARENA_HEIGHT / CELL);
        if (!this._sepGrid || this._sepGrid.length !== cols * rows) {
            this._sepGrid = new Array(cols * rows);
            for (let i = 0; i < this._sepGrid.length; i++) this._sepGrid[i] = [];
            this._sepTouched = [];
        }
        this._sepCols = cols; this._sepRows = rows;
        const grid = this._sepGrid;
        for (const i of this._sepTouched) grid[i].length = 0;
        this._sepTouched.length = 0;
        for (const e of this.enemies) {
            const c = clamp(Math.floor(e.sprite.x / CELL), 0, cols - 1);
            const r = clamp(Math.floor(e.sprite.y / CELL), 0, rows - 1);
            const i = r * cols + c;
            const cell = grid[i];
            if (cell.length === 0) this._sepTouched.push(i);
            cell.push(e);
        }
    };

MainScene.prototype._bulletEnemyCollisions = function() {
        const CELL = C.CELL_SIZE;
        const cols = this._sepCols, rows = this._sepRows, grid = this._sepGrid;
        for (const b of this.bullets) {
            if (b.isDestroyed) continue;
            const bx = b.sprite.x, by = b.sprite.y;
            const bcol = clamp(Math.floor(bx / CELL), 0, cols - 1);
            const brow = clamp(Math.floor(by / CELL), 0, rows - 1);
            for (let r = brow - 1; r <= brow + 1 && !b.isDestroyed; r++) {
                if (r < 0 || r >= rows) continue;
                for (let c = bcol - 1; c <= bcol + 1 && !b.isDestroyed; c++) {
                    if (c < 0 || c >= cols) continue;
                    const cell = grid[r * cols + c];
                    for (const e of cell) {
                        if (e.hp <= 0 || b.lastHit === e) continue;
                        const hitDist = e.isBoss ? C.COLLISION.BOSS_HIT_SQ : C.COLLISION.BULLET_HIT_SQ;
                        if (distSq(e.sprite.x, e.sprite.y, bx, by) < hitDist) {
                            e.hp -= b.damage;
                            e.hitFlashTimer = 0.08;
                            this.dmgTexts.push(this.spawnDamageText(e.sprite.x, e.sprite.y, b.damage, b.isCrit));
                            if (b.pierceLeft > 0) {
                                b.pierceLeft--;
                                b.lastHit = e;
                                b.damage = Math.max(1, Math.floor(b.damage * 0.5));
                            } else {
                                b.isDestroyed = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    };

MainScene.prototype.separateEnemies = function(px, py) {
        const CELL = C.CELL_SIZE;
        const cols = this._sepCols, rows = this._sepRows, grid = this._sepGrid;
        const R = C.COLLISION.SEPARATION_ACTIVE_SQ;
        for (let ei = 0; ei < this.enemies.length; ei++) {
            const e = this.enemies[ei];
            if (distSq(e.sprite.x, e.sprite.y, px, py) > R) continue;
            const col = Math.floor(e.sprite.x / CELL), row = Math.floor(e.sprite.y / CELL);
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = col - 1; c <= col + 1; c++) {
                    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
                    const cell = grid[r * cols + c];
                    if (cell.length === 0) continue;
                    for (const other of cell) {
                        if (e === other) continue;
                        if (e._id >= other._id) continue;
                        if (distSq(other.sprite.x, other.sprite.y, px, py) > R) continue;
                        const dq = distSq(e.sprite.x, e.sprite.y, other.sprite.x, other.sprite.y);
                        const minOverlap = (e.isBoss || other.isBoss) ? C.COLLISION.OVERLAP_BOSS : C.COLLISION.OVERLAP_NORMAL;
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
    };

MainScene.prototype.handleEnemyDeaths = function(px, py) {
        const s = this.save, p = this.player;
        const split = [];
        for (const e of this.enemies) {
            if (e.hp > 0) continue;
            this.killCount++;
            if (e.splitOnDeath && this._mosherKey) {
                const SP = C.ENEMY.MOSHER;
                const n = SP.splitMin + randInt(SP.splitMax - SP.splitMin + 1);
                for (let i = 0; i < n; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const mx = clamp(e.sprite.x + Math.cos(ang) * 40, 0, C.ARENA_WIDTH);
                    const my = clamp(e.sprite.y + Math.sin(ang) * 40, 0, C.ARENA_HEIGHT);
                    const m = new Enemy(this, mx, my, this._mosherKey);
                    m.makeMosherling(this._mosherKey);
                    this._applyChapterEnemy(m);
                    split.push(m);
                }
            }
            if (!this.crazyMode) this.runScore += this._scoreFor(e);
            if (hasArtifact(s, ARTIFACT.SOUL_LEECH)) {
                const cap = p.baseCritChance + 0.05;
                p.critChance = Math.min(cap, p.critChance + 0.005);
            }
            if (hasArtifact(s, ARTIFACT.BLOOD_PACT) && p.hp < p.maxHp) {
                p.hp = Math.min(p.maxHp, p.hp + 2);
            }
            const ex = e.sprite.x, ey = e.sprite.y;
            if (e.type === EnemyType.GOBLIN) {
                for (let i = 0; i < 30; i++) this.particles.push(this.spawnParticle(ex, ey, randInt(2) === 0 ? rgb(180, 0, 255) : rgb(255, 0, 200)));
                for (let k = 0; k < 3; k++) this.gems.push(this.spawnGem(ex - 24 + randInt(40) - 20, ey + randInt(40) - 20));
                if (!this.crazyMode && randInt(100) < 50) this.coins.push(this.spawnCoin(ex + 38, ey));
                if (randInt(100) < 35) this.vinyls.push(this.spawnVinyl(ex, ey));
                continue;
            }
            const isSub = e.type === EnemyType.SUBWOOFER;
            const particleCount = (e.isBoss2 || e.isBoss3) ? 300 : (e.isBoss ? 200 : (isSub ? 40 : 15));
            const c1 = isSub ? rgb(60, 90, 255) : e.isBoss3 ? rgb(0, 230, 255) : e.isBoss2 ? rgb(200, 0, 255) : rgb(255, 20, 50);
            const c2 = isSub ? rgb(0, 220, 255) : e.isBoss3 ? rgb(150, 255, 255) : e.isBoss2 ? rgb(255, 100, 0) : rgb(255, 0, 150);
            for (let i = 0; i < particleCount; i++) this.particles.push(this.spawnParticle(ex, ey, randInt(2) === 0 ? c1 : c2));

            if (e.isBoss3) {
                this.audio.play('sfx_boss_death', { volume: 1 });
                if (e.isBossSplit && e.canSplit) {
                    for (let i = 0; i < e.splitCount; i++) {
                        const ang = (i / e.splitCount) * Math.PI * 2 + Math.random();
                        const cx = clamp(ex + Math.cos(ang) * 70, 60, C.ARENA_WIDTH - 60);
                        const cy = clamp(ey + Math.sin(ang) * 70, 60, C.ARENA_HEIGHT - 60);
                        const c = new Enemy(this, cx, cy, this._boss3Key);
                        c.makeBossSplit(this._boss3Key, e.splitTier + 1);
                        this._applyChapterBoss(c);
                        if (s.isHardcoreMode) { c.hp *= 2; c.maxHp *= 2; }
                        split.push(c);
                    }
                }
                const isFinal = !(e.isBossSplit && e.canSplit) && !this.enemies.some(o => o !== e && o.isBoss3 && o.hp > 0);
                if (!e.isBossSplit || e.splitTier === 0 || isFinal) this.triggerShake(0.8, 70);
                if (isFinal && !this.crazyMode) {
                    this._boss3Alive = false;
                    this.bossSouls.push(new BossSoul(this, ex, ey, e.isBossSplit ? 6 : 3));
                    for (let k = 0; k < 20; k++) {
                        this.gems.push(this.spawnGem(ex + randInt(150) - 75, ey + randInt(150) - 75));
                        this.coins.push(this.spawnCoin(ex + randInt(150) - 75, ey + randInt(150) - 75));
                    }
                    for (let k = 0; k < 3; k++) this.vinyls.push(this.spawnVinyl(ex + randInt(80) - 40, ey + randInt(80) - 40));
                    this._startCrazyMode();
                } else {
                    this._boss3Alive = true;
                }
            } else if (e.isBoss2) {
                this.triggerShake(0.8, 60);
                this.audio.play('sfx_boss_death', { volume: 1 });
                this.bossSouls.push(new BossSoul(this, ex, ey, e.isBossBass ? 5 : 2));
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
                this.bossSouls.push(new BossSoul(this, ex, ey, e.isBossDoc ? 4 : 1));
                this._firstBossKilled = true;
                if (this.gamePhase === GamePhase.PHASE_1) this.gamePhase = GamePhase.CLEARING;
            } else {
                const off = 24;
                this.gems.push(this.spawnGem(ex - off, ey));
                if (!this.crazyMode && randInt(100) < 15) this.coins.push(this.spawnCoin(ex + off, ey));
                if (randInt(100) < 2) this.vinyls.push(this.spawnVinyl(ex, ey));
            }
        }
        for (const m of split) this.enemies.push(m);
    };

MainScene.prototype._scoreFor = function(e) {
        const S = C.SCORE;
        if (e.isBoss3) return (e.isBossSplit && e.splitTier > 0) ? Math.round(S.BOSS3 * (e.splitTier === 1 ? 0.2 : 0.08)) : S.BOSS3;
        if (e.isBoss2) return S.BOSS2;
        if (e.isBoss) return S.BOSS1;
        if (e.type === EnemyType.GOBLIN) return S.GOBLIN;
        if (e.type === EnemyType.SUBWOOFER) return S.SUBWOOFER;
        if (e.type === EnemyType.MOSHER) return S.MOSHER;
        if (e.type === EnemyType.MOSHERLING) return S.MOSHERLING;
        if (e.type === EnemyType.HYPEMAN) return S.HYPEMAN;
        if (e.type === EnemyType.FAST) return S.FAST;
        if (e.type === EnemyType.TANK) return S.TANK;
        return S.NORMAL;
    };
