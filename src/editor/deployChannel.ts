export type EditorDeployChannel = 'stable' | 'dev';

type EnvLike = {
  VITE_PHASERFORGE_DEPLOY_CHANNEL?: unknown;
  VITE_PHASERFORGE_ENABLE_DEV_CLOUD_PERSISTENCE?: unknown;
};

type LocationLike = {
  pathname?: string;
};

declare const __PHASER_FORGE_DEPLOY_CHANNEL__: string | undefined;
declare const __PHASER_FORGE_ENABLE_DEV_CLOUD_PERSISTENCE__: string | undefined;

function getBuildEnv(): EnvLike {
  return {
    VITE_PHASERFORGE_DEPLOY_CHANNEL: typeof __PHASER_FORGE_DEPLOY_CHANNEL__ === 'undefined' ? undefined : __PHASER_FORGE_DEPLOY_CHANNEL__,
    VITE_PHASERFORGE_ENABLE_DEV_CLOUD_PERSISTENCE: typeof __PHASER_FORGE_ENABLE_DEV_CLOUD_PERSISTENCE__ === 'undefined'
      ? undefined
      : __PHASER_FORGE_ENABLE_DEV_CLOUD_PERSISTENCE__,
  };
}

export function resolveEditorDeployChannel(env: EnvLike = getBuildEnv(), location: LocationLike | undefined = globalThis.location): EditorDeployChannel {
  if (env.VITE_PHASERFORGE_DEPLOY_CHANNEL === 'dev') return 'dev';
  if (env.VITE_PHASERFORGE_DEPLOY_CHANNEL === 'stable') return 'stable';
  if (location?.pathname?.split('/').includes('dev')) return 'dev';
  return 'stable';
}

export function isDevDeployChannel(env?: EnvLike, location?: LocationLike): boolean {
  return resolveEditorDeployChannel(env, location) === 'dev';
}

export function getChannelScopedStorageKey(baseKey: string, env?: EnvLike, location?: LocationLike): string {
  return isDevDeployChannel(env, location) ? `${baseKey}.dev` : baseKey;
}

export function isCloudPersistenceEnabledForChannel(env: EnvLike = getBuildEnv(), location?: LocationLike): boolean {
  if (!isDevDeployChannel(env, location)) return true;
  return env.VITE_PHASERFORGE_ENABLE_DEV_CLOUD_PERSISTENCE === '1';
}
