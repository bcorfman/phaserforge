import { useEffect, useMemo, useState } from 'react';
import {
  isDebugUrlFlagEnabled,
  isPersistenceDebugEnabled,
  readPersistenceDebugEntries,
  type PersistenceDebugEntry,
} from './util/persistenceDebug';

const RESTORE_DEBUG_EVENTS = new Set([
  'restore:workspace-state-loaded',
  'restore:latest-active-marker-loaded',
  'restore:project-candidates-loaded',
  'restore:bootstrap-fallback-selected',
  'restore:active-project-selected',
  'restore:project-dispatched',
  'editor-store:initialize-record-selection',
  'project-persistence:create-local-project',
]);

function isRestoreDebugEnabled(): boolean {
  return isDebugUrlFlagEnabled('restoreDebug');
}

function formatEntryDetails(entry: PersistenceDebugEntry): string {
  if (!entry.details) return '';
  try {
    return JSON.stringify(entry.details);
  } catch {
    return '[unserializable details]';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour12: false });
}

function readRestoreDebugEntries(): PersistenceDebugEntry[] {
  return readPersistenceDebugEntries().filter((entry) => RESTORE_DEBUG_EVENTS.has(entry.event));
}

export function RestoreDebugOverlay(): JSX.Element | null {
  const enabled = useMemo(() => isRestoreDebugEnabled(), []);
  const [entries, setEntries] = useState<PersistenceDebugEntry[]>(() => (enabled ? readRestoreDebugEntries() : []));

  useEffect(() => {
    if (!enabled) return;
    const update = () => setEntries(readRestoreDebugEntries());
    update();
    const intervalId = window.setInterval(update, 250);
    return () => window.clearInterval(intervalId);
  }, [enabled]);

  if (!enabled) return null;

  const recentEntries = entries.slice(-8).reverse();

  return (
    <div
      data-testid="restore-debug-overlay"
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 9999,
        width: 460,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'min(45vh, 420px)',
        overflow: 'auto',
        borderRadius: 10,
        background: 'rgba(12, 15, 26, 0.94)',
        color: '#f7f4ea',
        padding: '10px 12px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
        font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Restore Debug</div>
      <div>urlFlag: true</div>
      <div>persistenceDebugEnabled: {String(isPersistenceDebugEnabled())}</div>
      <div>matchingEvents: {entries.length}</div>
      {recentEntries.length === 0 ? (
        <div style={{ marginTop: 8, color: '#d7d0bf' }}>Waiting for restore events...</div>
      ) : (
        recentEntries.map((entry, index) => (
          <div
            key={`${entry.timestamp}-${entry.event}-${index}`}
            style={{
              marginTop: index === 0 ? 8 : 10,
              paddingTop: index === 0 ? 0 : 8,
              borderTop: index === 0 ? 'none' : '1px solid rgba(247, 244, 234, 0.15)',
            }}
          >
            <div style={{ color: '#ffd166' }}>
              {formatTimestamp(entry.timestamp)} {entry.event}
            </div>
            {entry.details ? (
              <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: '#d7d0bf' }}>
                {formatEntryDetails(entry)}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
