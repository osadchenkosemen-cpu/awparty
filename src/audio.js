
const AUDIO_VER = 3;

const AUDIO_MANIFEST = [
    ['sfx_player_shot', 'player_shot.wav'],
    ['sfx_player_hurt', 'damage_enemy.wav'],
    ['sfx_player_death', 'player_death.wav'],
    ['sfx_boss_death', 'bossdeath.wav'],
    ['sfx_dash', 'dash.wav'],
    ['sfx_slam', 'GroundSlam.wav'],
    ['sfx_levelup', 'lvlup.wav'],
    ['sfx_menu_click', 'menu_click.wav'],
    ['sfx_skillbought', 'skillbought.wav'],
    ['sfx_boss_warning', 'attention.wav'],
    ['mus_menu', 'sound_menu.wav'],
    ['mus_round', 'soundround.mp3'],
];

class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.sfxVolume = 0.6;
        this.musicVolume = 0.4;
        this.musicMaster = 0.3;
        this.duckFactor = 1;
        this.music = null;
        this.currentMusicKey = null;
        this._pendingMusicKey = null;
        this._unlockHooked = false;
        this._lastPlay = {};
        this.syncFromSave();
    }

    _musicGain() { return this.musicVolume * this.musicMaster * this.duckFactor; }

    setDuck(f) {
        if (this.duckFactor === f) return;
        this.duckFactor = f;
        if (this.music) this.music.setVolume(this._musicGain());
    }

    syncFromSave() {
        const s = this.scene.save;
        if (!s) return;
        if (s.effectsVolume != null) this.sfxVolume = s.effectsVolume / 100;
        if (s.soundVolume != null) this.setMusicVolume(s.soundVolume / 100);
    }

    static preload(loader) {
        loader.setPath(C.ASSET_PATH);
        for (const [key, file] of AUDIO_MANIFEST) loader.audio(key, file + '?v=' + AUDIO_VER);
    }

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

    playLoopSfx(key, opts) {
        opts = opts || {};
        if (!this.scene.cache.audio.exists(key)) return null;
        if (this.scene.sound.locked) return null;
        const vol = (opts.volume == null ? 1 : opts.volume) * this.sfxVolume;
        const snd = this.scene.sound.add(key, { loop: true, volume: vol });
        snd.play();
        return snd;
    }

    stopLoopSfx(snd) { if (snd) { snd.stop(); snd.destroy(); } }

    releaseLoopSfx(snd, durMs) {
        if (!snd) return;
        durMs = durMs == null ? 600 : durMs;
        this.scene.tweens.add({
            targets: snd, volume: 0, duration: durMs, ease: 'Linear',
            onComplete: () => { snd.stop(); snd.destroy(); },
        });
    }

    musicForState(st) {
        if (st === GameState.PLAYING || st === GameState.LEVEL_UP ||
            st === GameState.ABILITY_SELECT || st === GameState.PAUSED) {
            return 'mus_round';
        }
        return 'mus_menu';
    }

    playMusic(key) {
        this._pendingMusicKey = key;
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
