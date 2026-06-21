// EnemySpawner — порт EnemySpawner.cpp.
// Спавнит врагов в массив enemies в зависимости от фазы и времени.

// Частота обычного спавна масштабируется по номеру этапа: каждый следующий этап
// спавнит на 15% чаще (единая формула с 1-го этапа). Все числа — для тюнинга.
const SPAWN_BASE_INTERVAL = 0.625;  // интервал обычного спавна на 1-м этапе (сек)
const SPAWN_FREQ_PER_STAGE = 1.15;  // множитель частоты за каждый следующий этап
const SPAWN_HARDCORE_FREQ = 1.5;    // в hardcore спавн ещё чаще
const SPAWN_HARDCORE_HP = 2;        // в hardcore HP всех юнитов в N раз больше

// Минимальная дистанция спавна врага от игрока (чтобы не появлялись вплотную).
const SPAWN_SAFE_DIST = 700;        // обычные враги
const SPAWN_SAFE_DIST_GOBLIN = 750; // гоблины — чуть дальше

// Конфиг рядового/гоблинского спавна по фазам. Прежде эти числа были «зашиты» в три
// почти одинаковых блока фаз 1/2/3 — теперь различия фаз только здесь.
//   fastCap          — лимит «быстрых» за фазу (фаза 1); null = без лимита
//   bonusHp/bonusDmg — прибавка к fast/tank/гоблину (растёт по этапам)
//   normalHp/normalDmg — статы обычного врага; normalDmg=null = дефолт Enemy (20)
//   speedMul         — множитель скорости рядовых/гоблинов фазы
//   hardcoreSpeedMul — доп. множитель скорости в hardcore (фаза 1: 1.5; далее 1)
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
    // Фолбэк у стены: перебираем направления по кольцу и берём первое, что после клэмпа
    // в арену остаётся достаточно далеко от игрока (иначе враг появлялся внутри игрока).
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
        this.phase1FastCount = 0; // сколько быстрых врагов уже заспавнено в фазе 1 (лимит 7)
        this.subSpawnTimer = 0;   // ритм спавна Сабвуферов (глава 2+); не сбрасывается между фазами
        this.mosherSpawnTimer = 0; // ритм спавна Мошеров (глава 2+)
        this.hypeSpawnTimer = 0;   // таймер спавна Хайпменов (глава 2+)
        this.hypeCount = 0;        // сколько Хайпменов уже заспавнено в текущем этапе
        this.hypePhase = 0;        // этап, обслуживаемый хайп-спавнером (смена → сброс счётчика)
        this.hypeNextAt = 0;       // случайная задержка до следующего Хайпмена
    }

    resetForPhase2() { this.spawnTimer = 0; this.goblinSpawnTimer = 0; }
    reset() {
        this.spawnTimer = 0; this.bossSpawned = false; this.goblinSpawnTimer = 0; this.phase1FastCount = 0;
        this.subSpawnTimer = 0; this.mosherSpawnTimer = 0;
        this.hypeSpawnTimer = 0; this.hypeCount = 0; this.hypePhase = 0; this.hypeNextAt = 5 + Math.random() * 15;
    }

    // Интервал обычного спавна для этапа step (1,2,3,...): +15% частоты за каждый этап.
    spawnInterval(step, isHardcore) {
        const stage = Math.max(1, step | 0);
        const freq = Math.pow(SPAWN_FREQ_PER_STAGE, stage - 1) * (isHardcore ? SPAWN_HARDCORE_FREQ : 1);
        return SPAWN_BASE_INTERVAL / freq;
    }

    // Общий «хвост» спавна юнита: множители главы + hardcore (+ опц. скорость) + «безумный»
    // этап. Эквивалентен прежним повторяющимся блокам всех фаз и спец-врагов.
    // crazyMode истинен только в фазе 3 после 3-го босса, поэтому проверка безопасна везде.
    _finalize(scene, e, isHardcore, hardcoreSpeedMul, enemies) {
        scene._applyChapterEnemy(e);
        if (isHardcore) { e.speed *= hardcoreSpeedMul; e.hp *= SPAWN_HARDCORE_HP; e.maxHp *= SPAWN_HARDCORE_HP; }
        if (scene.crazyMode) { e.hp *= C.CRAZY_HP_MULT; e.maxHp *= C.CRAZY_HP_MULT; }
        enemies.push(e);
    }

    // Рядовой враг по конфигу фазы (cfg из PHASE_CFG). Финализацию делает _finalize.
    _makeRegular(scene, enemyKey, x, y, cfg) {
        const e = new Enemy(scene, x, y, enemyKey);
        const chance = randInt(100);
        if (chance < 20) {
            // Быстрый. В фазе 1 — не больше fastCap за фазу; сверх лимита спавним обычного.
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

    // Гоблин-стрелок по конфигу фазы (прибавки/скорость как у рядовых той же фазы).
    _makeGoblin(scene, enemyKey, goblinKey, x, y, cfg) {
        const g = new Enemy(scene, x, y, enemyKey);
        g.makeGoblin(goblinKey);
        g.hp += cfg.bonusHp; g.maxHp += cfg.bonusHp; g.damage += cfg.bonusDmg;
        g.speed *= cfg.speedMul;
        return g;
    }

    // scene нужен для создания Enemy; enemies — массив-приёмник
    update(scene, dt, survivalTime, arenaW, arenaH, px, py, enemies, isHardcore,
           enemyKey, goblinKey, isPhase2, phase2Time, isPhase3, step) {
        this.spawnTimer += dt;
        this.goblinSpawnTimer += dt;

        // Множитель частоты спавна главы (для главы 1 = 1): интервал делится на него.
        const sm = (scene.chapter && scene.chapter.spawnMult) || 1;

        // Сабвуфер (глава 2+): спавнится по своему ритму, независимо от фазы. Первый —
        // через ~20с, далее каждые ~20с. Гейт по ключу: в главе 1 _subwooferKey == null.
        this.subSpawnTimer += dt;
        if (scene._subwooferKey && this.subSpawnTimer >= 20) {
            const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
            const sub = new Enemy(scene, p.x, p.y, scene._subwooferKey);
            sub.makeSubwoofer(scene._subwooferKey);
            this._finalize(scene, sub, isHardcore, 1, enemies);
            this.subSpawnTimer = 0;
        }

        // Мошер (глава 2+): спавнится по своему ритму (~13с). При смерти распадётся на мини.
        this.mosherSpawnTimer += dt;
        if (scene._mosherKey && this.mosherSpawnTimer >= 13) {
            const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
            const mo = new Enemy(scene, p.x, p.y, scene._mosherKey);
            mo.makeMosher(scene._mosherKey);
            this._finalize(scene, mo, isHardcore, 1, enemies);
            this.mosherSpawnTimer = 0;
        }

        // Хайпмен (глава 2+): за этап сеется фикс. число штук в случайные моменты.
        // Бюджет по этапам: 1-й → 2, 2-й → 3, 3-й → 4.
        if (scene._hypemanKey) {
            const phaseIdx = isPhase3 ? 3 : (isPhase2 ? 2 : 1);
            if (phaseIdx !== this.hypePhase) {
                // Новый этап — обнуляем счётчик и планируем первый спавн.
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
                this.hypeNextAt = 6 + Math.random() * 18; // следующий — через 6..24с
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
            // ФАЗА 1
            const cfg = PHASE_CFG[1];
            if (survivalTime < 60 && this.spawnTimer >= this.spawnInterval(step, isHardcore) / sm) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = this._makeRegular(scene, enemyKey, p.x, p.y, cfg);
                this._finalize(scene, e, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.spawnTimer = 0;
            }
            if (survivalTime >= 10 && survivalTime < 60 && this.goblinSpawnTimer >= 25) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = this._makeGoblin(scene, enemyKey, goblinKey, p.x, p.y, cfg);
                this._finalize(scene, g, isHardcore, cfg.hardcoreSpeedMul, enemies);
                this.goblinSpawnTimer = 0;
            }
            if (survivalTime >= 60 && !this.bossSpawned) {
                // Гарантируем дистанцию от игрока даже у стены (иначе босс появлялся внутри него).
                const bp = findSpawnPos(px, py, arenaW, arenaH, 800);
                const bx = bp.x, by = bp.y;
                const boss = new Enemy(scene, bx, by, scene._boss1Key || enemyKey);
                // Глава с boss1Type:'DOCTOR' — босс этапа 1 это доктор; иначе обычный прыжок-босс.
                if (scene.chapter && scene.chapter.boss1Type === 'DOCTOR') boss.makeBossDoctor(scene._boss1Key);
                else boss.makeBoss();
                scene._applyChapterBoss(boss);
                if (isHardcore) { boss.speed *= 1.5; boss.hp *= SPAWN_HARDCORE_HP; boss.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(boss);
                this.bossSpawned = true;
            }
        } else {
            // ФАЗА 2
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
            // Босс фазы 2 спавнится из scene
        }
    }
}
