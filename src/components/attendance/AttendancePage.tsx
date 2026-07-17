import {
  useMemo,
  useState,
} from 'react';

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

export function AttendancePage({
  members,
  isLoadingMembers,
  memberErrorMessage,
  onReloadMembers,
}: AttendancePageProps) {
  const [eventDate, setEventDate] =
    useState(getTodayDate);

  const [eventType, setEventType] =
    useState<AttendanceEventType>(
      'GuildLeague',
    );

  const {
    attendanceMembers,
    isLoading,
    isSaving,
    errorMessage,
    saveMessage,
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

  const isPageLoading =
    isLoadingMembers || isLoading;

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
            className="attendance-reload-button"
            onClick={() =>
              void reloadAttendance()
            }
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
            className="attendance-save-button"
            onClick={() =>
              void saveCurrentAttendance()
            }
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
              setEventDate(
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>ประเภทวอ</span>

          <select
            value={eventType}
            onChange={(event) =>
              setEventType(
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
        </label>
      </section>

      <section className="attendance-summary-grid">
        <article className="attendance-summary-card present">
          <span>มาวอ</span>
          <strong>{summary.present}</strong>
        </article>

        <article className="attendance-summary-card leave">
          <span>ลาวอ</span>
          <strong>{summary.leave}</strong>
        </article>

        <article className="attendance-summary-card absent">
          <span>ขาด</span>
          <strong>{summary.absent}</strong>
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
        attendanceMembers.length === 0 && (
          <div className="attendance-status">
            ไม่พบข้อมูลสมาชิก
          </div>
        )}

      {!isPageLoading &&
        !errorMessage &&
        attendanceMembers.length > 0 && (
          <section className="attendance-member-list">
            <header className="attendance-table-header">
              <span>สมาชิก</span>
              <span>สถานะวอ</span>
              <span>Discord</span>
              <span>หมายเหตุ</span>
            </header>

            {attendanceMembers.map(
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
    </main>
  );
}