import Phaser from 'phaser';
import { EditorScene } from '../phaser/EditorScene';

export default function StartGame(container: string): Phaser.Game
{
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: 1024,
        height: 768,
        backgroundColor: '#000000',
        scene: [EditorScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
    };

    // Keep an existing game instance from being recreated in hot reload scenarios
    // (only relevant during development with Vite HMR)
    if ((window as any).__phaserGame)
    {
        (window as any).__phaserGame.destroy(true);
    }

    const game = new Phaser.Game(config);
    (window as any).__phaserGame = game;
    return game;
}
