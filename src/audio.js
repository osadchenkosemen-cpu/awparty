// AudioManager — централизованное аудио: короткие SFX + фоновая музыка по состоянию.
// Грузится обычным <script>, как остальные модули (глобальный класс).

// Версия аудио-ассетов для анти-кэша. Меняйте при замене любого .wav/.mp3.
const AUDIO_VER = 3;

// Ключ -> файл (лежат в C.ASSET_PATH вместе с текстурами).
const AUDIO_MANIFEST = [
    // SFX
    ['sfx_player_shot', 'player_shot.wav'],
    ['sfx_player_hurt', 'damage_enemy.wav'],   // игрок получает урон
    ['sfx_player_death', 'player_death.wav'],
    ['sfx_boss_death', 'bossdeath.wav'],
    ['sfx_dash', 'dash.wav'],
    ['sfx_slam', 'GroundSlam.wav'],
    ['sfx_levelup', 'lvlup.wav'],
    ['sfx_menu_click', 'menu_click.wav'],      // подтверждение выбора в меню
    ['sfx_skillbought', 'skillbought.wav'],    // покупка в магазине
    ['sfx_boss_warning', 'attention.wav'],     // мерцание экрана перед спавном босса
    // Музыка (зацикленная)
    ['mus_menu', 'sound_menu.wav'],
    ['mus_round', 'soundround.mp3'],
];

class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.sfxVolume = 0.6;
        this.musicVolume = 0.4;        // пользовательская доля 0..1 (из настроек)
        this.musicMaster = 0.3;        // общий «потолок»: 100% настроек = 0.3 реальной громкости
        this.duckFactor = 1;           // приглушение поверх настроек (пауза/левелап)
        this.music = null;
        this.currentMusicKey = null;
        this._pendingMusicKey = null;  // что должно играть (используется до разблокировки звука)
        this._unlockHooked = false;    // повешен ли единственный слушатель UNLOCKED
        this._lastPlay = {};           // ключ -> performance.now() для троттлинга
        this.syncFromSave();
    }

    // Итоговая громкость музыки для Phaser: настройка * «потолок» * приглушение.
    _musicGain() { return this.musicVolume * this.musicMaster * this.duckFactor; }

    // Приглушить/восстановить музыку (f=0..1) вживую, без перезапуска трека.
    setDuck(f) {
        if (this.duckFactor === f) return;
        this.duckFactor = f;
        if (this.music) this.music.setVolume(this._musicGain());
    }

    // Подтянуть громкости из сейва (0..100 -> 0..1) и применить к текущей музыке.
    syncFromSave() {
        const s = this.scene.save;
        if (!s) return;
        if (s.effectsVolume != null) this.sfxVolume = s.effectsVolume / 100;
        if (s.soundVolume != null) this.setMusicVolume(s.soundVolume / 100);
    }

    // Вызывается из preload сцены.
    static preload(loader) {
        loader.setPath(C.ASSET_PATH);
        // ?v=... — анти-кэш: бампайте AUDIO_VER при замене звуковых файлов,
        // иначе браузер отдаст старую версию (имя файла-то прежнее).
        for (const [key, file] of AUDIO_MANIFEST) loader.audio(key, file + '?v=' + AUDIO_VER);
    }

    // Короткий звук. opts: { volume (0..1, доля от sfxVolume), minGap (мс, троттл) }.
    play(key, opts) {
        opts = opts || {};
        if (!this.scene.cache.audio.exists(key)) return;
        if (opts.minGap) {
            const now = performance.now();
            if (this._lastPlay[key] && now - this._lastPlay[key] < opts.minGap) return;
            this._lastPlay[key] = now;
        }
        const vol = (opts.volume == null ? 1 : opts.volume) * this.sfxVolume;
        this.scene.sound.play(key, { volume: vol });
    }

    // Зацикленный SFX (например, сигнал тревоги, пока мерцает экран).
    // Возвращает объект звука — его нужно остановить через stopLoopSfx().
    playLoopSfx(key, opts) {
        opts = opts || {};
        if (!this.scene.cache.audio.exists(key)) return null;
        if (this.scene.sound.locked) return null; // до разблокировки звука не стартуем
        const vol = (opts.volume == null ? 1 : opts.volume) * this.sfxVolume;
        const snd = this.scene.sound.add(key, { loop: true, volume: vol });
        snd.play();
        return snd;
    }

    stopLoopSfx(snd) { if (snd) { snd.stop(); snd.destroy(); } }

    // Мягко завершить зацикленный SFX: плавно увести громкость в ноль твином
    // (durMs), не обрывая звук резко, затем остановить и убрать объект.
    releaseLoopSfx(snd, durMs) {
        if (!snd) return;
        durMs = durMs == null ? 600 : durMs;
        this.scene.tweens.add({
            targets: snd, volume: 0, duration: durMs, ease: 'Linear',
            onComplete: () => { snd.stop(); snd.destroy(); },
        });
    }

    // Какая музыка соответствует игровому состоянию.
    musicForState(st) {
        if (st === GameState.PLAYING || st === GameState.LEVEL_UP ||
            st === GameState.ABILITY_SELECT || st === GameState.PAUSED) {
            return 'mus_round';
        }
        return 'mus_menu'; // MENU / LOBBY / SHOP / SETTINGS / LEADERBOARD
    }

    // Запустить зацикленный трек (no-op, если он уже играет).
    playMusic(key) {
        // Всегда помним последний желаемый трек — на случай ожидания разблокировки.
        this._pendingMusicKey = key;
        // WebAudio до первого жеста заблокирован. Вешаем РОВНО ОДИН слушатель UNLOCKED,
        // иначе на каждый setState копился бы новый и стартовало несколько треков сразу.
        if (this.scene.sound.locked) {
            if (!this._unlockHooked) {
                this._unlockHooked = true;
                this.scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
                    this._unlockHooked = false;
                    this._applyMusic(this._pendingMusicKey);
                });
            }
            return;
        }
        this._applyMusic(key);
    }

    // Фактически переключить трек (звук уже разблокирован).
    _applyMusic(key) {
        if (this.currentMusicKey === key && this.music && this.music.isPlaying) return;
        if (this.music) { this.music.stop(); this.music.destroy(); this.music = null; }
        this.currentMusicKey = key;
        if (!key || !this.scene.cache.audio.exists(key)) return;
        this.music = this.scene.sound.add(key, { loop: true, volume: this._musicGain() });
        this.music.play();
    }

    stopMusic() {
        if (this.music) { this.music.stop(); this.music.destroy(); this.music = null; }
        this.currentMusicKey = null;
        this._pendingMusicKey = null;
    }

    setMusicVolume(v) { this.musicVolume = v; if (this.music) this.music.setVolume(this._musicGain()); }
}
