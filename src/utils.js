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

// Число с разделителем тысяч (узкий пробел): 12345 -> "12 345".
function fmtNum(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Сравнение записей рекордов: приоритет у ВРЕМЕНИ (меньше = быстрее прошёл = выше),
// при равном времени — у очков (больше = выше). Пустые записи (нет ни времени, ни очков)
// всегда в конце. Для сортировки «лучшие сверху»: list.sort(lbCompare).
function lbCompare(a, b) {
    const aEmpty = !((a.time || 0) > 0 || (a.score || 0) > 0);
    const bEmpty = !((b.time || 0) > 0 || (b.score || 0) > 0);
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1; // непустые — выше пустых
    if (aEmpty && bEmpty) return 0;
    return (a.time || 0) - (b.time || 0) || (b.score || 0) - (a.score || 0);
}

// Сравнение для вида «по очкам»: приоритет ОЧКАМ (больше = выше), при равенстве — время
// (меньше = выше). Пустые записи всегда в конце. Для сортировки «лучшие сверху».
function lbCompareScore(a, b) {
    const aEmpty = !((a.time || 0) > 0 || (a.score || 0) > 0);
    const bEmpty = !((b.time || 0) > 0 || (b.score || 0) > 0);
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    if (aEmpty && bEmpty) return 0;
    return (b.score || 0) - (a.score || 0) || (a.time || 0) - (b.time || 0);
}

// Пустая запись таблицы рекордов.
function lbEmptyEntry() {
    return { name: '', score: 0, time: 0, day: 0, month: 0, year: 0 };
}

// Форматирование MM:SS как в Game::update
function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds) % 60;
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return pad(m) + ':' + pad(s);
}
