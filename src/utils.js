// Математические утилиты — порт MathUtils.h + общие хелперы.

function distSq(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
}

function dist(ax, ay, bx, by) {
    return Math.sqrt(distSq(ax, ay, bx, by));
}

// normalize(vec) из MathUtils.h — возвращает {x,y}
function normalize(x, y) {
    const lenSq = x * x + y * y;
    if (lenSq > 1e-8) {
        const len = Math.sqrt(lenSq);
        return { x: x / len, y: y / len };
    }
    return { x, y };
}

// rand() % n — целое от 0 до n-1
function randInt(n) {
    return Math.floor(Math.random() * n);
}

// Сборка цвета 0xRRGGBB из компонентов (для Phaser setTint)
function rgb(r, g, b) {
    return (clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b);
}

function clamp8(v) {
    v = Math.round(v);
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v;
}

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

// Форматирование MM:SS как в Game::update
function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds) % 60;
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return pad(m) + ':' + pad(s);
}
