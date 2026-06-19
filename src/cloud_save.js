// CloudSave — облачный бэкап мета-прогресса по нику через Supabase REST.
// Использует тот же проект/ключ, что и таблица рекордов (config.js).
//
// ⚠️ Модель «по нику, без аутентификации»: кто знает ник, может прочитать и
// перезаписать чужой бэкап. Это сознательный компромисс ради простоты (без логина).
// Защита ключом — возможное улучшение (см. SECURITY.md).
//
// Таблица: public.cloud_saves (name text PK, blob jsonb, updated_at timestamptz).

const CloudSave = {
    configured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },

    _headers() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        };
    },

    // Отправить (upsert) бэкап по нику. cb(ok:boolean).
    push(name, blob, cb) {
        if (!this.configured() || !name) { if (cb) cb(false); return; }
        fetch(SUPABASE_URL + '/rest/v1/cloud_saves', {
            method: 'POST',
            // merge-duplicates => upsert по первичному ключу name (нужен PK/unique на name).
            headers: Object.assign(this._headers(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
            body: JSON.stringify({ name: name, blob: blob, updated_at: new Date().toISOString() }),
        })
            .then(r => { if (cb) cb(r.ok); })
            .catch(() => { if (cb) cb(false); });
    },

    // Загрузить бэкап по нику. cb(result):
    //   объект blob  — найдено;
    //   'NOTFOUND'   — облако доступно, но записи нет;
    //   null         — ошибка/оффлайн/не настроено.
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
