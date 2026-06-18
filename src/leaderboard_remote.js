// RemoteLeaderboard — общая онлайн-таблица рекордов через Supabase REST API.
// Без библиотек: обычный fetch к /rest/v1/leaderboard.
// Если ключи в config.js не заданы — configured() == false, игра остаётся на localStorage.

const RemoteLeaderboard = {
    configured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

    _headers() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        };
    },

    // Топ N по времени (desc). cb(entries|null) — null при ошибке/оффлайне.
    // entries: [{ name, time, day, month, year }] (дата из created_at).
    fetchTop(limit, cb) {
        if (!this.configured()) { cb(null); return; }
        const url = SUPABASE_URL + '/rest/v1/leaderboard'
            + '?select=name,time,created_at&order=time.desc&limit=' + limit;
        fetch(url, { headers: this._headers() })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(rows => {
                cb(rows.map(row => {
                    const d = row.created_at ? new Date(row.created_at) : new Date();
                    return {
                        name: row.name || '',
                        time: +row.time || 0,
                        day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(),
                    };
                }));
            })
            .catch(() => cb(null));
    },

    // Отправить результат. cb(ok).
    submit(name, time, cb) {
        if (!this.configured()) { if (cb) cb(false); return; }
        fetch(SUPABASE_URL + '/rest/v1/leaderboard', {
            method: 'POST',
            headers: Object.assign(this._headers(), { 'Prefer': 'return=minimal' }),
            body: JSON.stringify({ name: name, time: time }),
        })
            .then(r => { if (cb) cb(r.ok); })
            .catch(() => { if (cb) cb(false); });
    },
};
