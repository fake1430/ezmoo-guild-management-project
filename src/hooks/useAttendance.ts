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

type BulkUpdateField =
  | 'warStatus'
  | 'discordStatus';

type BulkUpdateValue =
  | WarStatus
  | DiscordStatus;

interface UseAttendanceResult {
  attendanceMembers: AttendanceMember[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string;
  saveMessage: string;

  canUndo: boolean;
  canRedo: boolean;

  undo: () => void;
  redo: () => void;
  clearAllAttendance: () => void;

  bulkUpdateAttendance: (
    field: BulkUpdateField,
    value: BulkUpdateValue,
  ) => void;

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

type AttendanceMemberUpdate = Partial<
  Pick<
    AttendanceMember,
    'warStatus' | 'discordStatus' | 'note'
  >
>;

function cloneAttendanceMembers(
  attendanceMembers: AttendanceMember[],
): AttendanceMember[] {
  return attendanceMembers.map((member) => ({
    ...member,
  }));
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

  const [
    historyPast,
    setHistoryPast,
  ] = useState<AttendanceMember[][]>([]);

  const [
    historyFuture,
    setHistoryFuture,
  ] = useState<AttendanceMember[][]>([]);

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

  const resetHistory =
    useCallback((): void => {
      setHistoryPast([]);
      setHistoryFuture([]);
    }, []);

  const loadAttendance =
    useCallback(async (): Promise<void> => {
      if (
        !eventDate ||
        members.length === 0
      ) {
        setAttendanceMembers([]);
        resetHistory();
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage('');
        setSaveMessage('');

        const month =
          eventDate.slice(0, 7);

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

        resetHistory();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'ไม่สามารถโหลดข้อมูลเช็กชื่อได้';

        setErrorMessage(message);
        setAttendanceMembers([]);
        resetHistory();
      } finally {
        setIsLoading(false);
      }
    }, [
      eventDate,
      eventType,
      members,
      resetHistory,
    ]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  function addHistorySnapshot(
    previousState: AttendanceMember[],
  ): void {
    setHistoryPast(
      (currentHistory) => [
        ...currentHistory,
        cloneAttendanceMembers(
          previousState,
        ),
      ],
    );

    setHistoryFuture([]);
    setSaveMessage('');
  }

  function updateAttendanceMember(
    memberId: string,
    update: AttendanceMemberUpdate,
  ): void {
    const targetMember =
      attendanceMembers.find(
        (member) =>
          member.memberId === memberId,
      );

    if (!targetMember) {
      return;
    }

    const hasChanged =
      Object.entries(update).some(
        ([key, value]) =>
          targetMember[
            key as keyof AttendanceMember
          ] !== value,
      );

    if (!hasChanged) {
      return;
    }

    const previousState =
      cloneAttendanceMembers(
        attendanceMembers,
      );

    const nextState =
      attendanceMembers.map(
        (member) =>
          member.memberId === memberId
            ? {
                ...member,
                ...update,
              }
            : member,
      );

    addHistorySnapshot(
      previousState,
    );

    setAttendanceMembers(
      nextState,
    );
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

  function undo(): void {
    if (historyPast.length === 0) {
      return;
    }

    const previousState =
      historyPast[
        historyPast.length - 1
      ];

    const currentState =
      cloneAttendanceMembers(
        attendanceMembers,
      );

    setHistoryPast(
      historyPast.slice(0, -1),
    );

    setHistoryFuture(
      (currentFuture) => [
        currentState,
        ...currentFuture,
      ],
    );

    setAttendanceMembers(
      cloneAttendanceMembers(
        previousState,
      ),
    );

    setSaveMessage('');
  }

  function redo(): void {
    if (historyFuture.length === 0) {
      return;
    }

    const nextState =
      historyFuture[0];

    const currentState =
      cloneAttendanceMembers(
        attendanceMembers,
      );

    setHistoryFuture(
      historyFuture.slice(1),
    );

    setHistoryPast(
      (currentHistory) => [
        ...currentHistory,
        currentState,
      ],
    );

    setAttendanceMembers(
      cloneAttendanceMembers(
        nextState,
      ),
    );

    setSaveMessage('');
  }

  function clearAllAttendance(): void {
    const hasAttendanceData =
      attendanceMembers.some(
        (member) =>
          member.warStatus !== '' ||
          member.discordStatus !== '' ||
          member.note.trim() !== '',
      );

    if (!hasAttendanceData) {
      return;
    }

    const previousState =
      cloneAttendanceMembers(
        attendanceMembers,
      );

    const clearedMembers =
      attendanceMembers.map(
        (member): AttendanceMember => ({
          ...member,
          warStatus: '',
          discordStatus: '',
          note: '',
        }),
      );

    addHistorySnapshot(
      previousState,
    );

    setAttendanceMembers(
      clearedMembers,
    );
  }

  function bulkUpdateAttendance(
    field: BulkUpdateField,
    value: BulkUpdateValue,
  ): void {
    /*
     * ป้องกันการส่งค่าผิดประเภท เช่น
     * warStatus = Online
     * discordStatus = Present
     */
    if (
      field === 'warStatus' &&
      ![
        '',
        'Present',
        'Leave',
        'Absent',
      ].includes(value)
    ) {
      return;
    }

    if (
      field === 'discordStatus' &&
      ![
        '',
        'Online',
        'Offline',
      ].includes(value)
    ) {
      return;
    }

    const hasChange =
      attendanceMembers.some(
        (member) =>
          member[field] !== value,
      );

    if (!hasChange) {
      return;
    }

    const previousState =
      cloneAttendanceMembers(
        attendanceMembers,
      );

    const updatedMembers =
      attendanceMembers.map(
        (member): AttendanceMember => {
          if (
            field === 'warStatus'
          ) {
            return {
              ...member,
              warStatus:
                value as WarStatus,
            };
          }

          return {
            ...member,
            discordStatus:
              value as DiscordStatus,
          };
        },
      );

    addHistorySnapshot(
      previousState,
    );

    setAttendanceMembers(
      updatedMembers,
    );
  }

  async function saveCurrentAttendance(): Promise<boolean> {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSaveMessage('');

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
            memberId:
              member.memberId,
            warStatus:
              member.warStatus,
            discordStatus:
              member.discordStatus,
            note:
              member.note.trim(),
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

    canUndo:
      historyPast.length > 0,
    canRedo:
      historyFuture.length > 0,

    undo,
    redo,
    clearAllAttendance,
    bulkUpdateAttendance,

    reloadAttendance:
      loadAttendance,

    setWarStatus,
    setDiscordStatus,
    setNote,
    saveCurrentAttendance,
  };
}