import type { ProjectLibraryEntry, ProjectPickerFilter } from './projectLibrary';
import { formatProjectTimestamp } from './projectLibrary';

export function ProjectPickerPanel({
  projects,
  activeProject,
  counts,
  search,
  filter,
  syncMode,
  onSearchChange,
  onFilterChange,
  onOpenProject,
  onCreateProject,
  onImportYaml,
  onRefreshCloudProjects,
  onDuplicateProject,
  onExportYaml,
  onToggleSyncMode,
}: {
  projects: ProjectLibraryEntry[];
  activeProject: ProjectLibraryEntry | null;
  counts: { cloud: number; local: number; unsynced: number };
  search: string;
  filter: ProjectPickerFilter;
  syncMode: 'online' | 'offline';
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ProjectPickerFilter) => void;
  onOpenProject: (projectId: string) => void;
  onCreateProject: () => void;
  onImportYaml: () => void;
  onRefreshCloudProjects: () => void;
  onDuplicateProject: () => void;
  onExportYaml: () => void;
  onToggleSyncMode: () => void;
}) {
  const filters: Array<{ value: ProjectPickerFilter; label: string }> = [
    { value: 'recent', label: 'Recent' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'local', label: 'Local' },
    { value: 'templates', label: 'Templates' },
  ];

  return (
    <div className="project-picker-panel" data-testid="project-picker-panel">
      <section className="panel-section" aria-labelledby="project-picker-projects">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="project-picker-projects">Projects</h3>
          <button
            className={`button button-compact project-sync-toggle ${syncMode === 'offline' ? 'button-danger' : ''}`}
            type="button"
            data-testid="project-sync-toggle"
            onClick={onToggleSyncMode}
          >
            {syncMode === 'offline' ? 'Offline' : 'Online'}
          </button>
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
          <button className="button primary" type="button" onClick={onCreateProject}>New Project</button>
          <button className="button" type="button" onClick={onImportYaml}>Import…</button>
          <button className="button" type="button" onClick={onRefreshCloudProjects}>Refresh</button>
        </div>

        <div className="project-picker-grid">
          <div className="project-picker-sources">
            <div className="project-picker-source-card project-picker-source-card-cloud">
              <div>
                <div className="project-picker-source-title">Cloud Projects</div>
                <div className="project-picker-source-copy">{counts.cloud} available</div>
              </div>
            </div>
            <div className="project-picker-source-card">
              <div>
                <div className="project-picker-source-title">Local Projects</div>
                <div className="project-picker-source-copy">{counts.local} local only</div>
              </div>
            </div>
            <div className="project-picker-source-card project-picker-source-card-warn">
              <div>
                <div className="project-picker-source-title">Cloud Sync Issues</div>
                <div className="project-picker-source-copy">{counts.unsynced} need retry</div>
              </div>
            </div>
          </div>

          <div className="project-picker-list" data-testid="project-picker-list">
            <div className="project-picker-list-title">Recent Projects</div>
            {projects.length === 0 ? (
              <div className="project-picker-empty">No projects match this filter yet.</div>
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="panel-section" aria-labelledby="active-project-summary">
        <div className="panel-heading-row">
          <h3 className="panel-heading" id="active-project-summary">Active Project Summary</h3>
        </div>
        <div className="project-picker-summary-card">
          <div className="project-picker-summary-title">{activeProject?.title ?? 'Untitled Project'}</div>
          <div className="project-picker-row-meta">
            {activeProject
              ? `${activeProject.source === 'cloud' ? 'Cloud' : 'Local'} project. Last edited ${formatProjectTimestamp(activeProject.updatedAt)}.`
              : 'Local project. No project metadata loaded yet.'}
          </div>
          <div className="project-picker-summary-actions">
            <button className="button primary" type="button" onClick={() => activeProject && onOpenProject(activeProject.id)}>Open</button>
            <button className="button" type="button" onClick={onDuplicateProject}>Duplicate</button>
            <button className="button" type="button" onClick={onExportYaml}>Export YAML</button>
          </div>
        </div>
      </section>
    </div>
  );
}
