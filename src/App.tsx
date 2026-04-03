import { useEffect, useRef, useState } from 'react';
import { PhaserGame } from './phaser/PhaserHost';
import { EventBus } from './phaser/EventBus';
import { EditorProvider, useEditorStore } from './editor/EditorStore';
import { EntityList } from './editor/EntityList';
import { Inspector } from './editor/Inspector';
import { Toolbar } from './editor/Toolbar';
import { JsonPanel } from './editor/JsonPanel';
import './app/layout.css';

function AppShell() {
  const { state } = useEditorStore();
  const [sceneReady, setSceneReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const handleReady = () => {
      readyRef.current = true;
      setSceneReady(true);
    };
    EventBus.on('current-scene-ready', handleReady);
    return () => {
      EventBus.off('current-scene-ready', handleReady);
    };
  }, []);

  useEffect(() => {
    if (!sceneReady) return;
    EventBus.emit('load-scene', state.scene);
  }, [sceneReady, state.scene]);

  return (
    <div className="app-root">
      <Toolbar />
      <div className="app-body">
        <aside className="pane pane-left">
          <EntityList />
        </aside>
        <main className="pane pane-center">
          <div className="phaser-frame">
            <PhaserGame currentActiveScene={() => {
              if (!readyRef.current) setSceneReady(true);
            }} />
          </div>
        </main>
        <aside className="pane pane-right">
          <Inspector />
          <JsonPanel />
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <AppShell />
    </EditorProvider>
  );
}
