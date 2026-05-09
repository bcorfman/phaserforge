let pendingRuntimeRequestedSceneId: string | null = null;

export function setPendingRuntimeRequestedSceneId(sceneId: string): void {
  if (typeof sceneId !== 'string' || sceneId.length === 0) return;
  pendingRuntimeRequestedSceneId = sceneId;
}

export function consumePendingRuntimeRequestedSceneId(): string | null {
  const pending = pendingRuntimeRequestedSceneId;
  pendingRuntimeRequestedSceneId = null;
  return pending;
}

