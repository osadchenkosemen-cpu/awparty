
const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0a0a0a',
    fps: { limit: 0 },
    scale: {
        mode: Phaser.Scale.NONE,
        width: C.VIEW_WIDTH,
        height: C.VIEW_HEIGHT,
    },
    render: {
        antialias: true,
        roundPixels: false,
    },
    scene: [MainScene],
};

const boot = () => {
    const start = () => {
        const game = new Phaser.Game(config);
        window.__gameRef = game;
        const fit = () => {
            const c = game.canvas;
            if (!c) return;
            c.style.width = '100%';
            c.style.height = '100%';
            c.style.display = 'block';
            game.scale.refresh();
        };
        game.events.once('ready', fit);
        window.addEventListener('resize', fit);
        setTimeout(fit, 100);
    };
    if (document.fonts && document.fonts.load) {
        Promise.all([
            document.fonts.load('30px Orbitron'),
            document.fonts.load('30px "Exo 2"', 'прогрев'),
        ]).then(start).catch(start);
    } else {
        start();
    }
};

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
