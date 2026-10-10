import { useState, useEffect } from 'react';
import Login from './Login';
import Chat from './Chat';
import Admin from './Admin';
import { API_URL } from './config';

const SESSION_KEY = 'chat_session';
const ADMIN_USERNAME = 'MrNFZ';  // <-- apnar admin username din

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token && parsed.me) setSession(parsed);
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  async function handleLogin(username, password, mode) {
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/register' : '/login';

      const res = await fetch(API_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      const newSession = {
        me: { username: data.username },
        token: data.token
      };
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
    setShowAdmin(false);
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdmin = session.me.username === ADMIN_USERNAME;

  if (showAdmin && isAdmin) {
    return (
      <Admin
        me={session.me}
        token={session.token}
        onBack={() => setShowAdmin(false)}
      />
    );
  }

  return (
    <Chat
      {...session}
      onLogout={handleLogout}
      onOpenAdmin={isAdmin ? () => setShowAdmin(true) : null}
    />
  );
}