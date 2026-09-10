import type { Member } from '../../src/types/member.js';
import type { DiscordMemberLink } from '../types/discordMemberLink.js';
import type {
  CharacterStats,
  StatSubmission,
} from '../../shared/characterStats.js';

interface ApiSuccess<T> {
  success: true;
  data?: T;
  message?: string;
}

interface ApiFailure {
  success: false;
  error: string;
}

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

function getApiUrl(): string {
  const apiUrl = process.env.GOOGLE_API_URL;
  if (!apiUrl) {
    throw new Error('Missing GOOGLE_API_URL');
  }
  return apiUrl;
}

async function readResult<T>(response: Response): Promise<ApiSuccess<T>> {
  if (!response.ok) {
    throw new Error(`Guild API returned HTTP ${response.status}`);
  }
  const result = (await response.json()) as ApiResult<T>;
  if (!result.success) {
    throw new Error(result.error || 'Guild API request failed');
  }
  return result;
}

export async function getMembers(): Promise<Member[]> {
  const url = new URL(getApiUrl());
  url.searchParams.set('action', 'members');
  const result = await readResult<Member[]>(await fetch(url));
  return result.data ?? [];
}

export async function getDiscordMemberLinks(): Promise<DiscordMemberLink[]> {
  const url = new URL(getApiUrl());
  url.searchParams.set('action', 'getDiscordMemberLinks');
  const result = await readResult<DiscordMemberLink[]>(await fetch(url));
  return result.data ?? [];
}

export async function saveDiscordMemberLink(input: {
  discordUserId: string;
  memberId: string;
  linkedByDiscordId: string;
}): Promise<DiscordMemberLink> {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'saveDiscordMemberLink', ...input }),
  });
  const result = await readResult<DiscordMemberLink>(response);
  if (!result.data) throw new Error('Guild API did not return the saved link');
  return result.data;
}

export async function deleteDiscordMemberLink(
  discordUserId: string,
): Promise<DiscordMemberLink> {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'deleteDiscordMemberLink', discordUserId }),
  });
  const result = await readResult<DiscordMemberLink>(response);
  if (!result.data) throw new Error('Discord member link not found');
  return result.data;
}

export async function saveStatSubmission(input: {
  memberId: string;
  ign: string;
  submittedByDiscordId: string;
  submittedByDiscordName: string;
  stats: CharacterStats;
}): Promise<StatSubmission | null> {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'saveStatSubmission', ...input }),
  });
  const result = await readResult<StatSubmission>(response);
  return result.data ?? null;
}
