const API_BASE = import.meta.env.VITE_API_URL
export const TOKEN_KEY = 'bizsaathi_auth_token';
export const USER_KEY = 'bizsaathi_user';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to store auth token:', err);
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.error('Failed to store user profile:', err);
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear auth:', err);
  }
}

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const signal = options.signal || (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined);

  const response = await fetch(url, {
    ...options,
    headers,
    signal,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail = Array.isArray(errData.detail)
          ? errData.detail.map((d) => d.msg || d).join(', ')
          : errData.detail;
      }
    } catch {
      // Non-json error
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }

  // If 204 or empty response
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  auth: {
    register: async ({ name, email, password, confirm_password }) => {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, confirm_password }),
      });
      if (data.access_token) {
        setStoredToken(data.access_token);
        setStoredUser(data.user);
      }
      return data;
    },

    login: async ({ email, password }) => {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.access_token) {
        setStoredToken(data.access_token);
        setStoredUser(data.user);
      }
      return data;
    },

    getMe: async () => {
      return apiRequest('/api/auth/me');
    },

    updateProfile: async ({ name, theme }) => {
      const data = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, theme }),
      });
      setStoredUser(data);
      return data;
    },

    changePassword: async ({ current_password, new_password, confirm_new_password }) => {
      return apiRequest('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password, new_password, confirm_new_password }),
      });
    },

    logout: () => {
      clearStoredAuth();
    },
  },

  businessProfile: {
    get: async () => {
      return apiRequest('/api/business-profile');
    },

    save: async (profileData) => {
      return apiRequest('/api/business-profile', {
        method: 'POST',
        body: JSON.stringify(profileData),
      });
    },

    update: async (profileData) => {
      return apiRequest('/api/business-profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
    },
  },

  conversations: {
    list: async () => {
      return apiRequest('/api/conversations');
    },

    create: async (title = 'General Advice') => {
      return apiRequest('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
    },

    get: async (conversationId) => {
      return apiRequest(`/api/conversations/${conversationId}`);
    },

    transfer: async ({ title, migration_id, business_context, messages }) => {
      return apiRequest('/api/conversations/transfer', {
        method: 'POST',
        body: JSON.stringify({ title, migration_id, business_context, messages }),
      });
    },

    migrateGuest: async (payload) => {
      return apiRequest('/api/conversations/migrate-guest', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    addMessage: async (conversationId, messageData) => {
      return apiRequest(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
    },

    delete: async (conversationId) => {
      return apiRequest(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
    },
  },

  chat: {
    send: async (chatPayload) => {
      return apiRequest('/chat', {
        method: 'POST',
        body: JSON.stringify(chatPayload),
      });
    },

    stream: async (chatPayload, { onChunk, onDone }) => {
      const url = `${API_BASE}/chat`;
      const token = getStoredToken();
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...chatPayload, stream: true }),
      });

      if (!response.ok) {
        let errorDetail = `Request failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorDetail = Array.isArray(errData.detail)
              ? errData.detail.map((d) => d.msg || d).join(', ')
              : errData.detail;
          }
        } catch {}
        const error = new Error(errorDetail);
        error.status = response.status;
        throw error;
      }

      const contentType = response.headers.get('content-type') || '';
      // If server returned regular JSON response instead of SSE
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.reply) onChunk(data.reply);
        if (onDone) onDone(data);
        return data;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let convId = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.chunk) onChunk(parsed.chunk);
              if (parsed.conversation_id) convId = parsed.conversation_id;
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.done && onDone) onDone({ conversation_id: convId });
            } catch (e) {
              if (e.message && e.message !== 'Unexpected end of JSON input') {
                console.warn('Error parsing SSE event:', e);
              }
            }
          }
        }
      }

      if (buffer.trim().startsWith('data: ')) {
        try {
          const parsed = JSON.parse(buffer.trim().slice(6));
          if (parsed.chunk) onChunk(parsed.chunk);
          if (parsed.conversation_id) convId = parsed.conversation_id;
          if (parsed.done && onDone) onDone({ conversation_id: convId });
        } catch {}
      }

      return { conversation_id: convId };
    },
  },
};
