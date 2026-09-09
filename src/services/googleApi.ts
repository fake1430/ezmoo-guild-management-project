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
): Promise<T> {
  const url = new URL(API_URL);

  url.searchParams.set('action', action);

  Object.entries(parameters).forEach(
    ([key, value]) => {
      url.searchParams.set(key, value);
    },
  );

  const response = await fetch(
    url.toString(),
  );

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

  return result.data;
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

export function getMembers(): Promise<Member[]> {
  return request<Member[]>('members');
}

export function getParties(
  sheetName:
    | 'GuildLeague'
    | 'Overrun'
    | 'AuctionParty',
): Promise<Party[]> {
  return request<Party[]>('party', {
    sheet: sheetName,
  });
}

export function saveParties(
  sheetName:
    | 'GuildLeague'
    | 'Overrun'
    | 'AuctionParty',
  parties: Party[],
): Promise<string> {
  return postRequest({
    action: 'saveParty',
    sheet: sheetName,
    parties,
  });
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

export function getLatestGuildStats(): Promise<StatSubmission[]> {
  return request<StatSubmission[]>('getLatestGuildStats');
}

export function saveStatSubmission(
  submission: {
    memberId: string;
    ign: string;
    submittedByDiscordId: string;
    submittedByDiscordName?: string;
    stats: CharacterStats;
  },
): Promise<string> {
  return postRequest({
    action: 'saveStatSubmission',
    ...submission,
  });
}
