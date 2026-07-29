const HOSTED_COMMANDS = new Set(['hosted-probe', 'hosted-browser', 'hosted-mutate', 'hosted-isolation', 'hosted-oauth-preflight']);

export function isHostedCommand(command: string): boolean {
  return [...HOSTED_COMMANDS].some((name) => command.trim() === name || command.trim().startsWith(`${name} `));
}

export function assertHostedScope(command: string, scope: string | undefined): void {
  if (!HOSTED_COMMANDS.has(command)) throw new Error(`Not a hosted command: ${command}.`);
  if (scope !== 'hosted') throw new Error('Hosted commands require explicit --scope hosted validation.');
}

export function assertRepairCannotUseHostedScope(scope: string | undefined): void {
  if (scope === 'hosted') throw new Error('The repair path cannot invoke hosted mutation commands.');
}
