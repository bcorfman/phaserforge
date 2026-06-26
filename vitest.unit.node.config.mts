import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.mts';
import { jsdomTaggedTests, storybookTestExclude } from './vitest.unit.shared.mts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: [...storybookTestExclude, ...jsdomTaggedTests],
    },
  }),
);
