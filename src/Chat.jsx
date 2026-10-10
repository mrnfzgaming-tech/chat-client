import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { addFriend, getFriends, markRead, getMessages, getUnreadCounts } from './api';

export default function Chat({ me, token, onLogout, onOpenAdmin }) {
  const [friends, setFriends] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
const [friendTypingMap, setFriendTypingMap] = useState({});
  const [activeFriend, setActiveFriend] = useState(() => {
    return localStorage.getItem('active_friend') || null;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendMsg, setAddFriendMsg] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_open');
    return saved === null ? true : saved === 'true';
  });

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeFriendRef = useRef(null);

  useEffect(() => {
    activeFriendRef.current = activeFriend;
  }, [activeFriend]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar_open', sidebarOpen ? 'true' : 'false');
  }, [sidebarOpen]);

  useEffect(() => {
    const socket = io(API_URL, { auth: { token: token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('new_message', (msg) => {
  if (activeFriendRef.current === msg.from) {
    // Chat open — append + mark read
    setMessages((m) => [...m, { ...msg, mine: false, readAt: null }]);
    socket.emit('mark_read', { from: msg.from });
    markRead(token, msg.from);
  } else {
    // Chat closed — increment unread
    setUnreadCounts((prev) => ({
      ...prev,
      [msg.from]: (prev[msg.from] || 0) + 1,
    }));
  }
});

    socket.on('friend_typing', (data) => {
  // Update global typing map (for sidebar)
  setFriendTypingMap((prev) => ({
    ...prev,
    [data.from]: data.isTyping,
  }));

  // Update current chat typing (for chat area)
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
  getUnreadCounts(token).then((counts) => setUnreadCounts(counts));
}, [token]);

  useEffect(() => {
    const saved = localStorage.getItem('active_friend');
    if (saved) {
      openChat(saved);
    }
  }, []);

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
      localStorage.setItem('active_friend', friendName);
      setFriendTyping(false);

      const history = await getMessages(token, friendName);
      const mapped = history.map((m) => ({
        ...m,
        mine: m.from === me.username,
      }));
      setMessages(mapped);
      setUnreadCounts((prev) => ({ ...prev, [friendName]: 0 }));

      markRead(token, friendName);
      if (socketRef.current) {
        socketRef.current.emit('mark_read', { from: friendName });
      }
    } catch (err) {
      console.error('openChat failed:', err);
      alert('Could not load chat');
    }
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

  const sidebarWidth = sidebarOpen ? '40%' : '20%';

  return (
    <div style={s.app}>
      {/* ============ SIDEBAR (always visible) ============ */}
      <div
  style={{ ...s.sidebar, width: sidebarWidth }}
  onClick={(e) => e.stopPropagation()}
>
        {/* Top: user + toggle button */}
        <div style={s.sidebarTop}>
          {sidebarOpen ? (
            <div style={s.userInfo}>
              <strong style={s.username}>{me.username}</strong>
              <div style={{ fontSize: 11, color: connected ? '#4ade80' : '#f87171' }}>
                {connected ? 'Online' : 'Offline'}
              </div>
            </div>
          ) : (
            <div style={s.avatarSmall}>{me.username[0].toUpperCase()}</div>
          )}

          <button
            style={s.toggleBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Contract' : 'Expand'}
          >
            {sidebarOpen ? <ContractIcon /> : <ExpandIcon />}
          </button>
        </div>

        {/* Middle: content (only when expanded) */}
        {sidebarOpen && (
          <>
            {onOpenAdmin && (
              <button style={s.adminBtn} onClick={onOpenAdmin}>Admin</button>
            )}

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
                <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
                  No friends yet.
                </div>
              )}
              {friends.map((f) => {
  const unread = unreadCounts[f] || 0;
  const isTyping = friendTypingMap[f];
  const isActive = activeFriend === f;

  return (
    <div
      key={f}
      style={{
        ...s.friendItem,
        background: isActive ? '#2a2a44' : 'transparent',
      }}
      onClick={() => openChat(f)}
    >
      <div style={s.avatar}>{f[0].toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: unread > 0 ? 'bold' : 'normal',
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {f}
        </div>
        {isTyping && (
          <div style={{ fontSize: 11, color: '#4ade80', fontStyle: 'italic' }}>
            typing...
          </div>
        )}
      </div>
      {unread > 0 && (
        <div style={s.badge}>{unread > 99 ? '99+' : unread}</div>
      )}
    </div>
  );
})}
            </div>
          </>
        )}

        {/* Collapsed: only avatars */}
        {!sidebarOpen && friends.length > 0 && (
  <div style={s.friendsListCollapsed}>
    {friends.map((f) => {
      const unread = unreadCounts[f] || 0;
      return (
        <div key={f} style={{ position: 'relative' }}>
          <div
            style={{
              ...s.avatarSmall,
              background: activeFriend === f ? '#4ade80' : '#667eea',
              cursor: 'pointer',
            }}
            onClick={() => openChat(f)}
            title={f}
          >
            {f[0].toUpperCase()}
          </div>
          {unread > 0 && (
            <div style={s.badgeSmall}>{unread > 9 ? '9+' : unread}</div>
          )}
        </div>
      );
    })}
  </div>
)}
        {/* Bottom: logout */}
        <div style={s.logoutBottom}>
          {sidebarOpen ? (
            <button style={s.logoutBtn} onClick={onLogout}>Log out</button>
          ) : (
            <button
              style={s.logoutBtnSmall}
              onClick={onLogout}
              title="Log out"
            >
              ⎋
            </button>
          )}
        </div>
      </div>

      {/* ============ CHAT AREA ============ */}
      <div
  style={s.chat}
  onClick={() => {
    // Only clear if clicking outside the messages/header area
    // (Optional — comment out if not needed)
  }}
>
        {!activeFriend ? (
          <div style={s.empty}>
            <h2>Welcome, {me.username}</h2>
            <p>Pick a friend from the sidebar to start</p>
          </div>
        ) : (
          <>
            <div style={s.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={s.avatar}>{activeFriend[0].toUpperCase()}</div>
                <strong>{activeFriend}</strong>
              </div>
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
    </div>
  );
}

// ============ ICONS ============

// Expand icon: menu lines on left, arrow pointing right
function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="7" x2="13" y2="7" />
      <line x1="3" y1="12" x2="13" y2="12" />
      <line x1="3" y1="17" x2="13" y2="17" />
      <polyline points="17,7 21,12 17,17" />
    </svg>
  );
}

// Contract icon: arrow pointing left, menu lines on right
function ContractIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="7,7 3,12 7,17" />
      <line x1="11" y1="7" x2="21" y2="7" />
      <line x1="11" y1="12" x2="21" y2="12" />
      <line x1="11" y1="17" x2="21" y2="17" />
    </svg>
  );
}

// ============ STYLES ============

const s = {
  app: {
  display: 'flex',
  height: '100dvh',
  width: '100vw',
  overflow: 'hidden',
  fontFamily: 'system-ui, sans-serif',
  position: 'relative',
},

  // ====== SIDEBAR ======
  sidebar: {
    background: '#1e1e2f',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s ease',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidebarTop: {
    padding: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  userInfo: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  username: {
    display: 'block',
    fontSize: 15,
  },
  toggleBtn: {
    background: '#667eea',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(102,126,234,0.5)',
  },

  // ====== SIDEBAR CONTENT (expanded) ======
  adminBtn: {
    margin: '8px 12px 0',
    background: 'transparent',
    color: '#4ade80',
    border: '1px solid #4ade80',
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    flexShrink: 0,
  },
  addBox: {
    display: 'flex',
    gap: 6,
    padding: '12px 12px 0',
    flexShrink: 0,
  },
  friendInput: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    border: 'none',
    fontSize: 13,
    minWidth: 0,
  },
  openBtn: {
    padding: '8px 12px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  addMsg: {
    fontSize: 12,
    color: '#aaa',
    padding: '4px 12px 0',
    flexShrink: 0,
  },
  friendsLabel: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 1,
    padding: '12px 12px 4px',
    flexShrink: 0,
  },
  friendsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
    padding: '0 8px',
    flex: 1,
  },
  friendsListCollapsed: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 0',
    gap: 4,
    overflowY: 'auto',
    flex: 1,
  },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  badge: {
  background: '#4ade80',
  color: '#0f0f1a',
  borderRadius: 12,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 'bold',
  minWidth: 20,
  textAlign: 'center',
  flexShrink: 0,
},
badgeSmall: {
  position: 'absolute',
  top: -4,
  right: -6,
  background: '#4ade80',
  color: '#0f0f1a',
  borderRadius: 10,
  padding: '1px 5px',
  fontSize: 9,
  fontWeight: 'bold',
  minWidth: 16,
  textAlign: 'center',
},
  avatar: {
    width: 30,
    height: 30,
    minWidth: 30,
    borderRadius: '50%',
    background: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'white',
    fontSize: 13,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    minWidth: 28,
    borderRadius: '50%',
    background: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'white',
    fontSize: 13,
    flexShrink: 0,
  },

  // ====== LOGOUT ======
  logoutBottom: {
    marginTop: 'auto',
    padding: 12,
    borderTop: '1px solid #333',
    flexShrink: 0,
  },
  logoutBtn: {
    width: '100%',
    padding: 10,
    background: 'transparent',
    color: '#f87171',
    border: '1px solid #f87171',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
  },
  logoutBtnSmall: {
    width: '100%',
    padding: 8,
    background: 'transparent',
    color: '#f87171',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
  },

  // ====== CHAT ======
  chat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#f5f5f7',
    minWidth: 0,
    overflow: 'hidden',
  },
  header: {
    padding: 14,
    background: 'white',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
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