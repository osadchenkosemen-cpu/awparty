
MainScene.prototype._runMode = function() { return this.save.isHardcoreMode ? 'hardcore' : 'normal'; }

MainScene.prototype.onPlayerDeath = function() {
        this.isGameOver = true;
        this.audio.play('sfx_player_death', { volume: 0.9 });
        this.saveGame();
        if (this._firstBossKilled && !this.save.playerName) {
            this._nameClaimOnly = true;
            this.nameInput = '';
            this._nameError = '';
            this.setState(GameState.NAME_INPUT);
            return;
        }
        this.rebuildMenu();
    }

MainScene.prototype._submitChapterResult = function(name) {
        const mode = this._runMode(), chapter = this.currentChapter;
        name = (name || '').trim() || 'Anonymous';
        if (name !== 'Anonymous') { this.save.playerName = name; this.saveGame(); }
        this.tryAddToLeaderboard(this.runScore, this.survivalTimer, name, mode, chapter);
        RemoteLeaderboard.submit(name, this.runScore, this.survivalTimer, mode, chapter, null);
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
        RemoteLeaderboard.nameTaken(typed, (taken) => {
            const isTaken = (taken === null) ? this._nameTakenLocally(typed) : taken;
            if (isTaken) {
                this._nameError = t('err_name_taken');
                if (this.currentState === GameState.NAME_INPUT) this.rebuildMenu();
                return;
            }
            this.save.playerName = typed; this.saveGame();
            if (this._nameClaimOnly) {
                this._nameClaimOnly = false;
                this.audio.play('sfx_menu_click');
                this.setState(GameState.PLAYING);
                return;
            }
            this._pendingPortalSubmit = false;
            this._submitChapterResult(typed);
        });
    }

MainScene.prototype._nameTakenLocally = function(name) {
        for (const mode of ['normal', 'hardcore'])
            for (let c = 1; c <= CHAPTERS.length; c++)
                if ((this.leaderboards[mode][c] || []).some(e => e.name === name)) return true;
        return false;
    }

MainScene.prototype._refreshRemoteLeaderboard = function(mode, chapter) {
        mode = mode || this.lbView; chapter = chapter || this.lbChapter;
        if (!RemoteLeaderboard.configured()) return;
        const sort = this.lbSort;
        RemoteLeaderboard.fetchTop(10, mode, chapter, sort, (rows) => {
            if (sort !== this.lbSort) return;
            if (!rows) return;                       // ошибка/офлайн → оставить локальную доску как есть
            // Пустой онлайн-ответ (на сервере нет записей этой доски) НЕ должен затирать
            // локальные рекорды: иначе только что заработанный локальный рекорд исчезает с экрана.
            // Перезаписываем онлайн-данными только когда они реально есть (иначе фолбэк на локальные).
            if (rows.length > 0) {
                const lb = [];
                for (let i = 0; i < 10; i++) lb.push(rows[i] || lbEmptyEntry());
                this.leaderboards[mode][chapter] = lb;
            }
            if (this.lbView === mode && this.lbChapter === chapter) {
                this.leaderboardNewEntryIndex = -1;
                const h = this._pendingHighlight;
                const cur = this.leaderboards[mode][chapter] || [];
                if (h) for (let i = 0; i < cur.length; i++) {
                    if (cur[i] && cur[i].name === h) { this.leaderboardNewEntryIndex = i; break; }
                }
                if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
            }
        });
    }

MainScene.prototype._setLbBoard = function(mode, chapter) {
        if (this.lbView === mode && this.lbChapter === chapter) return;
        this.lbView = mode; this.lbChapter = chapter;
        this._pendingHighlight = null;
        this.leaderboardNewEntryIndex = -1;
        this.audio.play('sfx_menu_click');
        this._refreshRemoteLeaderboard(mode, chapter);
        if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
    }

MainScene.prototype._setLbSort = function(sort) {
        if (this.lbSort === sort) return;
        this.lbSort = sort;
        this.audio.play('sfx_menu_click');
        this._refreshRemoteLeaderboard(this.lbView, this.lbChapter);
        if (this.currentState === GameState.LEADERBOARD) this.rebuildMenu();
    }

MainScene.prototype.tryAddToLeaderboard = function(score, time, name, mode, chapter) {
        mode = mode || 'normal'; chapter = chapter || 1;
        let n = name || 'Anonymous';
        if (n.length > 23) n = n.slice(0, 23);
        const d = new Date();
        const entry = { name: n, score, time, day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
        let list = (this.leaderboards[mode][chapter] || []).filter(e => e.score > 0 || e.time > 0);
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
