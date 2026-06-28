const { test, expect } = require('@playwright/test');

// Юнит-тесты ЧИСТОЙ логики. Игра — классические <script> с глобальным «супом»
// (без сборщика/модулей), поэтому функции и классы дёргаем прямо в реалме страницы
// через page.evaluate. Новых dev-зависимостей НЕ добавляем — переиспользуем уже
// установленный Playwright (правило проекта: ничего не качать на машину).
//
// Ждём window.__gameRef (его ставит main.js — последний модуль), это гарантирует,
// что все модули (utils/save/spawner/shop/...) загружены и доступны по имени.

test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.__gameRef !== 'undefined', { timeout: 15000 });
});

test('lbCompare: время по возрастанию, тай-брейк по очкам, пустые в конце', async ({ page }) => {
    const r = await page.evaluate(() => {
        const sgn = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
        return {
            fasterFirst: sgn(lbCompare({ time: 10, score: 5 }, { time: 20, score: 1 })),
            slowerSecond: sgn(lbCompare({ time: 20, score: 5 }, { time: 10, score: 1 })),
            tieHigherScoreFirst: sgn(lbCompare({ time: 10, score: 9 }, { time: 10, score: 3 })),
            emptyLast: sgn(lbCompare({ time: 0, score: 0 }, { time: 5, score: 1 })),
            bothEmpty: sgn(lbCompare({ time: 0, score: 0 }, { time: 0, score: 0 })),
        };
    });
    expect(r.fasterFirst).toBe(-1);
    expect(r.slowerSecond).toBe(1);
    expect(r.tieHigherScoreFirst).toBe(-1);
    expect(r.emptyLast).toBe(1);
    expect(r.bothEmpty).toBe(0);
});

test('lbCompareScore: очки по убыванию, тай-брейк по времени, пустые в конце', async ({ page }) => {
    const r = await page.evaluate(() => {
        const sgn = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
        return {
            higherScoreFirst: sgn(lbCompareScore({ score: 100, time: 50 }, { score: 50, time: 10 })),
            tieLowerTimeFirst: sgn(lbCompareScore({ score: 50, time: 10 }, { score: 50, time: 20 })),
            emptyLast: sgn(lbCompareScore({ score: 0, time: 0 }, { score: 1, time: 5 })),
        };
    });
    expect(r.higherScoreFirst).toBe(-1);
    expect(r.tieLowerTimeFirst).toBe(-1);
    expect(r.emptyLast).toBe(1);
});

test('SaveSystem._validate клэмпит мета-поля', async ({ page }) => {
    const r = await page.evaluate(() => {
        const v = (obj) => SaveSystem._validate(Object.assign(SaveSystem.defaults(), obj));
        const countBits = (x) => { let n = 0; for (let b = 0; b < 7; b++) n += (x >> b) & 1; return n; };
        return {
            hpHi: v({ permMaxHp: 9999 }).permMaxHp,
            hpLo: v({ permMaxHp: 10 }).permMaxHp,
            dmgHi: v({ permDamage: 999 }).permDamage,
            dmgLo: v({ permDamage: 0 }).permDamage,
            coinsNeg: v({ totalCoins: -5 }).totalCoins,
            coinsFloor: v({ totalCoins: 3.9 }).totalCoins,
            coinsCap: v({ totalCoins: 1e15 }).totalCoins,
            chapterHi: v({ maxChapterUnlocked: 99 }).maxChapterUnlocked,
            nameLen: v({ playerName: 'x'.repeat(50) }).playerName.length,
            // активные артефакты ⊆ купленных: 0b111 & 0b011 = 0b011
            activeSubsetOwned: v({ permArtifacts: 3, permActiveArtifacts: 7 }).permActiveArtifacts,
            // активных не больше 3 даже если выставлены все 7 бит
            activeMax3: countBits(v({ permArtifacts: 127, permActiveArtifacts: 127 }).permActiveArtifacts),
        };
    });
    expect(r.hpHi).toBe(170);
    expect(r.hpLo).toBe(100);
    expect(r.dmgHi).toBe(10);
    expect(r.dmgLo).toBe(1);
    expect(r.coinsNeg).toBe(0);
    expect(r.coinsFloor).toBe(3);
    expect(r.coinsCap).toBe(1e12);
    expect(r.chapterHi).toBe(3);
    expect(r.nameLen).toBe(20);
    expect(r.activeSubsetOwned).toBe(3);
    expect(r.activeMax3).toBe(3);
});

test('Shop: цена узла, гейтинг разблокировки, покупка списывает монеты', async ({ page }) => {
    const r = await page.evaluate(() => {
        // Без Phaser: создаём объект с прототипом Shop и нужными полями.
        const mk = (save) => {
            const sh = Object.create(Shop.prototype);
            sh.s = save; sh.activeTab = 0; sh.selBranch = 0; sh.selRow = 0; sh.selArtifact = -1;
            return sh;
        };
        const s = SaveSystem.defaults();
        const sh = mk(s);
        const out = {};
        out.dmgCost0 = sh.nodeCost(0, 0);              // экспонента: base 1500, cur 0 → 1500
        out.critLockedAtStart = !sh.nodeUnlocked(0, 1); // крит закрыт, пока урон cur < 3
        s.totalCoins = 5000;
        out.buyOk = sh.purchaseSelected();             // купить урон (b0,r0) за 1500
        out.dmgAfter = s.permDamage;
        out.coinsAfter = s.totalCoins;
        s.totalCoins = 0;
        out.buyBroke = sh.purchaseSelected();          // нет монет → false
        return out;
    });
    expect(r.dmgCost0).toBe(1500);
    expect(r.critLockedAtStart).toBe(true);
    expect(r.buyOk).toBe(true);
    expect(r.dmgAfter).toBe(2);      // 1 -> 2
    expect(r.coinsAfter).toBe(3500); // 5000 - 1500
    expect(r.buyBroke).toBe(false);
});

test('roundCost округляет по диапазонам (50/100/500)', async ({ page }) => {
    const r = await page.evaluate(() => ({
        sub1k: roundCost(123),    // <1000 → к 50 → 100
        mid: roundCost(1523),     // 1000..9999 → к 100 → 1500
        big: roundCost(64424),    // >=10000 → к 500 → 64500
        zero: roundCost(0),
        neg: roundCost(-5),
    }));
    expect(r.sub1k).toBe(100);
    expect(r.mid).toBe(1500);
    expect(r.big).toBe(64500);
    expect(r.zero).toBe(0);
    expect(r.neg).toBe(0);
});

test('SaveSystem._migrate: одноразовый вайп монет старой экономики', async ({ page }) => {
    const r = await page.evaluate(() => ({
        oldWiped: SaveSystem._migrate({ totalCoins: 555 }).totalCoins,
        oldVer: SaveSystem._migrate({ totalCoins: 555 }).economyVersion,
        newKept: SaveSystem._migrate({ totalCoins: 7777, economyVersion: 1 }).totalCoins,
        defaultsVer: SaveSystem.defaults().economyVersion,
    }));
    expect(r.oldWiped).toBe(0);
    expect(r.oldVer).toBe(1);
    expect(r.newKept).toBe(7777);
    expect(r.defaultsVer).toBe(1);
});

test('EnemySpawner.spawnInterval: короче с этапом и в хардкоре', async ({ page }) => {
    const r = await page.evaluate(() => {
        const sp = new EnemySpawner();
        return {
            s1: sp.spawnInterval(1, false),
            s2: sp.spawnInterval(2, false),
            s3: sp.spawnInterval(3, false),
            s1hc: sp.spawnInterval(1, true),
        };
    });
    expect(r.s1).toBeCloseTo(0.625, 5);
    expect(r.s2).toBeLessThan(r.s1);
    expect(r.s3).toBeLessThan(r.s2);
    expect(r.s1hc).toBeLessThan(r.s1);
});

test('SaveSystem: поля достижений — дефолты и валидация', async ({ page }) => {
    const r = await page.evaluate(() => {
        const v = (obj) => SaveSystem._validate(Object.assign(SaveSystem.defaults(), obj));
        const d = SaveSystem.defaults();
        return {
            defAch: Array.isArray(d.achUnlocked) && d.achUnlocked.length === 0,
            defKills: d.lifetimeKills,
            defRuns: d.lifetimeRuns,
            badAch: JSON.stringify(v({ achUnlocked: 'nope' }).achUnlocked),
            dedup: JSON.stringify(v({ achUnlocked: ['a', 'a', 'b', 5] }).achUnlocked),
            killsNeg: v({ lifetimeKills: -10 }).lifetimeKills,
            killsFloor: v({ lifetimeKills: 12.9 }).lifetimeKills,
        };
    });
    expect(r.defAch).toBe(true);
    expect(r.defKills).toBe(0);
    expect(r.defRuns).toBe(0);
    expect(r.badAch).toBe('[]');
    expect(r.dedup).toBe('["a","b"]');
    expect(r.killsNeg).toBe(0);
    expect(r.killsFloor).toBe(12);
});

test('SaveSystem.applyCloudMeta: слияние достижений (union/max)', async ({ page }) => {
    const r = await page.evaluate(() => {
        const data = Object.assign(SaveSystem.defaults(), { achUnlocked: ['a', 'b'], lifetimeKills: 500, lifetimeRuns: 10 });
        SaveSystem.applyCloudMeta(data, { achUnlocked: ['b', 'c'], lifetimeKills: 300, lifetimeRuns: 40 });
        return {
            ach: JSON.stringify(data.achUnlocked.slice().sort()),
            kills: data.lifetimeKills,
            runs: data.lifetimeRuns,
        };
    });
    expect(r.ach).toBe('["a","b","c"]');
    expect(r.kills).toBe(500); // max(500, 300)
    expect(r.runs).toBe(40);   // max(10, 40)
});
