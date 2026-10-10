import { API_URL } from './config';

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  };
}

export async function addFriend(token, friendUsername) {
  const res = await fetch(API_URL + '/friends/add', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ friendUsername: friendUsername }),
  });
  return res.json();
}

export async function getFriends(token) {
  const res = await fetch(API_URL + '/friends', {
    headers: authHeaders(token),
  });
  const data = await res.json();
  return data.friends || [];
}

export async function markRead(token, friendUsername) {
  await fetch(API_URL + '/messages/' + friendUsername + '/read', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function getMessages(token, friendUsername) {
  const res = await fetch(API_URL + '/messages/' + friendUsername, {
    headers: authHeaders(token),
  });
  return res.json();
}

export async function getUnreadCounts(token) {
  const res = await fetch(API_URL + '/messages/unread', {
    headers: authHeaders(token),
  });
  const data = await res.json();
  return data.unreadCounts || {};
}