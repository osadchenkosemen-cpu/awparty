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

    // Топ N по времени (desc) для режима mode ('normal'|'hardcore').
    // cb(entries|null) — null при ошибке/оффлайне. entries: [{ name, time, day, month, year }].
    fetchTop(limit, mode, cb) {
        if (!this.configured()) { cb(null); return; }
        const url = SUPABASE_URL + '/rest/v1/leaderboard'
            + '?select=name,time,created_at&mode=eq.' + encodeURIComponent(mode || 'normal')
            + '&order=time.desc&limit=' + limit;
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

    // Занят ли ник. cb(true|false|null) — null при ошибке/оффлайне/без конфига.
    nameTaken(name, cb) {
        if (!this.configured()) { cb(null); return; }
        const url = SUPABASE_URL + '/rest/v1/leaderboard'
            + '?select=name&name=eq.' + encodeURIComponent(name) + '&limit=1';
        fetch(url, { headers: this._headers() })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(rows => cb(rows.length > 0))
            .catch(() => cb(null));
    },

    // Отправить результат через RPC submit_score: одна запись на игрока в режиме mode, хранит лучшее время.
    submit(name, time, mode, cb) {
        if (!this.configured()) { if (cb) cb(false); return; }
        fetch(SUPABASE_URL + '/rest/v1/rpc/submit_score', {
            method: 'POST',
            headers: Object.assign(this._headers(), { 'Prefer': 'return=minimal' }),
            body: JSON.stringify({ p_name: name, p_time: time, p_mode: mode || 'normal' }),
        })
            .then(r => { if (cb) cb(r.ok); })
            .catch(() => { if (cb) cb(false); });
    },
};
