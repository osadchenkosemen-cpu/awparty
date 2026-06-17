// EnemySpawner — порт EnemySpawner.cpp.
// Спавнит врагов в массив enemies в зависимости от фазы и времени.

function findSpawnPos(px, py, arenaW, arenaH, safeRadius) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const tx = randInt(Math.floor(arenaW));
        const ty = randInt(Math.floor(arenaH));
        if (distSq(px, py, tx, ty) >= safeRadius * safeRadius) return { x: tx, y: ty };
    }
    const ang = randInt(360) * Math.PI / 180;
    const gx = clamp(px + Math.cos(ang) * safeRadius, 0, arenaW);
    const gy = clamp(py + Math.sin(ang) * safeRadius, 0, arenaH);
    return { x: gx, y: gy };
}

class EnemySpawner {
    constructor() {
        this.spawnTimer = 0;
        this.bossSpawned = false;
        this.goblinSpawnTimer = 0;
    }

    resetForPhase2() { this.spawnTimer = 0; this.goblinSpawnTimer = 0; }
    reset() { this.spawnTimer = 0; this.bossSpawned = false; this.goblinSpawnTimer = 0; }

    // scene нужен для создания Enemy; enemies — массив-приёмник
    update(scene, dt, survivalTime, arenaW, arenaH, px, py, enemies, isHardcore,
           enemyKey, goblinKey, isPhase2, phase2Time, isPhase3) {
        this.spawnTimer += dt;
        this.goblinSpawnTimer += dt;

        if (isPhase3) {
            const spawnInterval = isHardcore ? 0.15 : 0.22;
            if (this.spawnTimer >= spawnInterval) {
                const p = findSpawnPos(px, py, arenaW, arenaH, 350);
                const e = new Enemy(scene, p.x, p.y, enemyKey);
                const chance = randInt(100);
                if (chance < 20) { e.makeFast(); e.hp += 2; e.maxHp += 2; e.damage += 2; }
                else if (chance < 35) { e.makeTank(1); e.hp += 2; e.maxHp += 2; e.damage += 2; }
                else { e.hp = e.maxHp = 4; e.damage = 3; }
                if (isHardcore) e.speed *= 1.5;
                enemies.push(e);
                this.spawnTimer = 0;
            }
            if (this.goblinSpawnTimer >= 10) {
                const p = findSpawnPos(px, py, arenaW, arenaH, 400);
                const g = new Enemy(scene, p.x, p.y, enemyKey);
                g.makeGoblin(goblinKey);
                g.hp += 2; g.maxHp += 2; g.damage += 2;
                if (isHardcore) g.speed *= 1.5;
                enemies.push(g);
                this.goblinSpawnTimer = 0;
            }
        } else if (!isPhase2) {
            // ФАЗА 1
            if (survivalTime < 60 && this.spawnTimer >= 0.5) {
                const p = findSpawnPos(px, py, arenaW, arenaH, 350);
                const e = new Enemy(scene, p.x, p.y, enemyKey);
                const chance = randInt(100);
                if (chance < 20) e.makeFast();
                else if (chance < 35) e.makeTank(1);
                else { e.hp = e.maxHp = 2; }
                if (isHardcore) e.speed *= 1.5;
                enemies.push(e);
                this.spawnTimer = 0;
            }
            if (survivalTime >= 10 && survivalTime < 60 && this.goblinSpawnTimer >= 20) {
                const p = findSpawnPos(px, py, arenaW, arenaH, 400);
                const g = new Enemy(scene, p.x, p.y, enemyKey);
                g.makeGoblin(goblinKey);
                if (isHardcore) g.speed *= 1.5;
                enemies.push(g);
                this.goblinSpawnTimer = 0;
            }
            if (survivalTime >= 60 && !this.bossSpawned) {
                const bossOffset = 800;
                let bx = clamp(px + bossOffset, 0, arenaW);
                let by = clamp(py, 0, arenaH);
                if (distSq(px, py, bx, by) < 40000) {
                    const ang = randInt(360) * Math.PI / 180;
                    bx = clamp(px + Math.cos(ang) * bossOffset, 0, arenaW);
                    by = clamp(py + Math.sin(ang) * bossOffset, 0, arenaH);
                }
                const boss = new Enemy(scene, bx, by, enemyKey);
                boss.makeBoss();
                if (isHardcore) boss.speed *= 1.5;
                enemies.push(boss);
                this.bossSpawned = true;
            }
        } else {
            // ФАЗА 2
            const spawnInterval = isHardcore ? 0.2 : 0.3;
            if (this.spawnTimer >= spawnInterval) {
                const p = findSpawnPos(px, py, arenaW, arenaH, 350);
                const e = new Enemy(scene, p.x, p.y, enemyKey);
                const chance = randInt(100);
                if (chance < 20) { e.makeFast(); e.hp += 1; e.maxHp += 1; e.damage += 1; }
                else if (chance < 35) { e.makeTank(1); e.hp += 1; e.maxHp += 1; e.damage += 1; }
                else { e.hp = e.maxHp = 3; e.damage = 2; }
                if (isHardcore) e.speed *= 1.5;
                enemies.push(e);
                this.spawnTimer = 0;
            }
            if (this.goblinSpawnTimer >= 15) {
                const p = findSpawnPos(px, py, arenaW, arenaH, 400);
                const g = new Enemy(scene, p.x, p.y, enemyKey);
                g.makeGoblin(goblinKey);
                g.hp += 1; g.maxHp += 1; g.damage += 1;
                if (isHardcore) g.speed *= 1.5;
                enemies.push(g);
                this.goblinSpawnTimer = 0;
            }
            // Босс фазы 2 спавнится из scene
        }
    }
}
