import { describe, expect, it } from 'vitest';

import {
  extractSection,
  generateWorkflowReferenceMarkdown,
} from '../../src/docs/workflowReference';

const inventorySource = `# Editor Workflows Inventory (Current Editor)

Intro paragraph.

## Atomic Workflows

### Canvas

#### A1 — Select Single
- Click a thing.

## Composite Workflows

### W1 — Basic Scene Layout
- Do some steps.

## Repetitive / Redundant Workflows

### Duplicate paths
- Notes.

## Missing or Incomplete Workflows

### No workflow for X
- Missing notes.
`;

describe('extractSection', () => {
  it('returns a section body without the heading line', () => {
    expect(extractSection(inventorySource, 'Atomic Workflows')).toBe(`### Canvas

#### A1 — Select Single
- Click a thing.`);
  });

  it('throws a helpful error when the heading is missing', () => {
    expect(() => extractSection(inventorySource, 'Not Real')).toThrow(
      'Missing required section: Not Real',
    );
  });
});

describe('generateWorkflowReferenceMarkdown', () => {
  it('renders the workflow sections into the docs page template', () => {
    const generated = generateWorkflowReferenceMarkdown(inventorySource);

    expect(generated).toContain('# Editor Workflows');
    expect(generated).toContain(
      'This page is generated from `.plans/editor-workflows-inventory.md`.',
    );
    expect(generated).toContain('## Atomic Workflows');
    expect(generated).toContain('#### A1 — Select Single');
    expect(generated).toContain('## Composite Workflows');
    expect(generated).toContain('### W1 — Basic Scene Layout');
    expect(generated).toContain('## Repetitive / Redundant Workflows');
    expect(generated).toContain('## Missing or Incomplete Workflows');
  });

  it('does not copy the source page title into the generated page', () => {
    const generated = generateWorkflowReferenceMarkdown(inventorySource);

    expect(generated).not.toContain('# Editor Workflows Inventory (Current Editor)');
  });
});
