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
    }

    resetForPhase2() { this.spawnTimer = 0; this.goblinSpawnTimer = 0; }
    reset() { this.spawnTimer = 0; this.bossSpawned = false; this.goblinSpawnTimer = 0; this.phase1FastCount = 0; this.subSpawnTimer = 0; this.mosherSpawnTimer = 0; }

    // Интервал обычного спавна для этапа step (1,2,3,...): +15% частоты за каждый этап.
    spawnInterval(step, isHardcore) {
        const stage = Math.max(1, step | 0);
        const freq = Math.pow(SPAWN_FREQ_PER_STAGE, stage - 1) * (isHardcore ? SPAWN_HARDCORE_FREQ : 1);
        return SPAWN_BASE_INTERVAL / freq;
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
            scene._applyChapterEnemy(sub);
            if (isHardcore) { sub.hp *= SPAWN_HARDCORE_HP; sub.maxHp *= SPAWN_HARDCORE_HP; }
            if (scene.crazyMode) { sub.hp *= C.CRAZY_HP_MULT; sub.maxHp *= C.CRAZY_HP_MULT; }
            enemies.push(sub);
            this.subSpawnTimer = 0;
        }

        // Мошер (глава 2+): спавнится по своему ритму (~13с). При смерти распадётся на мини.
        this.mosherSpawnTimer += dt;
        if (scene._mosherKey && this.mosherSpawnTimer >= 13) {
            const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
            const mo = new Enemy(scene, p.x, p.y, scene._mosherKey);
            mo.makeMosher(scene._mosherKey);
            scene._applyChapterEnemy(mo);
            if (isHardcore) { mo.hp *= SPAWN_HARDCORE_HP; mo.maxHp *= SPAWN_HARDCORE_HP; }
            if (scene.crazyMode) { mo.hp *= C.CRAZY_HP_MULT; mo.maxHp *= C.CRAZY_HP_MULT; }
            enemies.push(mo);
            this.mosherSpawnTimer = 0;
        }

        if (isPhase3) {
            const spawnInterval = this.spawnInterval(step, isHardcore) / sm;
            if (this.spawnTimer >= spawnInterval) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = new Enemy(scene, p.x, p.y, enemyKey);
                const chance = randInt(100);
                if (chance < 20) { e.makeFast(); e.hp += 2; e.maxHp += 2; e.damage += 20; }
                else if (chance < 32) { e.makeTank(1); e.hp += 2; e.maxHp += 2; e.damage += 20; }
                else { e.hp = e.maxHp = 4; e.damage = 40; }
                e.speed *= 1.25; // скорость как на этапе 2
                scene._applyChapterEnemy(e);
                if (isHardcore) { e.hp *= SPAWN_HARDCORE_HP; e.maxHp *= SPAWN_HARDCORE_HP; }
                // «Безумный» этап после третьего босса: x5 HP (урон/скорость не трогаем).
                if (scene.crazyMode) { e.hp *= C.CRAZY_HP_MULT; e.maxHp *= C.CRAZY_HP_MULT; }
                enemies.push(e);
                this.spawnTimer = 0;
            }
            if (this.goblinSpawnTimer >= 10) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = new Enemy(scene, p.x, p.y, enemyKey);
                g.makeGoblin(goblinKey);
                g.hp += 2; g.maxHp += 2; g.damage += 20;
                g.speed *= 1.25; // скорость как на этапе 2
                scene._applyChapterEnemy(g);
                if (isHardcore) { g.hp *= SPAWN_HARDCORE_HP; g.maxHp *= SPAWN_HARDCORE_HP; }
                if (scene.crazyMode) { g.hp *= C.CRAZY_HP_MULT; g.maxHp *= C.CRAZY_HP_MULT; }
                enemies.push(g);
                this.goblinSpawnTimer = 0;
            }
        } else if (!isPhase2) {
            // ФАЗА 1
            if (survivalTime < 60 && this.spawnTimer >= this.spawnInterval(step, isHardcore) / sm) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = new Enemy(scene, p.x, p.y, enemyKey);
                const chance = randInt(100);
                if (chance < 20) {
                    // быстрые — рандомным шансом, но не больше 7 за фазу 1; сверх лимита — обычный
                    if (this.phase1FastCount < 7) { e.makeFast(); this.phase1FastCount++; }
                    else { e.hp = e.maxHp = 2; }
                } else if (chance < 32) e.makeTank(1);
                else { e.hp = e.maxHp = 2; }
                scene._applyChapterEnemy(e);
                if (isHardcore) { e.speed *= 1.5; e.hp *= SPAWN_HARDCORE_HP; e.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(e);
                this.spawnTimer = 0;
            }
            if (survivalTime >= 10 && survivalTime < 60 && this.goblinSpawnTimer >= 25) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = new Enemy(scene, p.x, p.y, enemyKey);
                g.makeGoblin(goblinKey);
                scene._applyChapterEnemy(g);
                if (isHardcore) { g.speed *= 1.5; g.hp *= SPAWN_HARDCORE_HP; g.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(g);
                this.goblinSpawnTimer = 0;
            }
            if (survivalTime >= 60 && !this.bossSpawned) {
                // Гарантируем дистанцию от игрока даже у стены (иначе босс появлялся внутри него).
                const bp = findSpawnPos(px, py, arenaW, arenaH, 800);
                const bx = bp.x, by = bp.y;
                const boss = new Enemy(scene, bx, by, scene._boss1Key || enemyKey);
                boss.makeBoss();
                scene._applyChapterBoss(boss);
                if (isHardcore) { boss.speed *= 1.5; boss.hp *= SPAWN_HARDCORE_HP; boss.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(boss);
                this.bossSpawned = true;
            }
        } else {
            // ФАЗА 2
            const spawnInterval = this.spawnInterval(step, isHardcore) / sm;
            if (this.spawnTimer >= spawnInterval) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST);
                const e = new Enemy(scene, p.x, p.y, enemyKey);
                const chance = randInt(100);
                if (chance < 20) { e.makeFast(); e.hp += 1; e.maxHp += 1; e.damage += 10; }
                else if (chance < 32) { e.makeTank(1); e.hp += 1; e.maxHp += 1; e.damage += 10; }
                else { e.hp = e.maxHp = 3; e.damage = 30; }
                e.speed *= 1.25; // на 25% быстрее врагов фазы 1 (вместо прежнего hardcore-x1.5)
                scene._applyChapterEnemy(e);
                if (isHardcore) { e.hp *= SPAWN_HARDCORE_HP; e.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(e);
                this.spawnTimer = 0;
            }
            if (this.goblinSpawnTimer >= 15) {
                const p = findSpawnPos(px, py, arenaW, arenaH, SPAWN_SAFE_DIST_GOBLIN);
                const g = new Enemy(scene, p.x, p.y, enemyKey);
                g.makeGoblin(goblinKey);
                g.hp += 1; g.maxHp += 1; g.damage += 10;
                g.speed *= 1.25; // на 25% быстрее, как и остальные враги фазы 2
                scene._applyChapterEnemy(g);
                if (isHardcore) { g.hp *= SPAWN_HARDCORE_HP; g.maxHp *= SPAWN_HARDCORE_HP; }
                enemies.push(g);
                this.goblinSpawnTimer = 0;
            }
            // Босс фазы 2 спавнится из scene
        }
    }
}
