
const SPAWN_BASE_INTERVAL = 0.625;
const SPAWN_FREQ_PER_STAGE = 1.15;
const SPAWN_HARDCORE_FREQ = 1.5;
const SPAWN_HARDCORE_HP = 2;

const SPAWN_SAFE_DIST = 700;
const SPAWN_SAFE_DIST_GOBLIN = 750;

const PHASE_CFG = {
    1: { fastCap: 7,    bonusHp: 0, bonusDmg: 0,  normalHp: 2, normalDmg: null, speedMul: 1,    hardcoreSpeedMul: 1.5 },
    2: { fastCap: null, bonusHp: 1, bonusDmg: 10, normalHp: 3, normalDmg: 30,   speedMul: 1.25, hardcoreSpeedMul: 1 },
    3: { fastCap: null, bonusHp: 2, bonusDmg: 20, normalHp: 4, normalDmg: 40,   speedMul: 1.25, hardcoreSpeedMul: 1 },
};

function findSpawnPos(px, py, arenaW, arenaH, safeRadius) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const tx = randInt(Math.floor(arenaW));
        const ty = randInt(Math.floor(arenaH));
        if (distSq(px, py, tx, ty) >= safeRadius * safeRadius) return { x: tx, y: ty };
    }
    let best = null, bestD = -1;
    const start = randInt(360);
    for (let i = 0; i < 36; i++) {
        const ang = (start + i * 10) * Math.PI / 180;
        const gx = clamp(px + Math.cos(ang) * safeRadius, 0, arenaW);
        const gy = clamp(py + Math.sin(ang) * safeRadius, 0, arenaH);
        const d = distSq(px, py, gx, gy);
        if (d >= safeRadius * safeRadius) return { x: gx, y: gy };
        if (d > bestD) { bestD = d; best = { x: gx, y: gy }; }
    }
    return best;
}

class EnemySpawner {
    constructor() {
        this.spawnTimer = 0;
        this.bossSpawned = false;
        this.goblinSpawnTimer = 0;
        this.phase1FastCount = 0;
        this.subSpawnTimer = 0;
        this.mosherSpawnTimer = 0;
        this.hypeSpawnTimer = 0;
        this.hypeCount = 0;
        this.hypePhase = 0;
        this.hypeNextAt = 0;
    }

    resetForPhase2() { this.spawnTimer = 0; this.goblinSpawnTimer = 0; }
    reset() {
        this.spawnTimer = 0; this.bossSpawned = false; this.goblinSpawnTimer = 0; this.phase1FastCount = 0;
        this.subSpawnTimer = 0; this.mosherSpawnTimer = 0;
        this.hypeSpawnTimer = 0; this.hypeCount = 0; this.hypePhase = 0; this.hypeNextAt = 5 + Math.random() * 15;
    }

    spawnInterval(step, isHardcore) {
        const stage = Math.max(1, step | 0);
        const freq = Math.pow(SPAWN_FREQ_PER_STAGE, stage - 1) * (isHardcore ? SPAWN_HARDCORE_FREQ : 1);
        return SPAWN_BASE_INTERVAL / freq;
    }

    _finalize(scene, e, isHardcore, hardcoreSpeedMul, enemies) {
        scene._applyChapterEnemy(e);
        if (isHardcore) { e.speed *= hardcoreSpeedMul; e.hp *= SPAWN_HARDCORE_HP; e.maxHp *= SPAWN_HARDCORE_HP; }
        if (scene.crazyMode) { e.hp *= C.CRAZY_HP_MULT; e.maxHp *= C.CRAZY_HP_MULT; }
        enemies.push(e);
    }

    _makeRegular(scene, enemyKey, x, y, cfg) {
        const e = new Enemy(scene, x, y, enemyKey);
        const chance = randInt(100);
        if (chance < 20) {
            if (cfg.fastCap != null && this.phase1FastCount >= cfg.fastCap) {
                e.hp = e.maxHp = cfg.normalHp;
                if (cfg.normalDmg != null) e.damage = cfg.normalDmg;
            } else {
                e.makeFast();
                if (cfg.fastCap != null) this.phase1FastCount++;
                e.hp += cfg.bonusHp; e.maxHp += cfg.bonusHp; e.damage += cfg.bonusDmg;
            }
        } else if (chance < 32) {
            e.makeTank(1);
            e.hp += cfg.bonusHp; e.maxHp += cfg.bonusHp; e.damage += cfg.bonusDmg;
        } else {
            e.hp = e.maxHp = cfg.normalHp;
            if (cfg.normalDmg != null) e.damage = cfg.normalDmg;
        }
        e.speed *= cfg.speedMul;
        return e;
    }

    _makeGoblin(scene, enemyKey, goblinKey, x, y, cfg) {
        const g = new Enemy(scene, x, y, enemyKey);
        g.makeGoblin(goblinKey);
        g.hp += cfg.bonusHp; g.maxHp += cfg.bonusHp; g.damage += cfg.bonusDmg;
        g.speed *= cfg.speedMul;
        return g;
    }

    update(scene, dt, survivalTime, arenaW, arenaH, px, py, enemies, isHardcore,
           enemyKey, goblinKey, isPhase2, phase2Time, isPhase3, step) {
        this.spawnTimer += dt;
        this.goblinSpawnTimer += dt;

        const sm = (scene.chapter && scene.chapter.spawnMult) || 1;

        this.subSpawnTimer += dt;
        if (scene._subwooferKey && this.subSpawnTimer >= 20) {
            const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
            const sub = new Enemy(scene, p.x, p.y, scene._subwooferKey);
            sub.makeSubwoofer(scene._subwooferKey);
            this._finalize(scene, sub, isHardcore, 1, enemies);
            this.subSpawnTimer = 0;
        }

        this.mosherSpawnTimer += dt;
        if (scene._mosherKey && this.mosherSpawnTimer >= 13) {
            const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
            const mo = new Enemy(scene, p.x, p.y, scene._mosherKey);
            mo.makeMosher(scene._mosherKey);
            this._finalize(scene, mo, isHardcore, 1, enemies);
            this.mosherSpawnTimer = 0;
        }

        if (scene._hypemanKey) {
            const phaseIdx = isPhase3 ? 3 : (isPhase2 ? 2 : 1);
            if (phaseIdx !== this.hypePhase) {
                this.hypePhase = phaseIdx;
                this.hypeCount = 0;
                this.hypeSpawnTimer = 0;
                this.hypeNextAt = 5 + Math.random() * 15;
            }
            const budget = phaseIdx === 3 ? 4 : (phaseIdx === 2 ? 3 : 2);
            this.hypeSpawnTimer += dt;
            if (this.hypeCount < budget && this.hypeSpawnTimer >= this.hypeNextAt) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const hy = new Enemy(scene, p.x, p.y, scene._hypemanKey);
                hy.makeHypeman(scene._hypemanKey);
                this._finalize(scene, hy, isHardcore, 1, enemies);
                this.hypeCount++;
                this.hypeSpawnTimer = 0;
                this.hypeNextAt = 6 + Math.random() * 18;
            }
        }

        if (isPhase3) {
            const cfg = PHASE_CFG[3];
            const interval = this.spawnInterval(step, isHardcore) / sm;
            if (this.spawnTimer >= interval) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = this._makeRegular(scene, enemyKey, p.x, p.y, cfg);
                this._finalize(scene, e, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.spawnTimer = 0;
            }
            if (this.goblinSpawnTimer >= 10) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = this._makeGoblin(scene, enemyKey, goblinKey, p.x, p.y, cfg);
                this._finalize(scene, g, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.goblinSpawnTimer = 0;
            }
        } else if (!isPhase2) {
            const cfg = PHASE_CFG[1];
            if (!this.bossSpawned && this.spawnTimer >= this.spawnInterval(step, isHardcore) / sm) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = this._makeRegular(scene, enemyKey, p.x, p.y, cfg);
                this._finalize(scene, e, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.spawnTimer = 0;
            }
            if (survivalTime >= 10 && !this.bossSpawned && this.goblinSpawnTimer >= 25) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = this._makeGoblin(scene, enemyKey, goblinKey, p.x, p.y, cfg);
                this._finalize(scene, g, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.goblinSpawnTimer = 0;
            }
            if ((survivalTime >= C.BOSS_TIME_CAP || (survivalTime >= C.BOSS_KILL_MIN_TIME && scene.phaseKills >= scene._bossKillReq(1))) && !this.bossSpawned) {
                const bp = findSpawnPos(px, py, arenaW, arenaH, 800);
                const bx = bp.x, by = bp.y;
                const boss = new Enemy(scene, bx, by, scene._boss1Key || enemyKey);
                if (scene.chapter && scene.chapter.boss1Type === 'DOCTOR') boss.makeBossDoctor(scene._boss1Key);
                else boss.makeBoss();
                scene._applyChapterBoss(boss);
                if (isHardcore) { boss.speed *= 1.5; boss.hp *= SPAWN_HARDCORE_HP; boss.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(boss);
                this.bossSpawned = true;
            }
        } else {
            const cfg = PHASE_CFG[2];
            const interval = this.spawnInterval(step, isHardcore) / sm;
            if (this.spawnTimer >= interval) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = this._makeRegular(scene, enemyKey, p.x, p.y, cfg);
                this._finalize(scene, e, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.spawnTimer = 0;
            }
            if (this.goblinSpawnTimer >= 15) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = this._makeGoblin(scene, enemyKey, goblinKey, p.x, p.y, cfg);
                this._finalize(scene, g, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.goblinSpawnTimer = 0;
            }
        }
    }
}
