
const SAVE_KEY = 'awparty_save';
const LB_KEY = 'awparty_leaderboard_v3';
const LB_KEY_HC = 'awparty_leaderboard_hc_v3';
const LB_KEY_PREFIX = 'awparty_lb_v4_';

const SaveSystem = {
    defaults() {
        return {
            totalCoins: 0,
            isHardcoreMode: false,
            isFullscreen: false,
            soundVolume: 40,
            effectsVolume: 60,
            playerName: '',
            language: detectLang(),
            permMaxHp: 100,
            permDamage: 1,
            permSpeed: 220,
            permDashLevel: 1,   // дэш доступен со старта (ур.1); в магазине только прокачка 2..5
            permCritChance: 0,
            permRegen: 0,
            permArmor: 0,
            permMagnet: 0,
            permMultishot: 0,
            permArtifacts: 0,
            permActiveArtifacts: 0,
            maxChapterUnlocked: 1,
            achUnlocked: [],
            lifetimeKills: 0,
            lifetimeRuns: 0,
        };
    },

    load() {
        const d = this.defaults();
        let raw = null;
        try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
        if (!raw) return d;
        let b;
        try { b = JSON.parse(raw); } catch (e) { return d; }
        return Object.assign(d, this._validate(b));
    },

    _validate(b) {
        if (!(b.soundVolume >= 0 && b.soundVolume <= 100)) b.soundVolume = 40;
        if (!(b.effectsVolume >= 0 && b.effectsVolume <= 100)) b.effectsVolume = 60;
        if (typeof b.playerName !== 'string') b.playerName = '';
        else b.playerName = b.playerName.slice(0, 20);
        if (b.language !== 'en' && b.language !== 'ru') b.language = detectLang();

        const numClamp = (v, lo, hi, def) => (Number.isFinite(v) ? clamp(v, lo, hi) : def);

        b.totalCoins = Number.isFinite(b.totalCoins) ? clamp(Math.floor(b.totalCoins), 0, 1e12) : 0;

        b.permMaxHp = Math.round(numClamp(b.permMaxHp, 100, 170, 100));
        b.permDamage = numClamp(b.permDamage, 1, 10, 1);
        b.permSpeed = numClamp(b.permSpeed, 220, 270, 220);
        b.permDashLevel = numClamp(b.permDashLevel, 1, 5, 1);  // мин.1: старым сейвам с 0 даёт дэш
        b.permCritChance = numClamp(b.permCritChance, 0, 5, 0);
        b.permRegen = numClamp(b.permRegen, 0, 3, 0);
        b.permArmor = numClamp(b.permArmor, 0, 2, 0);
        b.permMagnet = numClamp(b.permMagnet, 0, 3, 0);
        b.permMultishot = numClamp(b.permMultishot, 0, 1, 0);
        b.permArtifacts = Math.floor(numClamp(b.permArtifacts, 0, 127, 0));
        b.maxChapterUnlocked = numClamp(b.maxChapterUnlocked, 1, 3, 1);
        if (!Number.isFinite(b.permActiveArtifacts)) b.permActiveArtifacts = 0;
        else b.permActiveArtifacts = Math.floor(b.permActiveArtifacts) & 127;

        b.permActiveArtifacts &= b.permArtifacts;
        let activeCnt = 0;
        for (let bit = 0; bit < 7; bit++) {
            if ((b.permActiveArtifacts >> bit) & 1) {
                if (activeCnt >= 3) b.permActiveArtifacts &= ~(1 << bit);
                else activeCnt++;
            }
        }

        b.achUnlocked = Array.isArray(b.achUnlocked) ? b.achUnlocked.filter((x) => typeof x === 'string') : [];
        b.achUnlocked = b.achUnlocked.filter((x, i) => b.achUnlocked.indexOf(x) === i); // дедуп
        b.lifetimeKills = Math.floor(numClamp(b.lifetimeKills, 0, 1e12, 0));
        b.lifetimeRuns = Math.floor(numClamp(b.lifetimeRuns, 0, 1e9, 0));
        return b;
    },

    save(data) {
        const blob = {
            totalCoins: data.totalCoins,
            isHardcoreMode: data.isHardcoreMode,
            isFullscreen: data.isFullscreen,
            soundVolume: data.soundVolume,
            effectsVolume: data.effectsVolume,
            playerName: data.playerName,
            language: data.language,
            permMaxHp: data.permMaxHp,
            permDamage: data.permDamage,
            permSpeed: data.permSpeed,
            permDashLevel: data.permDashLevel,
            permCritChance: data.permCritChance,
            permRegen: data.permRegen,
            permArmor: data.permArmor,
            permMagnet: data.permMagnet,
            permMultishot: data.permMultishot,
            permArtifacts: data.permArtifacts,
            permActiveArtifacts: data.permActiveArtifacts,
            maxChapterUnlocked: data.maxChapterUnlocked,
            achUnlocked: data.achUnlocked,
            lifetimeKills: data.lifetimeKills,
            lifetimeRuns: data.lifetimeRuns,
        };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(blob)); } catch (e) {}
    },

    resetProgress(data) {
        const d = this.defaults();
        data.totalCoins = 0;
        data.permMaxHp = d.permMaxHp;
        data.permDamage = d.permDamage;
        data.permSpeed = d.permSpeed;
        data.permDashLevel = d.permDashLevel;  // дэш остаётся (ур.1), сбросом не отнимается
        data.permCritChance = 0;
        data.permRegen = 0;
        data.permArmor = 0;
        data.permMagnet = 0;
        data.permMultishot = 0;
        data.permArtifacts = 0;
        data.permActiveArtifacts = 0;
        data.maxChapterUnlocked = 1;
        return data;
    },

    META_FIELDS: [
        'totalCoins', 'permMaxHp', 'permDamage', 'permSpeed', 'permDashLevel',
        'permCritChance', 'permRegen', 'permArmor', 'permMagnet', 'permMultishot',
        'permArtifacts', 'permActiveArtifacts', 'maxChapterUnlocked',
        'achUnlocked', 'lifetimeKills', 'lifetimeRuns',
    ],

    cloudBlob(data) {
        const out = {};
        for (const f of this.META_FIELDS) out[f] = data[f];
        return out;
    },

    applyCloudMeta(data, blob) {
        if (!blob || typeof blob !== 'object') return false;
        // Локальные значения ачивок/счётчиков — для слияния (не перезаписи).
        const localAch = Array.isArray(data.achUnlocked) ? data.achUnlocked.slice() : [];
        const localKills = Number.isFinite(data.lifetimeKills) ? data.lifetimeKills : 0;
        const localRuns = Number.isFinite(data.lifetimeRuns) ? data.lifetimeRuns : 0;
        const tmp = Object.assign(this.defaults(), data);
        for (const f of this.META_FIELDS) if (blob[f] !== undefined) tmp[f] = blob[f];
        // Ачивки/счётчики синкаются слиянием, чтобы не терять прогресс между устройствами:
        // achUnlocked = объединение, счётчики = max. Дедуп массива делает _validate.
        const cloudAch = Array.isArray(blob.achUnlocked) ? blob.achUnlocked : [];
        tmp.achUnlocked = localAch.concat(cloudAch);
        tmp.lifetimeKills = Math.max(localKills, Number.isFinite(blob.lifetimeKills) ? blob.lifetimeKills : 0);
        tmp.lifetimeRuns = Math.max(localRuns, Number.isFinite(blob.lifetimeRuns) ? blob.lifetimeRuns : 0);
        const validated = this._validate(tmp);
        for (const f of this.META_FIELDS) data[f] = validated[f];
        return true;
    },

    loadLeaderboard(mode, chapter) {
        mode = mode || 'normal'; chapter = chapter || 1;
        const empty = [];
        for (let i = 0; i < 10; i++) empty.push(lbEmptyEntry());
        let raw = null;
        try { raw = localStorage.getItem(LB_KEY_PREFIX + mode + '_' + chapter); } catch (e) { raw = null; }
        if (!raw && chapter === 1) {
            try { raw = localStorage.getItem(mode === 'hardcore' ? LB_KEY_HC : LB_KEY); } catch (e) { raw = null; }
        }
        if (!raw) return empty;
        try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return empty;
            for (let i = 0; i < 10; i++) if (arr[i]) empty[i] = arr[i];
            return empty;
        } catch (e) { return empty; }
    },

    saveLeaderboard(lb, mode, chapter) {
        mode = mode || 'normal'; chapter = chapter || 1;
        try { localStorage.setItem(LB_KEY_PREFIX + mode + '_' + chapter, JSON.stringify(lb)); } catch (e) {}
    },
};
