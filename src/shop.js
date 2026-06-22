
const SHOP_BRANCH_X = [480, 960, 1440];
const SHOP_NODE_Y = [285, 485, 685];
const SHOP_CARD_W = 340, SHOP_CARD_H = 150;
const ACARD_W = 340, ACARD_H = 175;
const ARTIFACT_COUNT = 7;

const ARTIFACT_COLORS = [0xdc3c3c, 0xffa028, 0x50c8ff, 0xa03cdc, 0xff6428, 0xa0a0a0, 0x3cdca0];

const ARTIFACT_ICONS = ['art_bloodpact', 'art_glasscannon', 'art_echo', 'art_soulleech', 'art_berserker', 'art_ironskin', 'art_magnetcore'];
const NODE_ICONS = ['node_damage', 'node_crit', 'node_multishot', 'node_maxhp', 'node_regen', 'node_armor', 'node_speed', 'node_dash', 'node_magnet'];

function branchColor(b) {
    if (b === 0) return 0xff5050;
    if (b === 1) return 0x50dc50;
    return 0x5096ff;
}

class Shop {
    constructor(scene) {
        this.scene = scene;
        this.s = scene.save;
        this.activeTab = 0;
        this.selBranch = 0; this.selRow = 0;
        this.hovBranch = -1; this.hovRow = -1;
        this.hovArtifact = -1; this.selArtifact = -1;
        this.backHovered = false;
        this.objs = [];
        this.visible = false;
    }

    reset() {
        this.selBranch = 0; this.selRow = 0; this.hovBranch = -1; this.hovRow = -1;
        this.backHovered = false; this.hovArtifact = -1; this.selArtifact = -1;
    }

    nodeCurLevel(b, r) {
        switch (b * 3 + r) {
            case 0: return this.s.permDamage - 1;
            case 1: return this.s.permCritChance;
            case 2: return this.s.permMultishot;
            case 3: return (this.s.permMaxHp - 100) / 10;
            case 4: return this.s.permRegen;
            case 5: return this.s.permArmor;
            case 6: return Math.floor((this.s.permSpeed - 220) / 10);
            case 7: return this.s.permDashLevel;
            case 8: return this.s.permMagnet;
            default: return 0;
        }
    }
    nodeMaxLevel(b, r) {
        return [9, 5, 1, 7, 3, 2, 5, 5, 3][b * 3 + r];
    }
    nodeCost(b, r) {
        const cur = this.nodeCurLevel(b, r);
        switch (b * 3 + r) {
            case 0: return 80 + cur * 20;
            case 1: return 180;
            case 2: return 250;
            case 3: return 80 + cur * 10;
            case 4: return 350;
            case 5: return 280;
            case 6: return 80;
            case 7: return 120 + this.s.permDashLevel * 60;
            case 8: return 120;
            default: return 9999;
        }
    }
    nodeUnlockReq(b, r) {
        switch (b * 3 + r) {
            case 1: return 3; case 2: return 2; case 4: return 3;
            case 5: return 1; case 7: return 2; case 8: return 2;
            default: return 0;
        }
    }
    nodeUnlocked(b, r) {
        if (r === 0) return true;
        return this.nodeCurLevel(b, r - 1) >= this.nodeUnlockReq(b, r);
    }
    nodeMaxed(b, r) { return this.nodeCurLevel(b, r) >= this.nodeMaxLevel(b, r); }
    canAfford(b, r) { return this.s.totalCoins >= this.nodeCost(b, r); }

    nodeRect(b, r) {
        return { x: SHOP_BRANCH_X[b] - SHOP_CARD_W / 2, y: SHOP_NODE_Y[r] - SHOP_CARD_H / 2, w: SHOP_CARD_W, h: SHOP_CARD_H };
    }
    backRect() { return { x: 960 - 170, y: 870 - 28, w: 340, h: 56 }; }
    tabRect(t) {
        const w = 340, h = 50, y = 130 - h / 2;
        const x = (t === 0) ? 960 - w - 10 : 960 + 10;
        return { x, y, w, h };
    }
    artifactRect(id) {
        const gap = 20, rowY = [380, 590];
        if (id < 4) {
            const totalW = 4 * ACARD_W + 3 * gap;
            const startX = (1920 - totalW) / 2;
            return { x: startX + id * (ACARD_W + gap), y: rowY[0] - ACARD_H / 2, w: ACARD_W, h: ACARD_H };
        } else {
            const c = id - 4;
            const totalW = 3 * ACARD_W + 2 * gap;
            const startX = (1920 - totalW) / 2;
            return { x: startX + c * (ACARD_W + gap), y: rowY[1] - ACARD_H / 2, w: ACARD_W, h: ACARD_H };
        }
    }

    navigate(dRow, dBranch) {
        this.selRow = (this.selRow + dRow + 3) % 3;
        this.selBranch = (this.selBranch + dBranch + 3) % 3;
    }

    purchaseSelected() {
        const s = this.s;
        if (this.activeTab === 1) {
            const id = this.selArtifact;
            if (id < 0 || id >= ARTIFACT_COUNT) return false;
            const isOwned = (s.permArtifacts >> id) & 1;
            const isActive = (s.permActiveArtifacts >> id) & 1;
            if (isOwned) {
                if (isActive) { s.permActiveArtifacts &= ~(1 << id); }
                else {
                    let cnt = 0;
                    for (let j = 0; j < ARTIFACT_COUNT; j++) cnt += (s.permActiveArtifacts >> j) & 1;
                    if (cnt < 3) s.permActiveArtifacts |= (1 << id);
                }
                return true;
            }
            if (s.totalCoins < ARTIFACTS[id].cost) return false;
            s.totalCoins -= ARTIFACTS[id].cost;
            s.permArtifacts |= (1 << id);
            let cnt = 0;
            for (let j = 0; j < ARTIFACT_COUNT; j++) cnt += (s.permActiveArtifacts >> j) & 1;
            if (cnt < 3) s.permActiveArtifacts |= (1 << id);
            return true;
        }
        const b = this.selBranch, r = this.selRow;
        if (!this.nodeUnlocked(b, r) || this.nodeMaxed(b, r)) return false;
        if (s.totalCoins < this.nodeCost(b, r)) return false;
        s.totalCoins -= this.nodeCost(b, r);
        switch (b * 3 + r) {
            case 0: s.permDamage++; break;
            case 1: s.permCritChance++; break;
            case 2: s.permMultishot++; break;
            case 3: s.permMaxHp += 10; break;
            case 4: s.permRegen++; break;
            case 5: s.permArmor++; break;
            case 6: s.permSpeed += 10; break;
            case 7: s.permDashLevel++; break;
            case 8: s.permMagnet++; break;
        }
        return true;
    }

    _buyAndNotify() {
        const before = this.s.totalCoins;
        const ok = this.purchaseSelected();
        if (ok && this.s.totalCoins < before && this.scene.audio) this.scene.audio.play('sfx_skillbought');
        return ok;
    }

    handleClick(x, y) {
        const inside = (rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
        if (inside(this.backRect())) return 'back';
        if (inside(this.tabRect(0))) { this.activeTab = 0; this.redraw(); return null; }
        if (inside(this.tabRect(1))) { this.activeTab = 1; this.redraw(); return null; }
        if (this.activeTab === 1) {
            for (let i = 0; i < ARTIFACT_COUNT; i++) {
                if (inside(this.artifactRect(i))) { this.selArtifact = i; this._buyAndNotify(); this.scene.saveGame(); this.redraw(); return null; }
            }
            return null;
        }
        for (let b = 0; b < 3; b++) for (let r = 0; r < 3; r++) {
            if (inside(this.nodeRect(b, r))) { this.selBranch = b; this.selRow = r; this._buyAndNotify(); this.scene.saveGame(); this.redraw(); return null; }
        }
        return null;
    }

    updateHover(x, y) {
        const inside = (rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
        const prev = this.hovBranch + ',' + this.hovRow + ',' + this.hovArtifact + ',' + this.backHovered;
        this.hovBranch = -1; this.hovRow = -1; this.backHovered = false; this.hovArtifact = -1;
        if (inside(this.backRect())) this.backHovered = true;
        else if (this.activeTab === 1) {
            for (let i = 0; i < ARTIFACT_COUNT; i++) if (inside(this.artifactRect(i))) { this.hovArtifact = i; break; }
        } else {
            for (let b = 0; b < 3; b++) for (let r = 0; r < 3; r++) if (inside(this.nodeRect(b, r))) { this.hovBranch = b; this.hovRow = r; }
        }
        const now = this.hovBranch + ',' + this.hovRow + ',' + this.hovArtifact + ',' + this.backHovered;
        if (now !== prev && this.visible) this.redraw();
    }

    show() { this.visible = true; this.redraw(); }
    hide() { this.visible = false; this._clear(); }

    _clear() { this.objs.forEach(o => o.destroy()); this.objs = []; }
    _add(o) { this.scene.addUI(o); this.objs.push(o); return o; }
    _rect(x, y, w, h, fill, fillA, strokeW, strokeC) {
        const r = this.scene.add.rectangle(x, y, w, h, fill, fillA === undefined ? 1 : fillA).setOrigin(0, 0);
        if (strokeW) r.setStrokeStyle(strokeW, strokeC);
        return this._add(r);
    }
    _text(x, y, str, size, color, originX, originY, glow, wrapW) {
        const style = { fontFamily: FONT, fontSize: size + 'px', color: color };
        if (wrapW) style.wordWrap = { width: wrapW, useAdvancedWrap: true };
        const t = this.scene.add.text(x, y, str, style);
        t.setOrigin(originX === undefined ? 0 : originX, originY === undefined ? 0 : originY);
        if (glow) t.setShadow(0, 0, glow, 12, true, true);
        return this._add(t);
    }
    _hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

    _panel(x, y, w, h, rad, fill, fillA, stroke, strokeW) {
        const g = this.g;
        g.fillStyle(fill, fillA === undefined ? 1 : fillA);
        g.fillRoundedRect(x, y, w, h, rad);
        if (strokeW) { g.lineStyle(strokeW, stroke, 1); g.strokeRoundedRect(x, y, w, h, rad); }
    }
    _glow(x, y, w, h, rad, color) {
        const g = this.g;
        for (let i = 3; i >= 1; i--) {
            g.lineStyle(2, color, 0.12 * (4 - i));
            g.strokeRoundedRect(x - i * 3, y - i * 3, w + i * 6, h + i * 6, rad + i * 3);
        }
    }
    _icon(key, x, y, box, alpha) {
        if (!key || !this.scene.textures.exists(key)) return null;
        const sp = this.scene.add.sprite(x, y, key).setOrigin(0.5, 0.5);
        sp.setScale(box / Math.max(sp.width, sp.height));
        if (alpha !== undefined) sp.setAlpha(alpha);
        return this._add(sp);
    }
    _bar(x, y, w, h, frac, color) {
        const g = this.g;
        g.fillStyle(0x080510, 1); g.fillRoundedRect(x, y, w, h, h / 2);
        if (frac > 0) { g.fillStyle(color, 1); g.fillRoundedRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2); }
    }

    _coinPill(rightX, cy, coins) {
        const txt = '' + coins;
        const w = 56 + txt.length * 17, h = 46, x = rightX - w, y = cy - h / 2;
        this._panel(x, y, w, h, h / 2, 0x241636, 1, 0xffd24a, 2);
        const coin = this._add(this.scene.add.sprite(x + 26, cy, 'coin').setOrigin(0.5, 0.5));
        coin.setDisplaySize(28, 28);
        this._text(x + 48, cy, txt, 24, '#ffe24a', 0, 0.5, '#a06400');
    }

    redraw() {
        if (!this.visible) return;
        this._clear();
        const s = this.s;

        const g = this._add(this.scene.add.graphics());
        this.g = g;
        g.fillGradientStyle(0x160b2c, 0x160b2c, 0x07040f, 0x07040f, 1);
        g.fillRect(0, 0, 1920, 1080);

        this._panel(0, 0, 1920, 96, 0, 0x190d30, 0.9);
        g.lineStyle(2, 0x7a3cc8, 0.55); g.lineBetween(0, 96, 1920, 96);
        this._text(960, 48, this.activeTab === 0 ? t('shop_skilltree') : t('shop_artifacts'), 50, '#e6d8ff', 0.5, 0.5, '#8a3cf0');
        this._coinPill(1894, 48, s.totalCoins);

        const tabNames = [t('shop_skilltree'), t('shop_artifacts')];
        for (let i = 0; i < 2; i++) {
            const tr = this.tabRect(i), active = this.activeTab === i;
            if (active) this._glow(tr.x, tr.y, tr.w, tr.h, 12, 0xc896ff);
            this._panel(tr.x, tr.y, tr.w, tr.h, 12, active ? 0x3a1f66 : 0x150b28, 1, active ? 0xc896ff : 0x4a3568, active ? 3 : 2);
            this._text(tr.x + tr.w / 2, tr.y + tr.h / 2, tabNames[i], 22, active ? '#ecdcff' : '#8a78b0', 0.5, 0.5);
        }

        if (this.activeTab === 0) this._renderSkillTree();
        else this._renderArtifacts();

        const br = this.backRect(), bh = this.backHovered;
        if (bh) this._glow(br.x, br.y, br.w, br.h, 12, 0xffc8ff);
        this._panel(br.x, br.y, br.w, br.h, 12, bh ? 0x4a2560 : 0x241036, 1, bh ? 0xffc8ff : 0x9664c8, 2);
        this._text(960, br.y + br.h / 2, t('shop_back'), 24, bh ? '#ffffff' : '#d8c0ee', 0.5, 0.5);
    }

    _renderSkillTree() {
        const g = this.g;
        for (let b = 0; b < 3; b++) {
            const bc = branchColor(b);
            this._text(SHOP_BRANCH_X[b], 178, t('branch_names')[b], 34, this._hex(bc), 0.5, 0.5, this._hex(bc));
            for (let r = 0; r < 2; r++) {
                const x = SHOP_BRANCH_X[b];
                const y1 = SHOP_NODE_Y[r] + SHOP_CARD_H / 2;
                const y2 = SHOP_NODE_Y[r + 1] - SHOP_CARD_H / 2;
                const on = this.nodeUnlocked(b, r + 1);
                g.fillStyle(on ? bc : 0x39323f, on ? 1 : 0.6);
                g.fillRoundedRect(x - 3, y1, 6, y2 - y1 - 14, 3);
                g.beginPath();
                g.moveTo(x - 11, y2 - 14); g.lineTo(x + 11, y2 - 14); g.lineTo(x, y2 + 2);
                g.closePath(); g.fillPath();
            }
        }
        for (let b = 0; b < 3; b++) for (let r = 0; r < 3; r++) {
            const nr = this.nodeRect(b, r);
            const isSel = (b === this.selBranch && r === this.selRow);
            const isHov = (b === this.hovBranch && r === this.hovRow);
            const locked = !this.nodeUnlocked(b, r);
            const maxed = this.nodeMaxed(b, r);
            const afford = !locked && !maxed && this.canAfford(b, r);
            const col = branchColor(b);
            const cc = Phaser.Display.Color.IntegerToRGB(col);

            if ((isSel || isHov) && !locked) this._glow(nr.x, nr.y, nr.w, nr.h, 14, maxed ? col : 0xffffff);

            let fill, stroke, strokeW = 2;
            if (locked) { fill = 0x0c0a14; stroke = 0x2a2730; }
            else if (maxed) { fill = rgb(cc.r / 6, cc.g / 6, cc.b / 6); stroke = col; }
            else if (isSel) { fill = rgb(cc.r / 5, cc.g / 5, cc.b / 5); stroke = 0xffffff; strokeW = 3; }
            else if (isHov) { fill = rgb(cc.r / 5, cc.g / 5, cc.b / 5); stroke = 0xffffff; }
            else { fill = 0x130e1f; stroke = afford ? col : 0x5a2a3a; }
            this._panel(nr.x, nr.y, nr.w, nr.h, 14, fill, 1, stroke, strokeW);
            if (!locked) { g.fillStyle(col, maxed ? 1 : 0.85); g.fillRoundedRect(nr.x, nr.y + 10, 5, nr.h - 20, 3); }

            const cur = this.nodeCurLevel(b, r), mx = this.nodeMaxLevel(b, r);
            const icon = this._icon(NODE_ICONS[b * 3 + r], nr.x + 48, nr.y + nr.h / 2, 78, locked ? 0.3 : 1);
            const tx = icon ? nr.x + 96 : nr.x + SHOP_CARD_W / 2;
            const ox = icon ? 0 : 0.5;
            const right = nr.x + nr.w - 18;
            const barX = icon ? tx : nr.x + 40, barW = icon ? right - tx : nr.w - 80;

            this._text(tx, nr.y + 13, t('node_titles')[b][r], 23, locked ? '#4a4a52' : '#ffffff', ox, 0);
            this._text(tx, nr.y + 44, locked ? t('shop_locked') : (maxed ? t('shop_max') : t('shop_lv') + ' ' + cur + ' / ' + mx), 18,
                locked ? '#52525a' : (maxed ? this._hex(col) : '#b0a8c0'), ox, 0);
            if (!locked) this._bar(barX, nr.y + 72, barW, 8, mx > 0 ? cur / mx : 0, col);
            if (!locked) this._text(tx, nr.y + 88, t('node_descs')[b][r], 16, '#8a8a96', ox, 0);

            if (!locked && !maxed) {
                const cost = this.nodeCost(b, r);
                const coinX = icon ? tx + 10 : nr.x + SHOP_CARD_W / 2 - 16;
                const coin = this._add(this.scene.add.sprite(coinX, nr.y + nr.h - 20, 'coin').setOrigin(0.5, 0.5));
                coin.setDisplaySize(20, 20);
                this._text(coinX + 14, nr.y + nr.h - 20, '' + cost, 21, afford ? '#ffe24a' : '#d2643c', 0, 0.5);
            }
        }
    }

    _renderArtifacts() {
        const s = this.s;
        let activeEq = 0;
        for (let j = 0; j < ARTIFACT_COUNT; j++) activeEq += (s.permActiveArtifacts >> j) & 1;

        const full = activeEq >= 3;
        const slotTxt = t('shop_slots') + ':  ' + activeEq + ' / 3';
        const sw = 80 + slotTxt.length * 11, sh = 44;
        this._panel(960 - sw / 2, 240 - sh / 2, sw, sh, sh / 2, 0x1a1030, 1, full ? 0xff5a5a : 0x00c89a, 2);
        this._text(960, 240, slotTxt, 22, full ? '#ff7a7a' : '#28e6b4', 0.5, 0.5);

        for (let i = 0; i < ARTIFACT_COUNT; i++) {
            const ar = this.artifactRect(i);
            const isOwned = (s.permArtifacts >> i) & 1;
            const isActive = (s.permActiveArtifacts >> i) & 1;
            const isHov = this.hovArtifact === i;
            const afford = !isOwned && s.totalCoins >= ARTIFACTS[i].cost;
            const blocked = isOwned && !isActive && activeEq >= 3;
            const col = ARTIFACT_COLORS[i];
            const cc = Phaser.Display.Color.IntegerToRGB(col);

            if ((isHov || isActive) && !blocked) this._glow(ar.x, ar.y, ar.w, ar.h, 14, isHov ? 0xffffff : col);

            let fill, stroke, strokeW = 2;
            if (isActive) { fill = rgb(cc.r / 6, cc.g / 6, cc.b / 6); stroke = isHov ? 0xffffff : col; strokeW = 3; }
            else if (isOwned && !blocked) { fill = isHov ? rgb(cc.r / 5, cc.g / 5, cc.b / 5) : 0x0f0c19; stroke = isHov ? 0xffffff : rgb(cc.r / 2, cc.g / 2, cc.b / 2); }
            else if (blocked) { fill = 0x0f0c19; stroke = 0x464150; }
            else if (isHov) { fill = rgb(cc.r / 5, cc.g / 5, cc.b / 5); stroke = 0xffffff; }
            else { fill = 0x140f1e; stroke = afford ? col : 0x5a2a3a; }
            this._panel(ar.x, ar.y, ar.w, ar.h, 14, fill, 1, stroke, strokeW);
            this.g.fillStyle(col, blocked ? 0.4 : 0.9);
            this.g.fillRoundedRect(ar.x, ar.y + 12, 5, ar.h - 24, 3);

            const icon = this._icon(ARTIFACT_ICONS[i], ar.x + 54, ar.y + ar.h / 2, 88, blocked ? 0.35 : 1);
            const tx = icon ? ar.x + 108 : ar.x + ACARD_W / 2;
            const ox = icon ? 0 : 0.5;

            const titleCol = isActive ? this._hex(col) : (blocked ? '#7a7286' : (isOwned ? '#d2d2d2' : '#ffffff'));
            const wrapW = ar.x + ACARD_W - 16 - tx;
            this._text(tx, ar.y + 16, t('artifact_names')[i], 22, titleCol, ox, 0, isActive ? this._hex(col) : undefined);
            this._text(tx, ar.y + 54, t('artifact_descs')[i], 16, blocked ? '#5e5868' : '#a098ac', ox, 0, undefined, wrapW);

            if (isActive) {
                this._text(tx, ar.y + 128, isHov ? t('shop_unequip') : t('shop_active'), 20, isHov ? '#d2d2d2' : this._hex(col), ox, 0);
            } else if (isOwned) {
                this._text(tx, ar.y + 128, blocked ? t('shop_slots_full') : (isHov ? t('shop_equip') : t('shop_owned')), 20,
                    blocked ? '#786482' : this._hex(rgb(cc.r / 2 + 80, cc.g / 2 + 80, cc.b / 2 + 80)), ox, 0);
            } else {
                const coinX = icon ? tx + 10 : ar.x + ACARD_W / 2 - 18;
                const coin = this._add(this.scene.add.sprite(coinX, ar.y + 140, 'coin').setOrigin(0.5, 0.5));
                coin.setDisplaySize(22, 22);
                this._text(coinX + 16, ar.y + 140, '' + ARTIFACTS[i].cost, 22, afford ? '#ffe24a' : '#d2643c', 0, 0.5);
            }
        }
    }
}
