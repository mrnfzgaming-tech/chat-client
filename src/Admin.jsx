import { useState, useEffect } from 'react';
import { API_URL } from './config';

export default function Admin({ token, me, onBack }) {
  const [secretInput, setSecretInput] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function authFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: 'Bearer ' + token,
        'x-admin-secret': secretInput,
        'Content-Type': 'application/json',
      },
    });
    return res.json();
  }

  async function verifySecret() {
    if (!secretInput.trim()) {
      setAuthError('Enter secret');
      return;
    }

    const res = await fetch(API_URL + '/admin/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ secret: secretInput }),
    });

    if (res.ok) {
      setAuthorized(true);
      setAuthError('');
    } else {
      setAuthError('Invalid secret');
      setSecretInput('');
    }
  }

  useEffect(() => {
    if (authorized) {
      loadUsers();
      loadMessages();
    }
  }, [authorized]);

  async function loadUsers() {
    setLoading(true);
    const data = await authFetch(API_URL + '/admin/users');
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function loadMessages() {
    setLoading(true);
    const data = await authFetch(API_URL + '/admin/messages?limit=200');
    setMessages(data.messages || []);
    setLoading(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const data = await authFetch(
      API_URL + '/admin/search?q=' + encodeURIComponent(searchQuery)
    );
    setSearchResults(data.messages || []);
  }

  async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    await authFetch(API_URL + '/admin/message/' + id, { method: 'DELETE' });
    setMessages(messages.filter((m) => m._id !== id));
    setSearchResults(searchResults.filter((m) => m._id !== id));
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleString();
  }

  if (!authorized) {
    return (
      <div style={s.gate}>
        <div style={s.gateCard}>
          <h2 style={s.gateTitle}>Access Restricted</h2>
          <p style={s.gateText}>Enter admin secret to continue</p>
          <input
            type="password"
            style={s.gateInput}
            placeholder="Secret key"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verifySecret()}
            autoFocus
          />
          {authError && <div style={s.gateError}>{authError}</div>}
          <button style={s.gateBtn} onClick={verifySecret}>Unlock</button>
          <button style={s.gateBack} onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.app}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>Back</button>
        <h2 style={s.title}>Admin Dashboard</h2>
        <span style={s.adminTag}>Logged in as {me.username}</span>
      </div>

      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(tab === 'users' ? s.tabActive : {}) }}
          onClick={() => setTab('users')}
        >
          Users ({users.length})
        </button>
        <button
          style={{ ...s.tab, ...(tab === 'messages' ? s.tabActive : {}) }}
          onClick={() => setTab('messages')}
        >
          Messages ({messages.length})
        </button>
        <button
          style={{ ...s.tab, ...(tab === 'search' ? s.tabActive : {}) }}
          onClick={() => setTab('search')}
        >
          Search
        </button>
      </div>

      <div style={s.content}>
        {tab === 'users' && (
          <div>
            <h3>All Users</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Username</th>
                  <th style={s.th}>Created At</th>
                  <th style={s.th}>ID</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td style={s.td}><strong>{u.username}</strong></td>
                    <td style={s.td}>{formatTime(u.createdAt)}</td>
                    <td style={s.td}><code style={s.code}>{u._id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'messages' && (
          <div>
            <h3>All Messages ({messages.length})</h3>
            {loading && <div>Loading...</div>}
            {messages.map((m) => (
              <div key={m._id} style={s.msgCard}>
                <div style={s.msgHeader}>
                  <span>
                    <strong>{m.from}</strong> to <strong>{m.to}</strong>
                  </span>
                  <span style={s.msgTime}>{formatTime(m.timestamp)}</span>
                </div>
                <div style={s.msgText}>{m.text}</div>
                <button style={s.delBtn} onClick={() => deleteMessage(m._id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'search' && (
          <div>
            <h3>Search Messages</h3>
            <div style={s.searchBox}>
              <input
                style={s.searchInput}
                placeholder="Search text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button style={s.searchBtn} onClick={handleSearch}>Search</button>
            </div>
            {searchResults.length > 0 && (
              <div>
                <h4>Results: {searchResults.length}</h4>
                {searchResults.map((m) => (
                  <div key={m._id} style={s.msgCard}>
                    <div style={s.msgHeader}>
                      <span>
                        <strong>{m.from}</strong> to <strong>{m.to}</strong>
                      </span>
                      <span style={s.msgTime}>{formatTime(m.timestamp)}</span>
                    </div>
                    <div style={s.msgText}>{m.text}</div>
                    <button style={s.delBtn} onClick={() => deleteMessage(m._id)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  gate: {
    minHeight: '100vh',
    background: '#0f0f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
    padding: 20,
  },
  gateCard: {
    background: '#1e1e2f',
    padding: 40,
    borderRadius: 12,
    width: '100%',
    maxWidth: 360,
    textAlign: 'center',
  },
  gateTitle: { color: 'white', margin: 0, fontSize: 22 },
  gateText: { color: '#888', fontSize: 14, marginTop: 8, marginBottom: 24 },
  gateInput: {
    width: '100%',
    padding: 12,
    borderRadius: 6,
    border: 'none',
    fontSize: 15,
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  gateError: { color: '#f87171', fontSize: 13, marginBottom: 12 },
  gateBtn: {
    width: '100%',
    padding: 12,
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 12,
  },
  gateBack: {
    background: 'transparent',
    color: '#888',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
  },
  app: {
    minHeight: '100vh',
    background: '#0f0f1a',
    color: 'white',
    fontFamily: 'system-ui, sans-serif',
    padding: 16,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid #333',
  },
  backBtn: {
    background: 'transparent',
    color: '#667eea',
    border: '1px solid #667eea',
    padding: '8px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
  },
  title: { margin: 0, fontSize: 22 },
  adminTag: { fontSize: 12, color: '#4ade80' },
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: {
    padding: '10px 20px',
    background: '#1e1e2f',
    color: '#aaa',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  },
  tabActive: { background: '#667eea', color: 'white' },
  content: { maxWidth: 1200, margin: '0 auto' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 12 },
  th: {
    textAlign: 'left',
    padding: 12,
    background: '#1e1e2f',
    borderBottom: '2px solid #333',
    fontSize: 13,
  },
  td: { padding: 12, borderBottom: '1px solid #222', fontSize: 13 },
  code: { fontSize: 11, color: '#888' },
  msgCard: {
    background: '#1e1e2f',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeft: '3px solid #667eea',
  },
  msgHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 13,
  },
  msgTime: { color: '#888', fontSize: 11 },
  msgText: {
    background: '#2a2a44',
    padding: 8,
    borderRadius: 6,
    fontSize: 14,
    wordBreak: 'break-word',
    marginBottom: 8,
  },
  delBtn: {
    background: '#7f1d1d',
    color: 'white',
    border: 'none',
    padding: '4px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
  },
  searchBox: { display: 'flex', gap: 8, marginBottom: 16 },
  searchInput: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    border: 'none',
    fontSize: 14,
  },
  searchBtn: {
    padding: '10px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};