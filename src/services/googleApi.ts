import type { Member } from '../types/member';
import type { Party } from '../types/partyTypes';
import type {
  AttendanceEventType,
  AttendanceRecord,
  AttendanceSaveItem,
  LeaveSummary,
} from '../types/attendance';


interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: string;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

const API_URL = import.meta.env.VITE_GOOGLE_API_URL;

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

  Object.entries(parameters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`เชื่อมต่อ API ไม่สำเร็จ: ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<T>;

  if ('error' in result) {
    throw new Error(result.error || 'เกิดข้อผิดพลาดจาก API');
  }

  return result.data;
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

export async function saveParties(
  sheetName:
    | 'GuildLeague'
    | 'Overrun'
    | 'AuctionParty',
  parties: Party[],
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'saveParty',
      sheet: sheetName,
      parties,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `บันทึกข้อมูลไม่สำเร็จ: HTTP ${response.status}`,
    );
  }

  const result = (await response.json()) as
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

export function getAttendance(
  eventDate: string,
  eventType: AttendanceEventType,
): Promise<AttendanceRecord[]> {
  return request<AttendanceRecord[]>('getAttendance', {
    date: eventDate,
    eventType,
  });
}

export function getLeaveSummary(
  month: string,
  eventType: AttendanceEventType,
): Promise<LeaveSummary> {
  return request<LeaveSummary>('getLeaveSummary', {
    month,
    eventType,
  });
}
export async function saveAttendance(
  eventDate: string,
  eventType: AttendanceEventType,
  attendance: AttendanceSaveItem[],
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'saveAttendance',
      date: eventDate,
      eventType,
      attendance,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `บันทึกข้อมูลไม่สำเร็จ: HTTP ${response.status}`,
    );
  }

  const result = (await response.json()) as
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