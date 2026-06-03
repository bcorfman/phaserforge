import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';

import { ToolbarView } from './Toolbar';

const meta = {
  title: 'Editor/Toolbar',
  component: ToolbarView,
  args: {
    state: {
      dirty: true,
      uiScale: 0.95,
      themeMode: 'system',
      error: undefined,
      statusMessage: 'Draft autosaved',
    },
    dispatch: fn(),
  },
} satisfies Meta<typeof ToolbarView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThemeAndScale: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('theme-mode-dark'));
    fireEvent.change(canvas.getByTestId('ui-scale-slider'), { target: { value: '1.1' } });

    expect(args.dispatch).toHaveBeenCalledWith({ type: 'set-theme-mode', themeMode: 'dark' });
    expect(args.dispatch).toHaveBeenCalledWith({ type: 'set-ui-scale', uiScale: 1.1 });
  },
};
