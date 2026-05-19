export function allocDuplicateName(baseName: string, reservedNames: Set<string>): string {
  const trimmedBase = baseName.trim();
  const safeBase = trimmedBase.length > 0 ? trimmedBase : 'Entity';

  const match = safeBase.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const current = Number(match[2]);
    if (Number.isFinite(current)) {
      let counter = current + 1;
      let candidate = `${prefix}${counter}`;
      while (reservedNames.has(candidate)) {
        counter += 1;
        candidate = `${prefix}${counter}`;
      }
      return candidate;
    }
  }

  let counter = 2;
  let candidate = `${safeBase}${counter}`;
  while (reservedNames.has(candidate)) {
    counter += 1;
    candidate = `${safeBase}${counter}`;
  }
  return candidate;
}

