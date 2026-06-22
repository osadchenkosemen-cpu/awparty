
MainScene.prototype._drawSoundWaveWalls = function(g) {
        const W = C.ARENA_WIDTH, H = C.ARENA_HEIGHT, tm = this.globalTime;
        const step = 26;
        const k = (Math.PI * 2) / 220;
        const speed = 2;
        const A = 16 + 10 * (0.5 + 0.5 * Math.sin(tm * 1.6));
        const pulse = 0.5 + 0.5 * Math.sin(tm * 3);
        const col = rgb(255, 20 + 80 * pulse, 80 + 60 * pulse);

        if (!this._wallAxisX || this._wallStep !== step) {
            this._wallStep = step;
            const xs = []; for (let x = 0; x <= W; x += step) xs.push(x);
            const ys = []; for (let y = 0; y <= H; y += step) ys.push(y);
            this._wallAxisX = xs; this._wallAxisY = ys;
            this._wallTop = new Float64Array(xs.length);
            this._wallBot = new Float64Array(xs.length);
            this._wallLeft = new Float64Array(ys.length);
            this._wallRight = new Float64Array(ys.length);
        }
        const xs = this._wallAxisX, ys = this._wallAxisY;
        const top = this._wallTop, bot = this._wallBot, left = this._wallLeft, right = this._wallRight;
        for (let i = 0; i < xs.length; i++) {
            const x = xs[i];
            top[i] = 6 + A * (1 + Math.sin(k * x + tm * speed));
            bot[i] = H - 6 - A * (1 + Math.sin(k * x - tm * speed));
        }
        for (let i = 0; i < ys.length; i++) {
            const y = ys[i];
            left[i] = 6 + A * (1 + Math.sin(k * y + tm * speed));
            right[i] = W - 6 - A * (1 + Math.sin(k * y - tm * speed));
        }
        const strokeH = (yb, width, alpha) => {
            g.lineStyle(width, col, alpha);
            g.beginPath(); g.moveTo(xs[0], yb[0]);
            for (let i = 1; i < xs.length; i++) g.lineTo(xs[i], yb[i]);
            g.strokePath();
        };
        const strokeV = (xb, width, alpha) => {
            g.lineStyle(width, col, alpha);
            g.beginPath(); g.moveTo(xb[0], ys[0]);
            for (let i = 1; i < ys.length; i++) g.lineTo(xb[i], ys[i]);
            g.strokePath();
        };
        strokeH(top, 12, 0.16); strokeH(top, 4, 0.9);
        strokeH(bot, 12, 0.16); strokeH(bot, 4, 0.9);
        strokeV(left, 12, 0.16); strokeV(left, 4, 0.9);
        strokeV(right, 12, 0.16); strokeV(right, 4, 0.9);
    };

MainScene.prototype._drawSpawnFx = function(g) {
        const tm = this.globalTime;
        for (const e of this.enemies) {
            if (!e.spawning) continue;
            const dur = e.spawnDuration || 0.45;
            const k = clamp(e.spawnTimer / dur, 0, 1);
            const x = (e._spawnGX != null) ? e._spawnGX : e.sprite.x;
            const y = (e._spawnGY != null) ? e._spawnGY : e.sprite.y;

            if (e.spawnStyle === 'boss1') {
                const land = 0.85;
                if (k < land) {
                    const t = k / land, r = 50 + 150 * t, p = 0.5 + 0.5 * Math.sin(tm * 14);
                    g.fillStyle(0x000000, 0.35 * t); g.fillCircle(x, y, r);
                    g.lineStyle(4, rgb(255, 120, 0), 0.4 + 0.3 * p); g.strokeCircle(x, y, r);
                } else {
                    const t = (k - land) / (1 - land);
                    g.lineStyle(12, rgb(255, 140, 0), (1 - t) * 0.8); g.strokeCircle(x, y, 150 + 520 * t);
                    g.lineStyle(5, rgb(255, 220, 90), (1 - t)); g.strokeCircle(x, y, 100 + 360 * t);
                }
            } else if (e.spawnStyle === 'boss2') {
                const arrive = 0.7;
                if (k < arrive) {
                    const cx = e.sprite.x, cy = e.sprite.y, dx = e._spawnDX || 0, dy = e._spawnDY || 0;
                    for (let i = 1; i <= 5; i++) {
                        const d = i * 50, a = (1 - i / 6) * 0.45 * (1 - k / arrive);
                        g.fillStyle(rgb(255, 40, 160), a); g.fillCircle(cx - dx * d, cy - dy * d, 34 * (1 - i / 8));
                    }
                } else {
                    const t = (k - arrive) / (1 - arrive);
                    g.lineStyle(9, rgb(255, 40, 160), (1 - t) * 0.85); g.strokeCircle(x, y, 90 + 380 * t);
                }
            } else if (e.spawnStyle === 'boss3') {
                const flick = (Math.random() < 0.5) ? 1 : 0.35, beams = 7;
                for (let i = 0; i < beams; i++) {
                    const ang = i * (Math.PI * 2 / beams) + tm * 0.6, far = 1500 * (1 - k);
                    const ox = x + Math.cos(ang) * far, oy = y + Math.sin(ang) * far;
                    g.lineStyle(3, (i & 1) ? rgb(0, 230, 255) : rgb(255, 0, 180), 0.25 + 0.5 * flick);
                    g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.strokePath();
                }
                g.fillStyle(rgb(180, 240, 255), (0.1 + 0.3 * flick) * k); g.fillCircle(x, y, 30 + 90 * k);
            } else if (e.spawnStyle === 'bossdoc') {
                const fade = Math.min(1, k * 2);
                for (let i = 0; i < 3; i++) {
                    const rr = (tm * 0.6 + i / 3) % 1;
                    g.lineStyle(4, rgb(60, 255, 130), (1 - rr) * 0.5 * fade); g.strokeCircle(x, y, 30 + rr * 200);
                }
                const cs = 45 + 12 * Math.sin(tm * 6);
                g.lineStyle(8, rgb(120, 255, 170), 0.5 * fade);
                g.beginPath(); g.moveTo(x - cs, y); g.lineTo(x + cs, y); g.moveTo(x, y - cs); g.lineTo(x, y + cs); g.strokePath();
            } else {
                const pulse = 0.5 + 0.5 * Math.sin(tm * 18);
                const r = 75 * (1 - 0.45 * k), a = (0.35 + 0.4 * pulse) * (1 - 0.3 * k);
                g.lineStyle(5, rgb(255, 60 + 120 * pulse, 0), a); g.strokeCircle(x, y, r);
                g.lineStyle(2, rgb(255, 180, 60), a * 0.8); g.strokeCircle(x, y, r * 0.55);
            }
        }
    };

MainScene.prototype.drawWorldFx = function() {
        const g = this.worldFx;
        g.clear();
        this._drawSoundWaveWalls(g);
        this._drawSpawnFx(g);
        for (const b of this.bullets) {
            const n = b.trailCount;
            if (n <= 0) continue;
            const tx = b.trailX, ty = b.trailY, cap = b.TRAIL_LENGTH, start = b.trailStart;
            const col = b.isCrit ? rgb(255, 200, 0) : rgb(0, 255, 255);
            for (let i = 0; i < n; i++) {
                const ratio = i / n;
                const p = (start + i) % cap;
                g.fillStyle(col, (180 * ratio) / 255);
                g.fillCircle(tx[p], ty[p], 8 * ratio);
            }
        }
        if (this.slamRingTimer >= 0) {
            const t = this.slamRingTimer / C.SLAM_RING_DURATION;
            const r = (this.slamRingRadius || C.SLAM_RADIUS) * t;
            const alpha = (1 - t * t);
            g.lineStyle(8, this.slamRingColor || rgb(255, 160, 0), alpha * 0.5);
            g.strokeCircle(this.slamRingCenter.x, this.slamRingCenter.y, r + 6);
            g.lineStyle(3, this.slamRingColor2 || rgb(255, 220, 80), alpha);
            g.strokeCircle(this.slamRingCenter.x, this.slamRingCenter.y, r);
        }
        for (const w of this.soundWaves) {
            const ta = clamp(w.timer / (C.SUBWOOFER.WAVE_EXPAND + 0.15), 0, 1);
            const alpha = 1 - ta;
            const a0 = w.angle - w.halfArc, a1 = w.angle + w.halfArc;
            g.fillStyle(rgb(0, 200, 255), 0.12 * alpha);
            g.slice(w.x, w.y, w.radius, a0, a1, false); g.fillPath();
            g.lineStyle(10, rgb(0, 220, 255), 0.5 * alpha);
            g.beginPath(); g.arc(w.x, w.y, w.radius, a0, a1, false); g.strokePath();
            g.lineStyle(4, rgb(180, 245, 255), 0.85 * alpha);
            g.beginPath(); g.arc(w.x, w.y, Math.max(0, w.radius - 8), a0, a1, false); g.strokePath();
        }
        for (const e of this.enemies) {
            if (e.type !== EnemyType.HYPEMAN || e.hp <= 0) continue;
            const pulse = (Math.sin(this.globalTime * 3) + 1) / 2;
            const rr = C.HYPEMAN.AURA_RADIUS;
            g.fillStyle(rgb(60, 255, 130), 0.06 + 0.04 * pulse);
            g.fillCircle(e.sprite.x, e.sprite.y, rr);
            g.lineStyle(3, rgb(80, 255, 150), 0.4 + 0.25 * pulse);
            g.strokeCircle(e.sprite.x, e.sprite.y, rr);
        }
        for (const e of this.enemies) {
            if (!e.isBossDoc || e.hp <= 0) continue;
            const pulse = (Math.sin(this.globalTime * 3) + 1) / 2;
            const rr = C.BOSSDOC.AURA_RADIUS;
            g.fillStyle(rgb(60, 255, 130), 0.05 + 0.04 * pulse);
            g.fillCircle(e.sprite.x, e.sprite.y, rr);
            g.lineStyle(3, rgb(80, 255, 150), 0.35 + 0.25 * pulse);
            g.strokeCircle(e.sprite.x, e.sprite.y, rr);
            if (e.docState === 'TELEGRAPH') {
                const tp = e.throwTargetPos, mp = (Math.sin(this.globalTime * 18) + 1) / 2;
                g.lineStyle(4, rgb(255, 80, 220), 0.5 + 0.4 * mp);
                g.strokeCircle(tp.x, tp.y, 60 + 18 * mp);
                g.lineStyle(2, rgb(255, 150, 240), 0.6);
                g.strokeCircle(tp.x, tp.y, 16);
            }
        }
        if (this.player && this.player.stunTimer > 0) {
            const ps = this.player.sprite, cx = ps.x, cy = ps.y - 70;
            for (let i = 0; i < 3; i++) {
                const a = this.globalTime * 10 + i * (2 * Math.PI / 3);
                g.fillStyle(rgb(255, 230, 80), 0.95);
                g.fillCircle(cx + Math.cos(a) * 26, cy + Math.sin(a) * 10, 6);
            }
        }
        if (this.playerBeam) {
            const pb = this.playerBeam;
            const a = clamp(pb.timer / 0.28, 0, 1);
            const ex = pb.x + pb.nx * pb.len, ey = pb.y + pb.ny * pb.len;
            g.lineStyle(80, rgb(0, 220, 255), 0.22 * a);
            g.beginPath(); g.moveTo(pb.x, pb.y); g.lineTo(ex, ey); g.strokePath();
            g.lineStyle(36, rgb(150, 245, 255), 0.5 * a);
            g.beginPath(); g.moveTo(pb.x, pb.y); g.lineTo(ex, ey); g.strokePath();
            g.lineStyle(10, rgb(255, 255, 255), 0.95 * a);
            g.beginPath(); g.moveTo(pb.x, pb.y); g.lineTo(ex, ey); g.strokePath();
        }
        for (const e of this.enemies) {
            if (!e.isBoss3) continue;
            const bx = e.sprite.x, by = e.sprite.y;
            if (e.beamTelegraph) {
                const ex = bx + Math.cos(e.beamAngle) * e.beamLen;
                const ey = by + Math.sin(e.beamAngle) * e.beamLen;
                const pulse = 0.3 + 0.4 * Math.abs(Math.sin(e.strobeTimer * 25));
                g.lineStyle(4, rgb(120, 255, 255), pulse);
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
            }
            if (e.beamActive) {
                const ex = bx + Math.cos(e.beamAngle) * e.beamLen;
                const ey = by + Math.sin(e.beamAngle) * e.beamLen;
                g.lineStyle(e.beamWidth, rgb(0, 220, 255), 0.28);
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
                g.lineStyle(e.beamWidth * 0.5, rgb(150, 245, 255), 0.55);
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
                g.lineStyle(8, rgb(255, 255, 255), 0.95);
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
            }
        }
        if (this.crazyMode && this.portal) this._drawPortal(g);
    };

MainScene.prototype._drawPortal = function(g) {
        const px = this.portal.x, py = this.portal.y, T = this.globalTime;
        const R = C.PORTAL_RADIUS;
        const pulse = 0.5 + 0.5 * Math.sin(T * 4);
        g.fillStyle(rgb(0, 230, 255), 0.12 + 0.07 * pulse);
        g.fillCircle(px, py, R * 1.7);
        g.fillStyle(rgb(200, 0, 255), 0.12 + 0.07 * pulse);
        g.fillCircle(px, py, R * 1.25);

        if (this.portalSprite) {
            this.portalSprite.rotation = -T * 0.5;
            this.portalSprite.setScale(this._portalBaseScale * (1 + 0.06 * pulse));
            return;
        }

        for (let i = 0; i < 4; i++) {
            const rr = R * (0.45 + i * 0.18) + Math.sin(T * 3 + i) * 6;
            const col = (i % 2 === 0) ? rgb(0, 230, 255) : rgb(200, 0, 255);
            g.lineStyle(5 - i * 0.6, col, 0.85 - i * 0.12);
            g.strokeCircle(px, py, rr);
        }
        g.lineStyle(2, rgb(150, 245, 255), 0.5 + 0.3 * pulse);
        for (let i = 0; i < 8; i++) {
            const a = T * 1.6 + i * (Math.PI / 4);
            const r0 = R * 0.18, r1 = R * 0.9;
            g.beginPath();
            g.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
            g.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1);
            g.strokePath();
        }
        g.fillStyle(rgb(255, 255, 255), 0.6 + 0.4 * pulse);
        g.fillCircle(px, py, R * 0.16 + 4 * pulse);
    };

MainScene.prototype._drawBossArrow = function() {
        const g = this.bossArrowFx;
        g.clear();
        if (this.isGameOver) return;
        let tx, ty, col;
        if (this.crazyMode && this.portal) {
            tx = this.portal.x; ty = this.portal.y; col = rgb(0, 230, 255);
        } else {
            let boss = null;
            for (const e of this.enemies) { if (e.isBoss) { boss = e; break; } }
            if (!boss) return;
            tx = boss.sprite.x; ty = boss.sprite.y;
            col = boss.isBoss3 ? rgb(0, 230, 255) : boss.isBoss2 ? rgb(200, 0, 255) : rgb(255, 40, 60);
        }

        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, margin = 70;
        const view = this.cameras.main.worldView;
        const sx = tx - view.x, sy = ty - view.y;
        if (sx >= margin && sx <= W - margin && sy >= margin && sy <= H - margin) return;

        const cx = W / 2, cy = H / 2;
        const ang = Math.atan2(sy - cy, sx - cx);
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const hw = W / 2 - margin, hh = H / 2 - margin;
        let scale = Infinity;
        if (Math.abs(cos) > 1e-6) scale = Math.min(scale, hw / Math.abs(cos));
        if (Math.abs(sin) > 1e-6) scale = Math.min(scale, hh / Math.abs(sin));
        const ax = cx + cos * scale, ay = cy + sin * scale;

        const pulse = 0.6 + 0.4 * Math.sin(this.globalTime * 8);
        const size = 24 * (0.92 + 0.12 * Math.sin(this.globalTime * 8));

        const perp = ang + Math.PI / 2;
        const tip = { x: ax + cos * size, y: ay + sin * size };
        const bcx = ax - cos * size * 0.5, bcy = ay - sin * size * 0.5;
        const halfW = size * 0.72;
        const b1 = { x: bcx + Math.cos(perp) * halfW, y: bcy + Math.sin(perp) * halfW };
        const b2 = { x: bcx - Math.cos(perp) * halfW, y: bcy - Math.sin(perp) * halfW };

        g.fillStyle(col, 0.25 * pulse);
        g.fillCircle(ax, ay, size * 1.6);
        g.fillStyle(col, 0.95);
        g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(b1.x, b1.y); g.lineTo(b2.x, b2.y); g.closePath(); g.fillPath();
        g.lineStyle(2, 0xffffff, 0.85 * pulse);
        g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(b1.x, b1.y); g.lineTo(b2.x, b2.y); g.closePath(); g.strokePath();
    };
