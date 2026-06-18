// ShopUI — порт src/ShopUI.cpp. Древо навыков (3 ветки x 3 ряда) + вкладка артефактов.
// Читает/пишет perm-поля прямо в объект save (this.s).

const SHOP_BRANCH_X = [480, 960, 1440];
const SHOP_NODE_Y = [285, 485, 685];
const SHOP_CARD_W = 340, SHOP_CARD_H = 150;
const ACARD_W = 340, ACARD_H = 175;
const ARTIFACT_COUNT = 7;

const NODE_TITLES = [
    ['DAMAGE', 'CRIT CHANCE', 'MULTISHOT'],
    ['MAX HP', 'REGEN', 'ARMOR'],
    ['SPEED', 'DASH', 'MAGNET'],
];
const NODE_DESCS = [
    ['Attack power +1', '+5% crit chance', 'Every 8th shot +1'],
    ['Max HP +1', 'Heal 1 HP over time', 'Reduce dmg; MAX: immortal'],
    ['Move speed +10', 'Unlock/upgrade dash', 'Pickup radius +100'],
];
const BRANCH_NAMES = ['ATTACK', 'SURVIVAL', 'MOBILITY'];
const ARTIFACT_COLORS = [0xdc3c3c, 0xffa028, 0x50c8ff, 0xa03cdc, 0xff6428, 0xa0a0a0, 0x3cdca0];

function branchColor(b) {
    if (b === 0) return 0xff5050;
    if (b === 1) return 0x50dc50;
    return 0x5096ff;
}

class Shop {
    constructor(scene) {
        this.scene = scene;
        this.s = scene.save; // ссылка на runtime-сейв
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

    // --- логика узлов ---
    nodeCurLevel(b, r) {
        switch (b * 3 + r) {
            case 0: return this.s.permDamage - 1;
            case 1: return this.s.permCritChance;
            case 2: return this.s.permMultishot;
            case 3: return this.s.permMaxHp - 3;
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

    // --- прямоугольники ---
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
            case 3: s.permMaxHp++; break;
            case 4: s.permRegen++; break;
            case 5: s.permArmor++; break;
            case 6: s.permSpeed += 10; break;
            case 7: s.permDashLevel++; break;
            case 8: s.permMagnet++; break;
        }
        return true;
    }

    // Покупка + звук только если реально потратили монеты (не экип/снятие артефакта).
    _buyAndNotify() {
        const before = this.s.totalCoins;
        const ok = this.purchaseSelected();
        if (ok && this.s.totalCoins < before && this.scene.audio) this.scene.audio.play('sfx_skillbought');
        return ok;
    }

    // Возвращает 'back' если нажата кнопка Назад, иначе null
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
    _text(x, y, str, size, color, originX, originY) {
        const t = this.scene.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: color });
        t.setOrigin(originX === undefined ? 0 : originX, originY === undefined ? 0 : originY);
        return this._add(t);
    }
    _hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

    redraw() {
        if (!this.visible) return;
        this._clear();
        const s = this.s;

        this._rect(0, 0, 1920, 1080, 0x0a0514, 1);
        this._text(960, 55, this.activeTab === 0 ? 'SKILL TREE' : 'ARTIFACTS', 52, '#c8c8ff', 0.5, 0.5);
        this._text(1880, 20, 'Coins: ' + s.totalCoins, 30, '#ffff00', 1, 0);

        // Вкладки
        const tabNames = ['SKILL TREE', 'ARTIFACTS'];
        for (let t = 0; t < 2; t++) {
            const tr = this.tabRect(t);
            const active = this.activeTab === t;
            this._rect(tr.x, tr.y, tr.w, tr.h, active ? 0x321e50 : 0x140a23, 1, 2, active ? 0xc896ff : 0x503c6e);
            this._text(tr.x + tr.w / 2, tr.y + tr.h / 2, tabNames[t], 22, active ? '#dcbeff' : '#7864a0', 0.5, 0.5);
        }

        if (this.activeTab === 0) this._renderSkillTree();
        else this._renderArtifacts();

        // Кнопка назад
        const br = this.backRect();
        this._rect(br.x, br.y, br.w, br.h, this.backHovered ? 0x502864 : 0x28143c, 1, 2, this.backHovered ? 0xffc8ff : 0x9664c8);
        this._text(960, 870, '[ ESC  -  Back ]', 26, '#ffffff', 0.5, 0.5);
    }

    _renderSkillTree() {
        const g = this._add(this.scene.add.graphics());
        for (let b = 0; b < 3; b++) {
            this._text(SHOP_BRANCH_X[b], 185, BRANCH_NAMES[b], 36, this._hex(branchColor(b)), 0.5, 0.5);
            // стрелки между рядами
            for (let r = 0; r < 2; r++) {
                const x = SHOP_BRANCH_X[b];
                const y1 = SHOP_NODE_Y[r] + SHOP_CARD_H / 2;
                const y2 = SHOP_NODE_Y[r + 1] - SHOP_CARD_H / 2;
                const col = this.nodeUnlocked(b, r + 1) ? branchColor(b) : 0x464646;
                g.fillStyle(col, 1);
                g.fillRect(x - 2, y1, 4, y2 - y1 - 14);
                g.beginPath();
                g.moveTo(x - 10, y2 - 14); g.lineTo(x + 10, y2 - 14); g.lineTo(x, y2);
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

            let fill, fillA = 1, stroke;
            if (locked) { fill = 0x0f0f14; stroke = 0x323237; }
            else if (maxed) { fill = rgb(cc.r / 5, cc.g / 5, cc.b / 5); fillA = 220 / 255; stroke = col; }
            else if (isSel || isHov) { fill = rgb(cc.r / 4, cc.g / 4, cc.b / 4); stroke = 0xffffff; }
            else { fill = 0x140f1e; stroke = afford ? col : 0x782828; }
            this._rect(nr.x, nr.y, nr.w, nr.h, fill, fillA, isSel ? 4 : 2, stroke);

            const cx = nr.x + SHOP_CARD_W / 2;
            this._text(cx, nr.y + 10, NODE_TITLES[b][r], 24, locked ? '#464646' : '#ffffff', 0.5, 0);
            const cur = this.nodeCurLevel(b, r), mx = this.nodeMaxLevel(b, r);
            const lvlStr = maxed ? 'MAX' : ('Lv ' + cur + ' / ' + mx);
            this._text(cx, nr.y + 45, lvlStr, 20, maxed ? this._hex(col) : '#a0a0a0', 0.5, 0);
            this._text(cx, nr.y + 72, NODE_DESCS[b][r], 17, locked ? '#373737' : '#969696', 0.5, 0);

            if (!locked && !maxed) {
                const cost = this.nodeCost(b, r);
                const coin = this._add(this.scene.add.sprite(cx - 16, nr.y + 102 + 11, 'coin').setOrigin(0.5, 0.5));
                coin.setDisplaySize(22, 22);
                this._text(cx + 4, nr.y + 100, '' + cost, 22, afford ? '#ffff00' : '#c83c3c', 0, 0);
            } else if (locked) {
                this._text(cx, nr.y + 105, 'LOCKED', 20, '#505050', 0.5, 0);
            }
        }
    }

    _renderArtifacts() {
        const s = this.s;
        let activeCount = 0;
        for (let j = 0; j < ARTIFACT_COUNT; j++) activeCount += (s.permArtifacts >> j) & 1;
        const slotsFull = activeCount >= 3;

        this._text(960, 230, 'ARTIFACTS', 36, '#c8b4ff', 0.5, 0.5);
        let activeEq = 0;
        for (let j = 0; j < ARTIFACT_COUNT; j++) activeEq += (s.permActiveArtifacts >> j) & 1;
        this._text(960, 278, 'SLOTS:  ' + activeEq + ' / 3', 22, activeEq >= 3 ? '#ff5050' : '#00dca0', 0.5, 0.5);

        for (let i = 0; i < ARTIFACT_COUNT; i++) {
            const ar = this.artifactRect(i);
            const isOwned = (s.permArtifacts >> i) & 1;
            const isActive = (s.permActiveArtifacts >> i) & 1;
            const isHov = this.hovArtifact === i;
            const afford = !isOwned && s.totalCoins >= ARTIFACTS[i].cost;
            let activeEqCnt = 0;
            for (let j = 0; j < ARTIFACT_COUNT; j++) activeEqCnt += (s.permActiveArtifacts >> j) & 1;
            const blocked = isOwned && !isActive && activeEqCnt >= 3;
            const col = ARTIFACT_COLORS[i];
            const cc = Phaser.Display.Color.IntegerToRGB(col);

            let fill, fillA = 1, stroke;
            if (isActive) { fill = rgb(cc.r / 5, cc.g / 5, cc.b / 5); fillA = 220 / 255; stroke = isHov ? 0xffffff : col; }
            else if (isOwned && !blocked) { fill = isHov ? rgb(cc.r / 4, cc.g / 4, cc.b / 4) : 0x0f0c19; stroke = isHov ? 0xffffff : rgb(cc.r / 2, cc.g / 2, cc.b / 2); }
            else if (blocked) { fill = 0x0f0c19; stroke = 0x464150; }
            else if (isHov) { fill = rgb(cc.r / 4, cc.g / 4, cc.b / 4); stroke = 0xffffff; }
            else { fill = 0x140f1e; stroke = afford ? col : 0x782828; }
            this._rect(ar.x, ar.y, ar.w, ar.h, fill, fillA, isHov ? 4 : 2, stroke);

            const cx = ar.x + ACARD_W / 2;
            const titleCol = isActive ? this._hex(col) : (isOwned ? '#c8c8c8' : '#ffffff');
            this._text(cx, ar.y + 12, ARTIFACTS[i].name, 22, titleCol, 0.5, 0);
            this._text(cx, ar.y + 50, ARTIFACTS[i].desc, 16, '#969696', 0.5, 0);

            if (isActive) {
                this._text(cx, ar.y + 118, isHov ? 'UNEQUIP' : 'ACTIVE', 20, isHov ? '#c8c8c8' : this._hex(col), 0.5, 0);
            } else if (isOwned) {
                this._text(cx, ar.y + 118, blocked ? 'SLOTS FULL' : (isHov ? 'EQUIP' : 'OWNED'), 20, blocked ? '#786482' : this._hex(rgb(cc.r / 2 + 80, cc.g / 2 + 80, cc.b / 2 + 80)), 0.5, 0);
            } else {
                const coin = this._add(this.scene.add.sprite(cx - 16, ar.y + 120 + 11, 'coin').setOrigin(0.5, 0.5));
                coin.setDisplaySize(22, 22);
                this._text(cx + 4, ar.y + 118, '' + ARTIFACTS[i].cost, 22, afford ? '#ffff00' : '#c83c3c', 0, 0);
            }
        }
    }
}
