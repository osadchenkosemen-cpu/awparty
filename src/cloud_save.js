
const CloudSave = {
    configured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

    _headers() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        };
    },

    push(name, blob, cb) {
        if (!this.configured() || !name) { if (cb) cb(false); return; }
        fetch(SUPABASE_URL + '/rest/v1/cloud_saves', {
            method: 'POST',
            headers: Object.assign(this._headers(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
            body: JSON.stringify({ name: name, blob: blob, updated_at: new Date().toISOString() }),
        })
            .then(r => { if (cb) cb(r.ok); })
            .catch(() => { if (cb) cb(false); });
    },

    pull(name, cb) {
        if (!this.configured() || !name) { if (cb) cb(null); return; }
        const url = SUPABASE_URL + '/rest/v1/cloud_saves'
            + '?select=blob&name=eq.' + encodeURIComponent(name) + '&limit=1';
        fetch(url, { headers: this._headers() })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(rows => { if (cb) cb(rows.length ? rows[0].blob : 'NOTFOUND'); })
            .catch(() => { if (cb) cb(null); });
    },
};
