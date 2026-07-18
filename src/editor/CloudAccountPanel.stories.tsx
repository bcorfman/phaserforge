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
      state={{ project, syncMode: 'offline', initialized: true }}
      dispatch={(action) => {
        if (action.type !== 'set-project-metadata') return;
        setProject((current: any) => ({
          ...current,
          ...(typeof action.title === 'string' ? { title: action.title } : {}),
          ...(typeof action.publishGithubPagesRepo === 'string' ? { publishGithubPagesRepo: action.publishGithubPagesRepo } : {}),
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

export const SignedOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Email')).toBeTruthy());

    const loginTab = canvas.getByRole('tab', { name: 'Log in' });
    const createTab = canvas.getByRole('tab', { name: 'Create' });

    expect(createTab.className).toContain('active');
    expect(loginTab.className).not.toContain('active');

    await userEvent.click(loginTab);

    expect(loginTab.className).toContain('active');
    expect(createTab.className).not.toContain('active');
  },
};

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
    await userEvent.click(canvas.getByRole('tab', { name: 'Log in' }));
    await userEvent.type(canvas.getByLabelText('Email'), 'a@b.c');
    await userEvent.type(canvas.getByLabelText('Password'), 'pw');
    await userEvent.click(canvas.getByTestId('cloud-account-submit'));
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

export const PublishRepoEntryReady: Story = {
  args: {
    initialProject: {
      id: 'project-1',
      title: 'My Game',
      assets: {
        images: {
          i1: {
            id: 'i1',
            source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', originalName: 'img.png', mimeType: 'image/png' },
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
        publishInfo: { ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Publish repository')).toBeTruthy());
    await userEvent.clear(canvas.getByLabelText('Publish repository'));
    await userEvent.type(canvas.getByLabelText('Publish repository'), 'mygame');
    await waitFor(() => {
      expect(canvas.getByTestId('cloud-publish-pages-target').textContent).toContain('https://alice.github.io/mygame/');
      expect((canvas.getByTestId('cloud-publish-pages-button') as HTMLButtonElement).disabled).toBe(false);
      expect(canvas.getByTestId('cloud-publish-pages-help').textContent ?? '').toBe('');
    });
  },
};

export const PublishReady: Story = {
  args: {
    initialProject: {
      id: 'project-1',
      title: 'Zoof',
      publishGithubPagesRepo: 'zoof',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
    },
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: { id: 'u1', email: 'a@b.c' },
        publishInfo: { ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('Publish repository')).toBeTruthy());
    expect(canvas.getByTestId('cloud-publish-prereq').textContent).toContain('Before first publish');
    expect(canvas.getByTestId('cloud-publish-pages-target').textContent).toContain('https://alice.github.io/zoof/');
  },
};

export const PublishFirstTimeSuccess: Story = {
  args: {
    initialProject: {
      id: 'project-1',
      title: 'Zoof',
      publishGithubPagesRepo: 'zoof',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
    },
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: { id: 'u1', email: 'a@b.c' },
        publishInfo: { ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' },
        publishCheck: { ok: true, url: 'https://alice.github.io/zoof/', exists: false, routeExists: false, pagesConfigured: false, deploymentStatus: null },
        publishResult: { ok: true, url: 'https://alice.github.io/zoof/', repo: 'zoof', repoCreated: true, deploymentStatus: 'queued' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-button')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('cloud-publish-pages-button'));
    await waitFor(() => expect(canvas.getByTestId('publish-confirm-modal').textContent).toContain('A new repository will be created'));
    await userEvent.click(canvas.getByTestId('publish-confirm-submit'));
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-help').textContent).toContain('GitHub Pages accepted the deployment for zoof'));
  },
};

export const PublishFailure: Story = {
  args: {
    initialProject: {
      id: 'project-1',
      title: 'Zoof',
      publishGithubPagesRepo: 'zoof',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
    },
  },
  parameters: {
    msw: {
      handlers: createCloudAuthHandlers({
        user: { id: 'u1', email: 'a@b.c' },
        publishInfo: { ok: true, login: 'alice', pagesBaseUrl: 'https://alice.github.io/' },
        publishCheck: { ok: true, url: 'https://alice.github.io/zoof/', exists: true, routeExists: true, pagesConfigured: true, deploymentStatus: 'built' },
        publishResult: { ok: false, error: 'github_pages_permission_required' },
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-button')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('cloud-publish-pages-button'));
    await waitFor(() => expect(canvas.getByTestId('publish-confirm-modal')).toBeTruthy());
    await userEvent.click(canvas.getByTestId('publish-confirm-submit'));
    await waitFor(() => expect(canvas.getByTestId('cloud-publish-pages-help').textContent).toContain('GitHub denied GitHub Pages management access'));
  },
};
