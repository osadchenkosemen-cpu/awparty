
const RemoteLeaderboard = {
    configured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

    _headers() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        };
    },

    fetchTop(limit, mode, chapter, sort, cb) {
        if (!this.configured()) { cb(null); return; }
        const order = (sort === 'score') ? 'score.desc,time.asc' : 'time.asc,score.desc';
        const url = SUPABASE_URL + '/rest/v1/leaderboard'
            + '?select=name,score,time,created_at&mode=eq.' + encodeURIComponent(mode || 'normal')
            + '&chapter=eq.' + (chapter || 1)
            + '&order=' + order + '&limit=' + limit;
        fetch(url, { headers: this._headers() })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(rows => {
                cb(rows.map(row => {
                    const d = row.created_at ? new Date(row.created_at) : new Date();
                    return {
                        name: row.name || '',
                        score: +row.score || 0,
                        time: +row.time || 0,
                        day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(),
                    };
                }));
            })
            .catch(() => cb(null));
    },

    nameTaken(name, cb) {
        if (!this.configured()) { cb(null); return; }
        const url = SUPABASE_URL + '/rest/v1/leaderboard'
            + '?select=name&name=eq.' + encodeURIComponent(name) + '&limit=1';
        fetch(url, { headers: this._headers() })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(rows => cb(rows.length > 0))
            .catch(() => cb(null));
    },

    submit(name, score, time, mode, chapter, cb) {
        if (!this.configured()) { if (cb) cb(false); return; }
        fetch(SUPABASE_URL + '/rest/v1/rpc/submit_score', {
            method: 'POST',
            headers: Object.assign(this._headers(), { 'Prefer': 'return=minimal' }),
            body: JSON.stringify({ p_name: name, p_score: score, p_time: time, p_mode: mode || 'normal', p_chapter: chapter || 1 }),
        })
            .then(r => { if (cb) cb(r.ok); })
            .catch(() => { if (cb) cb(false); });
    },

    fetchRank(chapter, mode, time, score, name, cb) {
        if (!this.configured()) { cb(null); return; }
        const better = 'or=(time.lt.' + time + ',and(time.eq.' + time + ',score.gt.' + score + '))';
        const url = SUPABASE_URL + '/rest/v1/leaderboard'
            + '?select=name&mode=eq.' + encodeURIComponent(mode || 'normal')
            + '&chapter=eq.' + (chapter || 1)
            + '&name=neq.' + encodeURIComponent(name || '')
            + '&' + better + '&limit=1';
        fetch(url, { headers: Object.assign(this._headers(), { 'Prefer': 'count=exact' }) })
            .then(r => {
                if (!r.ok) return Promise.reject(r.status);
                const cr = r.headers.get('content-range') || '';
                const total = parseInt(cr.split('/')[1], 10);
                cb(isNaN(total) ? null : total + 1);
            })
            .catch(() => cb(null));
    },

    rename(oldName, newName, cb) {
        if (!this.configured()) { if (cb) cb(true); return; }
        fetch(SUPABASE_URL + '/rest/v1/rpc/rename_player', {
            method: 'POST',
            headers: Object.assign(this._headers(), { 'Prefer': 'return=minimal' }),
            body: JSON.stringify({ p_old: oldName, p_new: newName }),
        })
            .then(r => { if (cb) cb(r.ok); })
            .catch(() => { if (cb) cb(false); });
    },
};
