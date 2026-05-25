export type ActionLabelEntry = { type: string; displayName: string; category?: string };

export function formatActionDisplayName(entry: ActionLabelEntry): string {
  const name = (entry.displayName ?? '').trim();
  if (!name) return name;
  if (name.endsWith(' Pattern')) {
    return name.slice(0, -' Pattern'.length).trim();
  }
  return name;
}

export function formatActionTypeTag(entry: ActionLabelEntry): string {
  const type = (entry.type ?? '').trim();
  if (!type) return type;
  if (type.endsWith('Pattern')) {
    return type.slice(0, -'Pattern'.length).trim();
  }
  return type;
}
