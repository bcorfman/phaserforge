import { Events } from 'phaser';

// Used to emit events between components, HTML and Phaser scenes
export const EventBus = new Events.EventEmitter();

let activeScene: Phaser.Scene | null = null;

export function setActiveScene(scene: Phaser.Scene | null): void {
    activeScene = scene;
}

export function getActiveScene(): Phaser.Scene | null {
    return activeScene;
}
