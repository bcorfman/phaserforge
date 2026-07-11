import { useRef } from 'react';
import { serializeProjectToYaml } from '../model/serialization';
import { useEditorStore } from './EditorStore';
import { exportYamlToDisk } from './yamlFileExport';
import { getYamlFileHandle, getYamlFileSourceLabel, getYamlPickerStartIn, setYamlFileHandle, setYamlFileSourceLabel, setYamlPickerStartIn } from './yamlPickerState';
import { getOpenFilePicker, readFileHandleText, writeTextToHandle } from './yamlFileHandles';
import { appendPersistenceDebugEntry } from '../util/persistenceDebug';

type ViewbarYamlControlsViewProps = {
  project: ReturnType<typeof useEditorStore>['state']['project'];
  dispatch: ReturnType<typeof useEditorStore>['dispatch'];
};

export function ViewbarYamlControlsView({ project, dispatch }: ViewbarYamlControlsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const yamlFileLabel = getYamlFileSourceLabel();

  const openFromPicker = async () => {
    dispatch({ type: 'set-error', error: undefined });

    const picker = getOpenFilePicker();
    if (picker) {
      try {
        const handles = await picker({
          multiple: false,
          types: [
            {
              description: 'YAML',
              accept: {
                'application/x-yaml': ['.yaml', '.yml'],
                'text/yaml': ['.yaml', '.yml'],
                'text/plain': ['.yaml', '.yml'],
              },
            },
          ],
          ...(getYamlPickerStartIn() ? { startIn: getYamlPickerStartIn() } : {}),
        });
          const handle = handles?.[0];
          if (handle) {
            setYamlPickerStartIn(handle);
            setYamlFileHandle(handle);
            const { text, label } = await readFileHandleText(handle);
            setYamlFileSourceLabel(label);
            appendPersistenceDebugEntry('viewbar:load-yaml-text-dispatch', { sourceLabel: label });
            dispatch({ type: 'load-yaml-text', text, sourceLabel: label });
            return;
          }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Fall back to <input type=file>.
      }
    }

    const input = fileInputRef.current;
    if (!input) {
      dispatch({ type: 'set-error', error: 'File picker unavailable' });
      return;
    }
    input.value = '';
    // Headless browsers (notably Firefox) can crash when attempting to open a native file chooser.
    // In tests we set files via Playwright on the hidden input, so avoid opening the chooser.
    if ((window as any).__PHASER_FORGE_TEST__?.isEnabled) return;
    input.click();
  };

  const onFilePicked = async (file: File | null) => {
    dispatch({ type: 'set-error', error: undefined });
    if (!file) return;
    try {
      const text = await file.text();
      setYamlFileHandle(undefined);
      setYamlFileSourceLabel(file.name ?? 'picked file');
      appendPersistenceDebugEntry('viewbar:load-yaml-text-dispatch', { sourceLabel: file.name ?? 'picked file' });
      dispatch({ type: 'load-yaml-text', text, sourceLabel: file.name ?? 'picked file' });
    } catch (err) {
      dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to open YAML' });
    }
  };

  const saveToSameFile = async () => {
    dispatch({ type: 'set-error', error: undefined });
    const handle = getYamlFileHandle();
    if (!handle) {
      await saveAs();
      return;
    }
    try {
      await writeTextToHandle(handle, serializeProjectToYaml(project));
      dispatch({ type: 'mark-saved' });
      dispatch({ type: 'set-status', message: `Saved YAML: ${getYamlFileSourceLabel() ?? 'file'}`, expiresAt: Date.now() + 4000 });
    } catch (err) {
      dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to save YAML' });
    }
  };

  const saveAs = async () => {
    dispatch({ type: 'set-error', error: undefined });
    try {
      const result = await exportYamlToDisk(serializeProjectToYaml(project), {
        suggestedName: yamlFileLabel ?? 'scene.yaml',
        startIn: getYamlPickerStartIn(),
      });
      if (result.kind === 'saved') {
        setYamlPickerStartIn(result.handle);
        setYamlFileHandle(result.handle);
        setYamlFileSourceLabel(result.label);
        dispatch({ type: 'mark-saved' });
        dispatch({ type: 'set-status', message: 'Saved YAML', expiresAt: Date.now() + 4000 });
      } else {
        setYamlFileHandle(undefined);
        dispatch({ type: 'mark-saved' });
        dispatch({ type: 'set-status', message: 'Downloaded YAML', expiresAt: Date.now() + 4000 });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      dispatch({ type: 'set-error', error: err instanceof Error ? err.message : 'Failed to save YAML' });
    }
  };

  return (
    <div className="viewbar-yaml" role="toolbar" aria-label="YAML file actions">
      <div className="viewbar-group viewbar-yaml-group">
        {yamlFileLabel ? (
          <span className="viewbar-yaml-file-label" data-testid="yaml-file-label" title={yamlFileLabel}>
            {yamlFileLabel}
          </span>
        ) : (
          <span className="viewbar-yaml-file-label viewbar-yaml-file-label-hidden" data-testid="yaml-file-label-hidden" aria-hidden="true">
            scene.yaml
          </span>
        )}
        <button className="button" type="button" data-testid="yaml-open-button" onClick={() => void openFromPicker()}>
          Open YAML…
        </button>
        <button className="button" type="button" data-testid="yaml-save-button" onClick={() => void saveToSameFile()}>
          Save YAML
        </button>
        <button className="button" type="button" data-testid="yaml-save-as-button" onClick={() => void saveAs()}>
          Save YAML As…
        </button>
      </div>

      <input
        aria-hidden="true"
        data-testid="yaml-open-file-input"
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,application/x-yaml,text/yaml,text/plain"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0] ?? null;
          e.currentTarget.value = '';
          await onFilePicked(file);
        }}
      />
    </div>
  );
}

export function ViewbarYamlControls() {
  const { state, dispatch } = useEditorStore();
  return <ViewbarYamlControlsView project={state.project} dispatch={dispatch} />;
}
