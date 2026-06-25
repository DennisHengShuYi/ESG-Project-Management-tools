import fs from 'fs';
import { BACKEND_URL, TEST_USER_PATH } from '../../../playwright.config';

interface TestUser {
  email: string;
  password: string;
  token: string;
  organisation_id: string;
  user_id: string;
}

let cachedUser: TestUser | null = null;

export function getTestUser(): TestUser {
  if (!cachedUser) {
    cachedUser = JSON.parse(fs.readFileSync(TEST_USER_PATH, 'utf-8'));
  }
  return cachedUser!;
}

async function authedFetch(pathname: string, init: RequestInit = {}) {
  const { token } = getTestUser();
  const res = await fetch(`${BACKEND_URL}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  return res;
}

/** Direct API helpers — used to verify data actually persisted server-side
 * (in Supabase), independent of whatever the UI optimistically renders. */
export const api = {
  async getEvents() {
    const res = await authedFetch('/api/events');
    return res.json();
  },
  async getEventDetail(id: string) {
    const res = await authedFetch(`/api/events/${id}`);
    return res.json();
  },
  async createEvent(body: Record<string, any>) {
    const res = await authedFetch('/api/events', { method: 'POST', body: JSON.stringify(body) });
    return res.json();
  },
  async deleteEvent(id: string) {
    const res = await authedFetch(`/api/events/${id}`, { method: 'DELETE' });
    return res.json();
  },
  async bulkUpdate(id: string, flat: Record<string, any>) {
    const res = await authedFetch(`/api/events/${id}/bulk-update`, { method: 'POST', body: JSON.stringify(flat) });
    return res.json();
  },
  async saveModule(id: string, module: string, flat: Record<string, any>) {
    const res = await authedFetch(`/api/events/${id}/${module}`, { method: 'POST', body: JSON.stringify(flat) });
    return res.json();
  },
  async getGovernance(year = '2025') {
    const res = await authedFetch(`/api/governance?year=${year}`);
    return res.json();
  },
  async saveGovernance(body: Record<string, any>, year = '2025') {
    const res = await authedFetch(`/api/governance?year=${year}`, { method: 'POST', body: JSON.stringify(body) });
    return res.json();
  },
  async getSettings() {
    const res = await authedFetch('/api/settings');
    return res.json();
  },
  async saveSettings(body: Record<string, any>) {
    const res = await authedFetch('/api/settings', { method: 'POST', body: JSON.stringify(body) });
    return res.json();
  },
};
