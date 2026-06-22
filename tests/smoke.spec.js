const { test, expect } = require('@playwright/test');

test('boots to MENU without uncaught errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.goto('/index.html');

    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });

    await page.waitForFunction(() => {
        const g = window.__gameRef;
        const scene = g && g.scene && g.scene.scenes && g.scene.scenes[0];
        return scene && scene.currentState === 'MENU';
    }, { timeout: 15000 });

    expect(pageErrors, 'uncaught errors:\n' + pageErrors.join('\n')).toEqual([]);
});

test('runs a PLAYING tick without uncaught errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await page.goto('/index.html');
    await page.waitForFunction(() => {
        const g = window.__gameRef;
        const s = g && g.scene && g.scene.scenes && g.scene.scenes[0];
        return s && s.currentState === 'MENU';
    }, { timeout: 15000 });

    await page.evaluate(() => {
        const s = window.__gameRef.scene.scenes[0];
        s.currentChapter = 1;
        s.resetGame();
        s.setState('PLAYING');
    });
    await page.waitForTimeout(2500);

    const state = await page.evaluate(() => window.__gameRef.scene.scenes[0].currentState);
    expect(['PLAYING', 'LEVEL_UP', 'ABILITY_SELECT']).toContain(state);
    expect(pageErrors, 'uncaught errors:\n' + pageErrors.join('\n')).toEqual([]);
});
