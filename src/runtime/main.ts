import * as Phaser from 'phaser';
import { BootScene } from '../phaser/BootScene';
import { EditorScene } from '../phaser/EditorScene';
import { GameScene } from '../phaser/GameScene';
import { SCENE_HEIGHT, SCENE_WIDTH } from '../editor/viewport';

export function createGameConfig(container: string): Phaser.Types.Core.GameConfig
{
    return {
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
        pixelArt: false,
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            autoRound: true,
            snap: { width: 1, height: 1 },
        },
    };
}

export function configureGameAudioPersistence(game: Phaser.Game): void
{
    const soundManager = (game as any)?.sound;
    if (!soundManager) return;
    soundManager.pauseOnBlur = false;
}

export default function StartGame(container: string): Phaser.Game
{
    const config = createGameConfig(container);

    // Keep an existing game instance from being recreated in hot reload scenarios
    // (only relevant during development with Vite HMR)
    if ((window as any).__phaserGame)
    {
        (window as any).__phaserGame.destroy(true);
    }

    const game = new Phaser.Game(config);
    configureGameAudioPersistence(game);
    (window as any).__phaserGame = game;
    return game;
}
