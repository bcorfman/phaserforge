import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import PlayApp from './PlayApp.tsx';

function shouldRenderPlayOnly(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('playGameId')) return true;
    if (url.searchParams.get('yamlUrl')) return true;
  } catch {
    // ignore
  }
  try {
    const meta = document.querySelector('meta[name="phaserforge-mode"]');
    if (meta && meta.getAttribute('content') === 'play') return true;
  } catch {
    // ignore
  }
  return false;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    (shouldRenderPlayOnly() ? <PlayApp /> : <App />),
)
