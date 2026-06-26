import { describe, expect, it } from 'vitest';

import unitConfig from '../vitest.unit.config.mts';
import unitJsdomConfig from '../vitest.unit.jsdom.config.mts';
import unitNodeConfig from '../vitest.unit.node.config.mts';
import { findAllTestFiles, findJsdomTaggedTests, jsdomTaggedTests, nonJsdomTaggedTests, storybookTestExclude } from '../vitest.unit.shared.mts';

describe('vitest.unit config', () => {
  it('excludes storybook tests from the unit suite', () => {
    expect(storybookTestExclude).toEqual(['tests/storybook/**/*.test.ts', 'tests/storybook/**/*.test.tsx']);
    expect(unitConfig.test?.exclude).toEqual(expect.arrayContaining(storybookTestExclude));
  });

  it('detects jsdom-tagged tests from source pragmas', () => {
    expect(jsdomTaggedTests).toEqual(findJsdomTaggedTests());
    expect(nonJsdomTaggedTests).toEqual(findAllTestFiles().filter((filePath) => !jsdomTaggedTests.includes(filePath)));
    expect(jsdomTaggedTests).toContain('tests/editor/cloud-account-publish-gating.test.tsx');
    expect(jsdomTaggedTests).toContain('tests/storybook/editor-stories.test.tsx');
    expect(jsdomTaggedTests).not.toContain('tests/server/auth.test.ts');
  });

  it('excludes jsdom-tagged tests from the node unit suite', () => {
    expect(unitNodeConfig.test?.exclude).toEqual(expect.arrayContaining(jsdomTaggedTests));
    expect(unitNodeConfig.test?.exclude).toEqual(expect.arrayContaining(storybookTestExclude));
  });

  it('includes only jsdom-tagged tests in the jsdom unit suite', () => {
    expect(unitJsdomConfig.test?.exclude).toEqual(expect.arrayContaining(nonJsdomTaggedTests));
    expect(unitJsdomConfig.test?.exclude).toEqual(expect.arrayContaining(storybookTestExclude));
  });
});
