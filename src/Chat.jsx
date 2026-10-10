import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { addFriend, getFriends, markRead, getMessages } from './api';

export default function Chat({ me, token, onLogout, onOpenAdmin }) {
  const [friends, setFriends] = useState([]);
  const [activeFriend, setActiveFriend] = useState(() => {
    return localStorage.getItem('active_friend') || null;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendMsg, setAddFriendMsg] = useState('');
  const [pullDistance, setPullDistance] = useState(0);
const [refreshing, setRefreshing] = useState(false);
const [showExitWarning, setShowExitWarning] = useState(false);
const exitWarningTimer = useRef(null);
const backPressedRef = useRef(false);

const touchStartY = useRef(0);
const isPulling = useRef(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeFriendRef = useRef(null);

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
    localStorage.removeItem('active_friend');
    setMessages([]);
    setFriendTyping(false);
  }
  async function handleManualRefresh() {
  setRefreshing(true);
  try {
    const list = await getFriends(token);
    setFriends(list);

    if (activeFriend) {
      const history = await getMessages(token, activeFriend);
      const mapped = history.map((m) => ({
        ...m,
        mine: m.from === me.username,
      }));
      setMessages(mapped);
    }
  } catch (err) {
    console.error('Refresh failed:', err);
  }
  setTimeout(() => setRefreshing(false), 800);
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
// ============ PULL TO REFRESH ============
function handleTouchStart(e) {
  if (scrollRef.current && scrollRef.current.scrollTop > 0) {
    isPulling.current = false;
    return;
  }
  touchStartY.current = e.touches[0].clientY;
  isPulling.current = true;
}

function handleTouchMove(e) {
  if (!isPulling.current) return;

  const deltaY = e.touches[0].clientY - touchStartY.current;

  if (deltaY > 0 && !refreshing) {
    const distance = Math.min(deltaY * 0.5, 100);
    setPullDistance(distance);
  } else {
    setPullDistance(0);
  }
}

async function handleTouchEnd() {
  if (!isPulling.current) return;
  isPulling.current = false;

  if (pullDistance > 60) {
    setRefreshing(true);
    setPullDistance(60);

    try {
      const list = await getFriends(token);
      setFriends(list);

      if (activeFriend) {
        const history = await getMessages(token, activeFriend);
        const mapped = history.map((m) => ({
          ...m,
          mine: m.from === me.username,
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    }

    setTimeout(() => {
      setRefreshing(false);
      setPullDistance(0);
    }, 500);
  } else {
    setPullDistance(0);
  }
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
  // ============ ANDROID BACK BUTTON HANDLER ============
useEffect(() => {
  // Push a fake history state so back button doesn't exit immediately
  window.history.pushState({ app: true }, '');

  function handlePopState() {
    // If chat is open → close chat (go to sidebar)
    if (activeFriendRef.current) {
      setActiveFriend(null);
      localStorage.removeItem('active_friend');
      setMessages([]);
      setFriendTyping(false);

      // Push state again to stay in app
      window.history.pushState({ app: true }, '');
      return;
    }

    // If already on sidebar → show exit warning
    if (!backPressedRef.current) {
      // First press
      backPressedRef.current = true;
      setShowExitWarning(true);

      // Push state again to prevent exit
      window.history.pushState({ app: true }, '');

      // Reset after 2 seconds
      if (exitWarningTimer.current) clearTimeout(exitWarningTimer.current);
      exitWarningTimer.current = setTimeout(() => {
        backPressedRef.current = false;
        setShowExitWarning(false);
      }, 2000);
    } else {
      // Second press within 2 seconds — allow exit
      // Don't push state, let browser go back
      window.history.back();
    }
  }

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
    if (exitWarningTimer.current) clearTimeout(exitWarningTimer.current);
  };
}, []);

// ============ ANDROID BACK BUTTON HANDLER ============
useEffect(() => {
  window.history.pushState({ app: true }, '');

  function handlePopState() {
    if (activeFriendRef.current) {
      setActiveFriend(null);
      localStorage.removeItem('active_friend');
      setMessages([]);
      setFriendTyping(false);
      window.history.pushState({ app: true }, '');
      return;
    }

    if (!backPressedRef.current) {
      backPressedRef.current = true;
      setShowExitWarning(true);
      window.history.pushState({ app: true }, '');

      if (exitWarningTimer.current) clearTimeout(exitWarningTimer.current);
      exitWarningTimer.current = setTimeout(() => {
        backPressedRef.current = false;
        setShowExitWarning(false);
      }, 2000);
    } else {
      window.history.back();
    }
  }

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
    if (exitWarningTimer.current) clearTimeout(exitWarningTimer.current);
  };
}, []);
function RefreshIcon({ spinning }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: spinning ? 'spin 0.8s linear infinite' : 'none',
        transition: 'transform 0.3s',
      }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ============ MAIN RENDER ============
  return (
    <div style={s.app}> 
    {showExitWarning && (
  <div style={s.exitWarning}>Press back again to exit</div>
)}{/* Exit Warning Toast */}
    {/* Logout Confirmation Dialog */}
{showLogoutConfirm && (
  <div style={s.modalOverlay}>
    <div style={s.modalBox}>
      <h3 style={s.modalTitle}>Log out?</h3>
      <p style={s.modalText}>
        Are you sure you want to log out of your account?
      </p>
      <div style={s.modalButtons}>
        <button
          style={s.modalCancelBtn}
          onClick={() => setShowLogoutConfirm(false)}
        >
          Cancel
        </button>
        <button
          style={s.modalConfirmBtn}
          onClick={() => {
            setShowLogoutConfirm(false);
            onLogout();
          }}
        >
          Log out
        </button>
      </div>
    </div>
  </div>
)}
{showExitWarning && (
  <div style={s.exitWarning}>
    Press back again to exit
  </div>
)}
      {!activeFriend ? (
        // ====== SIDEBAR / CHAT LIST (full screen) ======
        <div
  style={s.sidebar}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
          {/* Header */}
          {/* Pull to refresh indicator */}
<div
  style={{
    height: pullDistance,
    overflow: 'hidden',
    transition: refreshing ? 'height 0.2s' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1e1e2f',
  }}
>
  {pullDistance > 0 && (
    <div
      style={{
        color: '#667eea',
        fontSize: 20,
        transition: 'transform 0.2s',
        transform: refreshing
          ? 'rotate(360deg)'
          : `rotate(${pullDistance * 3}deg)`,
      }}
    >
      🔄
    </div>
  )}
</div>
          <div style={s.sidebarTop}>
  <div style={s.userInfo}>
    <strong style={s.username}>{me.username}</strong>
    <div
      style={{
        fontSize: 12,
        color: connected ? '#4ade80' : '#f87171',
      }}
    >
      {connected ? 'Online' : 'Offline'}
    </div>
  </div>
  <div style={s.sidebarTopRight}>
    {onOpenAdmin && (
      <button style={s.adminBtnCenter} onClick={onOpenAdmin}>
        Admin
      </button>
    )}
    <button
      style={s.refreshBtn}
      onClick={handleManualRefresh}
      title="Refresh"
    >
      <RefreshIcon spinning={refreshing} />
    </button>
  </div>
</div>

          {/* Add friend */}
          <div style={s.addBox}>
            <input
              style={s.friendInput}
              placeholder="Add by username"
              value={addFriendInput}
              onChange={(e) => setAddFriendInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
            />
            <button style={s.openBtn} onClick={handleAddFriend}>
              +
            </button>
          </div>
          {addFriendMsg && <div style={s.addMsg}>{addFriendMsg}</div>}

          {/* Friends list */}
          <div style={s.friendsLabel}>FRIENDS</div>
          <div style={s.friendsList}>
            {friends.length === 0 && (
              <div style={{ color: '#666', fontSize: 13, padding: 12 }}>
                No friends yet. Add someone above!
              </div>
            )}
            {friends.map((f) => (
              <div
                key={f}
                style={s.friendItem}
                onClick={() => openChat(f)}
              >
                <div style={s.avatar}>{f[0].toUpperCase()}</div>
                <span style={s.friendName}>{f}</span>
              </div>
            ))}
          </div>

          {/* Logout */}
          <div style={s.logoutBottom}>
            <button
  style={s.logoutBtn}
  onClick={() => setShowLogoutConfirm(true)}
>
  Log out
</button>
          </div>
        </div>
      ) : (
        // ====== CHAT (full screen) ======
        <div
  style={s.chat}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
          {/* Header with back button */}
          <div style={s.header}>
  <button style={s.backBtn} onClick={closeChat}>
    ←
  </button>
  <div style={s.headerInfo}>
    <div style={s.avatar}>{activeFriend[0].toUpperCase()}</div>
    <div>
      <strong>{activeFriend}</strong>
      {friendTyping && (
        <div style={s.typingText}>typing...</div>
      )}
    </div>
  </div>
  <button
    style={s.refreshBtn}
    onClick={handleManualRefresh}
    title="Refresh"
  >
    <RefreshIcon spinning={refreshing} />
  </button>
</div>

          {/* Messages */}
          <div ref={scrollRef} style={s.messages}>
            {messages.length === 0 && (
              <div style={s.emptyText}>No messages yet. Say hi!</div>
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

          {/* Input */}
          <div style={s.inputRow}>
            <input
              style={s.msgInput}
              value={input}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message..."
            />
            <button style={s.sendBtn} onClick={send}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
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
    background: '#1e1e2f',
  },
  exitWarning: {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(30, 30, 47, 0.95)',
  color: 'white',
  padding: '12px 24px',
  borderRadius: 24,
  fontSize: 14,
  fontWeight: 500,
  zIndex: 9999,
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  animation: 'fadeIn 0.2s ease',
  whiteSpace: 'nowrap',
},

  exitWarning: {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(30, 30, 47, 0.95)',
  color: 'white',
  padding: '12px 24px',
  borderRadius: 24,
  fontSize: 14,
  fontWeight: 500,
  zIndex: 9999,
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  animation: 'fadeIn 0.2s ease',
  whiteSpace: 'nowrap',
},
modalOverlay: {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  padding: 20,
  animation: 'fadeIn 0.15s ease',
},
modalBox: {
  background: 'white',
  borderRadius: 16,
  padding: 24,
  maxWidth: 340,
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
},
modalTitle: {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: '#1e1e2f',
  marginBottom: 8,
},
modalText: {
  margin: 0,
  fontSize: 14,
  color: '#666',
  lineHeight: 1.5,
  marginBottom: 24,
},
modalButtons: {
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
},
modalCancelBtn: {
  padding: '10px 20px',
  background: 'transparent',
  color: '#666',
  border: '1px solid #ddd',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
},
modalConfirmBtn: {
  padding: '10px 20px',
  background: '#f87171',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
},

  // ====== SIDEBAR (Full Screen) ======
  sidebar: {
    flex: 1,
    background: '#1e1e2f',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxWidth: 500,
    margin: '0 auto',
    width: '100%',
  },
  sidebarTop: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  userInfo: {
    overflow: 'hidden',
  },
  username: {
    display: 'block',
    fontSize: 18,
  },
  adminBtn: {
    background: 'transparent',
    color: '#4ade80',
    border: '1px solid #4ade80',
    padding: '6px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },

  sidebarTopRight: {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
},
adminBtnCenter: {
  background: 'transparent',
  color: '#4ade80',
  border: '1px solid #4ade80',
  padding: '6px 12px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
},
refreshBtn: {
  background: '#667eea',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  padding: 8,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  flexShrink: 0,
  boxShadow: '0 2px 6px rgba(102,126,234,0.4)',
  transition: 'all 0.15s',
},

  // ====== ADD FRIEND ======
  addBox: {
    display: 'flex',
    gap: 8,
    padding: 16,
    flexShrink: 0,
  },
  friendInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    minWidth: 0,
    outline: 'none',
  },
  openBtn: {
    padding: '10px 16px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16,
  },
  addMsg: {
    fontSize: 12,
    color: '#aaa',
    padding: '0 16px 8px',
    flexShrink: 0,
  },

  // ====== FRIENDS ======
  friendsLabel: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 1,
    padding: '8px 16px',
    flexShrink: 0,
  },
  friendsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowY: 'auto',
    padding: '0 12px',
    flex: 1,
  },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  friendName: {
    fontSize: 15,
    fontWeight: 500,
  },
  avatar: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: '50%',
    background: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'white',
    fontSize: 16,
  },

  // ====== LOGOUT ======
  logoutBottom: {
    padding: 16,
    borderTop: '1px solid #333',
    flexShrink: 0,
  },
  logoutBtn: {
    width: '100%',
    padding: 12,
    background: 'transparent',
    color: '#f87171',
    border: '1px solid #f87171',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  },

  // ====== CHAT (Full Screen) ======
  chat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#f5f5f7',
    overflow: 'hidden',
    maxWidth: 900,
    margin: '0 auto',
    width: '100%',
  },
  header: {
    padding: 12,
    background: 'white',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    color: '#667eea',
    padding: '4px 8px',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  typingText: {
    fontSize: 12,
    color: '#4ade80',
    fontStyle: 'italic',
  },

  // ====== MESSAGES ======
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },

  // ====== INPUT ======
  inputRow: {
    display: 'flex',
    padding: 12,
    background: 'white',
    borderTop: '1px solid #e0e0e0',
    gap: 8,
    flexShrink: 0,
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
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