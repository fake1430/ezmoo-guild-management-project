import type { Member } from '../types/member';
import type { Party } from '../types/partyTypes';
import type {
  AttendanceEventType,
  AttendanceRecord,
  AttendanceSaveItem,
  LeaveSummary,
} from '../types/attendance';
import type {
  GuildLeagueAuctionRecord,
  GuildLeagueAuctionSaveItem,
} from '../types/auction';
import type {
  ConfirmOverrunResultPayload,
  OverrunAuctionRecord,
  OverrunAuctionSaveItem,
  OverrunQueueItem,
} from '../types/overrun';
import type { WarPlannerData } from '../types/warPlanner';
import type {
  CharacterStats,
  ClassFocusStatConfig,
  StatSubmission,
} from '../types/characterStats';

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: string;
}

type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;

interface RequestOptions {
  cacheKey?: string;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
}

interface CachedResponse {
  data: unknown;
  expiresAt: number;
}

const GET_RESPONSE_CACHE = new Map<string, CachedResponse>();
const IN_FLIGHT_GET_REQUESTS = new Map<string, Promise<unknown>>();
const GET_CACHE_GENERATIONS = new Map<string, number>();
const MEMBERS_CACHE_TTL_MS = 5 * 60 * 1000;
const PARTY_CACHE_TTL_MS = 2 * 60 * 1000;
const STAT_CACHE_TTL_MS = 60 * 1000;

const API_URL =
  import.meta.env.VITE_GOOGLE_API_URL;

if (!API_URL) {
  throw new Error(
    'ไม่พบ VITE_GOOGLE_API_URL กรุณาตรวจสอบไฟล์ .env.local',
  );
}

async function request<T>(
  action: string,
  parameters: Record<string, string> = {},
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(API_URL);

  url.searchParams.set('action', action);

  Object.entries(parameters).forEach(
    ([key, value]) => {
      url.searchParams.set(key, value);
    },
  );

  const requestUrl = url.toString();
  const cacheKey = options.cacheKey ?? requestUrl;
  if (options.forceRefresh) invalidateGetCache(cacheKey);
  const cached = GET_RESPONSE_CACHE.get(cacheKey);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  if (cached) GET_RESPONSE_CACHE.delete(cacheKey);

  const inFlight = IN_FLIGHT_GET_REQUESTS.get(cacheKey);
  if (!options.forceRefresh && inFlight) return inFlight as Promise<T>;
  const cacheGeneration = GET_CACHE_GENERATIONS.get(cacheKey) ?? 0;

  const requestPromise = (async (): Promise<T> => {
    const response = await fetch(requestUrl);

    if (!response.ok) {
      throw new Error(
        `เชื่อมต่อ API ไม่สำเร็จ: ${response.status}`,
      );
    }

    const result =
      (await response.json()) as ApiResponse<T>;

    if ('error' in result) {
      throw new Error(
        result.error ||
          'เกิดข้อผิดพลาดจาก API',
      );
    }

    if (
      options.cacheTtlMs
      && (GET_CACHE_GENERATIONS.get(cacheKey) ?? 0) === cacheGeneration
    ) {
      GET_RESPONSE_CACHE.set(cacheKey, {
        data: result.data,
        expiresAt: Date.now() + options.cacheTtlMs,
      });
    }
    return result.data;
  })();

  IN_FLIGHT_GET_REQUESTS.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    if (IN_FLIGHT_GET_REQUESTS.get(cacheKey) === requestPromise) {
      IN_FLIGHT_GET_REQUESTS.delete(cacheKey);
    }
  }
}

function invalidateGetCache(cacheKey: string): void {
  GET_RESPONSE_CACHE.delete(cacheKey);
  GET_CACHE_GENERATIONS.set(
    cacheKey,
    (GET_CACHE_GENERATIONS.get(cacheKey) ?? 0) + 1,
  );
}

async function postRequest(
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':
        'text/plain;charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `บันทึกข้อมูลไม่สำเร็จ: HTTP ${response.status}`,
    );
  }

  const result =
    (await response.json()) as
      | {
          success: true;
          message: string;
        }
      | {
          success: false;
          error: string;
        };

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.message;
}

export function getMembers(forceRefresh = false): Promise<Member[]> {
  return request<Member[]>(
    'members',
    forceRefresh ? { forceRefresh: '1' } : {},
    {
      cacheKey: 'members',
      cacheTtlMs: MEMBERS_CACHE_TTL_MS,
      forceRefresh,
    },
  );
}

export function getParties(
  sheetName:
    | 'GuildLeague'
    | 'Overrun'
    | 'AuctionParty',
  forceRefresh = false,
): Promise<Party[]> {
  return request<Party[]>(
    'party',
    {
      sheet: sheetName,
      ...(forceRefresh ? { forceRefresh: '1' } : {}),
    },
    {
      cacheKey: `party:${sheetName}`,
      cacheTtlMs: PARTY_CACHE_TTL_MS,
      forceRefresh,
    },
  );
}

export async function saveParties(
  sheetName:
    | 'GuildLeague'
    | 'Overrun'
    | 'AuctionParty',
  parties: Party[],
): Promise<string> {
  const message = await postRequest({
    action: 'saveParty',
    sheet: sheetName,
    parties,
  });
  invalidateGetCache(`party:${sheetName}`);
  return message;
}

export function getAttendance(
  eventDate: string,
  eventType: AttendanceEventType,
): Promise<AttendanceRecord[]> {
  return request<AttendanceRecord[]>(
    'getAttendance',
    {
      date: eventDate,
      eventType,
    },
  );
}

export function getLeaveSummary(
  month: string,
  eventType: AttendanceEventType,
): Promise<LeaveSummary> {
  return request<LeaveSummary>(
    'getLeaveSummary',
    {
      month,
      eventType,
    },
  );
}

export function getGuildLeagueAuction(
  eventDate: string,
): Promise<GuildLeagueAuctionRecord[]> {
  return request<
    GuildLeagueAuctionRecord[]
  >(
    'getGuildLeagueAuction',
    {
      date: eventDate,
    },
  );
}

export function getOverrunAuction(
  eventDate: string,
): Promise<OverrunAuctionRecord[]> {
  return request<OverrunAuctionRecord[]>(
    'getOverrunAuction',
    {
      date: eventDate,
    },
  );
}

export function getOverrunQueue(): Promise<
  OverrunQueueItem[]
> {
  return request<OverrunQueueItem[]>(
    'getOverrunQueue',
  );
}

export function saveAttendance(
  eventDate: string,
  eventType: AttendanceEventType,
  attendance: AttendanceSaveItem[],
): Promise<string> {
  return postRequest({
    action: 'saveAttendance',
    date: eventDate,
    eventType,
    attendance,
  });
}

export function saveGuildLeagueAuction(
  eventDate: string,
  auction: GuildLeagueAuctionSaveItem[],
): Promise<string> {
  return postRequest({
    action: 'saveGuildLeagueAuction',
    date: eventDate,
    auction,
  });
}

export function saveOverrunAuction(
  eventDate: string,
  auction: OverrunAuctionSaveItem[],
): Promise<string> {
  return postRequest({
    action: 'saveOverrunAuction',
    date: eventDate,
    auction,
  });
}

export function saveOverrunQueue(
  queue: OverrunQueueItem[],
): Promise<string> {
  return postRequest({
    action: 'saveOverrunQueue',
    queue,
  });
}

export function confirmOverrunResult(
  payload: ConfirmOverrunResultPayload,
): Promise<string> {
  const expectedQueueAfter =
    payload.result === 'win'
      ? payload.queueBefore.slice(payload.queueSize)
      : [
          payload.noItemMember.trim(),
          ...payload.queueBefore.slice(payload.queueSize),
        ];
  const firstMismatchIndex = expectedQueueAfter.findIndex(
    (memberName, index) => memberName !== payload.queueAfter[index],
  );

  console.debug('[Overrun confirm request]', {
    queueSize: payload.queueSize,
    queueBeforeLength: payload.queueBefore.length,
    queueAfterLength: payload.queueAfter.length,
    expectedQueueAfter,
    queueAfter: payload.queueAfter,
    firstMismatchIndex:
      firstMismatchIndex >= 0
        ? firstMismatchIndex
        : expectedQueueAfter.length !== payload.queueAfter.length
          ? Math.min(
              expectedQueueAfter.length,
              payload.queueAfter.length,
            )
          : -1,
  });

  return postRequest({
    action: 'confirmOverrunResult',
    ...payload,
  });
}

export function getWarPlanner(
  mapId: string,
): Promise<WarPlannerData | null> {
  return request<WarPlannerData | null>(
    'getWarPlanner',
    { mapId },
  );
}

export function saveWarPlanner(
  plan: WarPlannerData,
): Promise<string> {
  return postRequest({
    action: 'saveWarPlanner',
    plan,
  });
}

export function getMemberStatSubmissions(
  memberId: string,
): Promise<StatSubmission[]> {
  return request<StatSubmission[]>(
    'getMemberStatSubmissions',
    { memberId },
  );
}

export function getLatestMemberStats(
  memberId: string,
): Promise<StatSubmission | null> {
  return request<StatSubmission | null>(
    'getLatestMemberStats',
    { memberId },
  );
}

export function getLatestGuildStats(forceRefresh = false): Promise<StatSubmission[]> {
  return request<StatSubmission[]>(
    'getLatestGuildStats',
    forceRefresh ? { forceRefresh: '1' } : {},
    {
      cacheKey: 'latestGuildStats',
      cacheTtlMs: STAT_CACHE_TTL_MS,
      forceRefresh,
    },
  );
}

export function getStatFocusConfig(forceRefresh = false): Promise<ClassFocusStatConfig[]> {
  return request<ClassFocusStatConfig[]>(
    'getStatFocusConfig',
    forceRefresh ? { forceRefresh: '1' } : {},
    {
      cacheKey: 'statFocusConfig',
      cacheTtlMs: MEMBERS_CACHE_TTL_MS,
      forceRefresh,
    },
  );
}

export async function saveStatFocusConfig(
  config: ClassFocusStatConfig,
): Promise<string> {
  const message = await postRequest({
    action: 'saveStatFocusConfig',
    className: config.className,
    statKeys: config.statKeys,
    criteria: config.criteria ?? [],
  });
  invalidateGetCache('statFocusConfig');
  return message;
}

export async function saveStatSubmission(
  submission: {
    memberId: string;
    ign: string;
    submittedByDiscordId: string;
    submittedByDiscordName?: string;
    stats: CharacterStats;
  },
): Promise<string> {
  const message = await postRequest({
    action: 'saveStatSubmission',
    ...submission,
  });
  invalidateGetCache('latestGuildStats');
  return message;
}
