
const FONT = 'Orbitron, "Exo 2", Arial';

class HUD {
    constructor(scene) {
        this.scene = scene;
        this.uiW = C.VIEW_WIDTH;
        this.uiH = C.VIEW_HEIGHT;
        this.objects = [];
        this.skillCounts = [0, 0, 0, 0, 0, 0, 0];
        this._lastBossExists = false;
        this._build();
        this.setVisible(false);
    }

    _add(obj) { this.scene.addUI(obj); this.objects.push(obj); return obj; }

    _build() {
        const W = this.uiW, H = this.uiH;
        const add = this._add.bind(this);

        const xpWidth = W - 100;
        this.xpBg = add(this.scene.add.rectangle(50, 20, xpWidth, 25, 0x140028).setOrigin(0, 0).setStrokeStyle(3, 0x9600ff));
        this.xpFill = add(this.scene.add.rectangle(50, 20, 0, 25, 0x00ffff).setOrigin(0, 0));
        this.lvlText = add(this.scene.add.text(50, 55, 'LVL 1', { fontFamily: FONT, fontSize: '35px', color: '#ffff00', stroke: '#000', strokeThickness: 2 }).setOrigin(0, 0));

        const hpW = 400;
        const hpY = H - 166;
        this.hpBg = add(this.scene.add.rectangle(W / 2 - hpW / 2, hpY, hpW, 30, 0x280000).setOrigin(0, 0).setStrokeStyle(4, 0xff0032));
        this.hpFill = add(this.scene.add.rectangle(W / 2 - hpW / 2, hpY, hpW, 30, 0xff3232).setOrigin(0, 0));
        this.hpText = add(this.scene.add.text(W / 2, hpY + 15, 'HP 100 / 100', { fontFamily: FONT, fontSize: '24px', color: '#fff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0.5));

        this.timerText = add(this.scene.add.text(W / 2, 90, '00:00', { fontFamily: FONT, fontSize: '50px', color: '#ff0096', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0.5));

        this.coinSprite = add(this.scene.add.sprite(W - 150, 60, 'coin').setOrigin(0, 0));
        this.coinSprite.setDisplaySize(35, 35);
        this.coinText = add(this.scene.add.text(W - 100, 55, '0', { fontFamily: FONT, fontSize: '35px', color: '#ffff00' }).setOrigin(0, 0));

        const bW = 800;
        this.bossBg = add(this.scene.add.rectangle(W / 2 - bW / 2, 160, bW, 35, 0x280000, 200 / 255).setOrigin(0, 0).setStrokeStyle(4, 0xff0032));
        this.bossFill = add(this.scene.add.rectangle(W / 2 - bW / 2, 160, 0, 35, 0xff3232).setOrigin(0, 0));
        this.bossName = add(this.scene.add.text(W / 2, 135, 'THE OVERSEER', { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0.5));
        this.bossBarWidth = bW;

        const iconKeys = UPGRADE_ICONS;
        const cardColors = [0xff7800, 0xff3232, 0x00e6ff, 0xb400ff, 0x32ff64, 0xffd200, 0xffd200];
        this.skillCards = [];
        for (let i = 0; i < 7; i++) {
            const bg = add(this.scene.add.rectangle(0, 0, 64, 80, 0x0f001e, 210 / 255).setOrigin(0, 0).setStrokeStyle(2, cardColors[i]));
            const icon = add(this.scene.add.sprite(0, 0, iconKeys[i]).setOrigin(0.5, 0.5));
            const isc = 44 / Math.max(icon.width, icon.height);
            icon.setScale(isc, isc);
            const stars = add(this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#ffd200', stroke: '#321900', strokeThickness: 1.5 }).setOrigin(0.5, 0));
            this.skillCards.push({ bg, icon, stars });
        }

        const ABILITY_SLOTS = 4;
        const cardW = 88, cardH = 110, gap = 10;
        const totalW = ABILITY_SLOTS * cardW + (ABILITY_SLOTS - 1) * gap;
        const startX = (W - totalW) / 2;
        const startY = H - cardH - 14;
        const keyLabels = ['', 'Q', 'E', 'R'];
        this.abilityCards = [];
        for (let i = 0; i < ABILITY_SLOTS; i++) {
            const sx = startX + i * (cardW + gap);
            const sy = startY;
            const bg = add(this.scene.add.rectangle(sx, sy, cardW, cardH, 0x0c0018, 215 / 255).setOrigin(0, 0).setStrokeStyle(2, 0x3c374b));
            const icon = add(this.scene.add.sprite(sx + cardW / 2, sy + cardH / 2 - 8, 'ability_dash').setOrigin(0.5, 0.5));
            icon.setDisplaySize(52, 52);
            icon.setVisible(false);
            const keyLabel = add(this.scene.add.text(sx + cardW / 2, sy + cardH - 24, keyLabels[i], { fontFamily: FONT, fontSize: '18px', color: '#00dcc3', stroke: '#000', strokeThickness: 1.5 }).setOrigin(0.5, 0));
            this.abilityCards.push({
                bg, icon, keyLabel,
                cx: sx + cardW / 2, cy: sy + cardH / 2 - 8,
                w: cardW, h: cardH, handLen: cardW * 0.37,
                cachedId: -2, color: 0x3c374b, onCooldown: false, elapsedPct: 1,
            });

            if (i === 0) {
                const cx = sx + cardW / 2;
                const cy = sy + cardH - 17;
                const spaceOuter = add(this.scene.add.rectangle(cx, cy, 58, 14, 0x000000, 0).setOrigin(0.5, 0.5).setStrokeStyle(2, 0x00dcc3, 200 / 255));
                const spaceInner = add(this.scene.add.rectangle(cx, cy + 2, 46, 6, 0x00dcc3, 60 / 255).setOrigin(0.5, 0.5));
                keyLabel.setVisible(false);
            }
        }

        this.fx = add(this.scene.add.graphics());
    }

    setVisible(v) {
        this.objects.forEach(o => o.setVisible(v));
        if (!v && this.fx) this.fx.clear();
        if (v) {
            this._lastLevel = this._lastHp = this._lastMaxHp = this._lastCoins = this._lastTimer = undefined;
            this._applyConditionalVisibility();
        }
    }

    _applyConditionalVisibility() {
        if (this.abilityCards) {
            for (const card of this.abilityCards) {
                const hasAbility = (card.cachedId !== -1 && card.cachedId !== -2);
                card.icon.setVisible(hasAbility);
            }
        }
        if (this.skillCards) {
            for (let i = 0; i < 7; i++) {
                const show = this.skillCounts[i] > 0;
                this.skillCards[i].bg.setVisible(show);
                this.skillCards[i].icon.setVisible(show);
                this.skillCards[i].stars.setVisible(show);
            }
        }
        const b = !!this._lastBossExists;
        if (this.bossBg) { this.bossBg.setVisible(b); this.bossFill.setVisible(b); this.bossName.setVisible(b); }
    }

    static abilityColor(id) {
        switch (id) {
            case -10: return 0x00e6ff;
            case 0: return 0xffd700;
            case 1: return 0xff5000;
            case 2: return 0xb400ff;
            case 3: return 0x00e6ff;
            case 4: return 0x46ff8c;
            case 5: return 0x3ca0ff;
            case 6: return 0xff3caa;
            default: return 0x3c374b;
        }
    }
    static abilityIconKey(id) {
        switch (id) {
            case -10: return 'ability_dash';
            case 0: return 'ability_invincible';
            case 1: return 'ability_slam';
            case 2: return 'ability_disc';
            case 3: return 'ability_laser';
            case 4: return 'ability_skull';
            case 5: return 'ability_sonic';
            case 6: return 'ability_shatter';
            default: return null;
        }
    }

    update(player, totalCoins, bossExists, bossHpPct, timerStr, runPickCounts,
            equippedAbilities, abilityCooldowns, abilityMaxCooldowns) {
        const W = this.uiW, H = this.uiH;
        this._lastBossExists = bossExists;

        const xpPct = player.currentXP / player.xpToNextLevel;
        this.xpFill.setSize((W - 100) * clamp(xpPct, 0, 1), 25);
        if (this._lastLevel !== player.level) {
            this._lastLevel = player.level;
            this.lvlText.setText(t('hud_lvl') + ' ' + player.level);
        }

        const hpPct = player.hp / player.maxHp;
        this.hpFill.setSize(400 * Math.max(0, hpPct), 30);
        const hpShown = Math.max(0, player.hp);
        if (this._lastHp !== hpShown || this._lastMaxHp !== player.maxHp) {
            this._lastHp = hpShown; this._lastMaxHp = player.maxHp;
            this.hpText.setText(t('hud_hp') + ' ' + hpShown + ' / ' + player.maxHp);
        }

        if (this._lastCoins !== totalCoins) {
            this._lastCoins = totalCoins;
            this.coinText.setText('' + totalCoins);
        }

        if (this._lastTimer !== timerStr) {
            this._lastTimer = timerStr;
            this.timerText.setText(timerStr);
        }

        if (bossExists) {
            this.bossBg.setVisible(true); this.bossFill.setVisible(true); this.bossName.setVisible(true);
            this.bossFill.setSize(this.bossBarWidth * Math.max(0, bossHpPct), 35);
        } else {
            this.bossBg.setVisible(false); this.bossFill.setVisible(false); this.bossName.setVisible(false);
        }

        const cardW2 = 64, gap2 = 10;
        let col = 0;
        for (let i = 0; i < 7; i++) {
            this.skillCounts[i] = runPickCounts[i];
            const card = this.skillCards[i];
            if (this.skillCounts[i] <= 0) {
                card.bg.setVisible(false); card.icon.setVisible(false); card.stars.setVisible(false);
                continue;
            }
            const cx = 50 + col * (cardW2 + gap2);
            const cy = 100;
            card.bg.setPosition(cx, cy).setVisible(true);
            card.icon.setPosition(cx + cardW2 / 2, cy + 26).setVisible(true);
            let stars;
            if (LEGENDARY_UPGRADE_IDS.includes(i)) {
                stars = '★';
            } else {
                stars = '';
                const show = Math.min(this.skillCounts[i], 5);
                for (let s = 0; s < show; s++) stars += '*';
                if (this.skillCounts[i] > 5) stars += '+';
            }
            card.stars.setText(stars).setPosition(cx + cardW2 / 2, cy + 57).setVisible(true);
            col++;
        }

        const slot0 = this.abilityCards[0];
        const dashActive = player.hasDashUnlocked;
        this._refreshCard(0, dashActive ? -10 : -1);
        {
            const curCd = player.currentDashCooldown;
            const maxCd = player.dashCooldown;
            const onCd = dashActive && curCd > 0 && maxCd > 0;
            slot0.onCooldown = onCd;
            slot0.elapsedPct = onCd ? (1 - clamp(curCd / maxCd, 0, 1)) : 1;
        }
        for (let i = 0; i < 3; i++) {
            const card = this.abilityCards[i + 1];
            const id = equippedAbilities[i];
            this._refreshCard(i + 1, id);
            const curCd = abilityCooldowns[i];
            const maxCd = abilityMaxCooldowns[i];
            const onCd = id >= 0 && curCd > 0 && maxCd > 0;
            card.onCooldown = onCd;
            card.elapsedPct = onCd ? (1 - clamp(curCd / maxCd, 0, 1)) : 1;
        }

        this.fx.clear();
        for (const card of this.abilityCards) {
            const hasAbility = (card.cachedId !== -1 && card.cachedId !== -2);
            if (hasAbility && card.onCooldown) {
                const remainPct = 1 - card.elapsedPct;
                if (remainPct > 0.001) {
                    const startRad = -Math.PI / 2 + card.elapsedPct * 2 * Math.PI;
                    const sweepRad = remainPct * 2 * Math.PI;
                    const segs = Math.max(6, Math.floor(sweepRad * 36 / Math.PI));
                    const rx = card.w / 2, ry = card.h / 2;
                    this.fx.fillStyle(0x0a0a0a, 215 / 255);
                    this.fx.beginPath();
                    this.fx.moveTo(card.cx, card.cy);
                    for (let s = 0; s <= segs; s++) {
                        const frac = s / segs;
                        const ang = startRad + frac * sweepRad;
                        const cosA = Math.cos(ang), sinA = Math.sin(ang);
                        let r = 1e9;
                        if (Math.abs(cosA) > 0.001) r = Math.min(r, Math.abs(rx / cosA));
                        if (Math.abs(sinA) > 0.001) r = Math.min(r, Math.abs(ry / sinA));
                        this.fx.lineTo(card.cx + cosA * r, card.cy + sinA * r);
                    }
                    this.fx.closePath();
                    this.fx.fillPath();
                }
                const angleDeg = card.elapsedPct * 360 - 90;
                const ar = angleDeg * Math.PI / 180;
                this.fx.lineStyle(3, 0xffffff, 230 / 255);
                this.fx.beginPath();
                this.fx.moveTo(card.cx, card.cy);
                this.fx.lineTo(card.cx + Math.cos(ar) * card.handLen, card.cy + Math.sin(ar) * card.handLen);
                this.fx.strokePath();
                this.fx.fillStyle(0xffffff, 240 / 255);
                this.fx.fillCircle(card.cx, card.cy, 4);
            }
        }
    }

    _refreshCard(slotIdx, id) {
        const card = this.abilityCards[slotIdx];
        if (card.cachedId === id) return;
        card.cachedId = id;
        card.color = HUD.abilityColor(id);
        const key = HUD.abilityIconKey(id);
        const hasAbility = (id !== -1 && id !== -2);
        if (hasAbility && key && this.scene.textures.exists(key)) {
            card.icon.setTexture(key);
            const b = Math.max(card.icon.width, card.icon.height);
            const sc = 52 / b;
            card.icon.setScale(sc, sc);
            card.icon.setVisible(true);
            const c = Phaser.Display.Color.IntegerToRGB(card.color);
            card.bg.setFillStyle(rgb(c.r / 10, c.g / 10, c.b / 10), 225 / 255);
            card.bg.setStrokeStyle(2, card.color);
        } else {
            card.icon.setVisible(false);
            card.bg.setFillStyle(0x0c0018, 200 / 255);
            card.bg.setStrokeStyle(2, 0x322d41);
        }
    }
}
