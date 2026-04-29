import { randomToken } from './crypto';

export function newId(prefix: string): string {
  return `${prefix}_${randomToken(16)}`;
}

