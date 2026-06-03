import type { Preview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';

import { defaultApiHandlers } from '../src/testing/msw/apiHandlers';

initialize({ onUnhandledRequest: 'bypass' });

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    msw: {
      handlers: defaultApiHandlers,
    },
  },
};

export default preview;
