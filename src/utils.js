
function distSq(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
}

function dist(ax, ay, bx, by) {
    return Math.sqrt(distSq(ax, ay, bx, by));
}

function normalize(x, y) {
    const lenSq = x * x + y * y;
    if (lenSq > 1e-8) {
        const len = Math.sqrt(lenSq);
        return { x: x / len, y: y / len };
    }
    return { x, y };
}

function randInt(n) {
    return Math.floor(Math.random() * n);
}

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

function fmtNum(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function lbCompare(a, b) {
    const aEmpty = !((a.time || 0) > 0 || (a.score || 0) > 0);
    const bEmpty = !((b.time || 0) > 0 || (b.score || 0) > 0);
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    if (aEmpty && bEmpty) return 0;
    return (a.time || 0) - (b.time || 0) || (b.score || 0) - (a.score || 0);
}

function lbCompareScore(a, b) {
    const aEmpty = !((a.time || 0) > 0 || (a.score || 0) > 0);
    const bEmpty = !((b.time || 0) > 0 || (b.score || 0) > 0);
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    if (aEmpty && bEmpty) return 0;
    return (b.score || 0) - (a.score || 0) || (a.time || 0) - (b.time || 0);
}

function lbEmptyEntry() {
    return { name: '', score: 0, time: 0, day: 0, month: 0, year: 0 };
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds) % 60;
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return pad(m) + ':' + pad(s);
}
