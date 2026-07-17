import type { Member } from '../types/member';
import type { Party } from '../types/partyTypes';

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
  sheetName: 'GuildLeague' | 'Overrun',
): Promise<Party[]> {
  return request<Party[]>('party', {
    sheet: sheetName,
  });
}