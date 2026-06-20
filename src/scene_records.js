// scene_records.js — рекорды и сетевой слой MainScene (вынесено из scene.js).
// Методы навешиваются на MainScene.prototype (класс объявлен в scene.js, грузится раньше).
// Сюда входят: учёт смерти игрока, отправка/проверка результата, ввод/смена ника,
// подтягивание общего топа из Supabase, локальный кэш таблицы рекордов.

    // Режим текущего забега: в какую таблицу идёт результат.
MainScene.prototype._runMode = function() { return this.save.isHardcoreMode ? 'hardcore' : 'normal'; }

MainScene.prototype.onPlayerDeath = function() {
        this.isGameOver = true;
        this.audio.play('sfx_player_death', { volume: 0.9 });
        this.saveGame();
        // В топ идут ТОЛЬКО прохождения главы (вход в портал, см. _enterPortal), а не смерти:
        // метрика рейтинга — время прохождения, и быстрая смерть не должна попасть наверх.
        // Поэтому здесь результат НЕ отправляем — просто показываем экран Game Over.
        this.rebuildMenu();
    }

    // Записать результат в таблицу режима забега. showBoard=true — открыть её с подсветкой.
MainScene.prototype._submitScore = function(name, showBoard) {
        name = (name || '').trim() || 'Anonymous';
        if (name !== 'Anonymous') { this.save.playerName = name; this.saveGame(); } // запоминаем ник
        const mode = this._runMode();
        this.tryAddToLeaderboard(this.runScore, this.survivalTimer, name, mode); // локальный кэш/фолбэк (дедуп по имени)
        // Общий рейтинг: одна запись на игрока в этом режиме, хранит лучший результат (очки, потом время).
        RemoteLeaderboard.submit(name, this.runScore, this.survivalTimer, mode, () => {
            if (showBoard && this.currentState === GameState.LEADERBOARD) this._refreshRemoteLeaderboard(mode);
        });
        if (showBoard) {
            this.leaderboardFromMenu = false;
            this.lbView = mode; // показываем таблицу того режима, в котором играли
            this._pendingHighlight = name;
            this.audio.play('sfx_menu_click');
            this.setState(GameState.LEADERBOARD);
        }
    }

MainScene.prototype._confirmNameInput = function() {
        const typed = this.nameInput.trim();
        if (!typed) { this._nameError = t('err_enter_name'); this.rebuildMenu(); return; }
        // Ник должен быть свободен (одна запись на игрока).
        RemoteLeaderboard.nameTaken(typed, (taken) => {
            // null = оффлайн/без конфига: проверяем по обеим локальным таблицам.
            const localTaken = this.leaderboards.normal.some(e => e.name === typed) || this.leaderboards.hardcore.some(e => e.name === typed);
            const isTaken = (taken === null) ? localTaken : taken;
            if (isTaken) {
                this._nameError = t('err_name_taken');
                if (this.currentState === GameState.NAME_INPUT) this.rebuildMenu();
                return;
            }
            // Ник из портала: тихо записываем результат и возвращаемся к итогам 3 этапов.
            if (this._stageClearAfterName) {
                this._stageClearAfterName = false;
                this._submitScore(typed, false);
                this.setState(GameState.STAGE_CLEAR);
                return;
            }
            this._submitScore(typed, true);
        });
    }

    // ===================== ТАБЛИЦА РЕКОРДОВ =====================
    // Подтянуть общий топ-10 режима mode из Supabase и обновить экран, если он сейчас показан.
MainScene.prototype._refreshRemoteLeaderboard = function(mode) {
        mode = mode || this.lbView;
        if (!RemoteLeaderboard.configured()) return;
        RemoteLeaderboard.fetchTop(10, mode, (rows) => {
            if (!rows) return; // ошибка/оффлайн — оставляем локальную таблицу
            const lb = [];
            for (let i = 0; i < 10; i++) lb.push(rows[i] || lbEmptyEntry());
            this.leaderboards[mode] = lb;
            if (this.lbView === mode) {
                this.leaderboardNewEntryIndex = -1;
                const h = this._pendingHighlight; // имя игрока (одна запись на игрока)
                if (h) for (let i = 0; i < 10; i++) {
                    if (lb[i].name === h) { this.leaderboardNewEntryIndex = i; break; }
                }
                if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
            }
        });
    }

    // Переключить показываемую таблицу (normal/hardcore) и подтянуть её.
MainScene.prototype._setLbView = function(mode) {
        if (this.lbView === mode) return;
        this.lbView = mode;
        this._pendingHighlight = null;
        this.leaderboardNewEntryIndex = -1;
        this.audio.play('sfx_menu_click');
        this._refreshRemoteLeaderboard(mode);
        if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
    }

    // Проходит ли результат (score, при равенстве — time) в топ-10 режима.
MainScene.prototype.qualifiesForLeaderboard = function(score, time, mode) {
        const lb = this.leaderboards[mode || 'normal'];
        const cand = { score, time };
        for (let i = 0; i < 10; i++) {
            const e = lb[i];
            if (e.score === 0 && e.time === 0) return true;       // есть свободный слот
            if (lbCompare(cand, e) < 0) return true;              // лучше какой-то записи
        }
        return false;
    }
MainScene.prototype.tryAddToLeaderboard = function(score, time, name, mode) {
        mode = mode || 'normal';
        let n = name || 'Anonymous';
        if (n.length > 23) n = n.slice(0, 23);
        const d = new Date();
        const entry = { name: n, score, time, day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
        // Действующие записи без пустышек.
        let list = this.leaderboards[mode].filter(e => e.score > 0 || e.time > 0);
        // Одна запись на игрока — оставляем лучший результат (очки, потом время).
        const existing = list.find(e => e.name === n);
        if (!existing) list.push(entry);
        else if (lbCompare(entry, existing) < 0) { list = list.filter(e => e.name !== n); list.push(entry); }
        list.sort(lbCompare);
        list = list.slice(0, 10);
        if (this.lbView === mode) this.leaderboardNewEntryIndex = list.findIndex(e => e.name === n);
        while (list.length < 10) list.push(lbEmptyEntry());
        this.leaderboards[mode] = list;
        SaveSystem.saveLeaderboard(list, mode === 'hardcore');
    }
