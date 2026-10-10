import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { encryptMessage, decryptMessage } from './crypto';

export default function Chat({ me, keys, token, onLogout }) {
  const [friend, setFriend] = useState('');
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [friendPubKey, setFriendPubKey] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('new_message', async (msg) => {
      const pk = await fetchPublicKey(msg.from);
      const text = decryptMessage(msg.ciphertext, msg.nonce, pk, keys.privateKey);
      setMessages((m) => [...m, { ...msg, text, mine: false }]);
    });

    return () => socket.disconnect();
  }, [token, keys.privateKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function fetchPublicKey(username) {
    const res = await fetch(API_URL + '/users/' + username + '/pubkey');
    if (!res.ok) throw new Error('User not found');
    const data = await res.json();
    return data.publicKey;
  }

  async function openChat(friendName) {
    if (!friendName.trim() || friendName === me.username) return;
    try {
      const pk = await fetchPublicKey(friendName);
      setFriendPubKey(pk);
      setActiveFriend(friendName);

      const res = await fetch(API_URL + '/messages/' + friendName, {
        headers: { Authorization: 'Bearer ' + token }
      });
      const history = await res.json();

      const decrypted = history.map((m) => ({
        ...m,
        mine: m.from === me.username,
        text: decryptMessage(m.ciphertext, m.nonce, pk, keys.privateKey)
      }));
      setMessages(decrypted);
    } catch (e) {
      alert('User not found');
    }
  }

  function send() {
    if (!input.trim() || !activeFriend || !friendPubKey) return;
    const { ciphertext, nonce } = encryptMessage(input, friendPubKey, keys.privateKey);

    socketRef.current.emit('send_message', {
      to: activeFriend, ciphertext, nonce
    });

    setMessages((m) => [...m, {
      from: me.username, to: activeFriend, text: input, mine: true,
      timestamp: new Date()
    }]);
    setInput('');
  }

  return (
    <div style={s.app}>
      <div style={s.sidebar}>
        <div style={s.me}>
          <div>
            <strong>{me.username}</strong>
            <div style={{ fontSize: 12, color: connected ? '#4ade80' : '#f87171' }}>
              {connected ? '● Online' : '● Offline'}
            </div>
          </div>
          <button style={s.logout} onClick={onLogout}>Log out</button>
        </div>

        <div style={s.friendBox}>
          <input
            style={s.friendInput}
            placeholder="Friend's username"
            value={friend}
            onChange={(e) => setFriend(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openChat(friend)}
          />
          <button style={s.openBtn} onClick={() => openChat(friend)}>Chat</button>
        </div>

        {activeFriend && <div style={s.active}>💬 {activeFriend}</div>}
      </div>

      <div style={s.chat}>
        {!activeFriend ? (
          <div style={s.empty}>
            <h2>Welcome, {me.username} 👋</h2>
            <p>Enter a friend's username to start chatting</p>
          </div>
        ) : (
          <>
            <div style={s.header}>
              <strong>{activeFriend}</strong>
              <span style={{ fontSize: 12, color: '#666' }}>🔒 End-to-end encrypted</span>
            </div>

            <div ref={scrollRef} style={s.messages}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
                  No messages yet 👋
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ textAlign: m.mine ? 'right' : 'left', margin: '6px 0' }}>
                  <span style={{
                    display: 'inline-block', padding: '8px 14px',
                    background: m.mine ? '#667eea' : '#e5e5ea',
                    color: m.mine ? 'white' : 'black',
                    borderRadius: 16, maxWidth: '70%', wordWrap: 'break-word'
                  }}>{m.text}</span>
                </div>
              ))}
            </div>

            <div style={s.inputRow}>
              <input
                style={s.msgInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Type a message..."
              />
              <button style={s.sendBtn} onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  app: { display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: 260, background: '#1e1e2f', color: 'white', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  me: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #333' },
  logout: { background: 'transparent', color: '#f87171', border: '1px solid #f87171', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  friendBox: { display: 'flex', gap: 6 },
  friendInput: { flex: 1, padding: 8, borderRadius: 6, border: 'none', fontSize: 13 },
  openBtn: { padding: '8px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' },
  active: { padding: 10, background: '#2a2a44', borderRadius: 8, fontSize: 14 },
  chat: { flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f7' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666' },
  header: { padding: 16, background: 'white', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  messages: { flex: 1, overflowY: 'auto', padding: 20 },
  inputRow: { display: 'flex', padding: 16, background: 'white', borderTop: '1px solid #e0e0e0', gap: 8 },
  msgInput: { flex: 1, padding: 12, border: '1px solid #ddd', borderRadius: 24, fontSize: 15, outline: 'none' },
  sendBtn: { padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: 24, cursor: 'pointer', fontWeight: 600 }
};