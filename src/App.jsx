import { useState, useEffect } from 'react';
import Login from './Login';
import Chat from './Chat';
import { initCrypto, generateKeyPair } from './crypto';
import { API_URL } from './config';

const SESSION_KEY = 'chat_session';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---- On first load: check if a session exists in localStorage ----
  useEffect(() => {
    async function restoreSession() {
      try {
        await initCrypto();
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Verify token is still valid by checking expiry (optional)
          if (parsed.token && parsed.me && parsed.keys) {
            setSession(parsed);
          }
        }
      } catch (e) {
        console.error('Session restore failed:', e);
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  async function handleLogin(username, password, mode) {
    setLoading(true);
    try {
      await initCrypto();

      // Get or create encryption keys
      const keyStoreName = 'chat_keys_' + username;
      let keys = JSON.parse(localStorage.getItem(keyStoreName) || 'null');
      if (!keys) {
        keys = generateKeyPair();
        localStorage.setItem(keyStoreName, JSON.stringify(keys));
      }

      const endpoint = mode === 'register' ? '/register' : '/login';
      const body = mode === 'register'
        ? { username, password, publicKey: keys.publicKey }
        : { username, password };

      const res = await fetch(API_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      const newSession = {
        me: { username: data.username },
        keys,
        token: data.token
      };

      // Save session to localStorage
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return session
    ? <Chat {...session} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />;
}