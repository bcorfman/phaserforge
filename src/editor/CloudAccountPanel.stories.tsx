import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { CloudAccountPanel } from './CloudAccountPanel';
import { createCloudAuthHandlers } from '../testing/msw/apiHandlers';

function CloudAccountPanelStoryHarness({ initialProject }: { initialProject?: any }) {
  const [project, setProject] = useState<any>(
    initialProject ?? { id: 'project-1', assets: { images: {}, spriteSheets: {}, fonts: {} }, audio: { sounds: {} } },
  );

  return (
    <CloudAccountPanel
      state={{ project }}
      dispatch={(action) => {
        if (action.type !== 'set-project-metadata') return;
        setProject((current: any) => ({
          ...current,
          ...(typeof action.title === 'string' ? { title: action.title } : {}),
          ...(typeof action.publishGithubPagesRoute === 'string' ? { publishGithubPagesRoute: action.publishGithubPagesRoute } : {}),
        }));
      }}
      onLoadYaml={() => {}}
      onStatus={() => {}}
      onError={() => {}}
    />
  );
}

const meta = {
  title: 'Editor/CloudAccountPanel',
  component: CloudAccountPanelStoryHarness,
  args: {
    initialProject: undefined,
  },
} satisfies Meta<typeof CloudAccountPanelStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {};

export const EmailLogin: Story = {
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: null,
        loginUser: { id: 'u1', email: 'a@b.c' },
        publishInfo: { ok: false, error: 'github_not_linked' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Email')).toBeTruthy());
    await userEvent.type(canvas.getByLabelText('Email'), 'a@b.c');
    await userEvent.type(canvas.getByLabelText('Password'), 'pw');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(canvas.getByTestId('cloud-account-section').textContent).toContain('Signed in'));
    expect(canvas.getByRole('button', { name: 'Connect GitHub' })).toBeTruthy();
  },
};

export const SignedInGithubUnlinked: Story = {
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: { id: 'u1', email: 'alice@example.com' },
        publishInfo: { ok: false, error: 'github_not_linked' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-connect-github-cta')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('cloud-publish-connect-github-cta'));
    await waitFor(() => expect(canvas.getByTestId('github-connect-modal')).toBeTruthy());
  },
};

export const PublishBlockedByPathAssets: Story = {
  args: {
    initialProject: {
      id: 'project-1',
      title: 'My Game',
      assets: {
        images: {
          i1: {
            id: 'i1',
            source: { kind: 'path', path: '/img.png' },
          },
        },
        spriteSheets: {},
        fonts: {},
      },
      audio: { sounds: {} },
    },
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: { id: 'u1', email: 'a@b.c' },
        publishInfo: { ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/', repo: 'alice/alice.github.io' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Publish route')).toBeTruthy());
    await userEvent.clear(canvas.getByLabelText('Publish route'));
    await userEvent.type(canvas.getByLabelText('Publish route'), 'mygame');
    await waitFor(() => {
      expect(canvas.getByTestId('cloud-publish-pages-target').textContent).toContain('https://alice.github.io/mygame/');
      expect((canvas.getByTestId('cloud-publish-pages-button') as HTMLButtonElement).disabled).toBe(true);
      expect(canvas.getByTestId('cloud-publish-pages-help').textContent).toContain('Path assets detected');
    });
  },
};
