// Сущности — порт Player.h, Enemy.h, Bullet.h, EnemyProjectile.h, BossSoul.h,
// Gem.h, Coin.h, Vinyl.h, Particle.h, DamageText.h.
//
// Каждая сущность владеет своим Phaser-объектом (sprite / rectangle / text),
// созданным через scene.addWorld(...). Логика обновления повторяет C++.

const DEG = 180 / Math.PI;

// ----------------------------------------------------------------------------
// Player (Player.h)
// ----------------------------------------------------------------------------
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
        this.damageAcc = 0; // накопитель дробного урона при процентном снижении бронёй

        this.ironSkinCharges = 0;
        this.soulLeechCritBonus = 0;

        // Легендарные карты забега. Выставляются в resetGame / applyUpgrade,
        // но инициализируем здесь, чтобы поля существовали с момента создания.
        this.bladeMail = false; // шипы: враг при контакте получает ответный урон
        this.pierce = false;    // прострел: пуля пробивает врага насквозь

        // Dash
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

        this.lastUpgradeId = -1;
        this.messageTimer = 0;

        this.walkTimer = 0;
        this.animTimer = 0;
        this.idleTimer = 0;
        this.baseScale = 1.0;

        // 'front' | 'back' | 'left' | 'right'
        this.facing = 'front';
        this.animFrame = 0;
        this.ANIM_FPS = 8;
        this.ANIM_FRAMES = 6;
        this.currentTexKey = null;

        // Спрайт + тень
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

    // dir: 'front'|'back'|'left'|'right'
    applySprite(moving) {
        let texKey;
        if (moving) {
            // ключ кадра анимации panim_<dir><n>
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
        // Рывок даёт неуязвимость на время анимации дэша (isDashing).
        if (this.iFrames <= 0 && !this.isDashing && !this.isInvincible) {
            if (this.ironSkinCharges > 0) { this.ironSkinCharges--; this.iFrames = 0.3; return; }
            // Броня — процентное снижение урона (−20% за уровень). Дробный остаток копится,
            // чтобы снижение работало против любого урона и никогда не давало бессмертия.
            const reduction = Math.min(0.9, this.armor * 0.20);
            this.damageAcc += amount * (1 - reduction);
            const dealt = Math.floor(this.damageAcc);
            if (dealt > 0) { this.hp -= dealt; this.damageAcc -= dealt; }
            this.iFrames = 1.0;
        }
    }

    update(dt, arenaW, arenaH, input) {
        if (this.currentDashCooldown > 0) this.currentDashCooldown -= dt;

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
                // Призрак спавнится только если игрок реально сдвинулся —
                // иначе при упоре в стену/угол они накладываются в яркий блоб.
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
            if (input.left) { mvx -= 1; this.facing = 'left'; }
            if (input.right) { mvx += 1; this.facing = 'right'; }
            if (input.up) { mvy -= 1; if (mvx === 0) this.facing = 'back'; }
            if (input.down) { mvy += 1; if (mvx === 0) this.facing = 'front'; }

            this.isMoving = (mvx !== 0 || mvy !== 0);

            if (this.hasDashUnlocked && input.space && this.currentDashCooldown <= 0) {
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

        // Призраки рывка — обновление прозрачности и удаление отживших на месте,
        // без аллокации нового массива каждый кадр (как и пулы — бережём GC).
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

        // Клэмп в арену
        const halfW = s.displayWidth / 2;
        const halfH = s.displayHeight / 2;
        if (s.x < halfW) s.x = halfW;
        if (s.x > arenaW - halfW) s.x = arenaW - halfW;
        if (s.y < halfH) s.y = halfH;
        if (s.y > arenaH - halfH) s.y = arenaH - halfH;

        if (this.currentCooldown > 0) this.currentCooldown -= dt;

        // Тень (базовый эллипс rx=45; масштабируем под baseScale)
        const sr = this.baseScale * 45;
        this.shadow.setScale(sr / 45, sr / 45);
        this.shadow.x = s.x;
        this.shadow.y = s.y + halfH - sr * 0.4;
    }
}

// ----------------------------------------------------------------------------
// Enemy (Enemy.h)
// ----------------------------------------------------------------------------
class Enemy {
    constructor(scene, x, y, texKey) {
        this.scene = scene;
        this._id = Enemy._nextId++; // стабильный порядок для сепарации (замена &enemy > other)
        this.speed = C.ENEMY.NORMAL.speed;
        this.hp = C.ENEMY.NORMAL.hp;
        this.maxHp = this.hp;
        this.damage = C.ENEMY.NORMAL.damage; // урон по игроку в новой шкале (HP=100): десятки, не единицы (x2)
        this.walkTimer = randInt(100) / 10;

        this.type = EnemyType.NORMAL;
        this.baseScale = 1.0;

        this.bossState = BossState.WALKING;
        this.bossTimer = 0;
        this.jumpDir = { x: 0, y: 0 };
        this.isBoss = false;
        this.isBoss2 = false;
        this.isBoss3 = false;

        // STROBE (босс 3 этапа) — собственный конечный автомат и параметры атак
        this.strobeState = 'ROAM';   // ROAM | TELEGRAPH | EXECUTE | RECOVER
        this.strobeTimer = 0;
        this.strobeAttack = -1;      // 0=laser sweep, 1=strobe burst, 2=blackout
        this.beamActive = false;     // луч активен (наносит урон, рисуется сценой)
        this.beamTelegraph = false;  // фаза прицеливания лучом
        this.beamAngle = 0;          // текущий угол луча
        this.beamLen = 2400;
        this.beamWidth = 80;
        this.beamStart = 0;
        this.beamSweep = Math.PI;
        this.burstCount = 0;
        this.burstTimer = 0;
        this._teleported = false;

        this.goblinState = GoblinState.WALKING;
        this.goblinTimer = 0;
        this.goblinStationed = false; // гоблин-стрелок: встал на позицию (игрок его увидел) и больше не двигается
        this.throwTargetPos = { x: 0, y: 0 };
        this.justThrew = false;
        this.justFiredVolley = false;
        this.volleyTargetPos = { x: 0, y: 0 };

        this.hitFlashTimer = 0;
        this.bladeMailCd = 0; // кулдаун ответного урона шипов (блейдмейл игрока)

        this.sprite = scene.addWorld(scene.add.sprite(x, y, texKey));
        this.sprite.setOrigin(0.5, 0.5);
        this._setTargetSize(C.ENEMY.BASE_SIZE);
        this.maxHp = this.hp;
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

    // Сабвуфер (глава 2+): медленный «танк-колонка». Цикл MOVE → CHARGE (телеграф) →
    // BOOM: пускает направленную звуковую волну (сектор 90°) в сторону игрока — она
    // отбрасывает его и наносит урон (создаётся сценой по флагу justSoundWave).
    makeSubwoofer(texKey) {
        const st = C.ENEMY.SUBWOOFER;
        this.type = EnemyType.SUBWOOFER;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.subState = 'MOVE'; this.subTimer = 0;
        this.justSoundWave = false; this._waveFired = false;
    }

    // Мошер (глава 2+): обычный чейзер средней живучести, но при смерти распадается
    // на 2-3 мини-мошеров (см. handleEnemyDeaths). Движение — общий блок погони.
    makeMosher(texKey) {
        const st = C.ENEMY.MOSHER;
        this.type = EnemyType.MOSHER;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.splitOnDeath = true; // распад на splitMin..splitMax мини (число — в handleEnemyDeaths)
    }
    // Мини-мошер: мелкий, быстрый, 1 HP, НЕ делится. texKey — тот же спрайт мошера.
    makeMosherling(texKey) {
        const st = C.ENEMY.MOSHERLING;
        this.type = EnemyType.MOSHERLING;
        if (texKey) { this.sprite.setTexture(texKey); this.sprite.setOrigin(0.5, 0.5); }
        this._setTargetSize(st.size);
        this.sprite.setScale(this.baseScale * st.scale, this.baseScale * st.scale);
        this.hp = st.hp; this.maxHp = st.hp; this.speed = st.speed; this.damage = st.damage;
        this.splitOnDeath = false;
    }

    // Хайпмен (глава 2+): убегает от игрока, сам почти не бьёт. Ауру (+HP/реген союзникам)
    // считает сцена (_updateHypeAuras). Движение — собственная ветка «бегство».
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
        this.bossScale = this.baseScale * st.scale; // базовый масштаб (для анимации ходьбы/сброса)
        this.sprite.setScale(this.bossScale, this.bossScale);
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
    }

    // STROBE — босс 3 этапа (лазерный VJ). Текстура-плейсхолдер (boss2), тонируется
    // в неон сценой; можно заменить на отдельный спрайт позже.
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
    }

    // Конечный автомат STROBE: ROAM -> TELEGRAPH -> EXECUTE -> RECOVER, по кругу.
    // Атаки чередуются: 0 = вращающийся лазер, 1 = стробо-веер, 2 = затемнение+телепорт.
    // В ярости (HP<=50%) все фазы быстрее, веер даёт лишнее кольцо.
    _updateStrobe(dt, px, py) {
        const s = this.sprite;
        this.justFiredVolley = false;
        this.justThrew = false;
        const enraged = this.hp <= this.maxHp / 2;
        const tf = enraged ? 0.7 : 1.0; // ускорение таймеров в ярости

        const bs = this.bossScale || this.baseScale * 3.2;
        if (this.strobeState === 'ROAM') {
            const dir = normalize(px - s.x, py - s.y);
            s.x += dir.x * this.speed * dt;
            s.y += dir.y * this.speed * dt;
            this.walkTimer += dt * 8;
            // Анимация передвижения: «шаг» (squash-stretch) + лёгкое покачивание.
            const bob = Math.sin(this.walkTimer) * 0.05;
            s.setScale(bs * (1 - bob * 0.4), bs * (1 + bob));
            s.angle = Math.sin(this.walkTimer * 0.6) * 6;
            this.strobeTimer += dt;
            if (this.strobeTimer >= 2.5 * tf) {
                this.strobeAttack = (this.strobeAttack + 1) % 3;
                this.strobeTimer = 0;
                this.strobeState = 'TELEGRAPH';
                this.beamAngle = Math.atan2(py - s.y, px - s.x); // зафиксировать прицел
                this.beamActive = false;
                this.beamTelegraph = (this.strobeAttack === 0);
                this.burstCount = 0;
                this.burstTimer = 0;
                this._teleported = false;
                s.setScale(bs, bs); s.angle = 0; // снять «шаг» перед атакой
            }
        } else if (this.strobeState === 'TELEGRAPH') {
            this.strobeTimer += dt;
            const telDur = (this.strobeAttack === 0 ? 0.9 : this.strobeAttack === 1 ? 0.5 : 0.4) * tf;
            if (this.strobeTimer >= telDur) {
                this.strobeTimer = 0;
                this.strobeState = 'EXECUTE';
                if (this.strobeAttack === 0) {
                    this.beamTelegraph = false;
                    this.beamActive = true;
                    this.beamStart = this.beamAngle;
                    this.beamSweep = (Math.random() < 0.5 ? 1 : -1) * Math.PI; // влево или вправо
                } else if (this.strobeAttack === 1) {
                    this.burstTimer = 1.0; // чтобы первое кольцо вылетело сразу
                } else if (this.strobeAttack === 2) {
                    this._teleported = false;
                }
            }
        } else if (this.strobeState === 'EXECUTE') {
            this.strobeTimer += dt;
            if (this.strobeAttack === 0) {
                const dur = 1.6 * tf;
                const prog = clamp(this.strobeTimer / dur, 0, 1);
                this.beamAngle = this.beamStart + this.beamSweep * prog;
                if (this.strobeTimer >= dur) {
                    this.beamActive = false;
                    this.strobeState = 'RECOVER';
                    this.strobeTimer = 0;
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
                const normal = this.bossScale; // = baseScale * C.BOSS.B3.scale (масштаб «обычной» формы)
                const shrinkDur = 0.4 * tf;
                const expandDur = 0.35 * tf;
                if (!this._teleported) {
                    // встаёт (раздувается) -> сжимается в точку, закручиваясь
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
                        this.burstTimer = 1.0; // первый залп сразу после раскрытия
                    }
                } else if (this.strobeTimer < expandDur) {
                    // раскрывается обратно в обычную форму
                    const k = clamp(this.strobeTimer / expandDur, 0, 1);
                    const sc = normal * (0.1 + 0.9 * k);
                    s.setScale(sc, sc);
                    s.angle = (1 - k) * 360;
                } else {
                    // обычная форма + 2 залпа дисков
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

    update(dt, px, py, arenaW, arenaH) {
        const s = this.sprite;

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
        } else if (this.type === EnemyType.BOSS && this.isBoss3) {
            this._updateStrobe(dt, px, py);
        } else if (this.type === EnemyType.BOSS) {
            this.justFiredVolley = false;
            const bs = this.bossScale || this.baseScale * 3; // базовый масштаб для анимации/сброса
            const enraged = this.isBoss2 && (this.hp <= this.maxHp / 2);
            const walkDuration = enraged ? 2.5 : 4.0;
            const prepDuration = enraged ? 0.6 : 0.8;
            const recoverDuration = enraged ? 0.8 : 1.2;
            const dashSpeed = enraged ? 1600 : 1200;
            if (this.isBoss2) this.speed = enraged ? 200 : 150;

            if (this.bossState === BossState.WALKING) {
                const dir = normalize(px - s.x, py - s.y);
                s.x += dir.x * this.speed * dt;
                s.y += dir.y * this.speed * dt;
                this.walkTimer += dt * 10;
                s.angle = Math.sin(this.walkTimer) * 5;
                // Анимация ходьбы: вертикальный «шаг» с приседанием/растяжением (squash-stretch).
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
                s.setScale(bs, bs); // снять «шаг» ходьбы
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
                // Сближается с игроком; бьёт волной только подойдя на APPROACH_RANGE.
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
                // Телеграф: набухает и дрожит — игрок видит, что сейчас «бахнет».
                this.subTimer += dt;
                const pulse = 1 + 0.25 * clamp(this.subTimer / 0.7, 0, 1) + 0.05 * Math.sin(this.subTimer * 40);
                s.setScale(base * pulse, base * pulse);
                s.angle = Math.sin(this.subTimer * 50) * 4;
                if (this.subTimer >= 0.7) { this.subState = 'BOOM'; this.subTimer = 0; this._waveFired = false; s.angle = 0; }
            } else if (this.subState === 'BOOM') {
                // Один импульс: волна летит в сторону игрока; масштаб откатывается к базе.
                this.subTimer += dt;
                if (!this._waveFired) { this.justSoundWave = true; this._waveFired = true; }
                const rec = clamp(this.subTimer / 0.45, 0, 1);
                s.setScale(base * (1.3 - 0.3 * rec), base * (1.3 - 0.3 * rec));
                if (this.subTimer >= 0.45) { this.subState = 'MOVE'; this.subTimer = 0; s.setScale(base, base); }
            }
        } else if (this.type === EnemyType.HYPEMAN) {
            // Бегство: если игрок ближе FLEE_DIST — уходит от него; иначе держится на месте.
            const dx = s.x - px, dy = s.y - py;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d < C.HYPEMAN.FLEE_DIST) {
                s.x = clamp(s.x + (dx / d) * this.speed * dt, 0, arenaW);
                s.y = clamp(s.y + (dy / d) * this.speed * dt, 0, arenaH);
            }
            this.walkTimer += dt * 8;
            s.angle = Math.sin(this.walkTimer) * 6; // покачивание «в такт»
        }

        if (this.type === EnemyType.GOBLIN) {
            this.justThrew = false;

            // Гоблин-стрелок подходит к краю видимой области и там встаёт, чтобы стрелять.
            // Закрепление обратимо: если игрок убежал и гоблин вышел из кадра — он снова
            // идёт к экрану. Гистерезис: встаёт с отступом от края (margin), а снимается
            // с позиции только полностью выйдя из кадра, чтобы не дёргаться на границе.
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
                    // Гоблин-стрелок не бегает: стоит на месте и ведёт прицельный огонь.
                    this.walkTimer += dt * 8;
                    s.angle = Math.sin(this.walkTimer) * 4; // лёгкое покачивание на месте
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

        // Цвет/флэш
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
                    // STROBE: показываем неоновый арт как есть; белая строб-вспышка при зарядке луча
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
                    s.setTint(rgb(120 + 135 * pulse, 180 + 75 * pulse, 255)); // ярко-циан вспышка зарядки
                } else if (this.subState === 'BOOM') {
                    s.setTint(rgb(255, 255, 255)); // белый «удар»
                } else {
                    const pulse = (Math.sin(this.walkTimer * 1.2) + 1) / 2;
                    s.setTint(rgb(40 + 30 * pulse, 40 + 40 * pulse, 200 + 55 * pulse)); // глубокий сине-фиолет
                }
            } else if (this.type === EnemyType.MOSHER || this.type === EnemyType.MOSHERLING) {
                const pulse = (Math.sin(this.walkTimer * 1.5) + 1) / 2;
                s.setTint(rgb(255, 40 + 80 * pulse, 180 + 60 * pulse)); // неон-маджента «толпа»
            } else if (this.type === EnemyType.HYPEMAN) {
                const pulse = (Math.sin(this.walkTimer * 2) + 1) / 2;
                s.setTint(rgb(255, 200 + 55 * pulse, 40)); // золотой «MC»
            } else {
                s.clearTint();
            }
        }

        // Клэмп в арену
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

// ----------------------------------------------------------------------------
// Bullet (Bullet.h)
// ----------------------------------------------------------------------------
class Bullet {
    constructor(scene, x, y, dirx, diry, damage, crit) {
        this.scene = scene;
        this.speed = 800;
        this.TRAIL_LENGTH = 8;
        // Трейл — кольцевой буфер фиксированной ёмкости (две типизированные дорожки),
        // выделяется ОДИН раз: точки не аллоцируются каждый кадр (как раньше {x,y} + shift).
        // trailStart — индекс самой старой точки, trailCount — число валидных точек (0..cap).
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
        this.pierceLeft = 0;   // прострел: сколько врагов ещё пробьёт
        this.lastHit = null;   // последний пробитый враг (чтобы не бить его дважды)
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
        // Записываем позицию ДО сдвига (как и раньше) в кольцевой буфер — без аллокаций.
        const cap = this.TRAIL_LENGTH;
        if (this.trailCount < cap) {
            const i = (this.trailStart + this.trailCount) % cap;
            this.trailX[i] = this.sprite.x; this.trailY[i] = this.sprite.y;
            this.trailCount++;
        } else {
            this.trailX[this.trailStart] = this.sprite.x; this.trailY[this.trailStart] = this.sprite.y;
            this.trailStart = (this.trailStart + 1) % cap; // перезаписали старейшую — сдвигаем начало
        }
        this.sprite.x += this.vx * dt;
        this.sprite.y += this.vy * dt;
    }

    release() { this.sprite.setVisible(false); }
    destroy() { this.sprite.destroy(); }
}

// ----------------------------------------------------------------------------
// EnemyProjectile (EnemyProjectile.h)
// ----------------------------------------------------------------------------
class EnemyProjectile {
    constructor(scene, x, y, tx, ty) {
        this.scene = scene;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'weaponEnemyV'));
        this.sprite.setOrigin(0.5, 0.5);
        // пурпурный ореол (PlayState.cpp)
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
        this.damage = 20; // дефолт в новой шкале; фактический урон проставляется от врага-стрелка
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

// ----------------------------------------------------------------------------
// BossSoul (BossSoul.h)
// ----------------------------------------------------------------------------
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

        // свечение под душой (Game::render)
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
            this.sprite.setTint(rgb(0, 200 + 55 * pulse, 255)); // STROBE — циан
        } else {
            this.sprite.setTint(rgb(80 + 120 * pulse, 30 * pulse, 255));
        }

        // glow
        const gp = (Math.sin(globalTime * 3.5) + 1) / 2;
        this.glow.x = this.sprite.x;
        this.glow.y = this.sprite.y;
        const a = (25 + 20 * gp) / 255;
        this.glow.setFillStyle(this.soulType === 1 ? rgb(200, 0, 180) : this.soulType === 3 ? rgb(0, 220, 255) : rgb(100, 0, 255), a);
    }

    destroy() { this.sprite.destroy(); this.glow.destroy(); }
}

// ----------------------------------------------------------------------------
// Gem (Gem.h)
// ----------------------------------------------------------------------------
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
        // В полёте к игроку (под действием магнита) опыт вдвое меньше; лёжа на полу — обычный размер.
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

// ----------------------------------------------------------------------------
// Coin (Coin.h)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Vinyl (Vinyl.h)
// ----------------------------------------------------------------------------
class Vinyl {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.addWorld(scene.add.sprite(x, y, 'vinyl'));
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDisplaySize(50, 50);
        this.reinit(x, y);
    }

    reinit(x, y) {
        this.isCollected = false;
        this.sprite.setPosition(x, y).setVisible(true);
        this.sprite.angle = 0;
        return this;
    }

    update(dt) { this.sprite.angle += 100 * dt; }

    release() { this.sprite.setVisible(false); }
    destroy() { this.sprite.destroy(); }
}

// ----------------------------------------------------------------------------
// Particle (Particle.h)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// DamageText (DamageText.h)
// ----------------------------------------------------------------------------
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
