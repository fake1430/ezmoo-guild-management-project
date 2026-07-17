import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  getAttendance,
  getLeaveSummary,
  saveAttendance,
} from '../services/googleApi';

import type {
  AttendanceEventType,
  AttendanceMember,
  DiscordStatus,
  WarStatus,
} from '../types/attendance';

import type { Member } from '../types/member';

interface UseAttendanceResult {
  attendanceMembers: AttendanceMember[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string;
  saveMessage: string;
  reloadAttendance: () => Promise<void>;
  setWarStatus: (
    memberId: string,
    warStatus: WarStatus,
  ) => void;
  setDiscordStatus: (
    memberId: string,
    discordStatus: DiscordStatus,
  ) => void;
  setNote: (
    memberId: string,
    note: string,
  ) => void;
  saveCurrentAttendance: () => Promise<boolean>;
}

interface UseAttendanceParameters {
  members: Member[];
  eventDate: string;
  eventType: AttendanceEventType;
}

export function useAttendance({
  members,
  eventDate,
  eventType,
}: UseAttendanceParameters): UseAttendanceResult {
  const [
    attendanceMembers,
    setAttendanceMembers,
  ] = useState<AttendanceMember[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    saveMessage,
    setSaveMessage,
  ] = useState('');

  const loadAttendance =
    useCallback(async (): Promise<void> => {
      if (!eventDate || members.length === 0) {
        setAttendanceMembers([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage('');
        setSaveMessage('');

        const month = eventDate.slice(0, 7);

        const [
          attendanceRecords,
          leaveSummary,
        ] = await Promise.all([
          getAttendance(
            eventDate,
            eventType,
          ),
          getLeaveSummary(
            month,
            eventType,
          ),
        ]);

        const attendanceByMember =
          new Map(
            attendanceRecords.map(
              (record) => [
                record.memberId,
                record,
              ],
            ),
          );

        const mergedMembers =
          members.map(
            (
              member,
            ): AttendanceMember => {
              const attendanceRecord =
                attendanceByMember.get(
                  member.memberId,
                );

              const savedLeaveCount =
                leaveSummary[
                  member.memberId
                ] ?? 0;

              /*
               * getLeaveSummary รวมข้อมูลของวันที่ที่เลือก
               * หากแถวเดิมของวันนี้เป็น Leave ให้หักออกก่อน
               *
               * ตอนแสดงผลหน้า Attendance จะคำนวณ:
               * monthlyLeaveCount +
               * (warStatus === 'Leave' ? 1 : 0)
               *
               * ทำให้การแก้สถานะปัจจุบันไม่ถูกนับซ้ำ
               */
              const leaveCountWithoutCurrent =
                Math.max(
                  0,
                  savedLeaveCount -
                    (attendanceRecord
                      ?.warStatus ===
                    'Leave'
                      ? 1
                      : 0),
                );

              const className =
                eventType ===
                'GuildLeague'
                  ? member.guildLeagueClass
                  : member.overrunClass;

              return {
                memberId:
                  member.memberId,
                ign: member.ign,
                className,
                warStatus:
                  attendanceRecord
                    ?.warStatus ?? '',
                discordStatus:
                  attendanceRecord
                    ?.discordStatus ?? '',
                note:
                  attendanceRecord
                    ?.note ?? '',
                monthlyLeaveCount:
                  leaveCountWithoutCurrent,
              };
            },
          );

        setAttendanceMembers(
          mergedMembers,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'ไม่สามารถโหลดข้อมูลเช็กชื่อได้';

        setErrorMessage(message);
        setAttendanceMembers([]);
      } finally {
        setIsLoading(false);
      }
    }, [
      eventDate,
      eventType,
      members,
    ]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  function updateAttendanceMember(
    memberId: string,
    update: Partial<
      Pick<
        AttendanceMember,
        | 'warStatus'
        | 'discordStatus'
        | 'note'
      >
    >,
  ): void {
    setAttendanceMembers(
      (currentMembers) =>
        currentMembers.map(
          (member) =>
            member.memberId ===
            memberId
              ? {
                  ...member,
                  ...update,
                }
              : member,
        ),
    );

    setSaveMessage('');
  }

  function setWarStatus(
    memberId: string,
    warStatus: WarStatus,
  ): void {
    updateAttendanceMember(
      memberId,
      {
        warStatus,
      },
    );
  }

  function setDiscordStatus(
    memberId: string,
    discordStatus: DiscordStatus,
  ): void {
    updateAttendanceMember(
      memberId,
      {
        discordStatus,
      },
    );
  }

  function setNote(
    memberId: string,
    note: string,
  ): void {
    updateAttendanceMember(
      memberId,
      {
        note,
      },
    );
  }

  async function saveCurrentAttendance(): Promise<boolean> {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSaveMessage('');

      /*
       * ไม่ส่งสมาชิกที่ยังไม่มีข้อมูลใดเลย
       * เพื่อไม่ให้ชีต Attendance มีแถวว่าง
       */
      const attendance =
        attendanceMembers
          .filter(
            (member) =>
              member.warStatus !== '' ||
              member.discordStatus !==
                '' ||
              member.note.trim() !== '',
          )
          .map((member) => ({
            memberId: member.memberId,
            warStatus:
              member.warStatus,
            discordStatus:
              member.discordStatus,
            note: member.note.trim(),
          }));

            const message =
            await saveAttendance(
                eventDate,
                eventType,
                attendance,
            );

            await loadAttendance();

            setSaveMessage(message);

            return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถบันทึกข้อมูลเช็กชื่อได้';

      setErrorMessage(message);

      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    attendanceMembers,
    isLoading,
    isSaving,
    errorMessage,
    saveMessage,
    reloadAttendance:
      loadAttendance,
    setWarStatus,
    setDiscordStatus,
    setNote,
    saveCurrentAttendance,
  };
}