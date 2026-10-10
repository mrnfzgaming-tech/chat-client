import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { addFriend, getFriends, markRead, getMessages } from './api';

export default function Chat({ me, token, onLogout, onOpenAdmin }) {
  const [friends, setFriends] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendMsg, setAddFriendMsg] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeFriendRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    activeFriendRef.current = activeFriend;
  }, [activeFriend]);

  useEffect(() => {
    const socket = io(API_URL, { auth: { token: token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('new_message', (msg) => {
      if (activeFriendRef.current === msg.from) {
        setMessages((m) => [...m, { ...msg, mine: false, readAt: null }]);
        socket.emit('mark_read', { from: msg.from });
        markRead(token, msg.from);
      }
    });

    socket.on('friend_typing', (data) => {
      if (activeFriendRef.current === data.from) {
        setFriendTyping(data.isTyping);
      }
    });

    socket.on('messages_read', (data) => {
      if (activeFriendRef.current === data.by) {
        setMessages((m) =>
          m.map((msg) =>
            msg.mine ? { ...msg, readAt: msg.readAt || new Date() } : msg
          )
        );
      }
    });

    return () => socket.disconnect();
  }, [token]);

  useEffect(() => {
    getFriends(token).then((list) => setFriends(list));
  }, [token]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, friendTyping]);

  async function openChat(friendName) {
    if (!friendName || friendName === me.username) return;

    try {
      setActiveFriend(friendName);
      setFriendTyping(false);

      const history = await getMessages(token, friendName);
      const mapped = history.map((m) => ({
        ...m,
        mine: m.from === me.username,
      }));
      setMessages(mapped);

      markRead(token, friendName);
      if (socketRef.current) {
        socketRef.current.emit('mark_read', { from: friendName });
      }
    } catch (err) {
      console.error('openChat failed:', err);
      alert('Could not load chat');
    }
  }

  function closeChat() {
    setActiveFriend(null);
    setMessages([]);
  }

  async function handleAddFriend() {
    const name = addFriendInput.trim();
    if (!name) return;

    const result = await addFriend(token, name);
    if (result.error) {
      setAddFriendMsg('Error: ' + result.error);
    } else {
      setAddFriendMsg('Added ' + name);
      setAddFriendInput('');
      const updated = await getFriends(token);
      setFriends(updated);
      openChat(name);
    }
    setTimeout(() => setAddFriendMsg(''), 3000);
  }

  function send() {
    if (!input.trim() || !activeFriend) return;

    socketRef.current.emit('send_message', {
      to: activeFriend,
      text: input,
    });

    setMessages((m) => [
      ...m,
      {
        from: me.username,
        to: activeFriend,
        text: input,
        mine: true,
        timestamp: new Date(),
        readAt: null,
      },
    ]);
    setInput('');
    socketRef.current.emit('typing', { to: activeFriend, isTyping: false });
  }

  function handleTyping(e) {
    setInput(e.target.value);
    if (!activeFriend) return;

    socketRef.current.emit('typing', { to: activeFriend, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('typing', { to: activeFriend, isTyping: false });
    }, 1500);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const showSidebar = !isMobile || !activeFriend;
  const showChat = !isMobile || activeFriend;

  return (
    <div style={s.app}>
      {showSidebar && (
        <div style={s.sidebar}>
          <div style={s.me}>
            <div>
              <strong>{me.username}</strong>
              <div style={{ fontSize: 12, color: connected ? '#4ade80' : '#f87171' }}>
                {connected ? 'Online' : 'Offline'}
              </div>
            </div>
            {onOpenAdmin && (
  <button style={s.adminBtn} onClick={onOpenAdmin}>Admin</button>
)}
            <button style={s.logout} onClick={onLogout}>Log out</button>
          </div>

          <div style={s.addBox}>
            <input
              style={s.friendInput}
              placeholder="Add by username"
              value={addFriendInput}
              onChange={(e) => setAddFriendInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
            />
            <button style={s.openBtn} onClick={handleAddFriend}>+</button>
          </div>
          {addFriendMsg && <div style={s.addMsg}>{addFriendMsg}</div>}

          <div style={s.friendsLabel}>FRIENDS</div>
          <div style={s.friendsList}>
            {friends.length === 0 && (
              <div style={{ color: '#666', fontSize: 13, padding: 8 }}>
                No friends yet. Add someone above!
              </div>
            )}
            {friends.map((f) => (
              <div
                key={f}
                style={{
                  ...s.friendItem,
                  background: activeFriend === f ? '#2a2a44' : 'transparent',
                }}
                onClick={() => openChat(f)}
              >
                <div style={s.avatar}>{f[0].toUpperCase()}</div>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showChat && (
        <div style={s.chat}>
          {!activeFriend ? (
            <div style={s.empty}>
              <h2>Welcome, {me.username}</h2>
              <p>Add a friend on the left to start chatting</p>
            </div>
          ) : (
            <>
              <div style={s.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isMobile && (
                    <button style={s.backBtn} onClick={closeChat}>←</button>
                  )}
                  <div style={s.avatar}>{activeFriend[0].toUpperCase()}</div>
                  <strong>{activeFriend}</strong>
                </div>
                <span style={{ fontSize: 12, color: '#666' }}>Private</span>
              </div>

              <div ref={scrollRef} style={s.messages}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
                    No messages yet. Say hi!
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      textAlign: m.mine ? 'right' : 'left',
                      margin: '6px 0',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '8px 14px',
                        background: m.mine ? '#667eea' : '#e5e5ea',
                        color: m.mine ? 'white' : 'black',
                        borderRadius: 16,
                        maxWidth: '75%',
                        wordWrap: 'break-word',
                        textAlign: 'left',
                      }}
                    >
                      {m.text}
                      <div
                        style={{
                          fontSize: 10,
                          marginTop: 4,
                          opacity: 0.7,
                          textAlign: 'right',
                        }}
                      >
                        {formatTime(m.timestamp)}
                        {m.mine && (
                          <span style={{ marginLeft: 6 }}>
                            {m.readAt ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {friendTyping && (
                  <div style={{ textAlign: 'left', margin: '6px 0' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '8px 14px',
                        background: '#e5e5ea',
                        borderRadius: 16,
                        fontStyle: 'italic',
                        color: '#666',
                      }}
                    >
                      {activeFriend} is typing...
                    </div>
                  </div>
                )}
              </div>

              <div style={s.inputRow}>
                <input
                  style={s.msgInput}
                  value={input}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Type a message..."
                />
                <button style={s.sendBtn} onClick={send}>Send</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  },
  sidebar: {
    width: 280,
    minWidth: 280,
    background: '#1e1e2f',
    color: 'white',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
  },
  me: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottom: '1px solid #333',
  },
  logout: {
    background: 'transparent',
    color: '#f87171',
    border: '1px solid #f87171',
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
adminBtn: {
  background: 'transparent',
  color: '#4ade80',
  border: '1px solid #4ade80',
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  marginRight: 6,
},
  addBox: { display: 'flex', gap: 6 },
  friendInput: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    border: 'none',
    fontSize: 13,
    minWidth: 0,
  },
  openBtn: {
    padding: '8px 14px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  addMsg: { fontSize: 12, color: '#aaa' },
  friendsLabel: { fontSize: 11, color: '#666', marginTop: 8, letterSpacing: 1 },
  friendsList: { display: 'flex', flexDirection: 'column', gap: 2 },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 6,
    cursor: 'pointer',
  },
  avatar: {
    width: 32,
    height: 32,
    minWidth: 32,
    borderRadius: '50%',
    background: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'white',
    fontSize: 14,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: '#667eea',
    padding: 0,
    marginRight: 4,
  },
  chat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#f5f5f7',
    minWidth: 0,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  header: {
    padding: 16,
    background: 'white',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    WebkitOverflowScrolling: 'touch',
  },
  inputRow: {
    display: 'flex',
    padding: 12,
    background: 'white',
    borderTop: '1px solid #e0e0e0',
    gap: 8,
    flexShrink: 0,
  },
  msgInput: {
    flex: 1,
    padding: 12,
    border: '1px solid #ddd',
    borderRadius: 24,
    fontSize: 15,
    outline: 'none',
    minWidth: 0,
  },
  sendBtn: {
    padding: '12px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 24,
    cursor: 'pointer',
    fontWeight: 600,
  },
};