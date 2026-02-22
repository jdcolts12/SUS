import { useState } from 'react';
import { api } from '../api';

function SignUp({ onSignedUp, onBack, onSignIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimUser = username.trim();
    if (!trimUser || trimUser.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { userId, username: name } = await api.createUser(trimUser, password);
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', name || '');
      onSignedUp?.(userId, name);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup">
      <h2>Create Account</h2>
      <p className="signup__hint">Usernames are unique. Create once—you&apos;ll stay logged in on this device.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          required
        />
        <input
          type="password"
          placeholder="Choose a password (min 4 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={4}
          required
        />
        {error && <p className="signup__error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
      <p className="signup__switch">
        Already have an account? <button type="button" className="btn btn--ghost btn--link" onClick={onSignIn}>Sign in</button>
      </p>
      <button className="btn btn--ghost" onClick={onBack}>Back</button>
    </div>
  );
}

export default SignUp;
