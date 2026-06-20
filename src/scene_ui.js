// scene_ui.js — меню, экраны и ввод MainScene (вынесено из scene.js).
// Методы навешиваются на MainScene.prototype (класс объявлен в scene.js, грузится раньше).
// Сюда входят: построение всех экранов (меню/лобби/настройки/рекорды/пауза/левелап/способности),
// обработка мыши и клавиатуры, переходы по пунктам, смена языка/громкости, переименование игрока.

// Экран настроек: пункты сгруппированы по категориям. Внутри rows — ЛОГИЧЕСКИЕ индексы
// (та же нумерация, что в _settingsActivate/обработчиках ввода): 0 хардкор, 1 окно,
// 2 звук, 3 эффекты, 4 язык, 5 имя, 6 облако, 7 назад. SETTINGS_ORDER — порядок обхода
// стрелками (визуальный сверху вниз). Пункт 7 (Назад) — кнопка под панелью.
const SETTINGS_GROUPS = [
    { title: 'set_grp_game',    rows: [0] },
    { title: 'set_grp_audio',   rows: [2, 3] },
    { title: 'set_grp_display', rows: [1, 4] },
    { title: 'set_grp_account', rows: [5, 6] },
];
const SETTINGS_ORDER = [0, 2, 3, 1, 4, 5, 6, 7];

    // ===================== МЕНЮ / UI =====================
MainScene.prototype._clearMenu = function() { this.menuObjs.forEach(o => o.destroy()); this.menuObjs = []; }
MainScene.prototype._mAdd = function(o) { this.addUI(o); this.menuObjs.push(o); return o; }
MainScene.prototype._mText = function(x, y, str, size, color, ox, oy, stroke, strokeW) {
        const t = this.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: color, stroke: stroke || '#000', strokeThickness: strokeW === undefined ? 2 : strokeW, align: 'center' });
        t.setOrigin(ox === undefined ? 0.5 : ox, oy === undefined ? 0.5 : oy);
        return this._mAdd(t);
    }

    // Обновить только стиль выделения в простом списочном меню (MENU/LOBBY/PAUSE),
    // не пересоздавая текстовые объекты. Вызывается при перемещении выбора мышью/клавишами.
MainScene.prototype._restyleList = function(idx) {
        const L = this._listItems;
        if (!L) return;
        for (let i = 0; i < L.objs.length; i++) {
            const sel = i === idx;
            L.objs[i]
                .setText(sel ? '> ' + L.labels[i] + ' <' : L.labels[i])
                .setFontSize(sel ? L.selSize : L.baseSize)
                .setColor(sel ? '#ffffff' : '#00ffc8')
                .setStroke(sel ? '#ff0096' : '#000', sel ? 3 : 2);
        }
    }

MainScene.prototype.rebuildMenu = function() {
        this._clearMenu();
        this._listItems = null; // ссылки на тексты списочного меню (пересоздаются в _buildX)
        if (this.shop) this.shop.hide();
        const st = this.currentState;
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;

        const showBg = (st === GameState.MENU || st === GameState.SETTINGS || st === GameState.LOBBY || st === GameState.LEADERBOARD || st === GameState.RENAME_INPUT || st === GameState.CLOUD_RESTORE || st === GameState.CHAPTER_SELECT);
        this.menuBg.setVisible(showBg);
        this.lobbyPlayer.setVisible(st === GameState.LOBBY);
        const hudVisible = (st === GameState.PLAYING || st === GameState.PAUSED || st === GameState.LEVEL_UP || st === GameState.ABILITY_SELECT);
        this.hud.setVisible(hudVisible);

        // Скрыть динамические оверлеи вне активной игры
        if (st !== GameState.PLAYING) {
            this.phaseText.setVisible(false);
            this.phaseOverlay.setVisible(false);
            this.clearText.setVisible(false);
            this.warnRect.setVisible(false);
            this.upgradeMsg.setVisible(false);
            if (this.bossArrowFx) this.bossArrowFx.clear();
        }

        if (st === GameState.MENU) this._buildMenuScreen();
        else if (st === GameState.LOBBY) this._buildLobby();
        else if (st === GameState.SHOP) this.shop.show();
        else if (st === GameState.SETTINGS) this._buildSettings();
        else if (st === GameState.LEADERBOARD) this._buildLeaderboard();
        else if (st === GameState.PAUSED) this._buildPause();
        else if (st === GameState.LEVEL_UP) this._buildLevelUp();
        else if (st === GameState.ABILITY_SELECT) this._buildAbilitySelect();
        else if (st === GameState.NAME_INPUT) this._buildNameInput();
        else if (st === GameState.RENAME_INPUT) this._buildRenameInput();
        else if (st === GameState.CLOUD_RESTORE) this._buildCloudRestore();
        else if (st === GameState.STAGE_CLEAR) this._buildStageClear();
        else if (st === GameState.CHAPTER_SELECT) this._buildChapterSelect();
        else if (st === GameState.PLAYING && this.isGameOver) this._buildGameOver();
    }

MainScene.prototype._buildMenuScreen = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mText(W / 2, H * 0.15, 'AwParty', 150, '#00ffc8', 0.5, 0.5, '#ffffff', 2);
        const items = [t('menu_play'), t('menu_records'), t('menu_settings')];
        const objs = [];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedMenuIndex;
            objs.push(this._mText(W / 2, H * 0.45 + i * 110, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 75 : 60, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2));
        }
        this._listItems = { objs, labels: items, selSize: 75, baseSize: 60 };
    }

MainScene.prototype._buildLobby = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this.lobbyPlayer.setPosition(W * 0.25, H * 0.55).setScale(1.2);
        this._mText(W * 0.7, H * 0.15, t('lobby_hub'), 100, '#00ffc8', 0.5, 0.5, '#ff0096', 4);
        const coin = this._mAdd(this.add.sprite(W * 0.7 - 70, H * 0.27, 'coin').setOrigin(0.5, 0.5));
        coin.setDisplaySize(50, 50);
        this._mText(W * 0.7 - 30, H * 0.25, '' + this.save.totalCoins, 50, '#ffff00', 0, 0.5);
        const items = [t('lobby_start'), t('lobby_shop'), t('lobby_back')];
        const objs = [];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedLobbyIndex;
            objs.push(this._mText(W * 0.7, H * 0.45 + i * 110, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 75 : 60, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2));
        }
        this._listItems = { objs, labels: items, selSize: 75, baseSize: 60 };
    }

    // Геометрия карточек выбора главы (общая для рендера и хит-теста мыши).
MainScene.prototype._chapterCardRect = function(i) {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        const cardW = 420, cardH = 540, gap = 60;
        const totalW = CHAPTERS.length * cardW + (CHAPTERS.length - 1) * gap;
        const x0 = (W - totalW) / 2;
        return { x: x0 + i * (cardW + gap), y: H / 2 - cardH / 2 + 30, w: cardW, h: cardH };
    }

MainScene.prototype._buildChapterSelect = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x06001a, 200 / 255).setOrigin(0, 0));
        this._mText(W / 2, H * 0.12, t('chapter_select_title'), 90, '#00e6ff', 0.5, 0.5, '#c800ff', 4);

        for (let i = 0; i < CHAPTERS.length; i++) {
            const ch = CHAPTERS[i];
            const r = this._chapterCardRect(i);
            const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
            const sel = i === this.selectedChapterIndex;
            const locked = ch.id > this.save.maxChapterUnlocked;
            // Тема карточки: цвет главы; заблокированная — серая.
            const hue = locked ? 0x39394a : ch.hue;
            const fill = locked ? 0x16161e : Phaser.Display.Color.IntegerToColor(hue).darken(70).color;

            // Подложка-«карта» (вектор) + рамка. Выбранная — ярче и толще.
            this._mAdd(this.add.rectangle(cx, cy, r.w, r.h, fill, 1).setOrigin(0.5, 0.5)
                .setStrokeStyle(sel ? 6 : 3, hue, locked ? 0.6 : 1));

            const hexHue = '#' + hue.toString(16).padStart(6, '0');
            const titleCol = locked ? '#6a6a78' : '#ffffff';
            // «ГЛАВА» + номер — единый блок по центру карточки.
            this._mText(cx, cy - 55, t('chapter_label'), 38, locked ? '#56566a' : hexHue, 0.5, 0.5, '#000', 2);
            this._mText(cx, cy + 20, '' + ch.id, 110, titleCol, 0.5, 0.5, locked ? '#000' : hexHue, 3);

            if (locked) {
                this._mText(cx, r.y + r.h - 70, '[ ' + t('chapter_locked') + ' ]', 40, '#8a8a98', 0.5, 0.5, '#000', 3);
            } else {
                this._mText(cx, r.y + r.h - 70, sel ? '> ' + t('chapter_play') + ' <' : t('chapter_play'),
                    sel ? 40 : 34, sel ? '#ffffff' : hexHue, 0.5, 0.5, '#c800ff', sel ? 3 : 2);
            }
        }
        this._mText(W / 2, H * 0.92, t('chapter_hint_back'), 30, '#7d78a0', 0.5, 0.5, '#000', 2);
    }

MainScene.prototype._buildSettings = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, s = this.save;
        this._mText(W / 2, H * 0.07, t('set_title'), 78, '#00ffc8', 0.5, 0.5, '#ff0096', 3);

        const langLabel = s.language === 'ru' ? t('lang_ru') : t('lang_en');
        const labelOf = (i) => [t('set_hardcore'), t('set_window'), t('set_sound'),
            t('set_effects'), t('set_language'), t('set_rename'), t('set_cloud')][i];
        const valueOf = (i) => {
            if (i === 0) return s.isHardcoreMode ? t('on') : t('off');
            if (i === 1) return s.isFullscreen ? t('win_full') : t('win_windowed');
            if (i === 2) return s.soundVolume + '%';
            if (i === 3) return s.effectsVolume + '%';
            if (i === 4) return langLabel;
            if (i === 5) return s.playerName ? s.playerName : t('not_set');
            if (i === 6) return t('set_cloud_open');
            return '';
        };
        // Пункты со стрелками < > (меняются влево/вправо): окно, звук, эффекты, язык.
        const isAdjustable = (i) => i >= 1 && i <= 4;

        // Геометрия панели и строк.
        const panelW = 780, panelX = W / 2 - panelW / 2, padX = 46;
        const rowH = 56, headH = 50, grpGap = 12, innerPad = 22;
        let total = innerPad * 2 - grpGap;
        for (const g of SETTINGS_GROUPS) total += headH + g.rows.length * rowH + grpGap;
        const panelTop = H * 0.135;
        // Панель (рисуем первой — она под текстом).
        this._mAdd(this.add.rectangle(panelX, panelTop, panelW, total, 0x0c0820, 0.82)
            .setOrigin(0, 0).setStrokeStyle(2, 0x6a4aa0));

        this._settingsRows = [];
        let y = panelTop + innerPad;
        for (const grp of SETTINGS_GROUPS) {
            this._mText(panelX + padX, y + headH / 2, t(grp.title), 24, '#ff64c8', 0, 0.5, '#000', 2);
            this._mAdd(this.add.rectangle(panelX + padX, y + headH - 6, panelW - padX * 2, 2, 0x3a3060, 1).setOrigin(0, 0.5));
            y += headH;
            for (const idx of grp.rows) {
                const sel = idx === this.selectedSettingIndex;
                const rx = panelX + 18, rw = panelW - 36, cy = y + rowH / 2;
                if (sel) this._mAdd(this.add.rectangle(rx, y + 4, rw, rowH - 8, 0x2a1840, 1)
                    .setOrigin(0, 0).setStrokeStyle(2, 0xff3296));
                this._mText(panelX + padX, cy, labelOf(idx), sel ? 32 : 28,
                    sel ? '#ffffff' : '#cfe9e0', 0, 0.5, '#000', 2);
                const row = { idx, x: rx, y, w: rw, h: rowH };
                if (isAdjustable(idx)) {
                    // Стрелки < > — отдельные кликабельные элементы (правый край строки).
                    const aSize = sel ? 34 : 30, aCol = '#7ad6ff', vCol = sel ? '#ffe45a' : '#ffffff';
                    const gR = this._mText(panelX + panelW - padX, cy, '>', aSize, aCol, 1, 0.5, '#000', 2);
                    const vMid = this._mText(gR.x - gR.width - 18, cy, valueOf(idx), sel ? 32 : 28, vCol, 1, 0.5, '#000', 2);
                    const gL = this._mText(vMid.x - vMid.width - 18, cy, '<', aSize, aCol, 1, 0.5, '#000', 2);
                    row.adjL = { x: gL.x - gL.width - 14, y, w: gL.width + 28, h: rowH };
                    row.adjR = { x: gR.x - gR.width - 14, y, w: gR.width + 28, h: rowH };
                } else {
                    this._mText(panelX + panelW - padX, cy, valueOf(idx), sel ? 32 : 28,
                        sel ? '#ffe45a' : '#00ffc8', 1, 0.5, '#000', 2);
                }
                this._settingsRows.push(row);
                y += rowH;
            }
            y += grpGap;
        }

        // Кнопка «Назад» (логический индекс 7) — под панелью.
        const bw = 300, bh = 58, bx = W / 2 - bw / 2, by = panelTop + total + 26;
        const bsel = this.selectedSettingIndex === 7;
        this._mAdd(this.add.rectangle(bx, by, bw, bh, bsel ? 0x2a1840 : 0x140a28, 1)
            .setOrigin(0, 0).setStrokeStyle(2, bsel ? 0xff3296 : 0x6a4aa0));
        this._mText(bx + bw / 2, by + bh / 2, t('back'), bsel ? 34 : 30, bsel ? '#ffffff' : '#00ffc8', 0.5, 0.5, '#000', 2);
        this._settingsRows.push({ idx: 7, x: bx, y: by, w: bw, h: bh });

        if (this.cheatMessageTimer > 0) this._mText(50, H - 110, this.cheatMessage, 28, '#ffff00', 0, 0);

        // Кнопка «Сбросить персонажа» — правый нижний угол (мышь). Имя/настройки сохраняются.
        const rr = this._settingsResetRect();
        const confirm = !!this._resetConfirm, hov = !!this._resetHover;
        this._mAdd(this.add.rectangle(rr.x, rr.y, rr.w, rr.h, confirm ? 0x4a1020 : 0x1a1030, 1)
            .setOrigin(0, 0).setStrokeStyle(2, confirm ? 0xff3264 : (hov ? 0xff7a7a : 0x9664c8)));
        this._mText(rr.x + rr.w / 2, rr.y + rr.h / 2, confirm ? t('reset_confirm') : t('set_reset'),
            confirm ? 22 : 24, confirm ? '#ff9aa0' : (hov ? '#ffffff' : '#d8c0ee'), 0.5, 0.5);
    }

    // Прямоугольник кнопки сброса персонажа (правый нижний угол экрана настроек).
MainScene.prototype._settingsResetRect = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, w = 380, h = 56;
        return { x: W - w - 30, y: H - h - 30, w: w, h: h };
    }

    // Клик по кнопке сброса: первый раз — подтверждение, второй — собственно сброс.
MainScene.prototype._settingsResetClick = function() {
        this.audio.play('sfx_menu_click');
        if (!this._resetConfirm) { this._resetConfirm = true; this._resetConfirmTimer = 4; this.rebuildMenu(); return; }
        this._resetConfirm = false; this._resetConfirmTimer = 0;
        SaveSystem.resetProgress(this.save);
        this.saveGame();
        if (this.audio) this.audio.syncFromSave();
        this.cheatMessage = t('reset_done'); this.cheatMessageTimer = 3;
        this.rebuildMenu();
    }

MainScene.prototype._buildLeaderboard = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x000000, 160 / 255).setOrigin(0, 0));
        this._mText(W / 2, 50, t('lb_title'), 100, '#ffd700', 0.5, 0, '#b40050', 5);
        // Заголовок режима + переключатель.
        const hc = this.lbView === 'hardcore';
        this._mText(W / 2, 215, '<  ' + (hc ? t('lb_hardcore') : t('lb_normal')) + '  >', 44, hc ? '#ff5050' : '#00ffc8', 0.5, 0.5, '#000', 3);
        const board = this.leaderboards[this.lbView];
        const rowY0 = 300, rowH = 54;
        const colX = [W * 0.08, W * 0.16, W * 0.50, W * 0.66, W * 0.80];
        const hdrs = [t('lb_col_num'), t('lb_col_name'), t('lb_col_score'), t('lb_col_time'), t('lb_col_date')];
        for (let i = 0; i < 5; i++) this._mText(colX[i], rowY0 - 38, hdrs[i], 26, '#00ffc8', 0, 0);
        for (let i = 0; i < 10; i++) {
            const y = rowY0 + i * rowH;
            const e = board[i];
            const isNew = i === this.leaderboardNewEntryIndex;
            const filled = (e.score > 0 || e.time > 0);
            const col = filled ? (isNew ? '#ffd700' : '#dcd7eb') : '#504b5f';
            this._mText(colX[0], y, '' + (i + 1), 30, col, 0, 0);
            if (filled) {
                this._mText(colX[1], y, e.name, 30, col, 0, 0);
                this._mText(colX[2], y, fmtNum(e.score || 0), 30, col, 0, 0);
                this._mText(colX[3], y, formatTime(e.time), 30, col, 0, 0);
                const pad = (n) => (n < 10 ? '0' + n : '' + n);
                this._mText(colX[4], y, pad(e.day) + '.' + pad(e.month) + '.' + e.year, 30, col, 0, 0);
            } else this._mText(colX[1], y, '---', 30, col, 0, 0);
        }
        this._mText(W / 2, H * 0.86, t('lb_hint_switch'), 30, '#7d78a0', 0.5, 0, '#000', 2);
        this._mText(W / 2, H * 0.92, t('lb_hint_back'), 36, '#00ffc8', 0.5, 0);
    }

// --- Сбор «билда» забега для паузы/итогов: списки иконок ---
// Карты прокачки (взятые), с бейджем кол-ва (легендарные — золотая звезда).
MainScene.prototype._runCards = function() {
        const out = [];
        for (let id = 0; id < 7; id++) {
            if (this.runUpgradeLevels[id] > 0) {
                const badge = LEGENDARY_UPGRADE_IDS.includes(id) ? '★' : ('x' + this.runUpgradeLevels[id]);
                out.push({ key: UPGRADE_ICONS[id], badge });
            }
        }
        return out;
    }
// Способности в слотах.
MainScene.prototype._runAbilities = function() {
        const out = [];
        for (let i = 0; i < 3; i++) {
            const id = this.equippedAbilities[i];
            if (id >= 0) out.push({ key: HUD.abilityIconKey(id), badge: '' });
        }
        return out;
    }
// Активные артефакты (битовая маска).
MainScene.prototype._runArtifacts = function() {
        const out = [];
        for (let i = 0; i < 7; i++) {
            if ((this.save.permActiveArtifacts >> i) & 1) out.push({ key: ARTIFACT_ICONS[i], badge: '' });
        }
        return out;
    }
// Подписанный ряд иконок по центру cx, начиная с y. Возвращает следующий y.
MainScene.prototype._buildIconRow = function(label, cx, y, entries) {
        const ICON = 68, GAP = 18;
        this._mText(cx, y, label, 24, '#9a96b0', 0.5, 0, '#000', 2);
        const iconY = y + 34;
        if (!entries.length) {
            this._mText(cx, iconY + ICON / 2, t('build_none'), 30, '#6a6680', 0.5, 0.5);
            return iconY + ICON + 20;
        }
        const total = entries.length * ICON + (entries.length - 1) * GAP;
        let sx = cx - total / 2;
        for (const e of entries) {
            const tcx = sx + ICON / 2, tcy = iconY + ICON / 2;
            if (e.key && this.textures.exists(e.key)) {
                const sp = this._mAdd(this.add.sprite(tcx, tcy, e.key).setOrigin(0.5, 0.5));
                sp.setScale(ICON / Math.max(sp.width, sp.height));
            } else {
                this._mAdd(this.add.rectangle(tcx, tcy, ICON, ICON, 0x241a36, 1).setStrokeStyle(2, 0x5a4a78));
            }
            if (e.badge) this._mText(sx + ICON + 2, iconY + ICON + 2, e.badge, 24, '#ffd200', 1, 1, '#321900', 3);
            sx += ICON + GAP;
        }
        return iconY + ICON + 20;
    }

MainScene.prototype._buildPause = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT, p = this.player;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 205 / 255).setOrigin(0, 0));
        this._mText(W / 2, 70, t('pause_title'), 92, '#ffffff', 0.5, 0.5, '#000', 3);

        // Вертикальная полоска-разделитель по центру между статами и билдом.
        const midX = W / 2, dTop = 150, dH = 415;
        this._mAdd(this.add.rectangle(midX, dTop, 12, dH, 0x9664c8, 0.16).setOrigin(0.5, 0)); // свечение
        this._mAdd(this.add.rectangle(midX, dTop, 3, dH, 0xc8a0ff, 0.9).setOrigin(0.5, 0));   // линия

        // Статы — слева от центра (значения выровнены к разделителю).
        const lx = midX - 410, vx = midX - 60;
        this._mText((lx + vx) / 2, 150, t('pause_stats'), 30, '#00ffc8', 0.5, 0.5, '#000', 2);
        const fr = p.shootCooldown > 0 ? 1 / p.shootCooldown : 0;
        const stats = [
            [t('stat_damage'), '' + p.attackDamage],
            [t('stat_firerate'), fr.toFixed(1) + '/s'],
            [t('stat_speed'), '' + Math.round(p.speed)],
            [t('stat_crit'), Math.round(p.critChance * 100) + '%'],
            [t('stat_hp'), '' + Math.round(p.maxHp)],
            [t('stat_armor'), Math.min(90, p.armor * 20) + '%'],
            [t('stat_magnet'), p.pickupRadius >= 99999 ? '∞' : ('' + Math.round(p.pickupRadius))],
            [t('stat_dash'), p.hasDashUnlocked ? ('Lv ' + p.dashLevel) : t('build_none')],
        ];
        let sy = 210;
        for (const [lab, val] of stats) {
            this._mText(lx, sy, lab, 28, '#b0a8c0', 0, 0.5);
            this._mText(vx, sy, val, 28, '#ffffff', 1, 0.5);
            sy += 44;
        }

        // Билд — справа от центра (иконки карт/способностей/артефактов).
        const cx = midX + 300;
        this._mText(cx, 150, t('pause_build'), 30, '#00ffc8', 0.5, 0.5, '#000', 2);
        let by = 200;
        by = this._buildIconRow(t('build_cards'), cx, by, this._runCards());
        by = this._buildIconRow(t('build_abilities'), cx, by, this._runAbilities());
        by = this._buildIconRow(t('build_artifacts'), cx, by, this._runArtifacts());

        // Меню — позиции НЕ менять (на них завязан хит-тест в onPointer*).
        const items = [t('pause_resume'), t('pause_restart'), t('pause_quit')];
        const objs = [];
        for (let i = 0; i < items.length; i++) {
            const sel = i === this.selectedPauseIndex;
            objs.push(this._mText(W / 2, H / 2 + 50 + i * 100, sel ? '> ' + items[i] + ' <' : items[i],
                sel ? 70 : 55, sel ? '#ffffff' : '#00ffc8', 0.5, 0.5, sel ? '#ff0096' : '#000', sel ? 3 : 2));
        }
        this._listItems = { objs, labels: items, selSize: 70, baseSize: 55 };
    }

MainScene.prototype._buildGameOver = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x1e000a, 225 / 255).setOrigin(0, 0));
        this._mText(W / 2, 90, t('gameover_title'), 96, '#ffffff', 0.5, 0.5, '#ff0033', 4);

        // Сводка: счёт / время / уровень / убито / монет за забег.
        const cells = [
            [t('summary_score'), fmtNum(this.runScore || 0)],
            [t('summary_time'), formatTime(this.survivalTimer)],
            [t('summary_level'), '' + this.player.level],
            [t('summary_kills'), '' + (this.killCount || 0)],
            [t('summary_coins'), '' + (this.coinsThisRun || 0)],
        ];
        const colW = 340, startX = W / 2 - (cells.length - 1) * colW / 2;
        for (let i = 0; i < cells.length; i++) {
            const x = startX + i * colW;
            this._mText(x, 210, cells[i][0], 28, '#9a93b4', 0.5, 0.5);
            this._mText(x, 254, cells[i][1], 52, '#ffd700', 0.5, 0.5, '#3a2a00', 3);
        }

        // Билд забега.
        this._mText(W / 2, 340, t('pause_build'), 28, '#00ffc8', 0.5, 0, '#000', 2);
        let by = 384;
        by = this._buildIconRow(t('build_cards'), W / 2, by, this._runCards());
        by = this._buildIconRow(t('build_abilities'), W / 2, by, this._runAbilities());
        by = this._buildIconRow(t('build_artifacts'), W / 2, by, this._runArtifacts());

        // Управление.
        this._mText(W / 2, H - 150, t('gameover_hint'), 36, '#dcd7eb', 0.5, 0.5, '#000', 2);
        this._mText(W / 2, H - 95, t('gameover_records'), 30, '#00ffc8', 0.5, 0.5);
    }

    // Прямоугольник кнопки «ПЕРЕЙТИ В ХАБ» на экране итогов (для отрисовки и кликов).
MainScene.prototype._stageClearHubRect = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        const w = 540, h = 96;
        return { x: W / 2 - w / 2, y: H - 150, w, h };
    }

    // Экран после входа в портал: итоги 3 пройденных этапов + кнопка в хаб.
MainScene.prototype._buildStageClear = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x06001a, 235 / 255).setOrigin(0, 0));
        this._mText(W / 2, 70, t('stageclear_title'), 92, '#00e6ff', 0.5, 0.5, '#c800ff', 4);
        this._mText(W / 2, 138, t('stageclear_sub'), 30, '#bfb8e0', 0.5, 0.5, '#000', 2);

        // Таблица: строка-заголовок + 3 этапа + ИТОГО (счёт — приоритетная метрика).
        const cols = ['', t('summary_score'), t('summary_time'), t('summary_kills'), t('summary_coins')];
        const colX = [W / 2 - 560, W / 2 - 230, W / 2 + 20, W / 2 + 260, W / 2 + 480];
        let y = 210;
        for (let c = 0; c < 5; c++) this._mText(colX[c], y, cols[c], 28, '#7d78a0', 0.5, 0.5);
        y += 50;

        const tot = { time: 0, kills: 0, coins: 0, score: 0 };
        for (let i = 0; i < 3; i++) {
            const s = this.stageStats[i] || { time: 0, kills: 0, coins: 0, score: 0 };
            tot.time += s.time; tot.kills += s.kills; tot.coins += s.coins; tot.score += (s.score || 0);
            this._mText(colX[0], y, t('stageclear_stage') + ' ' + (i + 1), 38, '#00ffc8', 0.5, 0.5, '#000', 2);
            this._mText(colX[1], y, fmtNum(s.score || 0), 40, '#00e6ff', 0.5, 0.5, '#000', 2);
            this._mText(colX[2], y, formatTime(s.time), 40, '#ffffff', 0.5, 0.5, '#000', 2);
            this._mText(colX[3], y, '' + s.kills, 40, '#ffffff', 0.5, 0.5, '#000', 2);
            this._mText(colX[4], y, '' + s.coins, 40, '#ffd700', 0.5, 0.5, '#3a2a00', 2);
            y += 56;
        }
        // Разделитель + ИТОГО.
        this._mAdd(this.add.rectangle(W / 2, y - 6, 1280, 2, 0x3a3060, 1).setOrigin(0.5, 0.5));
        y += 30;
        this._mText(colX[0], y, t('stageclear_total'), 38, '#ff64c8', 0.5, 0.5, '#000', 2);
        this._mText(colX[1], y, fmtNum(tot.score), 42, '#00e6ff', 0.5, 0.5, '#000', 2);
        this._mText(colX[2], y, formatTime(tot.time), 42, '#ffffff', 0.5, 0.5, '#000', 2);
        this._mText(colX[3], y, '' + tot.kills, 42, '#ffffff', 0.5, 0.5, '#000', 2);
        this._mText(colX[4], y, '' + tot.coins, 42, '#ffd700', 0.5, 0.5, '#3a2a00', 2);

        // Билд забега.
        this._mText(W / 2, y + 70, t('pause_build'), 28, '#00ffc8', 0.5, 0, '#000', 2);
        let by = y + 112;
        by = this._buildIconRow(t('build_cards'), W / 2, by, this._runCards());
        by = this._buildIconRow(t('build_abilities'), W / 2, by, this._runAbilities());
        by = this._buildIconRow(t('build_artifacts'), W / 2, by, this._runArtifacts());

        // Кнопка «ПЕРЕЙТИ В ХАБ».
        const r = this._stageClearHubRect();
        this._mAdd(this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x14003c, 1)
            .setOrigin(0.5, 0.5).setStrokeStyle(3, 0x00e6ff));
        this._mText(r.x + r.w / 2, r.y + r.h / 2, t('stageclear_hub'), 44, '#ffffff', 0.5, 0.5, '#c800ff', 3);
    }

MainScene.prototype._buildNameInput = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 230 / 255).setOrigin(0, 0));
        this._mText(W / 2, H * 0.22, t('name_new_record'), 110, '#ffd700', 0.5, 0.5, '#b40050', 5);
        this._mText(W / 2, H * 0.36, t('name_score') + '  ' + fmtNum(this.runScore) + '    ' + t('name_time') + '  ' + formatTime(this.survivalTimer), 46, '#00ffc8', 0.5, 0.5, '#000', 3);
        this._mText(W / 2, H * 0.48, t('name_enter'), 38, '#dcd7eb', 0.5, 0.5, '#000', 2);

        // Поле ввода + текст с курсором-подчёркиванием.
        const boxW = 760, boxH = 96, boxY = H * 0.58;
        const errored = !!this._nameError;
        this._mAdd(this.add.rectangle(W / 2, boxY, boxW, boxH, 0x140028, 1).setOrigin(0.5, 0.5).setStrokeStyle(3, errored ? 0xff3264 : 0x9600ff));
        this._mText(W / 2, boxY, this.nameInput + '_', 50, '#ffffff', 0.5, 0.5, '#000', 2);

        if (errored) this._mText(W / 2, H * 0.66, this._nameError, 34, '#ff5078', 0.5, 0.5, '#000', 2);
        this._mText(W / 2, H * 0.74, t('name_hint'), 30, '#7d78a0', 0.5, 0.5, '#000', 2);
    }

MainScene.prototype._buildRenameInput = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 230 / 255).setOrigin(0, 0));
        this._mText(W / 2, H * 0.20, t('rename_title'), 100, '#ffd700', 0.5, 0.5, '#b40050', 5);
        this._mText(W / 2, H * 0.34, t('rename_current') + '  ' + (this.save.playerName || t('not_set')), 40, '#00ffc8', 0.5, 0.5, '#000', 3);
        this._mText(W / 2, H * 0.46, t('rename_new'), 38, '#dcd7eb', 0.5, 0.5, '#000', 2);

        const boxW = 760, boxH = 96, boxY = H * 0.56;
        const errored = !!this._renameError;
        this._mAdd(this.add.rectangle(W / 2, boxY, boxW, boxH, 0x140028, 1).setOrigin(0.5, 0.5).setStrokeStyle(3, errored ? 0xff3264 : 0x9600ff));
        this._mText(W / 2, boxY, this.renameInput + '_', 50, '#ffffff', 0.5, 0.5, '#000', 2);

        if (this._renameBusy) this._mText(W / 2, H * 0.64, t('rename_saving'), 34, '#ffd700', 0.5, 0.5, '#000', 2);
        else if (errored) this._mText(W / 2, H * 0.64, this._renameError, 34, '#ff5078', 0.5, 0.5, '#000', 2);

        this._mText(W / 2, H * 0.74, t('rename_merge_note'), 26, '#7d78a0', 0.5, 0.5, '#000', 2);
        this._mText(W / 2, H * 0.80, t('rename_hint'), 30, '#7d78a0', 0.5, 0.5, '#000', 2);
    }

MainScene.prototype._buildLevelUp = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 220 / 255).setOrigin(0, 0));
        this._mText(W / 2, 150, t('levelup'), 100, '#ffff00', 0.5, 0.5, '#ff0096', 5);
        this.levelUpCards = [];
        for (let i = 0; i < 3; i++) {
            const uId = this.levelUpIds[i];
            const cx = W / 2 + (i - 1) * 450;
            const cy = H / 2 + 50;
            // Легендарные карты — золотая рамка/заголовок и бейдж, без звёзд-этапов.
            const isLegendary = LEGENDARY_UPGRADE_IDS.includes(uId);
            const fill = isLegendary ? 0x2a2000 : 0x140028;
            const strokeCol = isLegendary ? 0xffd200 : 0x9600ff;
            const strokeW = isLegendary ? 7 : 5;
            const titleCol = isLegendary ? '#ffd200' : '#00ffc8';
            const rect = this._mAdd(this.add.rectangle(cx, cy, 400, 550, fill, 240 / 255).setOrigin(0.5, 0.5).setStrokeStyle(strokeW, strokeCol));
            const title = this._mText(cx, cy - 230, t('upgrade_titles')[uId], 35, titleCol, 0.5, 0);
            const icon = this._mAdd(this.add.sprite(cx, cy - 30, UPGRADE_ICONS[uId]).setOrigin(0.5, 0.5));
            const iscale = 180 / icon.width;
            icon.setScale(iscale);
            const desc = this._mText(cx, cy + 110, t('upgrade_descs')[uId], 25, '#ffffff', 0.5, 0);
            let badgeObj = null;
            const cnt = this.runUpgradeLevels[uId];
            if (isLegendary) {
                badgeObj = this._mText(cx, cy + 215, t('card_legendary'), 26, '#ffd200', 0.5, 0.5, '#643c00', 3);
            } else if (cnt > 0) {
                let stars = '';
                for (let s = 0; s < cnt; s++) stars += '*';
                badgeObj = this._mText(cx, cy + 215, stars, 28, '#ffd200', 0.5, 0.5, '#643c00', 2);
            }
            const objs = [rect, title, icon, desc]; if (badgeObj) objs.push(badgeObj);
            const baseY = objs.map(o => o.y);
            const baseSX = [1, 1, iscale, 1]; if (badgeObj) baseSX.push(1);
            this.levelUpCards.push({ rect, objs, baseY, baseSX, uId });
        }
        this._animateLevelUp();
    }

MainScene.prototype._buildAbilitySelect = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x080014, 210 / 255).setOrigin(0, 0));
        this._mText(W / 2, 130, t('ability_choose'), 80, '#dcb4ff', 0.5, 0.5, '#000', 4);
        const count = this.pendingAbilityCount;
        const gap = 430, cardW = 360, cardH = 560;
        const totalW = (count - 1) * gap;
        const startX = W / 2 - totalW / 2;
        const cy = H / 2 + 20;
        const keyLabels = ['[Q]', '[E]', '[R]'];
        const colHex = { 0: '#ffd700', 1: '#ff5000', 2: '#b400ff', 3: '#00e6ff' };
        this.abilityCards = [];
        for (let i = 0; i < count; i++) {
            const id = this.pendingAbilityIds[i];
            const cx = startX + i * gap;
            const rect = this._mAdd(this.add.rectangle(cx, cy, cardW, cardH, 0x120024, 245 / 255).setOrigin(0.5, 0.5).setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(colHex[id]).color));
            const title = this._mText(cx, cy - cardH / 2 + 28, t('ability_names')[id], 38, colHex[id], 0.5, 0, '#000', 3);
            const objs = [rect, title];
            const baseSX = [1, 1];
            const iconKey = ABILITY_ICONS[id];
            if (iconKey && this.textures.exists(iconKey)) {
                const icon = this._mAdd(this.add.sprite(cx, cy - cardH / 2 + 160, iconKey).setOrigin(0.5, 0.5));
                const iscale = 110 / Math.max(icon.width, icon.height);
                icon.setScale(iscale);
                objs.push(icon); baseSX.push(iscale);
            }
            const cd = ABILITY_COOLDOWNS[id];
            let desc = '';
            if (id === 0) desc = t('ability_desc_0') + '\n\n' + t('cooldown') + ': ' + cd + 's';
            else if (id === 1) desc = t('ability_desc_1') + '\n\n' + t('cooldown') + ': ' + cd + 's';
            else if (id === 2) desc = t('ability_desc_2') + '\n\n' + t('cooldown') + ': ' + cd + 's';
            else if (id === 3) desc = t('ability_desc_3') + '\n\n' + t('cooldown') + ': ' + cd + 's';
            const descObj = this._mText(cx, cy - cardH / 2 + 295, desc, 22, '#c8c3dc', 0.5, 0, '#000', 2);
            const slot = this.pendingSlot;
            const keyObj = this._mText(cx, cy + cardH / 2 - 70, (slot >= 0 && slot < 3) ? keyLabels[slot] : '[?]', 32, '#00f0c8', 0.5, 0, '#000', 2);
            objs.push(descObj, keyObj); baseSX.push(1, 1);
            this.abilityCards.push({ rect, id, cx, cy, w: cardW, h: cardH, objs, baseSX, stroke: Phaser.Display.Color.HexStringToColor(colHex[id]).color });
        }
        this._highlightAbility();
    }

MainScene.prototype._highlightAbility = function() {
        if (!this.abilityCards) return;
        for (let i = 0; i < this.abilityCards.length; i++) {
            const card = this.abilityCards[i];
            const sel = (i === this.selectedAbilityIndex);
            const scale = sel ? 1.05 : 1;
            card.objs.forEach((o, idx) => o.setScale(scale * card.baseSX[idx]));
            card.rect.setStrokeStyle(sel ? 6 : 4, sel ? 0xffffff : card.stroke);
        }
    }

    // ===================== ВВОД =====================
MainScene.prototype.onPointerMove = function(p) {
        const st = this.currentState;
        const x = p.x, y = p.y;
        const hit = (rx, ry, rw, rh) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;

        if (st === GameState.MENU) {
            let ns = -1;
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 200, H * 0.45 + i * 110 - 40, 400, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedMenuIndex) { this.selectedMenuIndex = ns; this._restyleList(ns); }
        } else if (st === GameState.SETTINGS) {
            let ns = -1;
            if (this._settingsRows) for (const r of this._settingsRows) if (hit(r.x, r.y, r.w, r.h)) ns = r.idx;
            // Ховер кнопки сброса (правый нижний угол).
            const rr = this._settingsResetRect();
            const rh = (x >= rr.x && x <= rr.x + rr.w && y >= rr.y && y <= rr.y + rr.h);
            let changed = false;
            if (ns !== -1 && ns !== this.selectedSettingIndex) { this.selectedSettingIndex = ns; changed = true; }
            if (rh !== !!this._resetHover) { this._resetHover = rh; changed = true; }
            if (changed) this.rebuildMenu();
        } else if (st === GameState.LOBBY) {
            let ns = -1;
            for (let i = 0; i < 3; i++) if (hit(W * 0.7 - 250, H * 0.45 + i * 110 - 40, 500, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedLobbyIndex) { this.selectedLobbyIndex = ns; this._restyleList(ns); }
        } else if (st === GameState.CHAPTER_SELECT) {
            let ns = -1;
            for (let i = 0; i < CHAPTERS.length; i++) { const r = this._chapterCardRect(i); if (hit(r.x, r.y, r.w, r.h)) ns = i; }
            if (ns !== -1 && ns !== this.selectedChapterIndex) { this.selectedChapterIndex = ns; this.rebuildMenu(); }
        } else if (st === GameState.PAUSED) {
            let ns = -1;
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 250, H / 2 + 50 + i * 100 - 40, 500, 80)) ns = i;
            if (ns !== -1 && ns !== this.selectedPauseIndex) { this.selectedPauseIndex = ns; this._restyleList(ns); }
        } else if (st === GameState.SHOP) {
            this.shop.updateHover(x, y);
        } else if (st === GameState.LEVEL_UP) {
            if (this.levelUpAnimTimer >= 1) {
                let ns = -1;
                for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) ns = i; }
                this.selectedLevelUpIndex = ns;
            }
        } else if (st === GameState.ABILITY_SELECT) {
            if (this.abilitySelectAnimTimer >= 0.5 && this.abilityCards) {
                let ns = -1;
                for (let i = 0; i < this.abilityCards.length; i++) {
                    const card = this.abilityCards[i];
                    if (hit(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h)) ns = i;
                }
                if (ns !== this.selectedAbilityIndex) { this.selectedAbilityIndex = ns; this._highlightAbility(); }
            }
        }
    }

MainScene.prototype.onPointerDown = function(p) {
        const st = this.currentState;
        const x = p.x, y = p.y;
        const hit = (rx, ry, rw, rh) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;

        if (st === GameState.MENU) {
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 200, H * 0.45 + i * 110 - 40, 400, 80)) { this.selectedMenuIndex = i; this._menuActivate(); return; }
        } else if (st === GameState.LEADERBOARD) {
            if (hit(W / 2 - 150, H * 0.9 - 30, 300, 60)) this.setState(this.leaderboardFromMenu ? GameState.MENU : GameState.LOBBY);
        } else if (st === GameState.SETTINGS) {
            const rr = this._settingsResetRect();
            if (x >= rr.x && x <= rr.x + rr.w && y >= rr.y && y <= rr.y + rr.h) { this._settingsResetClick(); return; }
            if (this._settingsRows) for (const r of this._settingsRows) {
                if (r.adjL && hit(r.adjL.x, r.adjL.y, r.adjL.w, r.adjL.h)) { this.selectedSettingIndex = r.idx; this._settingsAdjust(r.idx, -1); return; }
                if (r.adjR && hit(r.adjR.x, r.adjR.y, r.adjR.w, r.adjR.h)) { this.selectedSettingIndex = r.idx; this._settingsAdjust(r.idx, +1); return; }
                if (hit(r.x, r.y, r.w, r.h)) { this.selectedSettingIndex = r.idx; this._settingsActivate(); return; }
            }
        } else if (st === GameState.PAUSED) {
            for (let i = 0; i < 3; i++) if (hit(W / 2 - 250, H / 2 + 50 + i * 100 - 40, 500, 80)) { this.selectedPauseIndex = i; this._pauseActivate(); return; }
        } else if (st === GameState.LOBBY) {
            for (let i = 0; i < 3; i++) if (hit(W * 0.7 - 250, H * 0.45 + i * 110 - 40, 500, 80)) { this.selectedLobbyIndex = i; this._lobbyActivate(); return; }
        } else if (st === GameState.CHAPTER_SELECT) {
            for (let i = 0; i < CHAPTERS.length; i++) {
                const r = this._chapterCardRect(i);
                if (hit(r.x, r.y, r.w, r.h)) { this.selectedChapterIndex = i; this._chapterActivate(i); return; }
            }
        } else if (st === GameState.STAGE_CLEAR) {
            const r = this._stageClearHubRect();
            if (hit(r.x, r.y, r.w, r.h)) this._stageClearToHub();
        } else if (st === GameState.SHOP) {
            const r = this.shop.handleClick(x, y);
            if (r === 'back') { this.audio.play('sfx_menu_click'); this.saveGame(); this.setState(GameState.LOBBY); }
        } else if (st === GameState.LEVEL_UP) {
            if (this.levelUpAnimTimer >= 1) {
                for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 450, cy = H / 2 + 50; if (hit(cx - 200, cy - 275, 400, 550)) { this.applyUpgrade(this.levelUpIds[i]); return; } }
            }
        } else if (st === GameState.ABILITY_SELECT) {
            if (this.abilitySelectAnimTimer >= 0.5 && this.abilityCards) {
                for (const card of this.abilityCards) {
                    if (hit(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h)) { this._chooseAbility(card.id); return; }
                }
            }
        }
    }

MainScene.prototype._chooseAbility = function(id) {
        for (let sIdx = 0; sIdx < 3; sIdx++) {
            if (this.equippedAbilities[sIdx] < 0) {
                this.equippedAbilities[sIdx] = id;
                this.abilityCooldowns[sIdx] = 0;
                this.abilityMaxCooldowns[sIdx] = ABILITY_COOLDOWNS[id] || 1;
                break;
            }
        }
        this.pendingAbilityCount = 0;
        this.setState(GameState.PLAYING);
    }

MainScene.prototype._stageClearToHub = function() {
        this.audio.play('sfx_menu_click');
        this.saveGame();
        this.setState(GameState.LOBBY);
    }

MainScene.prototype._menuActivate = function() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedMenuIndex;
        if (i === 0) this.setState(GameState.LOBBY);
        else if (i === 1) { this.leaderboardFromMenu = true; this.leaderboardNewEntryIndex = -1; this._pendingHighlight = null; this.lbView = 'normal'; this.setState(GameState.LEADERBOARD); }
        else if (i === 2) this.setState(GameState.SETTINGS);
    }
MainScene.prototype._lobbyActivate = function() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedLobbyIndex;
        if (i === 0) { this.selectedChapterIndex = 0; this.setState(GameState.CHAPTER_SELECT); }
        else if (i === 1) { this.shop.reset(); this.setState(GameState.SHOP); }
        else if (i === 2) { this.saveGame(); this.setState(GameState.MENU); }
    }
    // Выбор главы: заблокированная — звук-отказ; доступная — старт забега в этой главе.
MainScene.prototype._chapterActivate = function(i) {
        const ch = CHAPTERS[i];
        if (!ch) return;
        if (ch.id > this.save.maxChapterUnlocked) { this.audio.play('sfx_menu_click', { volume: 0.4 }); return; }
        this.audio.play('sfx_menu_click');
        this.currentChapter = ch.id;
        this.resetGame();
        this.setState(GameState.PLAYING);
    }
MainScene.prototype._settingsActivate = function() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedSettingIndex, s = this.save;
        if (i === 0) { s.isHardcoreMode = !s.isHardcoreMode; this.saveGame(); this.rebuildMenu(); }
        else if (i === 1) { s.isFullscreen = !s.isFullscreen; if (s.isFullscreen) { if (!this.scale.isFullscreen) this.scale.startFullscreen(); } else if (this.scale.isFullscreen) this.scale.stopFullscreen(); this.saveGame(); this.rebuildMenu(); }
        else if (i === 2) { this._adjustVolume('sound', +1); }
        else if (i === 3) { this._adjustVolume('effects', +1); }
        else if (i === 4) { this._toggleLanguage(); }
        else if (i === 5) { this._openRename(); }
        else if (i === 6) { this._openCloudRestore(); }
        else if (i === 7) { this.saveGame(); this.setState(GameState.MENU); }
    }

    // Изменить параметр стрелками < / > (dir: -1 влево, +1 вправо). Для бинарных
    // (окно/язык) направление неважно — переключение.
MainScene.prototype._settingsAdjust = function(idx, dir) {
        const s = this.save;
        if (idx === 1) { this.audio.play('sfx_menu_click'); s.isFullscreen = !s.isFullscreen; if (s.isFullscreen) { if (!this.scale.isFullscreen) this.scale.startFullscreen(); } else if (this.scale.isFullscreen) this.scale.stopFullscreen(); this.saveGame(); this.rebuildMenu(); }
        else if (idx === 2) { this._adjustVolume('sound', dir); }
        else if (idx === 3) { this._adjustVolume('effects', dir); }
        else if (idx === 4) { this._toggleLanguage(); }
    }

    // Переключить язык интерфейса en<->ru, применить и сохранить.
MainScene.prototype._toggleLanguage = function() {
        const s = this.save;
        s.language = (s.language === 'ru') ? 'en' : 'ru';
        setLanguage(s.language);
        this.saveGame();
        this.rebuildMenu();
    }

MainScene.prototype._openRename = function() {
        if (!this.save.playerName) {
            this.cheatMessage = t('cheat_noname');
            this.cheatMessageTimer = 3;
            this.rebuildMenu();
            return;
        }
        this.renameInput = this.save.playerName;
        this._renameError = '';
        this._renameBusy = false;
        this.setState(GameState.RENAME_INPUT);
    }

MainScene.prototype._confirmRename = function() {
        if (this._renameBusy) return;
        const oldName = this.save.playerName;
        const typed = this.renameInput.trim();
        if (!oldName) { this.setState(GameState.SETTINGS); return; }
        if (!typed) { this._renameError = t('err_enter_name'); this.rebuildMenu(); return; }
        if (typed === oldName) { this.setState(GameState.SETTINGS); return; }
        this._renameBusy = true;
        this._renameError = '';
        this.rebuildMenu();
        // Удалённо (мёрж по лучшему времени), затем локально.
        RemoteLeaderboard.rename(oldName, typed, (ok) => {
            if (this.currentState !== GameState.RENAME_INPUT) return;
            this._renameBusy = false;
            if (!ok) { this._renameError = t('err_server'); this.rebuildMenu(); return; }
            this._applyLocalRename(oldName, typed);
            this.save.playerName = typed;
            this.saveGame();
            this.audio.play('sfx_menu_click');
            this.setState(GameState.SETTINGS);
        });
    }

    // Переименовать игрока в локальном кэше обеих таблиц; слить дубликаты по лучшему времени.
MainScene.prototype._applyLocalRename = function(oldName, newName) {
        for (const mode of ['normal', 'hardcore']) {
            const src = this.leaderboards[mode] || [];
            const merged = []; // лучшая запись на имя
            for (const raw of src) {
                if (!raw || (raw.score <= 0 && raw.time <= 0)) continue;
                const e = Object.assign({}, raw);
                if (e.name === oldName) e.name = newName;
                const j = merged.findIndex(m => m.name === e.name);
                if (j === -1) merged.push(e);
                else if (lbCompare(e, merged[j]) < 0) merged[j] = e;
            }
            merged.sort(lbCompare);
            const list = merged.slice(0, 10);
            while (list.length < 10) list.push(lbEmptyEntry());
            this.leaderboards[mode] = list;
            SaveSystem.saveLeaderboard(list, mode === 'hardcore');
        }
    }

    // --- Облачное восстановление прогресса по нику ---
MainScene.prototype._openCloudRestore = function() {
        if (!CloudSave.configured()) { this.cheatMessage = t('cloud_offline'); this.cheatMessageTimer = 3; this.rebuildMenu(); return; }
        this.cloudInput = this.save.playerName || '';
        this._cloudError = ''; this._cloudMsg = ''; this._cloudBusy = false;
        this.setState(GameState.CLOUD_RESTORE);
    }

MainScene.prototype._buildCloudRestore = function() {
        const W = C.VIEW_WIDTH, H = C.VIEW_HEIGHT;
        this._mAdd(this.add.rectangle(0, 0, W, H, 0x0a001e, 230 / 255).setOrigin(0, 0));
        this._mText(W / 2, H * 0.18, t('cloud_title'), 84, '#ffd700', 0.5, 0.5, '#b40050', 5);
        this._mText(W / 2, H * 0.32, t('cloud_enter_nick'), 38, '#dcd7eb', 0.5, 0.5, '#000', 2);

        const boxW = 760, boxH = 96, boxY = H * 0.44;
        const errored = !!this._cloudError;
        this._mAdd(this.add.rectangle(W / 2, boxY, boxW, boxH, 0x140028, 1).setOrigin(0.5, 0.5).setStrokeStyle(3, errored ? 0xff3264 : 0x9600ff));
        this._mText(W / 2, boxY, this.cloudInput + '_', 50, '#ffffff', 0.5, 0.5, '#000', 2);

        if (this._cloudBusy) this._mText(W / 2, H * 0.54, t('cloud_loading'), 34, '#ffd700', 0.5, 0.5, '#000', 2);
        else if (this._cloudMsg) this._mText(W / 2, H * 0.54, this._cloudMsg, 36, '#32ff96', 0.5, 0.5, '#000', 2);
        else if (errored) this._mText(W / 2, H * 0.54, this._cloudError, 34, '#ff5078', 0.5, 0.5, '#000', 2);

        this._mText(W / 2, H * 0.66, t('cloud_warn'), 26, '#b08a4a', 0.5, 0.5, '#000', 2);
        this._mText(W / 2, H * 0.74, t('cloud_hint'), 30, '#7d78a0', 0.5, 0.5, '#000', 2);
    }

MainScene.prototype._confirmCloudRestore = function() {
        if (this._cloudBusy) return;
        if (this._cloudMsg) { this.setState(GameState.SETTINGS); return; } // уже восстановлено — выходим
        const typed = this.cloudInput.trim();
        if (!typed) { this._cloudError = t('err_enter_name'); this.rebuildMenu(); return; }
        if (!CloudSave.configured()) { this._cloudError = t('cloud_offline'); this.rebuildMenu(); return; }
        this._cloudBusy = true; this._cloudError = ''; this.rebuildMenu();
        this.restoreFromCloud(typed, (res) => {
            if (this.currentState !== GameState.CLOUD_RESTORE) return;
            this._cloudBusy = false;
            if (res === 'ok') { this._cloudMsg = t('cloud_restored'); this.audio.play('sfx_skillbought'); }
            else if (res === 'notfound') { this._cloudError = t('cloud_notfound'); }
            else { this._cloudError = t('cloud_offline'); }
            this.rebuildMenu();
        });
    }

    // Изменить громкость на dir*10 (с обёрткой 0..100), применить к аудио и сохранить.
MainScene.prototype._adjustVolume = function(which, dir) {
        const s = this.save;
        if (which === 'sound') {
            s.soundVolume = (s.soundVolume + dir * 10 + 110) % 110;
            this.audio.setMusicVolume(s.soundVolume / 100);
        } else {
            s.effectsVolume = (s.effectsVolume + dir * 10 + 110) % 110;
            this.audio.sfxVolume = s.effectsVolume / 100;
            this.audio.play('sfx_menu_click'); // звуковой предпросмотр громкости SFX
        }
        this.saveGame();
        this.rebuildMenu();
    }
MainScene.prototype._pauseActivate = function() {
        this.audio.play('sfx_menu_click');
        const i = this.selectedPauseIndex;
        if (i === 0) this.setState(GameState.PLAYING);
        else if (i === 1) { this.resetGame(); this.setState(GameState.PLAYING); }
        else if (i === 2) { this.saveGame(); this.setState(GameState.LOBBY); }
    }

MainScene.prototype.onKeyDown = function(e) {
        const st = this.currentState;
        const code = e.code; // 'KeyW' и т.п.
        const up = (code === 'KeyW' || code === 'ArrowUp');
        const down = (code === 'KeyS' || code === 'ArrowDown');
        const left = (code === 'KeyA' || code === 'ArrowLeft');
        const right = (code === 'KeyD' || code === 'ArrowRight');
        const enter = (code === 'Enter' || code === 'Space');
        const esc = (code === 'Escape');

        if (st === GameState.MENU) {
            if (up) { this.selectedMenuIndex = (this.selectedMenuIndex + 2) % 3; this._restyleList(this.selectedMenuIndex); }
            if (down) { this.selectedMenuIndex = (this.selectedMenuIndex + 1) % 3; this._restyleList(this.selectedMenuIndex); }
            if (enter) this._menuActivate();
        } else if (st === GameState.LOBBY) {
            if (up) { this.selectedLobbyIndex = (this.selectedLobbyIndex + 2) % 3; this._restyleList(this.selectedLobbyIndex); }
            if (down) { this.selectedLobbyIndex = (this.selectedLobbyIndex + 1) % 3; this._restyleList(this.selectedLobbyIndex); }
            if (enter) this._lobbyActivate();
            if (esc) { this.saveGame(); this.setState(GameState.MENU); }
        } else if (st === GameState.CHAPTER_SELECT) {
            const n = CHAPTERS.length;
            if (left) { this.selectedChapterIndex = (this.selectedChapterIndex + n - 1) % n; this.rebuildMenu(); }
            if (right) { this.selectedChapterIndex = (this.selectedChapterIndex + 1) % n; this.rebuildMenu(); }
            if (enter) this._chapterActivate(this.selectedChapterIndex);
            if (esc) { this.setState(GameState.LOBBY); }
        } else if (st === GameState.SHOP) {
            if (up) { this.shop.navigate(-1, 0); this.shop.redraw(); }
            if (down) { this.shop.navigate(1, 0); this.shop.redraw(); }
            if (left) { this.shop.navigate(0, -1); this.shop.redraw(); }
            if (right) { this.shop.navigate(0, 1); this.shop.redraw(); }
            if (enter) { this.shop._buyAndNotify(); this.saveGame(); this.shop.redraw(); }
            if (esc) { this.audio.play('sfx_menu_click'); this.saveGame(); this.setState(GameState.LOBBY); }
        } else if (st === GameState.SETTINGS) {
            if (up || down) {
                let pos = SETTINGS_ORDER.indexOf(this.selectedSettingIndex); if (pos < 0) pos = 0;
                pos = (pos + (down ? 1 : SETTINGS_ORDER.length - 1)) % SETTINGS_ORDER.length;
                this.selectedSettingIndex = SETTINGS_ORDER[pos]; this.rebuildMenu();
            }
            // ←/→ меняют параметры со стрелками (окно/звук/эффекты/язык) — как клик по < >.
            if ((left || right) && this.selectedSettingIndex >= 1 && this.selectedSettingIndex <= 4) {
                this._settingsAdjust(this.selectedSettingIndex, left ? -1 : +1);
            }
            if (enter) this._settingsActivate();
            if (esc) { this.saveGame(); this.setState(GameState.MENU); }
            // Чит-код 'givecoinz'
            if (e.key && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                this.cheatBuffer = (this.cheatBuffer + e.key.toLowerCase()).slice(-32);
                if (this.cheatBuffer.indexOf('givecoinz') !== -1) {
                    this.save.totalCoins += 500; this.cheatMessage = t('cheat_gave'); this.cheatMessageTimer = 3;
                    this.saveGame(); this.cheatBuffer = ''; this.rebuildMenu();
                }
            }
        } else if (st === GameState.LEADERBOARD) {
            if (left) this._setLbView('normal');
            if (right) this._setLbView('hardcore');
            if (esc || code === 'Enter') this.setState(this.leaderboardFromMenu ? GameState.MENU : GameState.LOBBY);
        } else if (st === GameState.NAME_INPUT) {
            if (code === 'Backspace') { this.nameInput = this.nameInput.slice(0, -1); this._nameError = ''; this.rebuildMenu(); if (e.preventDefault) e.preventDefault(); }
            else if (code === 'Enter' || code === 'Escape') { this._confirmNameInput(); }
            else if (e.key && e.key.length === 1) {
                // Любой печатный символ (вкл. кириллицу), кроме управляющих и DEL.
                const cc = e.key.charCodeAt(0);
                if (cc >= 32 && cc !== 127 && this.nameInput.length < 20) { this.nameInput += e.key; this._nameError = ''; this.rebuildMenu(); }
            }
        } else if (st === GameState.RENAME_INPUT) {
            if (this._renameBusy) { if (e.preventDefault) e.preventDefault(); return; }
            if (code === 'Backspace') { this.renameInput = this.renameInput.slice(0, -1); this._renameError = ''; this.rebuildMenu(); if (e.preventDefault) e.preventDefault(); }
            else if (code === 'Escape') { this.audio.play('sfx_menu_click'); this.setState(GameState.SETTINGS); }
            else if (code === 'Enter') { this._confirmRename(); }
            else if (e.key && e.key.length === 1) {
                // Любой печатный символ (вкл. кириллицу), кроме управляющих и DEL.
                const cc = e.key.charCodeAt(0);
                if (cc >= 32 && cc !== 127 && this.renameInput.length < 20) { this.renameInput += e.key; this._renameError = ''; this.rebuildMenu(); }
            }
        } else if (st === GameState.CLOUD_RESTORE) {
            if (this._cloudBusy) { if (e.preventDefault) e.preventDefault(); return; }
            if (code === 'Backspace') { this.cloudInput = this.cloudInput.slice(0, -1); this._cloudError = ''; this._cloudMsg = ''; this.rebuildMenu(); if (e.preventDefault) e.preventDefault(); }
            else if (code === 'Escape') { this.audio.play('sfx_menu_click'); this.setState(GameState.SETTINGS); }
            else if (code === 'Enter') { this._confirmCloudRestore(); }
            else if (e.key && e.key.length === 1) {
                const cc = e.key.charCodeAt(0);
                if (cc >= 32 && cc !== 127 && this.cloudInput.length < 20) { this.cloudInput += e.key; this._cloudError = ''; this._cloudMsg = ''; this.rebuildMenu(); }
            }
        } else if (st === GameState.STAGE_CLEAR) {
            if (enter || esc) this._stageClearToHub();
        } else if (st === GameState.PLAYING) {
            if (this.isGameOver) {
                if (code === 'KeyR') { this.saveGame(); this.resetGame(); this.rebuildMenu(); }
                if (code === 'KeyQ') { this.saveGame(); this.setState(GameState.LOBBY); }
                if (code === 'KeyL') { this.leaderboardFromMenu = false; this._pendingHighlight = null; this.lbView = 'normal'; this.setState(GameState.LEADERBOARD); }
            } else {
                if (esc) { this.selectedPauseIndex = 0; this.setState(GameState.PAUSED); }
                if (code === 'KeyQ') this.activateAbility(0);
                if (code === 'KeyE') this.activateAbility(1);
                if (code === 'KeyR') this.activateAbility(2);
            }
        } else if (st === GameState.PAUSED) {
            if (esc) this.setState(GameState.PLAYING);
            if (up) { this.selectedPauseIndex = (this.selectedPauseIndex + 2) % 3; this._restyleList(this.selectedPauseIndex); }
            if (down) { this.selectedPauseIndex = (this.selectedPauseIndex + 1) % 3; this._restyleList(this.selectedPauseIndex); }
            if (enter) this._pauseActivate();
        }
    }
