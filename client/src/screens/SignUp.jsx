import { useState } from 'react';
import { api } from '../api';

function SignUp({ onSignedUp, onBack }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trim = username.trim();
    if (!trim || trim.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { userId } = await api.createUser(trim);
      localStorage.setItem('userId', userId);
      onSignedUp?.(userId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup">
      <h2>Create Account</h2>
      <p className="signup__hint">Usernames are unique and can only be used once ever.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          required
        />
        {error && <p className="signup__error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
      <button className="btn btn--ghost" onClick={onBack}>Back</button>
    </div>
  );
}

export default SignUp;
