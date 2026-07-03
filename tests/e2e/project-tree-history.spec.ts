import { expect, test } from '@playwright/test';
import { buildStoredProjectRecord } from '../../src/editor/projectPersistence';
import { appendProjectRevision, createProjectRevision } from '../../src/editor/projectTreeHistory';
import { sampleProject } from '../../src/model/sampleProject';
import { dismissViewHint, gotoStudio, seedSampleScene, waitForSampleScene } from './helpers';

test.describe('Project tree + history', () => {
  test('supports manage actions, restore, and copy flows @smoke', async ({ page }) => {
    await seedSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-tree-root-button')).toContainText('Untitled Project');

    await page.getByTestId('project-tree-manage-button').click();
    await expect(page.getByTestId('project-manage-create')).toBeVisible();
    await expect(page.getByTestId('project-manage-open')).toBeVisible();
    await expect(page.getByTestId('project-manage-toggle-sync')).toBeVisible();
    await expect(page.getByTestId('project-manage-import-yaml')).toBeVisible();
    await expect(page.getByTestId('project-manage-export-yaml')).toBeVisible();
    await expect(page.getByTestId('project-manage-rename')).toBeVisible();
    await expect(page.getByTestId('project-manage-history')).toBeVisible();
    await expect(page.getByTestId('project-manage-clear')).toBeVisible();

    await page.getByTestId('project-manage-rename').click();
    await expect(page.getByTestId('rename-project-input')).toBeVisible();
    await page.getByTestId('rename-project-input').fill('History Demo');
    await page.getByTestId('rename-project-input').press('Enter');
    await expect(page.getByTestId('project-tree-root-button')).toContainText('History Demo');

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();
    const revisionsPane = page.getByTestId('project-revisions-pane');
    await expect(revisionsPane).toBeVisible();
    const revisionCards = page.locator('.behavior-block[data-testid^="project-revision-"]');
    await expect(revisionCards.nth(1)).toBeVisible();
    await expect(revisionCards.first()).toContainText('Renamed to History Demo');
    await expect(page.getByTestId(/project-revision-toggle-/)).toHaveCount(0);
    await expect(revisionCards.first().getByTestId(/project-revision-teaser-/)).toHaveCount(0);
    await expect(revisionsPane).toContainText(/(Initial snapshot|entity added|entities added|scene added|scenes added|Minor edits)/);
    await expect(revisionsPane).not.toContainText('Autosave checkpoint');
    await expect(revisionsPane).not.toContainText('Start:');

    await page.getByTestId(/project-revision-restore-/).nth(1).click();
    await expect(page.getByTestId('restore-revision-dialog')).toBeVisible();
    await page.getByTestId('restore-revision-confirm-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toContainText('Untitled Project');

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();
    await expect(revisionsPane).toBeVisible();
    const firstRevisionCard = page.locator('.behavior-block[data-testid^="project-revision-"]').first();
    await expect(firstRevisionCard).toBeVisible();
    const firstCopyButton = firstRevisionCard.getByRole('button', { name: 'Copy...' });
    await expect(firstCopyButton).toBeVisible();
    await firstCopyButton.scrollIntoViewIfNeeded();
    await firstCopyButton.click();
    await expect(page.getByTestId('copy-revision-dialog')).toBeVisible();
    await page.getByTestId('copy-revision-name-input').fill('History Fork');
    await page.getByTestId('copy-revision-confirm-button').click();
    await expect(page.getByTestId('project-tree-root-button')).toContainText('History Fork');
  });

  test('expands multi-item revisions and skips disclosure UI for single-item rows @smoke', async ({ page }) => {
    const baseProject = structuredClone(sampleProject);
    const newerProject = structuredClone(sampleProject);
    newerProject.title = 'Pattern Demo';
    newerProject.publishTitle = 'Pattern Demo';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-27T02:21:00.000Z',
    });
    const newerRevision = createProjectRevision(newerProject, {
      id: 'rev-newer',
      updatedAt: '2026-06-27T02:22:00.000Z',
    });
    const revisions = appendProjectRevision([baseRevision], newerRevision, 25);
    const record = {
      ...buildStoredProjectRecord(newerProject, {
        id: newerProject.id,
        updatedAt: '2026-06-27T02:22:00.000Z',
        origin: 'local-only',
        syncStatus: 'local',
      }),
      revisions,
    };

    await page.addInitScript(async ({ seededRecord }) => {
      const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('workspaceState')) db.createObjectStore('workspaceState');
          if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
        };
        request.onsuccess = () => resolve(request.result);
      });

      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['projects', 'workspaceState'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('projects').put(seededRecord);
        tx.objectStore('workspaceState').put({
          activeProjectId: seededRecord.id,
          syncMode: 'offline',
        }, 'workspace');
        tx.objectStore('workspaceState').put('1', 'legacyMigrated');
      });
    }, { seededRecord: record });

    await gotoStudio(page, { forceNavigate: true });
    await waitForSampleScene(page);
    await dismissViewHint(page);

    await expect(page.getByTestId('project-tree-root-button')).toContainText('Pattern Demo');
    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();

    const revisionCards = page.locator('.behavior-block[data-testid^="project-revision-"]');
    await expect(revisionCards).toHaveCount(2);
    await expect(page.getByTestId(/project-revision-toggle-/)).toHaveCount(0);
    await expect(page.getByTestId('project-revision-teaser-rev-newer')).toContainText('+1 more change');
    await page.getByTestId('project-revision-teaser-rev-newer').click();
    const detailList = page.getByTestId('project-revision-details-rev-newer');
    await expect(detailList.locator('li')).toHaveCount(2);
    await expect(detailList).toContainText('Renamed to Pattern Demo');
    await expect(detailList).toContainText('Set publish title to Pattern Demo');
    await detailList.click();
    await expect(page.getByTestId('project-revision-details-rev-newer')).toHaveCount(0);
    await expect(page.getByTestId('project-revision-teaser-rev-base')).toHaveCount(0);
  });

  test('groups repetitive adjacent history rows and expands to named details @smoke', async ({ page }) => {
    const baseProject = structuredClone(sampleProject);
    const firstProject = structuredClone(sampleProject);
    firstProject.scenes[firstProject.initialSceneId].entities.enemy_c = {
      id: 'enemy_c',
      name: 'enemy_c',
      x: 64,
      y: 64,
      width: 16,
      height: 16,
    } as any;
    const secondProject = structuredClone(firstProject);
    secondProject.scenes[secondProject.initialSceneId].entities.ship_a = {
      id: 'ship_a',
      name: 'ship_a',
      x: 96,
      y: 64,
      width: 16,
      height: 16,
    } as any;
    const thirdProject = structuredClone(secondProject);
    thirdProject.scenes[thirdProject.initialSceneId].entities.effect_purple = {
      id: 'effect_purple',
      name: 'effect_purple',
      x: 128,
      y: 64,
      width: 16,
      height: 16,
    } as any;

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-27T23:00:00.000Z',
    });
    const firstRevision = createProjectRevision(firstProject, {
      id: 'rev-first',
      updatedAt: '2026-06-27T23:00:20.000Z',
      reason: 'autosave',
    });
    const secondRevision = createProjectRevision(secondProject, {
      id: 'rev-second',
      updatedAt: '2026-06-27T23:00:40.000Z',
      reason: 'autosave',
    });
    const thirdRevision = createProjectRevision(thirdProject, {
      id: 'rev-third',
      updatedAt: '2026-06-27T23:01:00.000Z',
      reason: 'autosave',
    });
    const revisions = appendProjectRevision(
      appendProjectRevision(
        appendProjectRevision([baseRevision], firstRevision, 25),
        secondRevision,
        25,
      ),
      thirdRevision,
      25,
    );
    const record = {
      ...buildStoredProjectRecord(thirdProject, {
        id: thirdProject.id,
        updatedAt: '2026-06-27T23:01:00.000Z',
        origin: 'local-only',
        syncStatus: 'local',
      }),
      revisions,
    };

    await page.addInitScript(async ({ seededRecord }) => {
      const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('workspaceState')) db.createObjectStore('workspaceState');
          if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
        };
        request.onsuccess = () => resolve(request.result);
      });

      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['projects', 'workspaceState'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('projects').put(seededRecord);
        tx.objectStore('workspaceState').put({
          activeProjectId: seededRecord.id,
          syncMode: 'offline',
        }, 'workspace');
        tx.objectStore('workspaceState').put('1', 'legacyMigrated');
      });
    }, { seededRecord: record });

    await gotoStudio(page, { forceNavigate: true });
    await waitForSampleScene(page);
    await dismissViewHint(page);

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();

    const revisionCards = page.locator('.behavior-block[data-testid^="project-revision-"]');
    await expect(revisionCards).toHaveCount(2);
    await expect(page.getByTestId('project-revision-row-button-rev-third')).toContainText('3 entities added');
    await expect(page.getByTestId('project-revision-teaser-rev-third')).toContainText('+3 more changes');

    await page.getByTestId('project-revision-teaser-rev-third').click();
    const detailList = page.getByTestId('project-revision-details-rev-third');
    await expect(detailList).toContainText('effect_purple added');
    await expect(detailList).toContainText('ship_a added');
    await expect(detailList).toContainText('enemy_c added');
  });

  test('archives multiple revisions from the main history pane and exposes delete only in archived history @smoke', async ({ page }) => {
    const baseProject = structuredClone(sampleProject);
    const middleProject = structuredClone(sampleProject);
    middleProject.scenes[middleProject.initialSceneId].entities.enemy_c = {
      id: 'enemy_c',
      name: 'enemy_c',
      x: 64,
      y: 64,
      width: 16,
      height: 16,
    } as any;
    const newestProject = structuredClone(sampleProject);
    newestProject.title = 'Newest Revision';

    const baseRevision = createProjectRevision(baseProject, {
      id: 'rev-base',
      updatedAt: '2026-06-27T23:00:00.000Z',
    });
    const middleRevision = createProjectRevision(middleProject, {
      id: 'rev-middle',
      updatedAt: '2026-06-27T23:00:30.000Z',
    });
    const newestRevision = createProjectRevision(newestProject, {
      id: 'rev-newest',
      updatedAt: '2026-06-27T23:01:00.000Z',
    });
    const revisions = [newestRevision, middleRevision, baseRevision];
    const record = {
      ...buildStoredProjectRecord(newestProject, {
        id: newestProject.id,
        updatedAt: '2026-06-27T23:01:00.000Z',
        origin: 'local-only',
        syncStatus: 'local',
        revisions,
      }),
    };

    await page.addInitScript(async ({ seededRecord }) => {
      const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open('phaserforge.persistence.v1', 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('workspaceState')) db.createObjectStore('workspaceState');
          if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
        };
        request.onsuccess = () => resolve(request.result);
      });

      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['projects', 'workspaceState'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('projects').put(seededRecord);
        tx.objectStore('workspaceState').put({
          activeProjectId: seededRecord.id,
          syncMode: 'offline',
        }, 'workspace');
        tx.objectStore('workspaceState').put('1', 'legacyMigrated');
      });
    }, { seededRecord: record });

    await gotoStudio(page, { forceNavigate: true });
    await waitForSampleScene(page);
    await dismissViewHint(page);

    await page.getByTestId('project-tree-manage-button').click();
    await page.getByTestId('project-manage-history').click();

    await expect(page.getByTestId('project-history-enter-archive-mode')).toBeVisible();
    await expect(page.getByTestId('project-revision-delete-rev-newest')).toHaveCount(0);

    await page.getByTestId('project-history-enter-archive-mode').click();
    const selectButtons = page.getByRole('button', { name: 'Select' });
    await selectButtons.nth(0).click();
    await selectButtons.nth(1).click();
    await page.getByTestId('project-history-archive-selected').click();
    await page.getByTestId('project-history-archive-confirm').click();

    const activeRevisionCards = page.locator('.behavior-block[data-testid^="project-revision-"]');
    await expect(activeRevisionCards).toHaveCount(1);

    await page.getByTestId('project-history-show-archived').click();
    const archivedRevisionCards = page.locator('.behavior-block[data-testid^="project-revision-"]');
    await expect(archivedRevisionCards).toHaveCount(2);
    await expect(page.getByTestId('project-revision-delete-rev-newest')).toBeVisible();

    await page.getByTestId('project-revision-delete-rev-newest').click();
    await page.getByTestId('project-history-delete-confirm').click();
    await expect(page.getByTestId('project-revision-row-button-rev-newest')).toHaveCount(0);
  });
});
