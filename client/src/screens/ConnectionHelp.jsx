import { useState } from 'react';

function ConnectionHelp() {
  const [serverUrl, setServerUrl] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const testServer = async (e) => {
    e.preventDefault();
    if (!serverUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const url = serverUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${url}/health`);
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true });
      } else {
        setTestResult({ ok: false, msg: 'Server responded but not OK' });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err.message || 'Failed to reach server' });
    }
    setTesting(false);
  };

  return (
    <div className="connection-help">
      <h4>Fix connection</h4>
      <ol>
        <li><strong>Railway:</strong> Deploy at railway.app → Get your URL</li>
        <li><strong>Test it:</strong> Open <code>https://YOUR-URL/health</code> — should show {"{"}ok: true{"}"}</li>
        <li><strong>Vercel:</strong> Settings → Environment Variables</li>
        <li>Add <code>VITE_SOCKET_URL</code> = your Railway URL</li>
        <li><strong>Redeploy</strong> (env vars only apply on new deploys)</li>
      </ol>
      <form onSubmit={testServer} className="connection-help__test">
        <input
          type="url"
          placeholder="Paste your Railway URL (e.g. https://xxx.up.railway.app)"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
        <button type="submit" disabled={testing}>
          {testing ? 'Testing...' : 'Test server'}
        </button>
      </form>
      {testResult && (
        <p className={testResult.ok ? 'connection-help__ok' : 'connection-help__fail'}>
          {testResult.ok ? '✓ Server is reachable' : `✗ ${testResult.msg}`}
        </p>
      )}
    </div>
  );
}

export default ConnectionHelp;
