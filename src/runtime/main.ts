import * as Phaser from 'phaser';
import { BootScene } from '../phaser/BootScene';
import { EditorScene } from '../phaser/EditorScene';
import { GameScene } from '../phaser/GameScene';
import { SCENE_HEIGHT, SCENE_WIDTH } from '../editor/viewport';

export default function StartGame(container: string): Phaser.Game
{
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        backgroundColor: '#000000',
        scene: [BootScene, EditorScene, GameScene],
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false,
            },
        },
        antialias: true,
        autoRound: true,
        pixelArt: false,
        resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        scale: {
            mode: Phaser.Scale.RESIZE,
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
