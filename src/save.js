// Сохранения — порт Game::saveGameData/loadGameData и saveLeaderboard/loadLeaderboard.
// В браузере вместо XOR-зашифрованного save.bin используем localStorage (JSON).
// Поля и значения по умолчанию совпадают с C++.

const SAVE_KEY = 'awparty_save';
// v3 — рекорды ранжируются по ВРЕМЕНИ прохождения (быстрее = выше), при равенстве — очки.
// Новый ключ, чтобы старые score-ранжированные записи не смешивались с новой метрикой
// (локальный кэш сбрасывается; общий онлайн-топ подтянется заново при открытии экрана).
const LB_KEY = 'awparty_leaderboard_v3';        // обычный режим
const LB_KEY_HC = 'awparty_leaderboard_hc_v3';  // hardcore

const SaveSystem = {
    // Значения по умолчанию из Game::loadGameData
    defaults() {
        return {
            totalCoins: 0,
            isHardcoreMode: false,
            isFullscreen: false,  // по умолчанию — в окне (WINDOWED)
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
            maxChapterUnlocked: 1,  // макс. открытая глава (1..3); растёт после прохождения
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
        if (!(b.soundVolume >= 0 && b.soundVolume <= 100)) b.soundVolume = 40;
        if (!(b.effectsVolume >= 0 && b.effectsVolume <= 100)) b.effectsVolume = 60;
        if (typeof b.playerName !== 'string') b.playerName = '';
        else b.playerName = b.playerName.slice(0, 20);
        if (b.language !== 'en' && b.language !== 'ru') b.language = detectLang();

        // Числа из недоверенного источника (тампер localStorage или ЧУЖОЙ облачный blob —
        // таблица cloud_saves открыта на запись по нику): приводим к конечному числу и
        // клэмпим в допустимый диапазон, иначе — дефолт. Раньше NaN/строка/огромное число
        // проходили насквозь (например, totalCoins не проверялся вовсе) и ломали сейв.
        const numClamp = (v, lo, hi, def) => (Number.isFinite(v) ? clamp(v, lo, hi) : def);

        // Монеты: целые, неотрицательные, с разумным потолком.
        b.totalCoins = Number.isFinite(b.totalCoins) ? clamp(Math.floor(b.totalCoins), 0, 1e12) : 0;

        // Перм-прокачка: верхние границы совпадают с максимумами магазина (shop.js nodeMaxLevel).
        // Новая шкала HP: база 100, +10 за уровень MAX HP (макс 170). Старые сейвы (3..10) → 100.
        b.permMaxHp = Math.round(numClamp(b.permMaxHp, 100, 170, 100));
        b.permDamage = numClamp(b.permDamage, 1, 10, 1);
        b.permSpeed = numClamp(b.permSpeed, 220, 270, 220);
        b.permDashLevel = numClamp(b.permDashLevel, 0, 5, 0);
        b.permCritChance = numClamp(b.permCritChance, 0, 5, 0);
        b.permRegen = numClamp(b.permRegen, 0, 3, 0);
        b.permArmor = numClamp(b.permArmor, 0, 2, 0);
        b.permMagnet = numClamp(b.permMagnet, 0, 3, 0);
        b.permMultishot = numClamp(b.permMultishot, 0, 1, 0);
        b.permArtifacts = Math.floor(numClamp(b.permArtifacts, 0, 127, 0));
        b.maxChapterUnlocked = numClamp(b.maxChapterUnlocked, 1, 3, 1);
        // Битовая маска активных артефактов — целое в диапазоне (битовые операции ниже закрепят).
        if (!Number.isFinite(b.permActiveArtifacts)) b.permActiveArtifacts = 0;
        else b.permActiveArtifacts = Math.floor(b.permActiveArtifacts) & 127;

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
        };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(blob)); } catch (e) {}
    },

    // Сброс «персонажа»: обнуляет прогресс (монеты, перм-прокачку, артефакты),
    // СОХРАНЯЯ ник, язык и настройки устройства. Мутирует объект на месте, чтобы
    // ссылки (например, shop.s) остались валидными.
    resetProgress(data) {
        const d = this.defaults();
        data.totalCoins = 0;
        data.permMaxHp = d.permMaxHp;   // 100
        data.permDamage = d.permDamage; // 1
        data.permSpeed = d.permSpeed;   // 220
        data.permDashLevel = 0;
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

    // Поля мета-прогресса для облачного бэкапа (без настроек устройства: громкость,
    // FPS, язык, fullscreen — они локальные и не переносятся).
    META_FIELDS: [
        'totalCoins', 'permMaxHp', 'permDamage', 'permSpeed', 'permDashLevel',
        'permCritChance', 'permRegen', 'permArmor', 'permMagnet', 'permMultishot',
        'permArtifacts', 'permActiveArtifacts', 'maxChapterUnlocked',
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

    // Таблица рекордов: массив из 10 записей { name, score, time, day, month, year }.
    // hardcore=true — отдельная таблица для хард-режима.
    loadLeaderboard(hardcore) {
        const key = hardcore ? LB_KEY_HC : LB_KEY;
        const empty = [];
        for (let i = 0; i < 10; i++) empty.push(lbEmptyEntry());
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
