export type AttendanceEventType = 'GuildLeague' | 'Overrun';

export type WarStatus = 'Present' | 'Leave' | 'Absent' | '';

export type DiscordStatus = 'Online' | 'Offline' | '';

export interface AttendanceRecord {
  attendanceId: string;
  eventDate: string;
  eventType: AttendanceEventType;
  memberId: string;
  warStatus: WarStatus;
  discordStatus: DiscordStatus;
  note: string;
  updatedAt: string;
}

export interface AttendanceMember {
  memberId: string;
  ign: string;
  className: string;
  warStatus: WarStatus;
  discordStatus: DiscordStatus;
  note: string;
  monthlyLeaveCount: number;
}

export interface AttendanceSaveItem {
  memberId: string;
  warStatus: WarStatus;
  discordStatus: DiscordStatus;
  note: string;
}

export interface SaveAttendancePayload {
  eventDate: string;
  eventType: AttendanceEventType;
  records: AttendanceSaveItem[];
}

export type LeaveSummary = Record<string, number>;