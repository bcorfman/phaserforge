import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config.mts';
import { nonJsdomTaggedTests, storybookTestExclude } from './vitest.unit.shared.mts';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    exclude: [...storybookTestExclude, ...nonJsdomTaggedTests],
  },
});
