import { useState } from 'react';
import { api } from '../api';

function SignIn({ onSignedIn, onBack, onSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username and password required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { userId } = await api.signIn(username.trim(), password);
      localStorage.setItem('userId', userId);
      onSignedIn?.(userId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin">
      <h2>Sign In</h2>
      <p className="signin__hint">Your login is saved when you reopen the game.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="signin__error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="signin__switch">
        Don&apos;t have an account? <button type="button" className="btn btn--ghost btn--link" onClick={onSignUp}>Create account</button>
      </p>
      <button className="btn btn--ghost" onClick={onBack}>Back</button>
    </div>
  );
}

export default SignIn;
