// Точка входа: конфигурация Phaser и запуск сцены.

const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0a0a0a',
    scale: {
        // NONE + CSS-растяжение канваса на весь вьюпорт: внутреннее разрешение
        // остаётся 1920x1080 (UI не плывёт), но чёрных полос нет.
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

window.addEventListener('load', () => {
    const start = () => {
        const game = new Phaser.Game(config);
        window.__gameRef = game;
        // Растягиваем канвас на весь экран; refresh() пересчитывает попадание мыши.
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
        // Ждём оба шрифта: Orbitron (латиница) и Exo 2 (кириллица), иначе первый кадр
        // нарисуется запасным Arial.
        Promise.all([
            document.fonts.load('30px Orbitron'),
            document.fonts.load('30px "Exo 2"', 'прогрев'),
        ]).then(start).catch(start);
    } else {
        start();
    }
});
