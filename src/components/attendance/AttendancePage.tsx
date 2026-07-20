import {
  useMemo,
  useRef,
  useState,
} from 'react';
import { toBlob } from 'html-to-image';

import { getClassColor } from '../../constants/classColors';
import { useAttendance } from '../../hooks/useAttendance';

import type {
  AttendanceEventType,
  DiscordStatus,
  WarStatus,
} from '../../types/attendance';

import type { Member } from '../../types/member';

interface AttendancePageProps {
  members: Member[];
  isLoadingMembers: boolean;
  memberErrorMessage: string;
  onReloadMembers: () => Promise<void>;
}

interface AttendanceSummary {
  present: number;
  leave: number;
  absent: number;
  unchecked: number;
  discordOnline: number;
}

type AttendanceSortMode =
  | 'class'
  | 'ign'
  | 'status';

function getTodayDate(): string {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    today.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isValidWarDate(
  date: string,
  eventType: AttendanceEventType,
): boolean {
  if (!date) {
    return false;
  }

  const selectedDate = new Date(
    `${date}T00:00:00`,
  );

  if (
    Number.isNaN(
      selectedDate.getTime(),
    )
  ) {
    return false;
  }

  const day = selectedDate.getDay();

  if (eventType === 'GuildLeague') {
    return day === 2 || day === 4;
  }

  return day === 0;
}

function formatDateValue(
  date: Date,
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getNextWarDate(
  startDate: string,
  eventType: AttendanceEventType,
): string {
  const date = new Date(
    `${startDate}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return getTodayDate();
  }

  for (
    let daysToAdd = 0;
    daysToAdd <= 7;
    daysToAdd += 1
  ) {
    const candidate = new Date(date);

    candidate.setDate(
      date.getDate() + daysToAdd,
    );

    const candidateValue =
      formatDateValue(candidate);

    if (
      isValidWarDate(
        candidateValue,
        eventType,
      )
    ) {
      return candidateValue;
    }
  }

  return startDate;
}

export function AttendancePage({
  members,
  isLoadingMembers,
  memberErrorMessage,
  onReloadMembers,
}: AttendancePageProps) {
  const captureAreaRef =
    useRef<HTMLDivElement | null>(null);

  const [eventDate, setEventDate] =
    useState(() =>
      getNextWarDate(
        getTodayDate(),
        'GuildLeague',
      ),
    );

  const [eventType, setEventType] =
    useState<AttendanceEventType>(
      'GuildLeague',
    );

  const [
    dateValidationMessage,
    setDateValidationMessage,
  ] = useState('');

  const [
    isBulkMenuOpen,
    setIsBulkMenuOpen,
  ] = useState(false);

  const [searchText, setSearchText] =
    useState('');

  const [sortMode, setSortMode] =
    useState<AttendanceSortMode>('class');

  const [
    isCapturing,
    setIsCapturing,
  ] = useState(false);

  const [copied, setCopied] =
    useState(false);

  const {
    attendanceMembers,
    isLoading,
    isSaving,
    errorMessage,
    saveMessage,
    canUndo,
    canRedo,
    undo,
    redo,
    clearAllAttendance,
    bulkUpdateAttendance,
    reloadAttendance,
    setWarStatus,
    setDiscordStatus,
    setNote,
    saveCurrentAttendance,
  } = useAttendance({
    members,
    eventDate,
    eventType,
  });

  const summary = useMemo(
    (): AttendanceSummary => {
      return attendanceMembers.reduce(
        (currentSummary, member) => {
          if (
            member.warStatus ===
            'Present'
          ) {
            currentSummary.present += 1;

            if (
              member.discordStatus ===
              'Online'
            ) {
              currentSummary.discordOnline +=
                1;
            }
          } else if (
            member.warStatus === 'Leave'
          ) {
            currentSummary.leave += 1;
          } else if (
            member.warStatus === 'Absent'
          ) {
            currentSummary.absent += 1;
          } else {
            currentSummary.unchecked += 1;
          }

          return currentSummary;
        },
        {
          present: 0,
          leave: 0,
          absent: 0,
          unchecked: 0,
          discordOnline: 0,
        },
      );
    },
    [attendanceMembers],
  );

  const sortedAttendanceMembers =
    useMemo(() => {
      const compareIgn = (
        firstIgn: string,
        secondIgn: string,
      ): number => {
        return firstIgn.localeCompare(
          secondIgn,
          'en',
          {
            sensitivity: 'base',
            numeric: true,
          },
        );
      };

      const statusOrder: Record<
        WarStatus,
        number
      > = {
        '': 0,
        Present: 1,
        Leave: 2,
        Absent: 3,
      };

      return [
        ...attendanceMembers,
      ].sort(
        (
          firstMember,
          secondMember,
        ) => {
          if (sortMode === 'ign') {
            return compareIgn(
              firstMember.ign,
              secondMember.ign,
            );
          }

          if (
            sortMode === 'status'
          ) {
            const statusComparison =
              statusOrder[
                firstMember.warStatus
              ] -
              statusOrder[
                secondMember.warStatus
              ];

            if (
              statusComparison !== 0
            ) {
              return statusComparison;
            }

            return compareIgn(
              firstMember.ign,
              secondMember.ign,
            );
          }

          const firstClass =
            firstMember.className.trim();

          const secondClass =
            secondMember.className.trim();

          /*
           * คนที่ไม่มีอาชีพอยู่ท้ายรายการ
           */
          if (
            !firstClass &&
            secondClass
          ) {
            return 1;
          }

          if (
            firstClass &&
            !secondClass
          ) {
            return -1;
          }

          const classComparison =
            firstClass.localeCompare(
              secondClass,
              'en',
              {
                sensitivity: 'base',
              },
            );

          if (
            classComparison !== 0
          ) {
            return classComparison;
          }

          return compareIgn(
            firstMember.ign,
            secondMember.ign,
          );
        },
      );
    }, [
      attendanceMembers,
      sortMode,
    ]);

  const filteredAttendanceMembers =
    useMemo(() => {
      const keyword =
        searchText.trim().toLowerCase();

      if (!keyword) {
        return sortedAttendanceMembers;
      }

      return sortedAttendanceMembers.filter(
        (member) =>
          member.ign
            .toLowerCase()
            .includes(keyword) ||
          member.className
            .toLowerCase()
            .includes(keyword),
      );
    }, [
      sortedAttendanceMembers,
      searchText,
    ]);

  const captureLists = useMemo(() => {
    const compareIgn = (
      firstIgn: string,
      secondIgn: string,
    ): number => {
      return firstIgn.localeCompare(
        secondIgn,
        'en',
        {
          sensitivity: 'base',
          numeric: true,
        },
      );
    };

    const leaveMembers =
      attendanceMembers
        .filter(
          (member) =>
            member.warStatus ===
            'Leave',
        )
        .map((member) => member.ign)
        .sort(compareIgn);

    const absentMembers =
      attendanceMembers
        .filter(
          (member) =>
            member.warStatus ===
            'Absent',
        )
        .map((member) => member.ign)
        .sort(compareIgn);

    const discordOfflineMembers =
      attendanceMembers
        .filter(
          (member) =>
            member.warStatus ===
              'Present' &&
            member.discordStatus ===
              'Offline',
        )
        .map((member) => member.ign)
        .sort(compareIgn);

    return {
      leaveMembers,
      absentMembers,
      discordOfflineMembers,
    };
  }, [attendanceMembers]);

  const attendanceCaptureTitle =
    eventType === 'GuildLeague'
      ? 'Guild League Attendance'
      : 'Overrun Attendance';

  const hasAttendanceData =
    attendanceMembers.some(
      (member) =>
        member.warStatus !== '' ||
        member.discordStatus !== '' ||
        member.note.trim() !== '',
    );

  const isPageLoading =
    isLoadingMembers || isLoading;

  function handleWarStatus(
    memberId: string,
    currentStatus: WarStatus,
    nextStatus: Exclude<
      WarStatus,
      ''
    >,
  ): void {
    setWarStatus(
      memberId,
      currentStatus === nextStatus
        ? ''
        : nextStatus,
    );
  }

  function handleDiscordStatus(
    memberId: string,
    currentStatus: DiscordStatus,
    nextStatus: Exclude<
      DiscordStatus,
      ''
    >,
  ): void {
    setDiscordStatus(
      memberId,
      currentStatus === nextStatus
        ? ''
        : nextStatus,
    );
  }

  function handleEventDateChange(
    nextDate: string,
  ): void {
    if (
      !isValidWarDate(
        nextDate,
        eventType,
      )
    ) {
      setDateValidationMessage(
        eventType === 'GuildLeague'
          ? 'Guild League มีวอเฉพาะวันอังคารและวันพฤหัสบดี'
          : 'Overrun มีวอเฉพาะวันอาทิตย์',
      );

      return;
    }

    setDateValidationMessage('');
    setIsBulkMenuOpen(false);
    setEventDate(nextDate);
  }

  function handleEventTypeChange(
    nextEventType: AttendanceEventType,
  ): void {
    setEventType(nextEventType);
    setDateValidationMessage('');
    setIsBulkMenuOpen(false);

    if (
      !isValidWarDate(
        eventDate,
        nextEventType,
      )
    ) {
      setEventDate(
        getNextWarDate(
          eventDate,
          nextEventType,
        ),
      );
    }
  }

  async function handleCopyAttendanceImage(): Promise<void> {
    const captureElement =
      captureAreaRef.current;

    if (!captureElement) {
      return;
    }

    try {
      setIsCapturing(true);

      const blob = await toBlob(
        captureElement,
        {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          cacheBust: true,
        },
      );

      if (!blob) {
        throw new Error(
          'สร้างภาพไม่สำเร็จ',
        );
      }

      if (
        !navigator.clipboard ||
        typeof ClipboardItem ===
          'undefined'
      ) {
        throw new Error(
          'เบราว์เซอร์นี้ไม่รองรับการคัดลอกรูปภาพ',
        );
      }

      const pngBlob =
        blob.type === 'image/png'
          ? blob
          : new Blob(
              [blob],
              {
                type: 'image/png',
              },
            );

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
        }),
      ]);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        'ไม่สามารถคัดลอกรูปสรุปเช็กชื่อได้',
        error,
      );
    } finally {
      setIsCapturing(false);
    }
  }

  function handleClearAll(): void {
    if (!hasAttendanceData) {
      return;
    }

    const confirmed = window.confirm(
      'ต้องการล้างข้อมูลเช็กชื่อทั้งหมดหรือไม่?\n\nสถานะวอ, Discord และหมายเหตุจะถูกล้าง แต่จะยังไม่บันทึกจนกว่าจะกดปุ่มบันทึก',
    );

    if (!confirmed) {
      return;
    }

    setIsBulkMenuOpen(false);
    clearAllAttendance();
  }

  function handleBulkWarStatus(
    status: Exclude<
      WarStatus,
      ''
    >,
    label: string,
  ): void {
    const confirmed = window.confirm(
      `ต้องการตั้งสถานะวอของสมาชิกทุกคนเป็น "${label}" หรือไม่?\n\nข้อมูลจะยังไม่ถูกบันทึกจนกว่าจะกดปุ่มบันทึก`,
    );

    if (!confirmed) {
      return;
    }

    bulkUpdateAttendance(
      'warStatus',
      status,
    );

    setIsBulkMenuOpen(false);
  }

  function handleBulkDiscordStatus(
    status: Exclude<
      DiscordStatus,
      ''
    >,
    label: string,
  ): void {
    const confirmed = window.confirm(
      `ต้องการตั้งสถานะ Discord ของสมาชิกทุกคนเป็น "${label}" หรือไม่?\n\nข้อมูลจะยังไม่ถูกบันทึกจนกว่าจะกดปุ่มบันทึก`,
    );

    if (!confirmed) {
      return;
    }

    bulkUpdateAttendance(
      'discordStatus',
      status,
    );

    setIsBulkMenuOpen(false);
  }

  function handleClearBulkWarStatus(): void {
    const hasWarStatus =
      attendanceMembers.some(
        (member) =>
          member.warStatus !== '',
      );

    if (!hasWarStatus) {
      setIsBulkMenuOpen(false);
      return;
    }

    const confirmed = window.confirm(
      'ต้องการล้างสถานะวอของสมาชิกทุกคนหรือไม่?\n\nสถานะ Discord และหมายเหตุจะไม่ถูกล้าง',
    );

    if (!confirmed) {
      return;
    }

    bulkUpdateAttendance(
      'warStatus',
      '',
    );

    setIsBulkMenuOpen(false);
  }

  function handleClearBulkDiscordStatus(): void {
    const hasDiscordStatus =
      attendanceMembers.some(
        (member) =>
          member.discordStatus !== '',
      );

    if (!hasDiscordStatus) {
      setIsBulkMenuOpen(false);
      return;
    }

    const confirmed = window.confirm(
      'ต้องการล้างสถานะ Discord ของสมาชิกทุกคนหรือไม่?\n\nสถานะวอและหมายเหตุจะไม่ถูกล้าง',
    );

    if (!confirmed) {
      return;
    }

    bulkUpdateAttendance(
      'discordStatus',
      '',
    );

    setIsBulkMenuOpen(false);
  }

  if (memberErrorMessage) {
    return (
      <main className="attendance-page">
        <div className="attendance-error">
          <strong>
            โหลดข้อมูลสมาชิกไม่สำเร็จ
          </strong>

          <p>{memberErrorMessage}</p>

          <button
            type="button"
            onClick={() =>
              void onReloadMembers()
            }
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="attendance-page">
      <section className="attendance-toolbar">
        <div>
          <h2>Attendance</h2>

          <p>
            เช็กชื่อสมาชิกและสถานะ
            Discord ของแต่ละรอบวอ
          </p>
        </div>

        <div className="attendance-toolbar-actions">
          <button
            type="button"
            className="attendance-history-button"
            onClick={undo}
            disabled={
              !canUndo ||
              isPageLoading ||
              isSaving
            }
          >
            ↶ Undo
          </button>

          <button
            type="button"
            className="attendance-history-button"
            onClick={redo}
            disabled={
              !canRedo ||
              isPageLoading ||
              isSaving
            }
          >
            ↷ Redo
          </button>

          <div className="attendance-bulk">
            <button
              type="button"
              className="attendance-history-button"
              onClick={() =>
                setIsBulkMenuOpen(
                  (currentValue) =>
                    !currentValue,
                )
              }
              disabled={
                isPageLoading ||
                isSaving ||
                attendanceMembers.length ===
                  0
              }
              aria-expanded={
                isBulkMenuOpen
              }
            >
              Bulk ▾
            </button>

            {isBulkMenuOpen && (
              <div className="attendance-bulk-menu">
                <div className="attendance-bulk-menu-title">
                  สถานะวอ
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleBulkWarStatus(
                      'Present',
                      'มาวอ',
                    )
                  }
                >
                  ✓ มาวอทั้งหมด
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleBulkWarStatus(
                      'Leave',
                      'ลาวอ',
                    )
                  }
                >
                  ✓ ลาวอทั้งหมด
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleBulkWarStatus(
                      'Absent',
                      'ขาด',
                    )
                  }
                >
                  ✓ ขาดทั้งหมด
                </button>

                <button
                  type="button"
                  className="bulk-clear-action"
                  onClick={
                    handleClearBulkWarStatus
                  }
                >
                  ล้างสถานะวอทั้งหมด
                </button>

                <hr />

                <div className="attendance-bulk-menu-title">
                  Discord
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleBulkDiscordStatus(
                      'Online',
                      'Online',
                    )
                  }
                >
                  ✓ Online ทั้งหมด
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleBulkDiscordStatus(
                      'Offline',
                      'Offline',
                    )
                  }
                >
                  ✓ Offline ทั้งหมด
                </button>

                <button
                  type="button"
                  className="bulk-clear-action"
                  onClick={
                    handleClearBulkDiscordStatus
                  }
                >
                  ล้าง Discord ทั้งหมด
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="attendance-clear-button"
            onClick={handleClearAll}
            disabled={
              isPageLoading ||
              isSaving ||
              !hasAttendanceData
            }
          >
            ล้างทั้งหมด
          </button>

          <button
            type="button"
            className="attendance-reload-button"
            onClick={() => {
              setIsBulkMenuOpen(false);
              void reloadAttendance();
            }}
            disabled={
              isPageLoading || isSaving
            }
          >
            {isPageLoading
              ? 'กำลังโหลด...'
              : 'โหลดใหม่'}
          </button>

          <button
            type="button"
            className="attendance-capture-button"
            onClick={() => {
              setIsBulkMenuOpen(false);
              void handleCopyAttendanceImage();
            }}
            disabled={
              isPageLoading ||
              isCapturing ||
              attendanceMembers.length ===
                0
            }
          >
            {isCapturing
              ? 'กำลังสร้างภาพ...'
              : copied
                ? '✓ คัดลอกแล้ว'
                : '📷 คัดลอกรูป'}
          </button>

          <button
            type="button"
            className="attendance-save-button"
            onClick={() => {
              setIsBulkMenuOpen(false);
              void saveCurrentAttendance();
            }}
            disabled={
              isPageLoading ||
              isSaving ||
              !eventDate
            }
          >
            {isSaving
              ? 'กำลังบันทึก...'
              : 'บันทึก'}
          </button>
        </div>
      </section>

      <section className="attendance-controls">
        <label>
          <span>วันที่วอ</span>

          <input
            type="date"
            value={eventDate}
            onChange={(event) =>
              handleEventDateChange(
                event.target.value,
              )
            }
          />

          <small className="attendance-date-hint">
            {eventType ===
            'GuildLeague'
              ? 'เลือกได้เฉพาะวันอังคารและวันพฤหัสบดี'
              : 'เลือกได้เฉพาะวันอาทิตย์'}
          </small>
        </label>

        <label>
          <span>ประเภทวอ</span>

          <select
            value={eventType}
            onChange={(event) =>
              handleEventTypeChange(
                event.target
                  .value as AttendanceEventType,
              )
            }
          >
            <option value="GuildLeague">
              Guild League
            </option>

            <option value="Overrun">
              Overrun
            </option>
          </select>

          <small className="attendance-date-hint">
            &nbsp;
          </small>
        </label>
      </section>

      {dateValidationMessage && (
        <div className="attendance-date-warning">
          ⚠ {dateValidationMessage}
        </div>
      )}

      <section className="attendance-search">
        <input
          type="text"
          placeholder="🔍 ค้นหา IGN หรือ Class..."
          value={searchText}
          onChange={(event) =>
            setSearchText(
              event.target.value,
            )
          }
        />

        <label className="attendance-sort-control">
          <span>เรียงตาม</span>

          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target
                  .value as AttendanceSortMode,
              )
            }
          >
            <option value="class">
              อาชีพ
            </option>

            <option value="ign">
              IGN (A-Z)
            </option>

            <option value="status">
              สถานะวอ
            </option>
          </select>
        </label>
      </section>

      <section className="attendance-summary-grid">
        <article className="attendance-summary-card present">
          <span>มาวอ</span>
          <strong>
            {summary.present}
          </strong>
        </article>

        <article className="attendance-summary-card leave">
          <span>ลาวอ</span>
          <strong>
            {summary.leave}
          </strong>
        </article>

        <article className="attendance-summary-card absent">
          <span>ขาด</span>
          <strong>
            {summary.absent}
          </strong>
        </article>

        <article className="attendance-summary-card unchecked">
          <span>ยังไม่ได้เช็ก</span>
          <strong>
            {summary.unchecked}
          </strong>
        </article>

        <article className="attendance-summary-card discord">
          <span>
            ออน Discord ในกลุ่มมาวอ
          </span>

          <strong>
            {summary.discordOnline}/
            {summary.present}
          </strong>
        </article>
      </section>

      {saveMessage && (
        <div className="attendance-success-message">
          {saveMessage}
        </div>
      )}

      {errorMessage && (
        <div className="attendance-error">
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() =>
              void reloadAttendance()
            }
          >
            ลองใหม่
          </button>
        </div>
      )}

      {isPageLoading && (
        <div className="attendance-status">
          กำลังโหลดข้อมูลเช็กชื่อ...
        </div>
      )}

      {!isPageLoading &&
        !errorMessage &&
        attendanceMembers.length ===
          0 && (
          <div className="attendance-status">
            ไม่พบข้อมูลสมาชิก
          </div>
        )}

      {!isPageLoading &&
        !errorMessage &&
        attendanceMembers.length >
          0 && (
          <section className="attendance-member-list">
            <header className="attendance-table-header">
            {filteredAttendanceMembers.length === 0 && (
                <div className="attendance-status">
                    ไม่พบสมาชิกที่ค้นหา
                </div>
                )}
              <span>สมาชิก</span>
              <span>สถานะวอ</span>
              <span>Discord</span>
              <span>หมายเหตุ</span>
            </header>

            {filteredAttendanceMembers.map(
              (member) => {
                const displayedLeaveCount =
                  member.monthlyLeaveCount +
                  (member.warStatus ===
                  'Leave'
                    ? 1
                    : 0);

                return (
                  <article
                    className="attendance-member-row"
                    key={member.memberId}
                  >
                    <div className="attendance-member-identity">
                      <span
                        className="attendance-class-badge"
                        style={{
                          backgroundColor:
                            getClassColor(
                              member.className ||
                                'ไม่ระบุอาชีพ',
                            ),
                        }}
                      >
                        {member.className ||
                          'ไม่ระบุอาชีพ'}
                      </span>

                      <div>
                        <strong>
                          {member.ign}
                        </strong>

                        <small>
                          {member.memberId}
                        </small>

                        {displayedLeaveCount >=
                          4 && (
                          <span className="attendance-leave-warning">
                            ⚠ ลาวอเดือนนี้{' '}
                            {
                              displayedLeaveCount
                            }{' '}
                            ครั้ง
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="attendance-status-buttons war-status-buttons">
                      <button
                        type="button"
                        className={
                          member.warStatus ===
                          'Present'
                            ? 'active present'
                            : ''
                        }
                        onClick={() =>
                          handleWarStatus(
                            member.memberId,
                            member.warStatus,
                            'Present',
                          )
                        }
                      >
                        มาวอ
                      </button>

                      <button
                        type="button"
                        className={
                          member.warStatus ===
                          'Leave'
                            ? 'active leave'
                            : ''
                        }
                        onClick={() =>
                          handleWarStatus(
                            member.memberId,
                            member.warStatus,
                            'Leave',
                          )
                        }
                      >
                        ลาวอ
                      </button>

                      <button
                        type="button"
                        className={
                          member.warStatus ===
                          'Absent'
                            ? 'active absent'
                            : ''
                        }
                        onClick={() =>
                          handleWarStatus(
                            member.memberId,
                            member.warStatus,
                            'Absent',
                          )
                        }
                      >
                        ขาด
                      </button>
                    </div>

                    <div className="attendance-status-buttons discord-status-buttons">
                      <button
                        type="button"
                        className={
                          member.discordStatus ===
                          'Online'
                            ? 'active online'
                            : ''
                        }
                        onClick={() =>
                          handleDiscordStatus(
                            member.memberId,
                            member.discordStatus,
                            'Online',
                          )
                        }
                      >
                        Online
                      </button>

                      <button
                        type="button"
                        className={
                          member.discordStatus ===
                          'Offline'
                            ? 'active offline'
                            : ''
                        }
                        onClick={() =>
                          handleDiscordStatus(
                            member.memberId,
                            member.discordStatus,
                            'Offline',
                          )
                        }
                      >
                        Offline
                      </button>
                    </div>

                    <input
                      className="attendance-note-input"
                      type="text"
                      value={member.note}
                      placeholder="หมายเหตุ..."
                      maxLength={200}
                      onChange={(event) =>
                        setNote(
                          member.memberId,
                          event.target.value,
                        )
                      }
                    />
                  </article>
                );
              },
            )}
          </section>
        )}

      <div className="attendance-discord-capture-wrapper">
        <section
          ref={captureAreaRef}
          className="attendance-discord-capture"
        >
          <header className="attendance-discord-capture-header">
            <h2>{attendanceCaptureTitle}</h2>
            <div>{eventDate}</div>
          </header>

          <div className="attendance-discord-divider" />

          <section className="attendance-discord-present">
            <span>✅ มา</span>
            <strong>{summary.present}</strong>
          </section>

          {captureLists.leaveMembers.length > 0 && (
            <section className="attendance-discord-section leave">
              <h3>🟠 ลา</h3>
              <div className="attendance-discord-name-list">
                {captureLists.leaveMembers.map(
                  (memberName) => (
                    <div key={`leave-${memberName}`}>
                      {memberName}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

          {captureLists.absentMembers.length > 0 && (
            <section className="attendance-discord-section absent">
              <h3>🔴 ขาด</h3>
              <div className="attendance-discord-name-list">
                {captureLists.absentMembers.map(
                  (memberName) => (
                    <div key={`absent-${memberName}`}>
                      {memberName}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

          {captureLists.discordOfflineMembers.length >
            0 && (
            <section className="attendance-discord-section discord-offline">
              <h3>🎧 ไม่ออนดิส</h3>
              <div className="attendance-discord-name-list">
                {captureLists.discordOfflineMembers.map(
                  (memberName) => (
                    <div
                      key={`discord-offline-${memberName}`}
                    >
                      {memberName}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

          <div className="attendance-discord-divider bottom" />
        </section>
      </div>

    </main>
  );
}