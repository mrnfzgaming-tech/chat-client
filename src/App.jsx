import { useState } from 'react';
import Login from './Login';
import Chat from './Chat';
import { initCrypto, generateKeyPair } from './crypto';
import { API_URL } from './config';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(username, password, mode) {
    setLoading(true);
    try {
      await initCrypto();

      const storeName = 'chat_keys_' + username;
      let keys = JSON.parse(localStorage.getItem(storeName) || 'null');
      if (!keys) {
        keys = generateKeyPair();
        localStorage.setItem(storeName, JSON.stringify(keys));
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

      setSession({ me: { username: data.username }, keys, token: data.token });
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return session
    ? <Chat {...session} onLogout={() => setSession(null)} />
    : <Login onLogin={handleLogin} />;
}