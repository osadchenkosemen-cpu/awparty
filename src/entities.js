
const DEG = 180 / Math.PI;

class Player {
    constructor(scene) {
        this.scene = scene;

        this.speed = 220;
        this.shootCooldown = 0.45;
        this.currentCooldown = 0;
        this.isMoving = false;

        this.level = 1;
        this.currentXP = 0;
        this.xpToNextLevel = 5;
        this.pickupRadius = 100;

        this.maxHp = 100;
        this.hp = 100;
        this.iFrames = 0;
        this.attackDamage = 1;

        this.critChance = 0.03;
        this.baseCritChance = 0.03;
        this.critMultiplier = 2.0;
        this.armor = 0;
        this.damageAcc = 0;

        this.ironSkinCharges = 0;
        this.soulLeechCritBonus = 0;

        this.bladeMail = false;
        this.pierce = false;

        this.damageReduction = 0;
        this.sphereLevel = 0;
        this.doubleTapLevel = 0;

        this.hasDashUnlocked = false;
        this.dashLevel = 0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDuration = 0.2;
        this.dashSpeed = 1200;
        this.dashCooldown = 3.0;
        this.currentDashCooldown = 0;
        this.dashDir = { x: 0, y: 0 };

        this.postDashSpeedMultiplier = 0.6;
        this.dashPenaltyDuration = 1.5;
        this.dashPenaltyTimer = 0;
        this.currentSpeedMultiplier = 1.0;

        this.ghosts = [];
        this.ghostSpawnTimer = 0;
        this.lastGhostX = 1500;
        this.lastGhostY = 1500;

        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.stunTimer = 0;

        this.lastUpgradeId = -1;
        this.messageTimer = 0;

        this.walkTimer = 0;
        this.animTimer = 0;
        this.idleTimer = 0;
        this.baseScale = 1.0;

        this.facing = 'front';
        this.animFrame = 0;
        this.ANIM_FPS = 8;
        this.ANIM_FRAMES = 6;
        this.currentTexKey = null;

        this.sprite = scene.addWorld(scene.add.sprite(1500, 1500, 'player_front'));
        this.sprite.setOrigin(0.5, 0.5);
        this.shadow = scene.addWorld(scene.add.ellipse(1500, 1500, 90, 36, 0x000000, 120 / 255));
        this.shadow.setDepth(-1);
        this.applySprite(false);
    }

    computePostDashMultiplier() {
        if (this.dashLevel >= C.MAX_PERM_DASH_LEVEL) return 1.0;
        const minMul = this.postDashSpeedMultiplier;
        const t = this.dashLevel / C.MAX_PERM_DASH_LEVEL;
        return minMul + (1.0 - minMul) * t;
    }

    computeDashPenaltyDuration() {
        if (this.dashLevel >= C.MAX_PERM_DASH_LEVEL) return 0;
        const t = this.dashLevel / C.MAX_PERM_DASH_LEVEL;
        return this.dashPenaltyDuration * (1.0 - t);
    }

    applySprite(moving) {
        let texKey;
        if (moving) {
            texKey = 'panim_' + this.facing + (this.animFrame + 1);
            if (!this.scene.textures.exists(texKey)) texKey = 'player_' + this.facing;
        } else {
            texKey = 'player_' + this.facing;
        }
        if (this.currentTexKey !== texKey) {
            this.currentTexKey = texKey;
            this.sprite.setTexture(texKey);
            this.sprite.setOrigin(0.5, 0.5);
            this.baseScale = 120 / this.sprite.height;
        }
    }

    gainXP(amount) { this.currentXP += amount; }

    takeDamage(amount) {
        if (this.iFrames <= 0 && !this.isDashing && !this.isInvincible) {
            if (this.ironSkinCharges > 0) { this.ironSkinCharges--; this.iFrames = 0.3; return; }
            const reduction = Math.min(0.9, this.armor * 0.20);
            this.damageAcc += amount * (1 - reduction);
            const dealt = Math.floor(this.damageAcc);
            if (dealt > 0) { this.hp -= dealt; this.damageAcc -= dealt; }
            this.iFrames = 1.0;
        }
    }

    update(dt, arenaW, arenaH, input) {
        if (this.currentDashCooldown > 0) this.currentDashCooldown -= dt;
        if (this.stunTimer > 0) this.stunTimer -= dt;

        let mvx = 0, mvy = 0;
        const s = this.sprite;

        if (this.isDashing) {
            this.dashTimer -= dt;
            s.x += this.dashDir.x * this.dashSpeed * dt;
            s.y += this.dashDir.y * this.dashSpeed * dt;

            this.applySprite(false);
            s.angle = Math.atan2(this.dashDir.y, this.dashDir.x) * DEG;
            s.setScale(this.baseScale * 1.5, this.baseScale * 0.6);

            this.ghostSpawnTimer -= dt;
            if (this.ghostSpawnTimer <= 0) {
                const moved = Math.abs(s.x - this.lastGhostX) + Math.abs(s.y - this.lastGhostY);
                if (moved > 5) {
                    const g = this.scene.addWorld(this.scene.add.image(s.x, s.y, s.texture.key));
                    g.setOrigin(0.5, 0.5);
                    g.setScale(s.scaleX, s.scaleY);
                    g.angle = s.angle;
                    g.setTint(rgb(0, 255, 200));
                    g.setAlpha(150 / 255);
                    this.ghosts.push({ img: g, lifetime: 0.2, maxLifetime: 0.2 });
                    this.lastGhostX = s.x;
                    this.lastGhostY = s.y;
                }
                this.ghostSpawnTimer = 0.03;
            }

            if (this.dashTimer <= 0) {
                this.isDashing = false;
                s.angle = 0;
                s.setScale(this.baseScale, this.baseScale);
                this.currentSpeedMultiplier = this.computePostDashMultiplier();
                this.dashPenaltyTimer = this.computeDashPenaltyDuration();
            }
        } else {
            if (this.stunTimer <= 0) {
                if (input.left) { mvx -= 1; this.facing = 'left'; }
                if (input.right) { mvx += 1; this.facing = 'right'; }
                if (input.up) { mvy -= 1; if (mvx === 0) this.facing = 'back'; }
                if (input.down) { mvy += 1; if (mvx === 0) this.facing = 'front'; }
            }

            this.isMoving = (mvx !== 0 || mvy !== 0);

            if (this.hasDashUnlocked && input.space && this.currentDashCooldown <= 0 && this.stunTimer <= 0) {
                this.isDashing = true;
                this.dashTimer = this.dashDuration;
                this.currentDashCooldown = this.dashCooldown;
                if (this.scene.audio) this.scene.audio.play('sfx_dash', { volume: 0.7 });
                this.ghosts.forEach(g => g.img.destroy());
                this.ghosts.length = 0;
                this.lastGhostX = s.x;
                this.lastGhostY = s.y;
                if (this.isMoving) this.dashDir = normalize(mvx, mvy);
                else this.dashDir = { x: 0, y: -1 };
            }

            if (this.isMoving && !this.isDashing) {
                const n = normalize(mvx, mvy);
                s.x += n.x * this.speed * this.currentSpeedMultiplier * dt;
                s.y += n.y * this.speed * this.currentSpeedMultiplier * dt;

                this.animTimer += dt;
                this.walkTimer += dt;
                if (this.walkTimer >= 1 / this.ANIM_FPS) {
                    this.walkTimer -= 1 / this.ANIM_FPS;
                    this.animFrame = (this.animFrame + 1) % this.ANIM_FRAMES;
                }
                this.applySprite(true);

                s.angle = n.x * 5;
                const bob = Math.sin(this.animTimer * 12) * 0.07;
                s.setScale(this.baseScale * (1 - bob * 0.4), this.baseScale * (1 + bob));
                this.idleTimer = 0;
            } else if (!this.isDashing) {
                this.animTimer = 0;
                this.animFrame = 0;
                this.walkTimer = 0;
                this.applySprite(false);

                s.angle = 0;
                this.idleTimer += dt * 4;
                const breath = Math.sin(this.idleTimer) * 0.03;
                s.setScale(this.baseScale * (1 + breath), this.baseScale * (1 - breath));
            }

            if (this.invincibilityTimer > 0) {
                this.invincibilityTimer -= dt;
                if (this.invincibilityTimer <= 0) this.isInvincible = false;
                const pulse = (Math.sin(this.invincibilityTimer * 12) + 1) / 2;
                const goldG = clamp8(190 + 65 * pulse);
                s.setTint(rgb(255, goldG, 0));
                s.setAlpha(1);
            } else if (this.iFrames > 0) {
                this.iFrames -= dt;
                if (Math.floor(this.iFrames * 15) % 2 === 0) { s.setTint(rgb(255, 50, 50)); s.setAlpha(1); }
                else { s.clearTint(); s.setAlpha(150 / 255); }
            } else {
                s.clearTint();
                s.setAlpha(1);
            }
        }

        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const g = this.ghosts[i];
            g.lifetime -= dt;
            if (g.lifetime <= 0) { g.img.destroy(); this.ghosts.splice(i, 1); continue; }
            g.img.setAlpha(150 / 255 * Math.max(0, g.lifetime / g.maxLifetime));
        }

        if (this.messageTimer > 0) this.messageTimer -= dt;

        if (this.dashPenaltyTimer > 0) {
            this.dashPenaltyTimer -= dt;
            if (this.dashPenaltyTimer <= 0) {
                this.dashPenaltyTimer = 0;
                this.currentSpeedMultiplier = 1.0;
            }
        }

        const halfW = s.displayWidth / 2;
        const halfH = s.displayHeight / 2;
        if (s.x < halfW) s.x = halfW;
        if (s.x > arenaW - halfW) s.x = arenaW - halfW;
        if (s.y < halfH) s.y = halfH;
        if (s.y > arenaH - halfH) s.y = arenaH - halfH;

        if (this.currentCooldown > 0) this.currentCooldown -= dt;

        const sr = this.baseScale * 45;
        this.shadow.setScale(sr / 45, sr / 45);
        this.shadow.x = s.x;
        this.shadow.y = s.y + halfH - sr * 0.4;
    }
}

class Enemy {
    constructor(scene, x, y, texKey) {
        this.scene = scene;
        this._id = Enemy._nextId++;
        this.speed = C.ENEMY.NORMAL.speed;
        this.hp = C.ENEMY.NORMAL.hp;
        this.maxHp = this.hp;
        this.damage = C.ENEMY.NORMAL.damage;
        this.walkTimer = randInt(100) / 10;

        this.type = EnemyType.NORMAL;
        this.baseScale = 1.0;

        this.bossState = BossState.WALKING;
        this.bossTimer = 0;
        this.jumpDir = { x: 0, y: 0 };
        this.isBoss = false;
        this.isBoss2 = false;
        this.isBoss3 = false;
        this.isBossDoc = false;
        this.isBossBass = false;
        this.isBossSplit = false;

        this.strobeState = 'ROAM';
        this.strobeTimer = 0;
        this.strobeAttack = -1;
        this.beamActive = false;
        this.beamTelegraph = false;
        this.beamAngle = 0;
        this.beamLen = 2400;
        this.beamWidth = 80;
        this.burstCount = 0;
        this.burstTimer = 0;
        this._teleported = false;

        this.goblinState = GoblinState.WALKING;
        this.goblinTimer = 0;
        this.goblinStationed = false;
        this.throwTargetPos = { x: 0, y: 0 };
        this.justThrew = false;
        this.justThrewStun = false;
        this.justFiredVolley = false;
        this.volleyTargetPos = { x: 0, y: 0 };

        this.hitFlashTimer = 0;
        this.bladeMailCd = 0;
        this.sphereCd = 0;

        this.sprite = scene.addWorld(scene.add.sprite(x, y, texKey));
        this.sprite.setOrigin(0.5, 0.5);
        this._setTargetSize(C.ENEMY.BASE_SIZE);
        this.maxHp = this.hp;

        this.spawning = true;
        this.spawnTimer = 0;
        this.spawnDuration = C.SPAWN.ENEMY_DURATION;
        this.spawnStyle = 'enemy';
        this._spawnBurst = false;
    }

    _setTargetSize(targetSize) {
        this.baseScale = targetSize / this.sprite.width;
        this.sprite.setScale(this.baseScale, this.baseScale);
    }

    makeTank(playerLevel) {
        const st = C.ENEMY.TANK;
        this.type = EnemyType.TANK;
        this.speed = st.speed;
        this.hp = st.hpBase + playerLevel * st.hpPerLevel;
        this.maxHp = this.hp;
        this.damage = st.damage;
        this.sprite.setScale(this.baseScale * st.scale, this.baseScale * st.scale);
    }

    makeFast() {
        const st = C.ENEMY.FAST;
        this.type = EnemyType.FAST;
        this.speed = st.speed;
        this.hp = st.hp;
        this.maxHp = st.hp;
        this.damage = st.damage;
        this.sprite.setScale(this.baseScale * st.scale, this.baseScale * st.scale);
    }

    makeGoblin(goblinTexKey) {
        const st = C.ENEMY.GOBLIN;
        this.type = EnemyType.GOBLIN;
        this.sprite.setTexture(goblinTexKey);
        this.sprite.setOrigin(0.5, 0.5);
        this._setTargetSize(st.size);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
    }

    makeSubwoofer(texKey) {
        const st = C.ENEMY.SUBWOOFER;
        this.type = EnemyType.SUBWOOFER;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.subState = 'MOVE'; this.subTimer = 0;
        this.justSoundWave = false; this._waveFired = false;
    }

    makeMosher(texKey) {
        const st = C.ENEMY.MOSHER;
        this.type = EnemyType.MOSHER;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.splitOnDeath = true;
    }
    makeMosherling(texKey) {
        const st = C.ENEMY.MOSHERLING;
        this.type = EnemyType.MOSHERLING;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.sprite.setScale(this.baseScale * st.scale, this.baseScale * st.scale);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.splitOnDeath = false;
        this.spawning = false;
    }

    makeHypeman(texKey) {
        const st = C.ENEMY.HYPEMAN;
        this.type = EnemyType.HYPEMAN;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
    }

    makeBoss() {
        const st = C.BOSS.B1;
        this.isBoss = true;
        this.type = EnemyType.BOSS;
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.bossScale = this.baseScale * st.scale;
        this.sprite.setScale(this.bossScale, this.bossScale);
        this.spawnStyle = 'boss1'; this.spawnDuration = C.SPAWN.BOSS1_DURATION;
    }

    makeBoss2(boss2TexKey) {
        const st = C.BOSS.B2;
        this.isBoss = true; this.isBoss2 = true;
        this.type = EnemyType.BOSS;
        this.sprite.setTexture(boss2TexKey);
        this.sprite.setOrigin(0.5, 0.5);
        this.baseScale = C.ENEMY.BASE_SIZE / this.sprite.width;
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.bossScale = this.baseScale * st.scale;
        this.sprite.setScale(this.bossScale, this.bossScale);
        this.spawnStyle = 'boss2'; this.spawnDuration = C.SPAWN.BOSS2_DURATION;
    }

    makeBoss3(texKey) {
        const st = C.BOSS.B3;
        this.isBoss = true; this.isBoss3 = true;
        this.type = EnemyType.BOSS;
        this.sprite.setTexture(texKey);
        this.sprite.setOrigin(0.5, 0.5);
        this.baseScale = C.ENEMY.BASE_SIZE / this.sprite.width;
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.bossScale = this.baseScale * st.scale;
        this.sprite.setScale(this.bossScale, this.bossScale);
        this.strobeState = 'ROAM';
        this.strobeTimer = 0;
        this.strobeAttack = -1;
        this.spawnStyle = 'boss3'; this.spawnDuration = C.SPAWN.BOSS3_DURATION;
    }

    makeBossDoctor(texKey) {
        const st = C.BOSS.BD;
        this.isBoss = true; this.isBossDoc = true;
        this.type = EnemyType.BOSS;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this.baseScale = C.ENEMY.BASE_SIZE / this.sprite.width;
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.bossScale = this.baseScale * st.scale;
        this.sprite.setScale(this.bossScale, this.bossScale);
        this.docState = 'ROAM';
        this.docTimer = 0;
        this.throwTargetPos = { x: 0, y: 0 };
        this.spawnStyle = 'bossdoc'; this.spawnDuration = C.SPAWN.BOSSDOC_DURATION;
    }

    makeBossBass(texKey) {
        const st = C.BOSS.BB;
        this.isBoss = true; this.isBoss2 = true; this.isBossBass = true;
        this.type = EnemyType.BOSS;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this.baseScale = C.ENEMY.BASE_SIZE / this.sprite.width;
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.bossScale = this.baseScale * st.scale;
        this.sprite.setScale(this.bossScale, this.bossScale);
        this.waveRadiusMult = C.BOSSBASS.WAVE_RADIUS_MULT;
        this.bassState = 'CHASE';
        this.bassTimer = 0;
        this.bassNextRush = false;
        this.rushDir = { x: 1, y: 0 };
        this.spawnStyle = 'boss1'; this.spawnDuration = C.SPAWN.BOSS1_DURATION;
    }

    makeBossSplit(texKey, tier) {
        const base = C.BOSS.BS, T = C.BOSSSPLIT.TIERS[tier] || C.BOSSSPLIT.TIERS[0];
        this.isBoss = true; this.isBoss3 = true; this.isBossSplit = true;
        this.type = EnemyType.BOSS;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this.baseScale = C.ENEMY.BASE_SIZE / this.sprite.width;
        this.hp = Math.round(base.hp * T.hpMult); this.maxHp = this.hp;
        this.speed = base.speed; this.damage = Math.round(base.damage * T.dmgMult);
        this.bossScale = this.baseScale * base.scale * T.scaleMult;
        this.sprite.setScale(this.bossScale, this.bossScale);
        this.splitTier = tier;
        this.splitCount = T.splits;
        this.canSplit = T.splits > 0;
        this.chargeTimer = C.BOSSSPLIT.CHARGE_BURST;
        if (tier === 0) { this.spawnStyle = 'boss1'; this.spawnDuration = C.SPAWN.BOSS1_DURATION; }
        else { this.spawning = false; }
    }

    _updateStrobe(dt, px, py) {
        const s = this.sprite;
        this.justFiredVolley = false;
        this.justThrew = false;
        const enraged = this.hp <= this.maxHp / 2;
        const tf = enraged ? 0.7 : 1.0;

        const bs = this.bossScale || this.baseScale * 3.2;
        if (this.strobeState === 'ROAM') {
            const dir = normalize(px - s.x, py - s.y);
            s.x += dir.x * this.speed * dt;
            s.y += dir.y * this.speed * dt;
            this.walkTimer += dt * 8;
            const bob = Math.sin(this.walkTimer) * 0.05;
            s.setScale(bs * (1 - bob * 0.4), bs * (1 + bob));
            s.angle = Math.sin(this.walkTimer * 0.6) * 6;
            this.strobeTimer += dt;
            if (this.strobeTimer >= 2.5 * tf) {
                this.strobeAttack = (this.strobeAttack + 1) % 3;
                this.strobeTimer = 0;
                this.strobeState = 'TELEGRAPH';
                this.beamAngle = Math.atan2(py - s.y, px - s.x);
                this.beamActive = false;
                this.beamTelegraph = (this.strobeAttack === 0);
                this.burstCount = 0;
                this.burstTimer = 0;
                this._teleported = false;
                s.setScale(bs, bs);
                s.angle = (this.strobeAttack === 0) ? this.beamAngle * DEG : 0;
            }
        } else if (this.strobeState === 'TELEGRAPH') {
            this.strobeTimer += dt;
            const telDur = (this.strobeAttack === 0 ? 0.5 : this.strobeAttack === 1 ? 0.5 : 0.4) * tf;
            if (this.strobeTimer >= telDur) {
                this.strobeTimer = 0;
                this.strobeState = 'EXECUTE';
                if (this.strobeAttack === 0) {
                    this.beamTelegraph = false;
                    this.beamActive = true;
                } else if (this.strobeAttack === 1) {
                    this.burstTimer = 1.0;
                } else if (this.strobeAttack === 2) {
                    this._teleported = false;
                }
            }
        } else if (this.strobeState === 'EXECUTE') {
            this.strobeTimer += dt;
            if (this.strobeAttack === 0) {
                const dur = 0.4 * tf;
                if (this.strobeTimer >= dur) {
                    this.beamActive = false;
                    this.strobeState = 'RECOVER';
                    this.strobeTimer = 0;
                    s.angle = 0;
                }
            } else if (this.strobeAttack === 1) {
                const rings = enraged ? 3 : 2;
                this.burstTimer += dt;
                if (this.burstCount < rings && this.burstTimer >= 0.28) {
                    this.justFiredVolley = true;
                    this.volleyTargetPos = { x: px, y: py };
                    this.burstTimer = 0;
                    this.burstCount++;
                }
                if (this.burstCount >= rings && this.burstTimer >= 0.28) {
                    this.strobeState = 'RECOVER';
                    this.strobeTimer = 0;
                }
            } else if (this.strobeAttack === 2) {
                const normal = this.bossScale;
                const shrinkDur = 0.4 * tf;
                const expandDur = 0.35 * tf;
                if (!this._teleported) {
                    const k = clamp(this.strobeTimer / shrinkDur, 0, 1);
                    const sc = (k < 0.25)
                        ? normal * (1 + 0.15 * (k / 0.25))
                        : normal * (1.15 - 1.05 * ((k - 0.25) / 0.75));
                    s.setScale(sc, sc);
                    s.angle = k * 540;
                    if (this.strobeTimer >= shrinkDur) {
                        const ang = Math.random() * Math.PI * 2;
                        s.x = clamp(px + Math.cos(ang) * 600, 150, 2850);
                        s.y = clamp(py + Math.sin(ang) * 600, 150, 2850);
                        this._teleported = true;
                        this.strobeTimer = 0;
                        this.burstCount = 0;
                        this.burstTimer = 1.0;
                    }
                } else if (this.strobeTimer < expandDur) {
                    const k = clamp(this.strobeTimer / expandDur, 0, 1);
                    const sc = normal * (0.1 + 0.9 * k);
                    s.setScale(sc, sc);
                    s.angle = (1 - k) * 360;
                } else {
                    s.setScale(normal, normal);
                    s.angle = 0;
                    this.burstTimer += dt;
                    if (this.burstCount < 2 && this.burstTimer >= 0.28) {
                        this.justFiredVolley = true;
                        this.volleyTargetPos = { x: px, y: py };
                        this.burstTimer = 0;
                        this.burstCount++;
                    }
                    if (this.burstCount >= 2 && this.burstTimer >= 0.28) {
                        this.strobeState = 'RECOVER';
                        this.strobeTimer = 0;
                    }
                }
            }
        } else if (this.strobeState === 'RECOVER') {
            this.strobeTimer += dt;
            if (this.strobeTimer >= 1.2 * tf) { this.strobeState = 'ROAM'; this.strobeTimer = 0; }
        }
    }

    _updateBossDoctor(dt, px, py, arenaW, arenaH) {
        const s = this.sprite;
        this.justThrewStun = false;
        const D = C.BOSSDOC;
        const bs = this.bossScale || this.baseScale * 3.2;

        const dx = s.x - px, dy = s.y - py;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < D.FLEE_DIST) {
            s.x = clamp(s.x + (dx / d) * this.speed * dt, 0, arenaW);
            s.y = clamp(s.y + (dy / d) * this.speed * dt, 0, arenaH);
        } else if (d > D.STANDOFF) {
            s.x = clamp(s.x - (dx / d) * this.speed * dt, 0, arenaW);
            s.y = clamp(s.y - (dy / d) * this.speed * dt, 0, arenaH);
        }
        this.walkTimer += dt * 6;
        const charge = (this.docState === 'TELEGRAPH') ? 0.12 : 0;
        s.setScale(bs * (1 + charge), bs * (1 + charge));
        s.angle = Math.sin(this.walkTimer) * 4;

        this.docTimer += dt;
        if (this.docState === 'ROAM') {
            if (this.docTimer >= D.STUN_INTERVAL) {
                this.docState = 'TELEGRAPH';
                this.docTimer = 0;
                this.throwTargetPos = { x: px, y: py };
            }
        } else if (this.docState === 'TELEGRAPH') {
            if (this.docTimer >= D.TELEGRAPH) {
                this.docState = 'ROAM';
                this.docTimer = 0;
                this.justThrewStun = true;
            }
        }
    }

    _updateBossBass(dt, px, py, arenaW, arenaH) {
        const s = this.sprite;
        this.justSoundWave = false;
        this.justFiredVolley = false;
        const bs = this.bossScale || this.baseScale * 3.2;
        const BB = C.BOSSBASS;
        const tf = (this.hp <= this.maxHp / 2) ? 0.7 : 1.0;

        if (this.bassState === 'CHASE') {
            const dir = normalize(px - s.x, py - s.y);
            s.x += dir.x * this.speed * dt;
            s.y += dir.y * this.speed * dt;
            this.walkTimer += dt * 8;
            const bob = Math.sin(this.walkTimer * 1.7) * 0.06;
            s.setScale(bs * (1 - bob * 0.4), bs * (1 + bob));
            s.angle = Math.sin(this.walkTimer) * 4;
            this.bassTimer += dt;
            if (this.bassTimer >= BB.ATTACK_GAP * tf) {
                this.bassTimer = 0; s.angle = 0; s.setScale(bs, bs);
                const dq = distSq(s.x, s.y, px, py);
                const inWave = dq <= BB.WAVE_RANGE * BB.WAVE_RANGE;
                if (inWave && !this.bassNextRush) {
                    this.bassState = 'WAVE_CHARGE';
                } else {
                    this.bassState = 'RUSH_WINDUP';
                    this.rushDir = normalize(px - s.x, py - s.y);
                }
                this.bassNextRush = !this.bassNextRush;
            }
        } else if (this.bassState === 'WAVE_CHARGE') {
            this.bassTimer += dt;
            const k = clamp(this.bassTimer / (BB.WAVE_TELEGRAPH * tf), 0, 1);
            const pulse = 1 + 0.25 * k + 0.05 * Math.sin(this.bassTimer * 40);
            s.setScale(bs * pulse, bs * pulse);
            s.angle = Math.sin(this.bassTimer * 45) * 4;
            if (this.bassTimer >= BB.WAVE_TELEGRAPH * tf) {
                this.justSoundWave = true;
                this.bassState = 'RECOVER'; this.bassTimer = 0; s.angle = 0; s.setScale(bs, bs);
            }
        } else if (this.bassState === 'RUSH_WINDUP') {
            this.bassTimer += dt;
            s.angle = Math.sin(this.bassTimer * 50) * 6;
            s.setScale(bs * 1.05, bs * 0.95);
            if (this.bassTimer >= BB.RUSH_WINDUP * tf) { this.bassState = 'RUSH'; this.bassTimer = 0; s.angle = 0; }
        } else if (this.bassState === 'RUSH') {
            this.bassTimer += dt;
            const accel = clamp(this.bassTimer / (BB.RUSH_DURATION * tf), 0, 1);
            const spd = BB.RUSH_SPEED * (0.4 + 0.6 * accel);
            const m = 80;
            const nx = s.x + this.rushDir.x * spd * dt, ny = s.y + this.rushDir.y * spd * dt;
            const hitWall = (nx < m || nx > arenaW - m || ny < m || ny > arenaH - m);
            s.x = clamp(nx, m, arenaW - m);
            s.y = clamp(ny, m, arenaH - m);
            s.setScale(bs * 1.1, bs * 0.92);
            if (hitWall || this.bassTimer >= BB.RUSH_DURATION * tf) {
                if (hitWall) this.scene.triggerShake(0.3, 26);
                this.bassState = 'RECOVER';
                this.bassTimer = hitWall ? -0.4 : 0;
                s.setScale(bs, bs);
            }
        } else {
            this.bassTimer += dt;
            s.setScale(bs, bs); s.angle = 0;
            if (this.bassTimer >= BB.RECOVER * tf) { this.bassState = 'CHASE'; this.bassTimer = 0; }
        }
    }

    _updateBossSplit(dt, px, py, arenaW, arenaH) {
        const s = this.sprite, SPL = C.BOSSSPLIT;
        if (this.chargeTimer > 0) this.chargeTimer -= dt;
        const spd = this.speed * (this.chargeTimer > 0 ? SPL.CHARGE_MULT : 1);
        const dir = normalize(px - s.x, py - s.y);
        s.x = clamp(s.x + dir.x * spd * dt, 0, arenaW);
        s.y = clamp(s.y + dir.y * spd * dt, 0, arenaH);
        this.walkTimer += dt * 10;
        const bob = Math.sin(this.walkTimer * 1.8) * 0.07;
        s.setScale(this.bossScale * (1 - bob * 0.4), this.bossScale * (1 + bob));
        s.angle = Math.sin(this.walkTimer) * 5;
        const R = SPL.SHOVE_RADIUS, F = SPL.SHOVE_FORCE;
        for (const o of this.scene.enemies) {
            if (o === this || o.isBoss || o.hp <= 0 || o.spawning) continue;
            const dx = o.sprite.x - s.x, dy = o.sprite.y - s.y, dq = dx * dx + dy * dy;
            if (dq < R * R && dq > 1) {
                const d = Math.sqrt(dq);
                o.sprite.x = clamp(o.sprite.x + (dx / d) * F * dt, 0, arenaW);
                o.sprite.y = clamp(o.sprite.y + (dy / d) * F * dt, 0, arenaH);
            }
        }
    }

    _updateSpawn(dt) {
        const s = this.sprite;
        if (this._spawnInit === undefined) {
            this._spawnInit = true;
            this._spawnSX = s.scaleX; this._spawnSY = s.scaleY;
            this._spawnGX = s.x; this._spawnGY = s.y;
            if (this.spawnStyle === 'boss2') {
                const a = Math.random() * Math.PI * 2;
                this._spawnDX = Math.cos(a); this._spawnDY = Math.sin(a);
            }
            s.setAlpha(0);
        }
        this.spawnTimer += dt;
        const k = clamp(this.spawnTimer / this.spawnDuration, 0, 1);
        const sx = this._spawnSX, sy = this._spawnSY;
        const gx = this._spawnGX, gy = this._spawnGY;

        switch (this.spawnStyle) {
            case 'boss1': {
                const land = 0.85;
                if (k < 0.35) { s.setAlpha(0); s.setScale(sx, sy); s.setPosition(gx, gy - 800); }
                else if (k < land) {
                    const f = (k - 0.35) / (land - 0.35), fe = f * f, sc = 0.8 + 0.2 * fe;
                    s.setAlpha(1); s.angle = 0; s.setScale(sx * sc, sy * sc);
                    s.setPosition(gx, (gy - 800) + 800 * fe);
                } else {
                    const t = (k - land) / (1 - land);
                    s.setAlpha(1); s.setPosition(gx, gy);
                    s.setScale(sx * (1.15 - 0.15 * t), sy * (0.8 + 0.2 * t));
                }
                if (!this._spawnBurst && k >= land) {
                    this._spawnBurst = true;
                    this.scene.triggerShake(0.3, 28);
                    this._spawnPuff(36, rgb(160, 160, 160), rgb(255, 150, 0));
                }
                break;
            }
            case 'boss2': {
                const arrive = 0.7, dx = this._spawnDX, dy = this._spawnDY;
                if (k < arrive) {
                    const f = k / arrive, fe = 1 - (1 - f) * (1 - f);
                    const dist = 1200 * (1 - fe), stretch = 1 + 1.2 * (1 - fe);
                    s.setPosition(gx - dx * dist, gy - dy * dist);
                    s.setAlpha(clamp(f * 2, 0, 1));
                    s.angle = Math.atan2(dy, dx) * DEG;
                    s.setScale(sx * stretch, sy / Math.sqrt(stretch));
                } else {
                    const t = (k - arrive) / (1 - arrive);
                    s.setPosition(gx, gy); s.angle = 0; s.setAlpha(1);
                    s.setScale(sx * (1 + 0.2 * (1 - t)), sy * (1 - 0.1 * (1 - t)));
                }
                if (!this._spawnBurst && k >= arrive) {
                    this._spawnBurst = true;
                    this.scene.triggerShake(0.2, 18);
                    this._spawnPuff(28, rgb(255, 40, 160), rgb(255, 160, 220));
                }
                break;
            }
            case 'boss3': {
                const flick = Math.random() < 0.5 ? 0.35 : 1, sc = 0.6 + 0.4 * k;
                s.setPosition(gx, gy); s.angle = 0;
                s.setAlpha(k < 0.85 ? flick * Math.min(1, k * 1.5) : 1);
                s.setScale(sx * sc, sy * sc);
                if (!this._spawnBurst && k >= 0.92) {
                    this._spawnBurst = true;
                    this.scene.triggerShake(0.25, 22);
                    this._spawnPuff(30, rgb(0, 230, 255), rgb(255, 0, 180));
                }
                break;
            }
            case 'bossdoc': {
                const m = clamp((k - 0.4) / 0.6, 0, 1), sc = 0.6 + 0.4 * m;
                s.setPosition(gx, gy); s.angle = 0;
                s.setAlpha(m); s.setScale(sx * sc, sy * sc);
                if (!this._spawnBurst && k >= 0.95) {
                    this._spawnBurst = true;
                    this._spawnPuff(24, rgb(60, 255, 130), rgb(180, 255, 200));
                }
                break;
            }
            default: {
                const m = clamp((k - 0.5) / 0.5, 0, 1);
                const c1 = 1.70158, c3 = c1 + 1;
                const back = m <= 0 ? 0 : 1 + c3 * Math.pow(m - 1, 3) + c1 * Math.pow(m - 1, 2);
                s.setPosition(gx, gy); s.angle = 0;
                s.setAlpha(m); s.setScale(sx * back, sy * back);
                if (!this._spawnBurst && k >= 1) {
                    this._spawnBurst = true;
                    this._spawnPuff(10, rgb(255, 90, 0), rgb(255, 200, 60));
                }
                break;
            }
        }

        if (k >= 1) {
            this.spawning = false;
            s.setAlpha(1); s.setScale(sx, sy); s.angle = 0; s.setPosition(gx, gy);
        }
    }

    _spawnPuff(n, c1, c2) {
        const sc = this.scene, s = this.sprite;
        if (!sc.particles || !sc.spawnParticle) return;
        for (let i = 0; i < n; i++) sc.particles.push(sc.spawnParticle(s.x, s.y, (i & 1) ? c1 : c2));
    }

    update(dt, px, py, arenaW, arenaH) {
        const s = this.sprite;

        if (this.spawning) { this._updateSpawn(dt); return; }

        if (this.type !== EnemyType.BOSS && this.type !== EnemyType.GOBLIN && this.type !== EnemyType.SUBWOOFER && this.type !== EnemyType.HYPEMAN) {
            const dir = normalize(px - s.x, py - s.y);
            s.x += dir.x * this.speed * dt;
            s.y += dir.y * this.speed * dt;
            if (this.type === EnemyType.FAST) {
                this.walkTimer += dt * 25;
                s.angle = Math.sin(this.walkTimer) * 20;
            } else {
                this.walkTimer += dt * 10;
                s.angle = Math.sin(this.walkTimer) * 15;
            }
        } else if (this.type === EnemyType.BOSS && this.isBossSplit) {
            this._updateBossSplit(dt, px, py, arenaW, arenaH);
        } else if (this.type === EnemyType.BOSS && this.isBoss3) {
            this._updateStrobe(dt, px, py);
        } else if (this.type === EnemyType.BOSS && this.isBossDoc) {
            this._updateBossDoctor(dt, px, py, arenaW, arenaH);
        } else if (this.type === EnemyType.BOSS && this.isBossBass) {
            this._updateBossBass(dt, px, py, arenaW, arenaH);
        } else if (this.type === EnemyType.BOSS) {
            this.justFiredVolley = false;
            const bs = this.bossScale || this.baseScale * 3;
            const enraged = this.isBoss2 && (this.hp <= this.maxHp / 2);
            const walkDuration = enraged ? 2.5 : 4.0;
            const prepDuration = enraged ? 0.6 : 0.8;
            const recoverDuration = enraged ? 0.8 : 1.2;
            const dashSpeed = enraged ? 1600 : 1200;
            if (this.isBoss2) this.speed = (this.scene.currentChapter === 1) ? 210 : (enraged ? 200 : 150);

            if (this.bossState === BossState.WALKING) {
                const dir = normalize(px - s.x, py - s.y);
                s.x += dir.x * this.speed * dt;
                s.y += dir.y * this.speed * dt;
                this.walkTimer += dt * 10;
                s.angle = Math.sin(this.walkTimer) * 5;
                const bob = Math.sin(this.walkTimer * 1.7) * 0.06;
                s.setScale(bs * (1 - bob * 0.4), bs * (1 + bob));
                this.bossTimer += dt;
                if (this.bossTimer >= walkDuration) {
                    this.bossState = BossState.PREPARING;
                    this.bossTimer = 0;
                    this.jumpDir = normalize(px - s.x, py - s.y);
                    if (this.isBoss2) this.volleyTargetPos = { x: px, y: py };
                }
            } else if (this.bossState === BossState.PREPARING) {
                this.bossTimer += dt;
                s.angle = Math.sin(this.bossTimer * 60) * 15;
                s.setScale(bs, bs);
                if (this.bossTimer >= prepDuration) { this.bossState = BossState.JUMPING; this.bossTimer = 0; }
            } else if (this.bossState === BossState.JUMPING) {
                this.bossTimer += dt;
                s.x += this.jumpDir.x * dashSpeed * dt;
                s.y += this.jumpDir.y * dashSpeed * dt;
                s.angle += 1000 * dt;
                s.setScale(bs, bs);
                if (this.bossTimer >= 0.4) {
                    this.bossState = BossState.RECOVERING;
                    this.bossTimer = 0;
                    s.angle = 0;
                    if (this.isBoss2 && enraged) this.justFiredVolley = true;
                }
            } else if (this.bossState === BossState.RECOVERING) {
                this.bossTimer += dt;
                s.setScale(bs, bs);
                if (this.bossTimer >= recoverDuration) { this.bossState = BossState.WALKING; this.bossTimer = 0; }
            }
        } else if (this.type === EnemyType.SUBWOOFER) {
            this.justSoundWave = false;
            const base = this.baseScale;
            if (this.subState === 'MOVE') {
                const dir = normalize(px - s.x, py - s.y);
                s.x += dir.x * this.speed * dt;
                s.y += dir.y * this.speed * dt;
                this.walkTimer += dt * 6;
                const bob = Math.sin(this.walkTimer) * 0.05;
                s.setScale(base * (1 + bob), base * (1 - bob));
                s.angle = 0;
                this.subTimer += dt;
                const dx = px - s.x, dy = py - s.y;
                const inRange = (dx * dx + dy * dy) <= C.SUBWOOFER.APPROACH_RANGE * C.SUBWOOFER.APPROACH_RANGE;
                if (this.subTimer >= C.SUBWOOFER.REARM && inRange) { this.subState = 'CHARGE'; this.subTimer = 0; }
            } else if (this.subState === 'CHARGE') {
                this.subTimer += dt;
                const pulse = 1 + 0.25 * clamp(this.subTimer / 0.7, 0, 1) + 0.05 * Math.sin(this.subTimer * 40);
                s.setScale(base * pulse, base * pulse);
                s.angle = Math.sin(this.subTimer * 50) * 4;
                if (this.subTimer >= 0.7) { this.subState = 'BOOM'; this.subTimer = 0; this._waveFired = false; s.angle = 0; }
            } else if (this.subState === 'BOOM') {
                this.subTimer += dt;
                if (!this._waveFired) { this.justSoundWave = true; this._waveFired = true; }
                const rec = clamp(this.subTimer / 0.45, 0, 1);
                s.setScale(base * (1.3 - 0.3 * rec), base * (1.3 - 0.3 * rec));
                if (this.subTimer >= 0.45) { this.subState = 'MOVE'; this.subTimer = 0; s.setScale(base, base); }
            }
        } else if (this.type === EnemyType.HYPEMAN) {
            const dx = s.x - px, dy = s.y - py;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d < C.HYPEMAN.FLEE_DIST) {
                s.x = clamp(s.x + (dx / d) * this.speed * dt, 0, arenaW);
                s.y = clamp(s.y + (dy / d) * this.speed * dt, 0, arenaH);
            } else if (d > C.HYPEMAN.AURA_RADIUS) {
                s.x = clamp(s.x - (dx / d) * this.speed * dt, 0, arenaW);
                s.y = clamp(s.y - (dy / d) * this.speed * dt, 0, arenaH);
            }
            this.walkTimer += dt * 8;
            s.angle = Math.sin(this.walkTimer) * 6;
        }

        if (this.type === EnemyType.GOBLIN) {
            this.justThrew = false;

            const view = this.scene.cameras.main.worldView;
            const margin = 80;

            if (this.goblinStationed) {
                const stillVisible = s.x >= view.x && s.x <= view.right && s.y >= view.y && s.y <= view.bottom;
                if (!stillVisible) {
                    this.goblinStationed = false;
                    this.goblinState = GoblinState.WALKING;
                    this.goblinTimer = 0;
                    s.angle = 0;
                    s.setScale(this.baseScale, this.baseScale);
                }
            }

            if (!this.goblinStationed) {
                const inView = s.x >= view.x + margin && s.x <= view.right - margin &&
                               s.y >= view.y + margin && s.y <= view.bottom - margin;
                if (inView) {
                    this.goblinStationed = true;
                    this.goblinState = GoblinState.WALKING;
                    this.goblinTimer = 0;
                } else {
                    const dir = normalize(px - s.x, py - s.y);
                    s.x += dir.x * this.speed * dt;
                    s.y += dir.y * this.speed * dt;
                    this.walkTimer += dt * 8;
                    s.angle = Math.sin(this.walkTimer) * 8;
                }
            }

            if (this.goblinStationed) {
                this.goblinTimer += dt;
                if (this.goblinState === GoblinState.WALKING) {
                    this.walkTimer += dt * 8;
                    s.angle = Math.sin(this.walkTimer) * 4;
                    if (this.goblinTimer >= 2.5) {
                        this.goblinState = GoblinState.PREPARING;
                        this.throwTargetPos = { x: px, y: py };
                        this.goblinTimer = 0;
                    }
                } else if (this.goblinState === GoblinState.PREPARING) {
                    s.angle = Math.sin(this.goblinTimer * 28) * 14;
                    const pulse = 1 + Math.sin(this.goblinTimer * 18) * 0.08;
                    s.setScale(this.baseScale * pulse, this.baseScale / pulse);
                    if (this.goblinTimer >= 1.2) { this.goblinState = GoblinState.THROWING; this.goblinTimer = 0; }
                } else if (this.goblinState === GoblinState.THROWING) {
                    this.justThrew = true;
                    s.angle = 0;
                    s.setScale(this.baseScale, this.baseScale);
                    this.goblinState = GoblinState.RECOVERING;
                    this.goblinTimer = 0;
                } else if (this.goblinState === GoblinState.RECOVERING) {
                    if (this.goblinTimer >= 2.0) { this.goblinState = GoblinState.WALKING; this.goblinTimer = 0; }
                }
            }
        }

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= dt;
            s.setTint(rgb(255, 50, 50));
        } else {
            if (this.type === EnemyType.BOSS) {
                if (this.bossState === BossState.PREPARING) {
                    s.setTint(rgb(255, 0, 0));
                } else if (this.isBoss2) {
                    const enraged = this.hp <= this.maxHp / 2;
                    if (enraged) {
                        const pulse = (Math.sin(this.bossTimer * 8) + 1) / 2;
                        s.setTint(rgb(255, 40 + 100 * pulse, 0));
                    } else {
                        s.setTint(rgb(200, 80, 255));
                    }
                } else if (this.isBoss3) {
                    if (this.strobeState === 'TELEGRAPH') {
                        const pulse = (Math.sin(this.strobeTimer * 30) + 1) / 2;
                        s.setTint(rgb(180 + 75 * pulse, 255, 255));
                    } else {
                        s.clearTint();
                    }
                } else {
                    s.setTint(rgb(255, 100, 255));
                }
            } else if (this.type === EnemyType.FAST) {
                s.setTint(rgb(255, 255, 50));
            } else if (this.type === EnemyType.TANK) {
                const pulse = (Math.sin(this.walkTimer * 1.5) + 1) / 2;
                s.setTint(rgb(30 + 20 * pulse, 150 + 50 * pulse, 220 + 35 * pulse));
            } else if (this.type === EnemyType.GOBLIN) {
                if (this.goblinState === GoblinState.PREPARING) {
                    const pulse = (Math.sin(this.goblinTimer * 20) + 1) / 2;
                    s.setTint(rgb(255, 80 + 80 * pulse, 255));
                } else {
                    s.clearTint();
                }
            } else if (this.type === EnemyType.SUBWOOFER) {
                if (this.subState === 'CHARGE') {
                    const pulse = (Math.sin(this.subTimer * 30) + 1) / 2;
                    s.setTint(rgb(120 + 135 * pulse, 180 + 75 * pulse, 255));
                } else if (this.subState === 'BOOM') {
                    s.setTint(rgb(255, 255, 255));
                } else {
                    const pulse = (Math.sin(this.walkTimer * 1.2) + 1) / 2;
                    s.setTint(rgb(40 + 30 * pulse, 40 + 40 * pulse, 200 + 55 * pulse));
                }
            } else if (this.type === EnemyType.MOSHER || this.type === EnemyType.MOSHERLING) {
                const pulse = (Math.sin(this.walkTimer * 1.5) + 1) / 2;
                s.setTint(rgb(255, 40 + 80 * pulse, 180 + 60 * pulse));
            } else if (this.type === EnemyType.HYPEMAN) {
                const pulse = (Math.sin(this.walkTimer * 2) + 1) / 2;
                s.setTint(rgb(255, 200 + 55 * pulse, 40));
            } else {
                s.clearTint();
            }
        }

        const halfW = s.displayWidth / 2;
        const halfH = s.displayHeight / 2;
        if (s.x < halfW) s.x = halfW;
        if (s.x > arenaW - halfW) s.x = arenaW - halfW;
        if (s.y < halfH) s.y = halfH;
        if (s.y > arenaH - halfH) s.y = arenaH - halfH;
    }

    destroy() { this.sprite.destroy(); }
}
Enemy._nextId = 1;

class Bullet {
    constructor(scene, x, y, dirx, diry, damage, crit) {
        this.scene = scene;
        this.speed = 800;
        this.TRAIL_LENGTH = 8;
        this.trailX = new Float64Array(this.TRAIL_LENGTH);
        this.trailY = new Float64Array(this.TRAIL_LENGTH);
        this.trailStart = 0;
        this.trailCount = 0;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'bullet'));
        this.sprite.setOrigin(0.5, 0.5);
        this.reinit(x, y, dirx, diry, damage, crit);
    }

    reinit(x, y, dirx, diry, damage, crit) {
        this.damage = damage;
        this.isDestroyed = false;
        this.isCrit = crit;
        this.ricochetsLeft = 0;
        this.pierceLeft = 0;
        this.lastHit = null;
        this.trailX[0] = x; this.trailY[0] = y; this.trailStart = 0; this.trailCount = 1;
        this.vx = dirx * this.speed;
        this.vy = diry * this.speed;
        this.sprite.setPosition(x, y).setVisible(true);
        this.sprite.setDisplaySize(40, 40);
        if (crit) this.sprite.setTint(rgb(255, 220, 0)); else this.sprite.clearTint();
        this.sprite.angle = Math.atan2(diry, dirx) * DEG - 180;
        return this;
    }

    update(dt) {
        const cap = this.TRAIL_LENGTH;
        if (this.trailCount < cap) {
            const i = (this.trailStart + this.trailCount) % cap;
            this.trailX[i] = this.sprite.x; this.trailY[i] = this.sprite.y;
            this.trailCount++;
        } else {
            this.trailX[this.trailStart] = this.sprite.x; this.trailY[this.trailStart] = this.sprite.y;
            this.trailStart = (this.trailStart + 1) % cap;
        }
        this.sprite.x += this.vx * dt;
        this.sprite.y += this.vy * dt;
    }

    release() { this.sprite.setVisible(false); }
    destroy() { this.sprite.destroy(); }
}

class EnemyProjectile {
    constructor(scene, x, y, tx, ty) {
        this.scene = scene;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'weaponEnemyV'));
        this.sprite.setOrigin(0.5, 0.5);
        this.glow = scene.addWorld(scene.add.sprite(x, y, 'weaponEnemyV'));
        this.glow.setOrigin(0.5, 0.5);
        this.glow.setDisplaySize(58 * 1.45, 58 * 1.45);
        this.glow.setTint(rgb(180, 0, 255));
        this.glow.setAlpha(70 / 255);
        this.glow.setDepth(-0.5);
        this.reinit(x, y, tx, ty);
    }

    reinit(x, y, tx, ty) {
        this.isDestroyed = false;
        this.isStun = false;
        this.damage = 20;
        const dir = normalize(tx - x, ty - y);
        this.vx = dir.x * 550;
        this.vy = dir.y * 550;
        const ang = Math.atan2(dir.y, dir.x) * DEG + 40;
        this.sprite.setPosition(x, y).setVisible(true).setDisplaySize(58, 58);
        this.sprite.angle = ang;
        this.glow.setPosition(x, y).setVisible(true);
        this.glow.angle = ang;
        return this;
    }

    update(dt, arenaW, arenaH) {
        this.sprite.x += this.vx * dt;
        this.sprite.y += this.vy * dt;
        this.glow.x = this.sprite.x;
        this.glow.y = this.sprite.y;
        const p = this.sprite;
        if (p.x < -120 || p.x > arenaW + 120 || p.y < -120 || p.y > arenaH + 120) this.isDestroyed = true;
    }

    release() { this.sprite.setVisible(false); this.glow.setVisible(false); }
    destroy() { this.sprite.destroy(); this.glow.destroy(); }
}

class BossSoul {
    constructor(scene, x, y, type) {
        this.scene = scene;
        this.isCollected = false;
        this.soulType = type;
        this.animTimer = randInt(100) / 40;
        this.baseY = y;

        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'boss_soul'));
        this.sprite.setOrigin(0.5, 0.5);
        const sc = 80 / Math.max(this.sprite.width, this.sprite.height);
        this.sprite.setScale(sc, sc);

        this.glow = scene.addWorld(scene.add.circle(x, y, 65, 0x000000, 0));
        this.glow.setDepth(-0.5);
    }

    update(dt, globalTime) {
        this.animTimer += dt;
        this.sprite.y = this.baseY + Math.sin(this.animTimer * 2.5) * 18;
        this.sprite.angle += 45 * dt;

        const pulse = (Math.sin(this.animTimer * 3) + 1) / 2;
        if (this.soulType === 1) {
            this.sprite.setTint(rgb(200 + 55 * pulse, 50, 100 + 155 * pulse));
        } else if (this.soulType === 3) {
            this.sprite.setTint(rgb(0, 200 + 55 * pulse, 255));
        } else if (this.soulType === 4) {
            this.sprite.setTint(rgb(40, 200 + 55 * pulse, 110));
        } else if (this.soulType === 5) {
            this.sprite.setTint(rgb(40, 120 + 80 * pulse, 255));
        } else if (this.soulType === 6) {
            this.sprite.setTint(rgb(255, 60 + 80 * pulse, 170));
        } else {
            this.sprite.setTint(rgb(80 + 120 * pulse, 30 * pulse, 255));
        }

        const gp = (Math.sin(globalTime * 3.5) + 1) / 2;
        this.glow.x = this.sprite.x;
        this.glow.y = this.sprite.y;
        const a = (25 + 20 * gp) / 255;
        this.glow.setFillStyle(this.soulType === 1 ? rgb(200, 0, 180) : this.soulType === 3 ? rgb(0, 220, 255) : this.soulType === 4 ? rgb(40, 220, 110) : this.soulType === 5 ? rgb(40, 130, 255) : this.soulType === 6 ? rgb(255, 50, 170) : rgb(100, 0, 255), a);
    }

    destroy() { this.sprite.destroy(); this.glow.destroy(); }
}

class SkullProjectile {
    constructor(scene, x, y, dirx, diry, firstTarget) {
        this.scene = scene;
        this.x = x; this.y = y;
        const n = normalize(dirx, diry);
        this.vx = n.x; this.vy = n.y;
        this.target = firstTarget || null;
        this.hitIds = [];
        this.hitsDone = 0;
        this.life = C.ABILITY.SKULL_LIFETIME;
        this.dead = false;
        this.spin = 0;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'ability_skull'));
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDisplaySize(C.ABILITY.SKULL_SIZE, C.ABILITY.SKULL_SIZE);
        this.sprite.setDepth(15);
    }

    _nearestTarget() {
        let best = null, bestD = C.ABILITY.SKULL_SEEK_RADIUS * C.ABILITY.SKULL_SEEK_RADIUS;
        for (const e of this.scene.enemies) {
            if (e.hp <= 0 || e.spawning) continue;
            if (this.hitIds.indexOf(e._id) !== -1) continue;
            const dq = distSq(this.x, this.y, e.sprite.x, e.sprite.y);
            if (dq < bestD) { bestD = dq; best = e; }
        }
        return best;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        if (!this.target || this.target.hp <= 0 || this.target.spawning || this.hitIds.indexOf(this.target._id) !== -1) {
            this.target = this._nearestTarget();
        }
        if (this.target) {
            const n = normalize(this.target.sprite.x - this.x, this.target.sprite.y - this.y);
            this.vx = n.x; this.vy = n.y;
        }
        const sp = C.ABILITY.SKULL_SPEED;
        this.x += this.vx * sp * dt;
        this.y += this.vy * sp * dt;
        this.spin += dt * 10;
        this.sprite.setPosition(this.x, this.y);
        this.sprite.angle = Math.sin(this.spin) * 14;
        if (this.target) {
            const hr = C.ABILITY.SKULL_HIT_RADIUS;
            if (distSq(this.x, this.y, this.target.sprite.x, this.target.sprite.y) < hr * hr) this._hit(this.target);
        }
        if (this.x < -150 || this.y < -150 || this.x > C.ARENA_WIDTH + 150 || this.y > C.ARENA_HEIGHT + 150) this.dead = true;
    }

    _hit(e) {
        const A = C.ABILITY;
        const base = this.scene.player.attackDamage * A.SKULL_DAMAGE_MULT;
        const dmg = Math.max(1, Math.round(base * (1 + A.SKULL_BOUNCE_BONUS * this.hitsDone)));
        e.hp -= dmg; e.hitFlashTimer = 0.12;
        this.scene.dmgTexts.push(this.scene.spawnDamageText(e.sprite.x, e.sprite.y, dmg, this.hitsDone > 0));
        for (let i = 0; i < 8; i++) this.scene.particles.push(this.scene.spawnParticle(this.x, this.y, (i & 1) ? rgb(120, 255, 150) : rgb(220, 255, 220)));
        this.hitIds.push(e._id);
        this.hitsDone++;
        this.target = null;
        if (this.hitsDone >= A.SKULL_MAX_HITS) this.dead = true;
    }

    destroy() { this.sprite.destroy(); }
}

class ShatterBomb {
    constructor(scene, x, y, dirx, diry) {
        this.scene = scene;
        this.x = x; this.y = y;
        const n = normalize(dirx, diry);
        this.vx = n.x; this.vy = n.y;
        this.traveled = 0;
        this.dead = false;
        this.spin = 0;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'ability_shatter'));
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDisplaySize(C.ABILITY.SHATTER_SIZE, C.ABILITY.SHATTER_SIZE);
        this.sprite.setDepth(15);
    }

    _hitsEnemy() {
        for (const e of this.scene.enemies) {
            if (e.hp <= 0 || e.spawning) continue;
            const hr = 50 + (e.isBoss ? 90 : 0);
            if (distSq(this.x, this.y, e.sprite.x, e.sprite.y) < hr * hr) return true;
        }
        return false;
    }

    update(dt) {
        const A = C.ABILITY, step = A.SHATTER_SPEED * dt;
        this.x += this.vx * step; this.y += this.vy * step; this.traveled += step;
        this.spin += dt;
        this.sprite.setPosition(this.x, this.y);
        this.sprite.angle = this.spin * 540;
        const out = (this.x < 0 || this.y < 0 || this.x > C.ARENA_WIDTH || this.y > C.ARENA_HEIGHT);
        if (this.traveled >= A.SHATTER_RANGE || out || this._hitsEnemy()) this._burst();
    }

    _burst() {
        this.dead = true;
        const A = C.ABILITY, sc = this.scene, n = A.SHATTER_FRAGMENTS;
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2;
            sc.bullets.push(sc.spawnBullet(this.x, this.y, Math.cos(ang), Math.sin(ang), A.SHATTER_DAMAGE, false));
        }
        for (let i = 0; i < 16; i++) sc.particles.push(sc.spawnParticle(this.x, this.y, (i & 1) ? rgb(255, 60, 180) : rgb(180, 80, 255)));
        sc.triggerShake(0.2, 16);
        sc.audio.play('sfx_slam', { volume: 0.5 });
    }

    destroy() { this.sprite.destroy(); }
}

class Gem {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'gem'));
        this.sprite.setOrigin(0.5, 0.5);
        this.baseScale = 44 / this.sprite.width;
        this.reinit(x, y);
    }

    reinit(x, y) {
        this.isCollected = false;
        this.animTimer = randInt(100) / 40;
        this.sprite.setPosition(x, y).setVisible(true);
        this.sprite.setScale(this.baseScale, this.baseScale);
        this.sprite.clearTint();
        this.sprite.angle = 0;
        return this;
    }

    update(dt, px, py, pickupRadius) {
        this.animTimer += dt;
        const breath = 1 + Math.sin(this.animTimer * 3.2) * 0.18;

        const spd = 2.8;
        const r = 128 + 127 * Math.sin(this.animTimer * spd + 0.0);
        const g = 128 + 127 * Math.sin(this.animTimer * spd + 2.094);
        const b = 128 + 127 * Math.sin(this.animTimer * spd + 4.189);
        this.sprite.setTint(rgb(r, g, b));

        this.sprite.angle += 55 * dt;

        const d = dist(this.sprite.x, this.sprite.y, px, py);
        const attracting = d < pickupRadius;
        const sizeMul = attracting ? 0.5 : 1;
        this.sprite.setScale(this.baseScale * breath * sizeMul, this.baseScale * breath * sizeMul);
        if (attracting) {
            const dir = normalize(px - this.sprite.x, py - this.sprite.y);
            this.sprite.x += dir.x * 500 * dt;
            this.sprite.y += dir.y * 500 * dt;
        }
    }

    release() { this.sprite.setVisible(false); }
    destroy() { this.sprite.destroy(); }
}

class Coin {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'coin'));
        this.sprite.setOrigin(0.5, 0.5);
        this.baseScale = 30 / this.sprite.width;
        this.reinit(x, y);
    }

    reinit(x, y) {
        this.isCollected = false;
        this.animTimer = x * 0.01 + y * 0.01;
        this.sprite.setPosition(x, y).setVisible(true);
        this.sprite.setScale(this.baseScale, this.baseScale);
        return this;
    }

    update(dt, px, py, pickupRadius) {
        this.animTimer += dt;
        const pulse = this.baseScale * (1 + Math.sin(this.animTimer * 5) * 0.1);
        this.sprite.setScale(pulse, pulse);

        if (distSq(this.sprite.x, this.sprite.y, px, py) < pickupRadius * pickupRadius) {
            const dir = normalize(px - this.sprite.x, py - this.sprite.y);
            this.sprite.x += dir.x * 550 * dt;
            this.sprite.y += dir.y * 550 * dt;
        }
    }

    release() { this.sprite.setVisible(false); }
    destroy() { this.sprite.destroy(); }
}

class Vinyl {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'vinyl'));
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDisplaySize(50, 50);
        this._baseSX = this.sprite.scaleX; this._baseSY = this.sprite.scaleY;
        this.reinit(x, y);
    }

    reinit(x, y) {
        this.isCollected = false;
        this._pulseT = 0;
        this.sprite.setPosition(x, y).setVisible(true);
        this.sprite.angle = 0;
        this.sprite.setScale(this._baseSX, this._baseSY);
        return this;
    }

    update(dt) {
        this._pulseT += dt;
        const p = 1 + 0.12 * Math.sin(this._pulseT * 4);
        this.sprite.setScale(this._baseSX * p, this._baseSY * p);
    }

    release() { this.sprite.setVisible(false); }
    destroy() { this.sprite.destroy(); }
}

class Particle {
    constructor(scene, x, y, color) {
        this.scene = scene;
        this.rect = scene.addWorld(scene.add.rectangle(x, y, 4, 4, color));
        this.rect.setOrigin(0.5, 0.5);
        this.reinit(x, y, color);
    }

    reinit(x, y, color) {
        const angle = randInt(360) * Math.PI / 180;
        const speed = randInt(150) + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.maxLifetime = randInt(100) / 100 * 0.5 + 0.5;
        this.lifetime = this.maxLifetime;
        this.rect.setPosition(x, y).setVisible(true);
        this.rect.setFillStyle(color, 1);
        this.rect.setScale(1, 1);
        this.rect.setAlpha(1);
        return this;
    }

    update(dt) {
        this.rect.x += this.vx * dt;
        this.rect.y += this.vy * dt;
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.lifetime -= dt;
        if (this.lifetime > 0) this.rect.setAlpha(this.lifetime / this.maxLifetime);
    }

    release() { this.rect.setVisible(false); }
    destroy() { this.rect.destroy(); }
}

class DamageText {
    constructor(scene, x, y, damage, isCrit) {
        this.scene = scene;
        this.text = scene.addWorld(scene.add.text(x, y, '', {
            fontFamily: 'Orbitron, Arial',
            fontSize: '30px',
            color: '#ff4646',
            stroke: '#000000',
            strokeThickness: 4,
        }));
        this.text.setOrigin(0.5, 0.5);
        this.reinit(x, y, damage, isCrit);
    }

    reinit(x, y, damage, isCrit) {
        this.lifetime = 0.8;
        this.maxLifetime = 0.8;
        this.vy = -80;
        const str = isCrit ? ('-' + damage + '!') : ('-' + damage);
        const offX = randInt(40) - 20;
        const offY = randInt(20) - 40;
        this.text.setFontSize(isCrit ? 45 : 30);
        this.text.setColor(isCrit ? '#ffd700' : '#ff4646');
        this.text.setText(str);
        this.text.setPosition(x + offX, y + offY).setVisible(true);
        this.text.setScale(1, 1);
        this.text.setAlpha(1);
        return this;
    }

    update(dt) {
        this.text.y += this.vy * dt;
        this.lifetime -= dt;
        if (this.lifetime > 0) {
            const ratio = this.lifetime / this.maxLifetime;
            this.text.setAlpha(ratio);
            const scale = 0.5 + 0.5 * ratio;
            this.text.setScale(scale, scale);
        }
    }

    release() { this.text.setVisible(false); }
    destroy() { this.text.destroy(); }
}
