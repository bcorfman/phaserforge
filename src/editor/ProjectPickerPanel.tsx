import { useState } from 'react';
import type { ProjectLibraryEntry, ProjectPickerFilter } from './projectLibrary';
import { formatProjectTimestamp } from './projectLibrary';

export function ProjectPickerPanel({
  projects,
  counts,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onOpenProject,
  onDeleteProject,
  onRefreshCloudProjects,
}: {
  projects: ProjectLibraryEntry[];
  counts: { cloud: number; local: number; unsynced: number };
  search: string;
  filter: ProjectPickerFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ProjectPickerFilter) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (project: ProjectLibraryEntry) => void | Promise<void>;
  onRefreshCloudProjects: () => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectLibraryEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const filters: Array<{ value: ProjectPickerFilter; label: string }> = [
    { value: 'recent', label: 'Recent' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'local', label: 'Local' },
    { value: 'templates', label: 'Templates' },
  ];
  const listTitle = filter === 'local'
    ? 'Local Projects'
    : filter === 'cloud'
      ? 'Cloud Projects'
      : filter === 'templates'
        ? 'Templates'
        : 'Recent Projects';
  const emptyCopy = filter === 'local'
    ? 'No locally stored projects match this filter yet.'
    : filter === 'cloud'
      ? 'No cloud projects match this filter yet.'
      : filter === 'templates'
        ? 'Templates are not available yet.'
        : 'No projects match this filter yet.';

  return (
    <div className="project-picker-panel" data-testid="project-picker-panel">
      <section className="panel-section" aria-labelledby="project-picker-projects">
        <div className="panel-heading-row">
        <h3 className="panel-heading" id="project-picker-projects">Project Library</h3>
          <button className="button button-compact" type="button" onClick={onRefreshCloudProjects}>Refresh</button>
        </div>

        <div className="project-picker-tabs" role="tablist" aria-label="Project filters">
          {filters.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`button button-compact ${filter === tab.value ? 'active' : ''}`}
              data-testid={`project-picker-filter-${tab.value}`}
              role="tab"
              aria-selected={filter === tab.value}
              onClick={() => onFilterChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="project-picker-toolbar">
          <label className="field" style={{ flex: 1 }}>
            <span>Search</span>
            <input
              aria-label="Search projects"
              data-testid="project-picker-search"
              placeholder="Search projects, tags, repo names…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>

        <div className="project-picker-grid">
          <div className="project-picker-sources">
            <div className={`project-picker-source-card ${filter === 'cloud' ? 'project-picker-source-card-cloud' : ''}`}>
              <div>
                <div className="project-picker-source-title">Cloud Projects</div>
                <div className="project-picker-source-copy">{counts.cloud} available</div>
              </div>
            </div>
            <div className={`project-picker-source-card ${filter === 'local' ? 'project-picker-source-card-cloud' : ''}`}>
              <div>
                <div className="project-picker-source-title">Local Projects</div>
                <div className="project-picker-source-copy">{counts.local} stored locally</div>
              </div>
            </div>
            <div className={`project-picker-source-card ${filter === 'recent' ? 'project-picker-source-card-cloud' : 'project-picker-source-card-warn'}`}>
              <div>
                <div className="project-picker-source-title">Cloud Sync Issues</div>
                <div className="project-picker-source-copy">{counts.unsynced} need retry</div>
              </div>
            </div>
          </div>

          <div className="project-picker-list" data-testid="project-picker-list">
            <div className="project-picker-list-title">{listTitle}</div>
            {projects.length === 0 ? (
              <div className="project-picker-empty">{emptyCopy}</div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className={`project-picker-row ${project.isCurrent ? 'is-current' : ''}`}
                  data-testid={`project-row-${project.id}`}
                >
                  <div className="project-picker-row-copy">
                    <div className="project-picker-row-title">{project.title}</div>
                    <div className="project-picker-row-meta">Last edited: {formatProjectTimestamp(project.updatedAt)}</div>
                    <div className="project-picker-row-meta">Scenes: {project.sceneCount}</div>
                  </div>
                  <div className="project-picker-row-actions">
                    <span className={`badge ${project.source === 'cloud' ? '' : 'badge-muted'}`}>{project.source === 'cloud' ? 'Cloud' : 'Local'}</span>
                    {project.isCurrent ? <span className="badge">Current</span> : null}
                    {project.status === 'unsynced' ? <span className="badge badge-warn">Unsynced</span> : null}
                    <button
                      className="button button-compact"
                      type="button"
                      data-testid={`project-open-${project.id}`}
                      onClick={() => onOpenProject(project.id)}
                    >
                      Open
                    </button>
                    <button
                      className="button button-compact"
                      type="button"
                      aria-label={`Project actions for ${project.title}`}
                      data-testid={`project-actions-${project.id}`}
                      onClick={() => setOpenMenuId((current) => current === project.id ? null : project.id)}
                    >
                      ⋯
                    </button>
                    {openMenuId === project.id ? (
                      <div className="project-picker-row-menu" role="menu">
                        <button
                          type="button"
                          className="scene-graph-menu-item"
                          data-testid={`project-delete-${project.id}`}
                          disabled={project.isCurrent}
                          title={project.isCurrent ? 'Open another project before deleting the current project' : undefined}
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteTarget(project);
                          }}
                        >
                          Delete…
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {deleteTarget ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="project-delete-title">
          <div className="modal-card">
            <div className="workspace-conflict-header">
              <div className="workspace-conflict-title" id="project-delete-title">Delete project?</div>
            </div>
            <div className="cloud-help">
              {deleteTarget.source === 'cloud'
                ? `Delete “${deleteTarget.title}” from your cloud account and remove its local cache?`
                : `Delete “${deleteTarget.title}” from this device?`}
            </div>
            <div className="cloud-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="button" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                type="button"
                className="button button-danger"
                data-testid="project-delete-confirm"
                disabled={deleteBusy}
                onClick={async () => {
                  setDeleteBusy(true);
                  try {
                    await onDeleteProject(deleteTarget);
                    setDeleteTarget(null);
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                {deleteBusy ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
