import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';
const REQUIRED_ASSETS = [
  'assets/demo-pack/audio/Simulacra-chosic.com_.mp3',
  'assets/demo-pack/audio/punch-deck-the-soul-crushing-monotony-of-isolation-instrumental-mix(chosic.com).mp3',
  'assets/demo-pack/audio/sb_indreams(chosic.com).mp3',
];

function isPointer(path) {
  try {
    return readFileSync(path, 'utf8').slice(0, LFS_POINTER_PREFIX.length) === LFS_POINTER_PREFIX;
  } catch {
    return false;
  }
}

function pointerAssets() {
  return REQUIRED_ASSETS.filter((assetPath) => isPointer(assetPath));
}

let pointers = pointerAssets();
if (pointers.length > 0) {
  try {
    execFileSync('git', ['lfs', 'pull', '--include', REQUIRED_ASSETS.join(','), '--exclude', ''], { stdio: 'inherit' });
  } catch (error) {
    console.error('[phaserforge] Git LFS assets are pointers and `git lfs pull` failed.');
    throw error;
  }
  pointers = pointerAssets();
}

if (pointers.length > 0) {
  throw new Error(`[phaserforge] Git LFS assets are still pointers: ${pointers.join(', ')}`);
}
