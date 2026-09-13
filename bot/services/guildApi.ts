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

const RETRYABLE_HTTP_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1500];

class HttpResponseError extends Error {
  constructor(readonly status: number) {
    super(`Guild API returned HTTP ${status}`);
  }
}

class InvalidResponseError extends Error {
  constructor(cause: unknown) {
    super('Guild API returned an invalid JSON response', { cause });
  }
}

function getApiUrl(): string {
  const apiUrl = process.env.GOOGLE_API_URL;
  if (!apiUrl) {
    throw new Error('Missing GOOGLE_API_URL');
  }
  return apiUrl;
}

function diagnosticUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.pathname = url.pathname.replace(/\/macros\/s\/[^/]+\//, '/macros/s/<deployment-id>/');
    for (const key of url.searchParams.keys()) {
      url.searchParams.set(key, '<redacted>');
    }
    return url.toString();
  } catch {
    return '<invalid-url>';
  }
}

function shortResponseBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 500);
}

async function readResult<T>(
  response: Response,
  context: { action: string; method: string; attempt: number; startedAt: number },
): Promise<ApiSuccess<T>> {
  const responseBody = await response.text();
  if (!response.ok) {
    console.error('[Guild API] HTTP error', {
      timestamp: new Date().toISOString(),
      action: context.action,
      method: context.method,
      attempt: context.attempt,
      status: response.status,
      responseUrl: diagnosticUrl(response.url),
      contentType: response.headers.get('content-type'),
      durationMs: Date.now() - context.startedAt,
      responseBody: shortResponseBody(responseBody),
    });
    throw new HttpResponseError(response.status);
  }
  let result: ApiResult<T>;
  try {
    result = JSON.parse(responseBody) as ApiResult<T>;
  } catch (error) {
    console.error('[Guild API] Invalid JSON response', {
      timestamp: new Date().toISOString(),
      action: context.action,
      method: context.method,
      attempt: context.attempt,
      status: response.status,
      responseUrl: diagnosticUrl(response.url),
      contentType: response.headers.get('content-type'),
      durationMs: Date.now() - context.startedAt,
      responseBody: shortResponseBody(responseBody),
    });
    throw new InvalidResponseError(error);
  }
  if (!result.success) {
    throw new Error(result.error || 'Guild API request failed');
  }
  return result;
}

async function request<T>(
  url: URL | string,
  init: RequestInit | undefined,
  options: { action: string; method: 'GET' | 'POST'; retry: boolean },
): Promise<ApiSuccess<T>> {
  const attempts = options.retry ? RETRY_DELAYS_MS.length + 1 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, init);
      return await readResult<T>(response, { ...options, attempt, startedAt });
    } catch (error) {
      if (!(error instanceof HttpResponseError) && !(error instanceof InvalidResponseError)) {
        console.error('[Guild API] Request failed', {
          timestamp: new Date().toISOString(),
          action: options.action,
          method: options.method,
          attempt,
          requestUrl: diagnosticUrl(String(url)),
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const retryable = error instanceof HttpResponseError
        ? RETRYABLE_HTTP_STATUSES.has(error.status)
        : error instanceof TypeError || error instanceof InvalidResponseError;
      if (!options.retry || !retryable || attempt === attempts) throw error;
      const delayMs = RETRY_DELAYS_MS[attempt - 1];
      console.warn('[Guild API] Retrying transient failure', {
        timestamp: new Date().toISOString(),
        action: options.action,
        method: options.method,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Guild API retry loop ended unexpectedly');
}

export async function getMembers(): Promise<Member[]> {
  const url = new URL(getApiUrl());
  url.searchParams.set('action', 'members');
  const result = await request<Member[]>(url, undefined, {
    action: 'members', method: 'GET', retry: true,
  });
  return result.data ?? [];
}

export async function getDiscordMemberLinks(): Promise<DiscordMemberLink[]> {
  const url = new URL(getApiUrl());
  url.searchParams.set('action', 'getDiscordMemberLinks');
  const result = await request<DiscordMemberLink[]>(url, undefined, {
    action: 'getDiscordMemberLinks', method: 'GET', retry: true,
  });
  return result.data ?? [];
}

export async function saveDiscordMemberLink(input: {
  discordUserId: string;
  memberId: string;
  linkedByDiscordId: string;
}): Promise<DiscordMemberLink> {
  const result = await request<DiscordMemberLink>(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'saveDiscordMemberLink', ...input }),
  }, {
    action: 'saveDiscordMemberLink', method: 'POST', retry: false,
  });
  if (!result.data) throw new Error('Guild API did not return the saved link');
  return result.data;
}

export async function deleteDiscordMemberLink(
  discordUserId: string,
): Promise<DiscordMemberLink> {
  const result = await request<DiscordMemberLink>(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'deleteDiscordMemberLink', discordUserId }),
  }, {
    action: 'deleteDiscordMemberLink', method: 'POST', retry: false,
  });
  if (!result.data) throw new Error('Discord member link not found');
  return result.data;
}

export async function saveStatSubmission(input: {
  submissionId: string;
  memberId: string;
  ign: string;
  submittedByDiscordId: string;
  submittedByDiscordName: string;
  stats: CharacterStats;
}): Promise<StatSubmission | null> {
  return (await request<StatSubmission>(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'saveStatSubmission', ...input }),
  }, {
    action: 'saveStatSubmission', method: 'POST', retry: true,
  })).data ?? null;
}
