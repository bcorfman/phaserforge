const REQUIRED_SECTIONS = [
  'Atomic Workflows',
  'Composite Workflows',
  'Repetitive / Redundant Workflows',
  'Missing or Incomplete Workflows',
] as const;

function normalizeTrailingWhitespace(value: string): string {
  return value
    .trim()
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n');
}

export function extractSection(source: string, heading: string): string {
  const lines = source.split('\n');
  const headingLine = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line === headingLine);
  if (startIndex === -1) {
    throw new Error(`Missing required section: ${heading}`);
  }

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (lines[i]?.startsWith('## ')) {
      endIndex = i;
      break;
    }
  }

  return normalizeTrailingWhitespace(lines.slice(startIndex + 2, endIndex).join('\n'));
}

export function generateWorkflowReferenceMarkdown(source: string): string {
  const [atomic, composite, repetitive, missing] = REQUIRED_SECTIONS.map((heading) =>
    extractSection(source, heading),
  );

  return `# Editor Workflows

This page is generated from \`.plans/editor-workflows-inventory.md\`.
Do not edit it by hand; update the inventory and regenerate this page instead.

This reference mirrors the workflow inventory in a docs-friendly format so tutorial pages can link to stable workflow sections without duplicating the source material.

## Atomic Workflows

${atomic}

## Composite Workflows

${composite}

## Repetitive / Redundant Workflows

${repetitive}

## Missing or Incomplete Workflows

${missing}
`;
}
