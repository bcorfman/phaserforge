import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { InspectorPaneView } from './InspectorPane';

const meta = {
  title: 'Editor/InspectorPane',
  component: InspectorPaneView,
  args: {
    cloudEnabled: true,
    activeTab: 'inspector',
    onSelectTab: fn(),
    inspectorContent: <div data-testid="story-inspector-content">Inspector</div>,
    cloudContent: <div data-testid="story-cloud-content">Cloud</div>,
  },
} satisfies Meta<typeof InspectorPaneView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SwitchTabs: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('inspector-pane-tab-cloud'));

    expect(args.onSelectTab).toHaveBeenCalledWith('cloud');
  },
};
