import { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');

  function submit() {
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    onLogin(username.trim(), password, mode);
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>🔒 Private Chat</h1>
        <p style={s.sub}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</p>

        {error && <div style={s.err}>{error}</div>}

        <input
          style={s.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          style={s.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button style={s.btn} onClick={submit}>
          {mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>

        <p style={s.switch}>
          {mode === 'login' ? "Don't have an account? " : 'Have an account? '}
          <span
            style={s.link}
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </span>
        </p>
      </div>
    </div>
  );
}

const s = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea, #764ba2)'
  },
  card: {
    background: 'white', padding: 40, borderRadius: 16, width: 360,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  title: { margin: 0, textAlign: 'center', color: '#333' },
  sub: { textAlign: 'center', color: '#666', marginBottom: 24 },
  input: {
    width: '100%', padding: 12, marginBottom: 12, border: '1px solid #ddd',
    borderRadius: 8, fontSize: 15, boxSizing: 'border-box'
  },
  btn: {
    width: '100%', padding: 12, background: '#667eea', color: 'white',
    border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer',
    fontWeight: 600
  },
  err: {
    background: '#fee', color: '#c33', padding: 10, borderRadius: 6,
    marginBottom: 12, fontSize: 14
  },
  switch: { textAlign: 'center', color: '#666', fontSize: 14 },
  link: { color: '#667eea', cursor: 'pointer', fontWeight: 600 }
};