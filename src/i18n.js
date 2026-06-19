// i18n — локализация интерфейса (English / Русский).
// Глобальная функция t(key) возвращает строку (или массив) для текущего языка
// с откатом на английский, затем на сам ключ. Язык хранится в save.language.
//
// ВАЖНО: шрифт Orbitron не содержит кириллицы — русские глифы рисуются запасным
// Arial (см. FONT = 'Orbitron, Arial'). Это нормально, просто стиль отличается.

const I18N = {
    en: {
        // --- Главное меню ---
        menu_play: 'Play',
        menu_records: 'Records',
        menu_settings: 'Settings',

        // --- Хаб ---
        lobby_hub: 'HUB',
        lobby_start: 'START RUN',
        lobby_shop: 'UPGRADES & SHOP',
        lobby_back: 'Back to Menu',

        // --- Настройки ---
        set_hardcore: 'Hardcore Mode',
        set_fps: 'FPS Limit',
        set_window: 'Window Mode',
        set_sound: 'Sound',
        set_effects: 'Effects',
        set_language: 'Language',
        set_rename: 'Rename Player',
        on: 'ON',
        off: 'OFF',
        fps_uncapped: 'UNCAPPED',
        win_full: 'FULLSCREEN',
        win_windowed: 'WINDOWED',
        not_set: '(not set)',
        back: 'Back',
        lang_en: 'English',
        lang_ru: 'Русский',
        cheat_gave: 'Gave 500 coins',
        cheat_noname: 'No player name yet — set one by scoring first',

        // --- Таблица рекордов ---
        lb_title: 'RECORDS',
        lb_hardcore: 'HARDCORE',
        lb_normal: 'NORMAL',
        lb_col_num: '#',
        lb_col_name: 'NAME',
        lb_col_time: 'TIME',
        lb_col_date: 'DATE',
        lb_hint_switch: '<  /  >   -   Normal / Hardcore',
        lb_hint_back: '[ ESC / ENTER  -  Back ]',

        // --- Пауза ---
        pause_title: 'PAUSED',
        pause_resume: 'Resume',
        pause_restart: 'Restart',
        pause_quit: 'Quit to Hub',

        // --- Конец игры ---
        gameover: "GAME OVER\nPress 'R' to Restart\nPress 'Q' for Hub",
        gameover_records: 'L  -  View Records',

        // --- Ввод имени (новый рекорд) ---
        name_new_record: 'NEW RECORD!',
        name_time: 'Time Survived:',
        name_enter: 'Enter your name:',
        name_hint: 'ENTER  -  Confirm        BACKSPACE  -  Erase',
        err_enter_name: 'Enter a name',
        err_name_taken: 'Name is taken',

        // --- Смена имени ---
        rename_title: 'RENAME PLAYER',
        rename_current: 'Current name:',
        rename_new: 'New name:',
        rename_saving: 'Saving...',
        rename_merge_note: 'Merges leaderboard records, keeps your best time per mode.',
        rename_hint: 'ENTER  -  Confirm        ESC  -  Cancel',
        err_server: 'Server error, try again',

        // --- Повышение уровня / способности ---
        levelup: 'LEVEL UP!',
        ability_choose: 'CHOOSE AN ABILITY',
        cooldown: 'Cooldown',
        ability_desc_0: 'Become invulnerable\nfor 2 seconds.',
        ability_desc_1: 'Slam the ground to\ndamage and knock back\nnearby enemies.',
        ability_desc_2: 'Unleash 12 vinyl discs\nin all directions.',
        ability_desc_3: 'Fire a piercing laser\nbeam toward the cursor.',

        // --- Тосты апгрейдов над игроком ---
        upgrade_toasts: ['UPGRADE: Fire Rate +', 'UPGRADE: Damage +', 'UPGRADE: Speed +', 'UPGRADE: Magnet +', 'UPGRADE: Max HP +1', 'UNLOCKED: Blademail', 'UNLOCKED: Pierce Shot'],

        // --- Апгрейды (карточки level up) ---
        upgrade_titles: ['FAST TRIGGER', 'BRUTE FORCE', 'RUNNER', 'MAGNETISM', 'HEALTH UP', 'BLADEMAIL', 'PIERCE SHOT'],
        upgrade_descs: [
            'Increases firing\nspeed.',
            'Increases bullet\ndamage.',
            'Increases movement\nspeed.',
            'Increases pickup\nradius.',
            'Increases Max HP\nby 10.',
            'Enemies that hit you\ntake damage back.',
            'Bullets pierce 1 enemy,\n-50% dmg to the next.',
        ],

        // --- Бейдж легендарной карточки ---
        card_legendary: '★ LEGENDARY ★',

        // --- Способности ---
        ability_names: ['INVINCIBILITY', 'GROUND SLAM', 'DISC STORM', 'LASER'],

        // --- Магазин: дерево навыков ---
        shop_skilltree: 'SKILL TREE',
        shop_artifacts: 'ARTIFACTS',
        shop_coins: 'Coins',
        shop_slots: 'SLOTS',
        shop_back: '[ ESC  -  Back ]',
        shop_max: 'MAX',
        shop_lv: 'Lv',
        shop_locked: 'LOCKED',
        shop_unequip: 'UNEQUIP',
        shop_active: 'ACTIVE',
        shop_equip: 'EQUIP',
        shop_owned: 'OWNED',
        shop_slots_full: 'SLOTS FULL',
        branch_names: ['ATTACK', 'SURVIVAL', 'MOBILITY'],
        node_titles: [
            ['DAMAGE', 'CRIT CHANCE', 'MULTISHOT'],
            ['MAX HP', 'REGEN', 'ARMOR'],
            ['SPEED', 'DASH', 'MAGNET'],
        ],
        node_descs: [
            ['Attack power +1', '+5% crit chance', 'Every 8th shot +1'],
            ['Max HP +10', 'Heal 10 HP over time', '-20% damage / lvl'],
            ['Move speed +10', 'Unlock/upgrade dash', 'Pickup radius +50'],
        ],

        // --- Артефакты (названия/описания; стоимость — в constants.js) ---
        artifact_names: ['BLOOD PACT', 'GLASS CANNON', 'ECHO CHAMBER', 'SOUL LEECH', 'BERSERKER', 'IRON SKIN', 'MAGNET CORE'],
        artifact_descs: [
            'Kill heals 2 HP',
            '+30% dmg, Max HP -20',
            'Bullets ricochet off walls',
            '+0.5% crit/kill  (max +5%)',
            'HP<=40%: dmg x1.5, no dash slow',
            'First 3 hits/run blocked',
            'Infinite pickup range',
        ],

        // --- HUD / игровой процесс ---
        hud_lvl: 'LVL',
        hud_hp: 'HP',
        boss_name: 'THE OVERSEER',
        boss2_name: 'BASS DROP',
        boss3_name: 'STROBE',
        phase: 'PHASE',
        clear_all: 'CLEAR ALL ENEMIES',

        // --- Пауза (статы/билд) и итоги забега ---
        pause_stats: 'STATS',
        pause_build: 'BUILD',
        stat_damage: 'Damage',
        stat_firerate: 'Fire rate',
        stat_speed: 'Speed',
        stat_crit: 'Crit',
        stat_hp: 'Max HP',
        stat_armor: 'Armor',
        stat_magnet: 'Pickup',
        stat_dash: 'Dash',
        build_cards: 'Cards',
        build_abilities: 'Abilities',
        build_artifacts: 'Artifacts',
        build_none: '—',
        summary_title: 'RUN SUMMARY',
        summary_time: 'Time',
        summary_level: 'Level',
        summary_kills: 'Kills',
        summary_coins: 'Coins',
        gameover_title: 'GAME OVER',
        gameover_hint: 'R  -  Restart        Q  -  Hub',

        // --- Облачное восстановление прогресса ---
        set_cloud: 'Cloud Restore',
        cloud_title: 'CLOUD RESTORE',
        cloud_enter_nick: 'Enter your nick to restore progress:',
        cloud_warn: 'Backup is keyed by nick only (no password).',
        cloud_loading: 'Loading...',
        cloud_restored: 'Progress restored!',
        cloud_notfound: 'No backup found for this nick',
        cloud_offline: 'Cloud not available',
        cloud_hint: 'ENTER  -  Restore        ESC  -  Cancel',

        // --- Сброс персонажа (кнопка в настройках) ---
        set_reset: 'Reset Character',
        reset_confirm: 'Click again to reset',
        reset_done: 'Character reset (name kept)',
    },

    ru: {
        // --- Главное меню ---
        menu_play: 'Играть',
        menu_records: 'Рекорды',
        menu_settings: 'Настройки',

        // --- Хаб ---
        lobby_hub: 'ХАБ',
        lobby_start: 'НАЧАТЬ ЗАБЕГ',
        lobby_shop: 'УЛУЧШЕНИЯ И МАГАЗИН',
        lobby_back: 'Назад в меню',

        // --- Настройки ---
        set_hardcore: 'Хардкор',
        set_fps: 'Лимит FPS',
        set_window: 'Режим окна',
        set_sound: 'Музыка',
        set_effects: 'Эффекты',
        set_language: 'Язык',
        set_rename: 'Сменить имя',
        on: 'ВКЛ',
        off: 'ВЫКЛ',
        fps_uncapped: 'БЕЗ ЛИМИТА',
        win_full: 'ПОЛНЫЙ ЭКРАН',
        win_windowed: 'В ОКНЕ',
        not_set: '(не задано)',
        back: 'Назад',
        lang_en: 'English',
        lang_ru: 'Русский',
        cheat_gave: 'Получено 500 монет',
        cheat_noname: 'Имени пока нет — сначала установите рекорд',

        // --- Таблица рекордов ---
        lb_title: 'РЕКОРДЫ',
        lb_hardcore: 'ХАРДКОР',
        lb_normal: 'ОБЫЧНЫЙ',
        lb_col_num: '#',
        lb_col_name: 'ИМЯ',
        lb_col_time: 'ВРЕМЯ',
        lb_col_date: 'ДАТА',
        lb_hint_switch: '<  /  >   -   Обычный / Хардкор',
        lb_hint_back: '[ ESC / ENTER  -  Назад ]',

        // --- Пауза ---
        pause_title: 'ПАУЗА',
        pause_resume: 'Продолжить',
        pause_restart: 'Заново',
        pause_quit: 'Выйти в хаб',

        // --- Конец игры ---
        gameover: 'ИГРА ОКОНЧЕНА\nНажми «R» — заново\nНажми «Q» — в хаб',
        gameover_records: 'L  -  Посмотреть рекорды',

        // --- Ввод имени (новый рекорд) ---
        name_new_record: 'НОВЫЙ РЕКОРД!',
        name_time: 'Продержался:',
        name_enter: 'Введите имя:',
        name_hint: 'ENTER  -  Подтвердить        BACKSPACE  -  Стереть',
        err_enter_name: 'Введите имя',
        err_name_taken: 'Имя занято',

        // --- Смена имени ---
        rename_title: 'СМЕНА ИМЕНИ',
        rename_current: 'Текущее имя:',
        rename_new: 'Новое имя:',
        rename_saving: 'Сохранение...',
        rename_merge_note: 'Объединяет рекорды, сохраняя лучшее время в каждом режиме.',
        rename_hint: 'ENTER  -  Подтвердить        ESC  -  Отмена',
        err_server: 'Ошибка сервера, попробуйте снова',

        // --- Повышение уровня / способности ---
        levelup: 'НОВЫЙ УРОВЕНЬ!',
        ability_choose: 'ВЫБЕРИТЕ СПОСОБНОСТЬ',
        cooldown: 'Перезарядка',
        ability_desc_0: 'Неуязвимость\nна 2 секунды.',
        ability_desc_1: 'Удар по земле:\nурон и отбрасывание\nближних врагов.',
        ability_desc_2: 'Выпустить 12 дисков\nво все стороны.',
        ability_desc_3: 'Выпустить пробивающий\nлуч в сторону курсора.',

        // --- Тосты апгрейдов над игроком ---
        upgrade_toasts: ['УЛУЧШЕНИЕ: Скорострельность +', 'УЛУЧШЕНИЕ: Урон +', 'УЛУЧШЕНИЕ: Скорость +', 'УЛУЧШЕНИЕ: Магнит +', 'УЛУЧШЕНИЕ: Макс. HP +1', 'ОТКРЫТО: Блейдмейл', 'ОТКРЫТО: Прострел'],

        // --- Апгрейды (карточки level up) ---
        upgrade_titles: ['БЫСТРЫЙ КУРОК', 'ГРУБАЯ СИЛА', 'БЕГУН', 'МАГНЕТИЗМ', 'ПРИБАВКА HP', 'БЛЕЙДМЕЙЛ', 'ПРОСТРЕЛ'],
        upgrade_descs: [
            'Повышает скорость\nстрельбы.',
            'Повышает урон\nпуль.',
            'Повышает скорость\nпередвижения.',
            'Повышает радиус\nподбора.',
            'Повышает макс. HP\nна 10.',
            'Враг получает урон,\nкогда бьёт вас.',
            'Пуля пробивает врага,\n-50% урона следующему.',
        ],

        // --- Бейдж легендарной карточки ---
        card_legendary: '★ ЛЕГЕНДАРНАЯ ★',

        // --- Способности ---
        ability_names: ['НЕУЯЗВИМОСТЬ', 'УДАР ОЗЕМЬ', 'ВИХРЬ ДИСКОВ', 'ЛАЗЕР'],

        // --- Магазин: дерево навыков ---
        shop_skilltree: 'ДЕРЕВО НАВЫКОВ',
        shop_artifacts: 'АРТЕФАКТЫ',
        shop_coins: 'Монеты',
        shop_slots: 'СЛОТЫ',
        shop_back: '[ ESC  -  Назад ]',
        shop_max: 'МАКС',
        shop_lv: 'LVL',
        shop_locked: 'ЗАКРЫТО',
        shop_unequip: 'СНЯТЬ',
        shop_active: 'АКТИВЕН',
        shop_equip: 'НАДЕТЬ',
        shop_owned: 'КУПЛЕНО',
        shop_slots_full: 'НЕТ СЛОТОВ',
        branch_names: ['АТАКА', 'ВЫЖИВАНИЕ', 'МОБИЛЬНОСТЬ'],
        node_titles: [
            ['УРОН', 'ШАНС КРИТА', 'МУЛЬТИВЫСТРЕЛ'],
            ['МАКС. HP', 'РЕГЕН', 'БРОНЯ'],
            ['СКОРОСТЬ', 'РЫВОК', 'МАГНИТ'],
        ],
        node_descs: [
            ['Сила атаки +1', '+5% к шансу крита', 'Каждый 8-й выстрел +1'],
            ['Макс. HP +10', 'Лечит 10 HP со временем', '-20% урона / LVL'],
            ['Скорость +10', 'Открыть/улучшить рывок', 'Радиус подбора +50'],
        ],

        // --- Артефакты ---
        artifact_names: ['КРОВАВЫЙ ПАКТ', 'СТЕКЛЯННАЯ ПУШКА', 'ЭХО-КАМЕРА', 'ПОЖИРАТЕЛЬ ДУШ', 'БЕРСЕРК', 'ЖЕЛЕЗНАЯ КОЖА', 'МАГНИТНОЕ ЯДРО'],
        artifact_descs: [
            'Убийство лечит 2 HP',
            '+30% урона, макс. HP -20',
            'Пули рикошетят от стен',
            '+0.5% крита/убийство (макс +5%)',
            'HP<=40%: урон x1.5, рывок без замедл.',
            'Первые 3 удара/забег блокируются',
            'Бесконечный радиус подбора',
        ],

        // --- HUD / игровой процесс ---
        hud_lvl: 'LVL',
        hud_hp: 'HP',
        boss_name: 'НАДЗИРАТЕЛЬ',
        boss2_name: 'БАС-ДРОП',
        boss3_name: 'СТРОБ',
        phase: 'ЭТАП',
        clear_all: 'УНИЧТОЖЬТЕ ВСЕХ ВРАГОВ',

        // --- Пауза (статы/билд) и итоги забега ---
        pause_stats: 'СТАТЫ',
        pause_build: 'БИЛД',
        stat_damage: 'Урон',
        stat_firerate: 'Скорострел.',
        stat_speed: 'Скорость',
        stat_crit: 'Крит',
        stat_hp: 'Макс. HP',
        stat_armor: 'Броня',
        stat_magnet: 'Подбор',
        stat_dash: 'Рывок',
        build_cards: 'Карты',
        build_abilities: 'Способности',
        build_artifacts: 'Артефакты',
        build_none: '—',
        summary_title: 'ИТОГИ ЗАБЕГА',
        summary_time: 'Время',
        summary_level: 'Уровень',
        summary_kills: 'Убито',
        summary_coins: 'Монеты',
        gameover_title: 'ИГРА ОКОНЧЕНА',
        gameover_hint: 'R  -  Заново        Q  -  В хаб',

        // --- Облачное восстановление прогресса ---
        set_cloud: 'Восстановить из облака',
        cloud_title: 'ВОССТАНОВЛЕНИЕ ИЗ ОБЛАКА',
        cloud_enter_nick: 'Введите ник для восстановления прогресса:',
        cloud_warn: 'Бэкап привязан только к нику (без пароля).',
        cloud_loading: 'Загрузка...',
        cloud_restored: 'Прогресс восстановлён!',
        cloud_notfound: 'Бэкап для этого ника не найден',
        cloud_offline: 'Облако недоступно',
        cloud_hint: 'ENTER  -  Восстановить        ESC  -  Отмена',

        // --- Сброс персонажа (кнопка в настройках) ---
        set_reset: 'Сбросить персонажа',
        reset_confirm: 'Нажми ещё раз для сброса',
        reset_done: 'Персонаж сброшен (имя сохранено)',
    },
};

// Текущий язык. Инициализируется из save в scene.create через setLanguage().
let I18N_LANG = 'en';

// Допустимый код языка ('en'|'ru'), иначе 'en'.
function normLang(code) { return I18N[code] ? code : 'en'; }

// Определить язык по браузеру при первом запуске (нет сохранённого выбора).
function detectLang() {
    try {
        const l = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (l.indexOf('ru') === 0) return 'ru';
    } catch (e) {}
    return 'en';
}

function setLanguage(code) { I18N_LANG = normLang(code); }

// Перевод по ключу. Откат: текущий язык -> en -> сам ключ.
function t(key) {
    const cur = I18N[I18N_LANG] || I18N.en;
    let v = cur[key];
    if (v === undefined) v = I18N.en[key];
    return v === undefined ? key : v;
}
