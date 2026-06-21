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
        // Рекорд пишется ТОЛЬКО при прохождении главы (портал). Смерть после 1-го босса лишь
        // даёт закрепить ник (для будущих забегов), если его ещё нет. Результат НЕ отправляем.
        if (this._firstBossKilled && !this.save.playerName) {
            this._nameClaimOnly = true;
            this.nameInput = '';
            this._nameError = '';
            this.setState(GameState.NAME_INPUT);
            return;
        }
        this.rebuildMenu();
    }

    // Записать результат прохождения главы (вызывается только из портала). Кладёт в доску
    // (currentChapter, mode) локально и онлайн, запрашивает глобальное место и уходит на итоги.
MainScene.prototype._submitChapterResult = function(name) {
        const mode = this._runMode(), chapter = this.currentChapter;
        name = (name || '').trim() || 'Anonymous';
        if (name !== 'Anonymous') { this.save.playerName = name; this.saveGame(); } // запоминаем ник
        this.tryAddToLeaderboard(this.runScore, this.survivalTimer, name, mode, chapter); // локальный кэш/фолбэк
        // Общий рейтинг: одна запись на игрока в (mode, chapter), хранит лучший результат.
        RemoteLeaderboard.submit(name, this.runScore, this.survivalTimer, mode, chapter, null);
        // Глобальное место: придёт асинхронно, на STAGE_CLEAR обновим строку «Ваше место».
        this._lastRank = null;
        RemoteLeaderboard.fetchRank(chapter, mode, this.survivalTimer, this.runScore, name, (rank) => {
            this._lastRank = rank;
            if (this.currentState === GameState.STAGE_CLEAR) this.rebuildMenu();
        });
        this.setState(GameState.STAGE_CLEAR);
    }

MainScene.prototype._confirmNameInput = function() {
        const typed = this.nameInput.trim();
        if (!typed) { this._nameError = t('err_enter_name'); this.rebuildMenu(); return; }
        // Ник должен быть свободен (одна запись на игрока).
        RemoteLeaderboard.nameTaken(typed, (taken) => {
            const isTaken = (taken === null) ? this._nameTakenLocally(typed) : taken;
            if (isTaken) {
                this._nameError = t('err_name_taken');
                if (this.currentState === GameState.NAME_INPUT) this.rebuildMenu();
                return;
            }
            this.save.playerName = typed; this.saveGame(); // закрепляем ник во всех ветках
            if (this._nameClaimOnly) { // смерть после 1-го босса: только закрепить ник, без записи
                this._nameClaimOnly = false;
                this.audio.play('sfx_menu_click');
                this.setState(GameState.PLAYING); // вернуться на экран Game Over (isGameOver = true)
                return;
            }
            // Прохождение (портал): записать результат + место и уйти на итоги.
            this._pendingPortalSubmit = false;
            this._submitChapterResult(typed);
        });
    }

    // Занят ли ник в любой локальной доске (все главы × режимы).
MainScene.prototype._nameTakenLocally = function(name) {
        for (const mode of ['normal', 'hardcore'])
            for (let c = 1; c <= CHAPTERS.length; c++)
                if ((this.leaderboards[mode][c] || []).some(e => e.name === name)) return true;
        return false;
    }

    // ===================== ТАБЛИЦА РЕКОРДОВ =====================
    // Подтянуть общий топ-10 доски (mode, chapter) из Supabase и обновить экран, если показан.
MainScene.prototype._refreshRemoteLeaderboard = function(mode, chapter) {
        mode = mode || this.lbView; chapter = chapter || this.lbChapter;
        if (!RemoteLeaderboard.configured()) return;
        RemoteLeaderboard.fetchTop(10, mode, chapter, (rows) => {
            if (!rows) return; // ошибка/оффлайн — оставляем локальную таблицу
            const lb = [];
            for (let i = 0; i < 10; i++) lb.push(rows[i] || lbEmptyEntry());
            this.leaderboards[mode][chapter] = lb;
            if (this.lbView === mode && this.lbChapter === chapter) {
                this.leaderboardNewEntryIndex = -1;
                const h = this._pendingHighlight; // имя игрока (одна запись на игрока)
                if (h) for (let i = 0; i < 10; i++) {
                    if (lb[i].name === h) { this.leaderboardNewEntryIndex = i; break; }
                }
                if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
            }
        });
    }

    // Переключить показываемую доску (глава/режим) и подтянуть её.
MainScene.prototype._setLbBoard = function(mode, chapter) {
        if (this.lbView === mode && this.lbChapter === chapter) return;
        this.lbView = mode; this.lbChapter = chapter;
        this._pendingHighlight = null;
        this.leaderboardNewEntryIndex = -1;
        this.audio.play('sfx_menu_click');
        this._refreshRemoteLeaderboard(mode, chapter);
        if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
    }

MainScene.prototype.tryAddToLeaderboard = function(score, time, name, mode, chapter) {
        mode = mode || 'normal'; chapter = chapter || 1;
        let n = name || 'Anonymous';
        if (n.length > 23) n = n.slice(0, 23);
        const d = new Date();
        const entry = { name: n, score, time, day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
        // Действующие записи без пустышек.
        let list = (this.leaderboards[mode][chapter] || []).filter(e => e.score > 0 || e.time > 0);
        // Одна запись на игрока — оставляем лучший результат (время, потом очки).
        const existing = list.find(e => e.name === n);
        if (!existing) list.push(entry);
        else if (lbCompare(entry, existing) < 0) { list = list.filter(e => e.name !== n); list.push(entry); }
        list.sort(lbCompare);
        list = list.slice(0, 10);
        if (this.lbView === mode && this.lbChapter === chapter) this.leaderboardNewEntryIndex = list.findIndex(e => e.name === n);
        while (list.length < 10) list.push(lbEmptyEntry());
        this.leaderboards[mode][chapter] = list;
        SaveSystem.saveLeaderboard(list, mode, chapter);
    }
