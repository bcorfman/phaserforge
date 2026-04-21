import type { Selection } from './EditorStore';

export interface GroupFrameDisplay {
  showFrame: boolean;
  showLabel: boolean;
  frameWidth: number;
  frameColor: number;
  frameAlpha: number;
  labelAlpha: number;
}

export function getGroupFrameDisplay(selection: Selection, groupId: string): GroupFrameDisplay {
  const selected = selection.kind === 'group' && selection.id === groupId;
  if (!selected) {
    return {
      showFrame: false,
      showLabel: false,
      frameWidth: 2,
      frameColor: 0x5aa9c8,
      frameAlpha: 0.55,
      labelAlpha: 0.75,
    };
  }

  return {
    showFrame: true,
    showLabel: true,
    frameWidth: 3,
    frameColor: 0xffb86b,
    frameAlpha: 0.95,
    labelAlpha: 1,
  };
}
