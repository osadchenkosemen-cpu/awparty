// scene_fx.js — рендер мировых эффектов MainScene (вынесено из scene.js).
// Методы навешиваются на MainScene.prototype (класс объявлен в scene.js, грузится раньше).
// Это чистый рендер из состояния (мутаций игровой логики нет): стены-волны, трейлы пуль,
// кольцо слэма, волны Сабвуфера, ауры Хайпмена, лучи (игрок/STROBE), портал, стрелка-босс.

// Стены арены в виде бегущих звуковых волн (вместо статичной красной рамки).
// Рисуем по 4 краям синусоиду, смещённую внутрь; фаза бежит со временем,
// амплитуда и цвет пульсируют (как аудио-визуализация).
MainScene.prototype._drawSoundWaveWalls = function(g) {
        const W = C.ARENA_WIDTH, H = C.ARENA_HEIGHT, tm = this.globalTime;
        const step = 26;
        const k = (Math.PI * 2) / 220;                 // длина волны ~220px
        const speed = 2;                                // скорость бегущей волны (медленнее)
        const A = 16 + 10 * (0.5 + 0.5 * Math.sin(tm * 1.6)); // амплитуда + плавный пульс
        const pulse = 0.5 + 0.5 * Math.sin(tm * 3);
        const col = rgb(255, 20 + 80 * pulse, 80 + 60 * pulse); // неон: красный<->розовый

        // Базовые координаты вдоль краёв статичны — считаем один раз и переиспользуем
        // буферы между кадрами. Раньше каждый кадр аллоцировались 4 массива по ~115
        // объектов {x,y} (~460 объектов/кадр → постоянный GC-мусор на 144/240 Гц).
        if (!this._wallAxisX || this._wallStep !== step) {
            this._wallStep = step;
            const xs = []; for (let x = 0; x <= W; x += step) xs.push(x);
            const ys = []; for (let y = 0; y <= H; y += step) ys.push(y);
            this._wallAxisX = xs; this._wallAxisY = ys;
            this._wallTop = new Float64Array(xs.length);   // осциллирующая y верх/низ
            this._wallBot = new Float64Array(xs.length);
            this._wallLeft = new Float64Array(ys.length);  // осциллирующая x лево/право
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
        // Горизонтальные края (верх/низ): x = xs[i], y = буфер[i].
        const strokeH = (yb, width, alpha) => {
            g.lineStyle(width, col, alpha);
            g.beginPath(); g.moveTo(xs[0], yb[0]);
            for (let i = 1; i < xs.length; i++) g.lineTo(xs[i], yb[i]);
            g.strokePath();
        };
        // Вертикальные края (лево/право): x = буфер[i], y = ys[i].
        const strokeV = (xb, width, alpha) => {
            g.lineStyle(width, col, alpha);
            g.beginPath(); g.moveTo(xb[0], ys[0]);
            for (let i = 1; i < ys.length; i++) g.lineTo(xb[i], ys[i]);
            g.strokePath();
        };
        // По два прохода на край: мягкое свечение (12px) + яркое ядро (4px).
        strokeH(top, 12, 0.16); strokeH(top, 4, 0.9);
        strokeH(bot, 12, 0.16); strokeH(bot, 4, 0.9);
        strokeV(left, 12, 0.16); strokeV(left, 4, 0.9);
        strokeV(right, 12, 0.16); strokeV(right, 4, 0.9);
    };

    // ===================== РЕНДЕР МИРА (FX) =====================
MainScene.prototype.drawWorldFx = function() {
        const g = this.worldFx;
        g.clear();
        this._drawSoundWaveWalls(g); // стены-границы в виде звуковых волн
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
        // Звуковые волны Сабвуфера: сектор 90° + дуга-фронт (циан).
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
        // Аура Хайпмена: пульсирующее золотое кольцо (зона лечения союзников).
        for (const e of this.enemies) {
            if (e.type !== EnemyType.HYPEMAN || e.hp <= 0) continue;
            const pulse = (Math.sin(this.globalTime * 3) + 1) / 2;
            const rr = C.HYPEMAN.AURA_RADIUS;
            g.fillStyle(rgb(255, 200, 40), 0.06 + 0.04 * pulse);
            g.fillCircle(e.sprite.x, e.sprite.y, rr);
            g.lineStyle(3, rgb(255, 210, 60), 0.4 + 0.25 * pulse);
            g.strokeCircle(e.sprite.x, e.sprite.y, rr);
        }
        // Лазер игрока (способность LASER): затухающий пробивающий луч
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
        // Лазер STROBE: тонкий телеграф-прицел, затем толстый светящийся луч
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
                g.lineStyle(e.beamWidth, rgb(0, 220, 255), 0.28);   // широкое свечение
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
                g.lineStyle(e.beamWidth * 0.5, rgb(150, 245, 255), 0.55);
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
                g.lineStyle(8, rgb(255, 255, 255), 0.95);           // яркое ядро
                g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.strokePath();
            }
        }
        // Портал безумного этапа: неоновая воронка из вращающихся колец.
        if (this.crazyMode && this.portal) this._drawPortal(g);
    };

    // Неоновый портал-воронка (синтвейв STROBE): пульсирующее свечение + концентрические
    // вращающиеся кольца + яркое ядро. Цвета совпадают с боссом-СТРОБОМ (cyan/magenta).
MainScene.prototype._drawPortal = function(g) {
        const px = this.portal.x, py = this.portal.y, T = this.globalTime;
        const R = C.PORTAL_RADIUS;
        const pulse = 0.5 + 0.5 * Math.sin(T * 4);
        // Неоновый ореол под спрайтом (или сам портал, если ассета нет)
        g.fillStyle(rgb(0, 230, 255), 0.12 + 0.07 * pulse);
        g.fillCircle(px, py, R * 1.7);
        g.fillStyle(rgb(200, 0, 255), 0.12 + 0.07 * pulse);
        g.fillCircle(px, py, R * 1.25);

        if (this.portalSprite) {
            // Анимация спрайта: медленное вращение против часовой стрелки + пульсация масштаба.
            this.portalSprite.rotation = -T * 0.5;
            this.portalSprite.setScale(this._portalBaseScale * (1 + 0.06 * pulse));
            return;
        }

        // Фолбэк без ассета: векторная воронка.
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

    // Стрелка-индикатор направления на босса, когда он за пределами видимой области.
    // Прижата к краю экрана (на отступе margin) в стороне босса, цвет — по типу босса.
MainScene.prototype._drawBossArrow = function() {
        const g = this.bossArrowFx;
        g.clear();
        if (this.isGameOver) return;
        // Цель указателя: босс, а в безумном этапе — портал-выход.
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
        const sx = tx - view.x, sy = ty - view.y; // позиция цели в координатах экрана
        if (sx >= margin && sx <= W - margin && sy >= margin && sy <= H - margin) return; // цель на экране — стрелка не нужна

        const cx = W / 2, cy = H / 2;
        const ang = Math.atan2(sy - cy, sx - cx);
        const cos = Math.cos(ang), sin = Math.sin(ang);
        // точка на прямоугольнике-рамке (экран минус margin) в направлении босса
        const hw = W / 2 - margin, hh = H / 2 - margin;
        let scale = Infinity;
        if (Math.abs(cos) > 1e-6) scale = Math.min(scale, hw / Math.abs(cos));
        if (Math.abs(sin) > 1e-6) scale = Math.min(scale, hh / Math.abs(sin));
        const ax = cx + cos * scale, ay = cy + sin * scale;

        const pulse = 0.6 + 0.4 * Math.sin(this.globalTime * 8);
        const size = 24 * (0.92 + 0.12 * Math.sin(this.globalTime * 8));

        // треугольник: остриё в сторону босса (наружу), основание — позади
        const perp = ang + Math.PI / 2;
        const tip = { x: ax + cos * size, y: ay + sin * size };
        const bcx = ax - cos * size * 0.5, bcy = ay - sin * size * 0.5;
        const halfW = size * 0.72;
        const b1 = { x: bcx + Math.cos(perp) * halfW, y: bcy + Math.sin(perp) * halfW };
        const b2 = { x: bcx - Math.cos(perp) * halfW, y: bcy - Math.sin(perp) * halfW };

        g.fillStyle(col, 0.25 * pulse);
        g.fillCircle(ax, ay, size * 1.6); // свечение
        g.fillStyle(col, 0.95);
        g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(b1.x, b1.y); g.lineTo(b2.x, b2.y); g.closePath(); g.fillPath();
        g.lineStyle(2, 0xffffff, 0.85 * pulse);
        g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(b1.x, b1.y); g.lineTo(b2.x, b2.y); g.closePath(); g.strokePath();
    };
