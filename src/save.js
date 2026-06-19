// Сохранения — порт Game::saveGameData/loadGameData и saveLeaderboard/loadLeaderboard.
// В браузере вместо XOR-зашифрованного save.bin используем localStorage (JSON).
// Поля и значения по умолчанию совпадают с C++.

const SAVE_KEY = 'awparty_save';
const LB_KEY = 'awparty_leaderboard';        // обычный режим
const LB_KEY_HC = 'awparty_leaderboard_hc';  // hardcore

const SaveSystem = {
    // Значения по умолчанию из Game::loadGameData
    defaults() {
        return {
            totalCoins: 0,
            isHardcoreMode: false,
            currentFpsIndex: 1,
            isFullscreen: true,
            soundVolume: 40,    // громкость музыки, 0..100
            effectsVolume: 60,  // громкость SFX, 0..100
            playerName: '',     // последний введённый ник (подставляется на экране рекорда)
            language: detectLang(), // язык интерфейса 'en'|'ru' (по умолчанию — по языку браузера)
            permMaxHp: 100,
            permDamage: 1,
            permSpeed: 220,
            permDashLevel: 0,
            permCritChance: 0,
            permRegen: 0,
            permArmor: 0,
            permMagnet: 0,
            permMultishot: 0,
            permArtifacts: 0,      // битовая маска купленных (7 бит)
            permActiveArtifacts: 0, // битовая маска активных (макс 3)
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

    // Валидация/клэмпы полей сейва (как в Game::loadGameData). Мутирует и возвращает b.
    // Вынесено отдельно, чтобы переиспользовать при применении облачного бэкапа.
    _validate(b) {
        if (b.currentFpsIndex < 0 || b.currentFpsIndex > 4) b.currentFpsIndex = 1;
        if (!(b.soundVolume >= 0 && b.soundVolume <= 100)) b.soundVolume = 40;
        if (!(b.effectsVolume >= 0 && b.effectsVolume <= 100)) b.effectsVolume = 60;
        if (typeof b.playerName !== 'string') b.playerName = '';
        else b.playerName = b.playerName.slice(0, 20);
        if (b.language !== 'en' && b.language !== 'ru') b.language = detectLang();
        // Новая шкала HP: база 100, +10 за уровень MAX HP (макс 170). Старые сейвы (3..10) обнуляются до 100.
        if (b.permMaxHp < 100) b.permMaxHp = 100;
        if (b.permMaxHp > 170) b.permMaxHp = 170;
        if (b.permDamage < 1) b.permDamage = 1;
        if (b.permSpeed < 220) b.permSpeed = 220;
        if (b.permDashLevel < 0 || b.permDashLevel > 5) b.permDashLevel = 0;
        if (b.permCritChance < 0 || b.permCritChance > 5) b.permCritChance = 0;
        if (b.permRegen < 0 || b.permRegen > 3) b.permRegen = 0;
        if (b.permArmor < 0 || b.permArmor > 2) b.permArmor = 0;
        if (b.permMagnet < 0 || b.permMagnet > 3) b.permMagnet = 0;
        if (b.permMultishot < 0 || b.permMultishot > 1) b.permMultishot = 0;
        if (b.permArtifacts < 0 || b.permArtifacts > 127) b.permArtifacts = 0;

        b.permActiveArtifacts &= b.permArtifacts; // active — подмножество owned
        // Не больше 3 активных
        let activeCnt = 0;
        for (let bit = 0; bit < 7; bit++) {
            if ((b.permActiveArtifacts >> bit) & 1) {
                if (activeCnt >= 3) b.permActiveArtifacts &= ~(1 << bit);
                else activeCnt++;
            }
        }
        return b;
    },

    save(data) {
        const blob = {
            totalCoins: data.totalCoins,
            isHardcoreMode: data.isHardcoreMode,
            currentFpsIndex: data.currentFpsIndex,
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
        };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(blob)); } catch (e) {}
    },

    // Поля мета-прогресса для облачного бэкапа (без настроек устройства: громкость,
    // FPS, язык, fullscreen — они локальные и не переносятся).
    META_FIELDS: [
        'totalCoins', 'permMaxHp', 'permDamage', 'permSpeed', 'permDashLevel',
        'permCritChance', 'permRegen', 'permArmor', 'permMagnet', 'permMultishot',
        'permArtifacts', 'permActiveArtifacts',
    ],

    // Снимок мета-прогресса для отправки в облако.
    cloudBlob(data) {
        const out = {};
        for (const f of this.META_FIELDS) out[f] = data[f];
        return out;
    },

    // Применить облачный блоб к локальному сейву (мутирует на месте). Прогон через
    // load() даёт те же клэмпы/валидацию, что и при обычной загрузке; настройки
    // устройства из локального сейва сохраняются.
    applyCloudMeta(data, blob) {
        if (!blob || typeof blob !== 'object') return false;
        const tmp = Object.assign(this.defaults(), data);
        for (const f of this.META_FIELDS) if (blob[f] !== undefined) tmp[f] = blob[f];
        // Переиспользуем валидацию load(): сериализуем во временное хранилище-клон.
        const validated = this._validate(tmp);
        for (const f of this.META_FIELDS) data[f] = validated[f];
        return true;
    },

    // Таблица рекордов: массив из 10 записей { name, time, day, month, year }.
    // hardcore=true — отдельная таблица для хард-режима.
    loadLeaderboard(hardcore) {
        const key = hardcore ? LB_KEY_HC : LB_KEY;
        const empty = [];
        for (let i = 0; i < 10; i++) empty.push({ name: '', time: 0, day: 0, month: 0, year: 0 });
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
        if (!raw) return empty;
        try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return empty;
            for (let i = 0; i < 10; i++) if (arr[i]) empty[i] = arr[i];
            return empty;
        } catch (e) { return empty; }
    },

    saveLeaderboard(lb, hardcore) {
        const key = hardcore ? LB_KEY_HC : LB_KEY;
        try { localStorage.setItem(key, JSON.stringify(lb)); } catch (e) {}
    },
};
