import {
  useMemo,
  useState,
} from 'react';

import { useOverrunAuction } from '../../hooks/useOverrunAuction';

import type { Member } from '../../types/member';
import type {
  OverrunQueueItem,
  OverrunResult,
} from '../../types/overrun';

interface OverrunPageProps {
  members: Member[];
  isLoadingMembers: boolean;
}

const CURRENT_QUEUE_SIZE = 13;

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

function QueueList({
  title,
  description,
  queue,
  startIndex,
  allowEditing,
  onRemove,
  onMove,
}: {
  title: string;
  description: string;
  queue: OverrunQueueItem[];
  startIndex: number;
  allowEditing: boolean;
  onRemove: (
    queueIndex: number,
  ) => void;
  onMove: (
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}) {
  const [
    draggedIndex,
    setDraggedIndex,
  ] = useState<number | null>(
    null,
  );

  return (
    <section className="overrun-queue-section">
      <header className="overrun-section-header">
        <div>
          <h3>{title}</h3>

          <p>{description}</p>
        </div>

        <span className="overrun-queue-count">
          {queue.length}
        </span>
      </header>

      {queue.length === 0 ? (
        <div className="overrun-empty-queue">
          ยังไม่มีสมาชิกในส่วนนี้
        </div>
      ) : (
        <div className="overrun-queue-list">
          {queue.map(
            (item, localIndex) => {
              const absoluteIndex =
                startIndex +
                localIndex;

              return (
                <article
                  key={`${item.memberName}-${absoluteIndex}`}
                  className="overrun-queue-row"
                  draggable={
                    allowEditing
                  }
                  onDragStart={() => {
                    if (
                      !allowEditing
                    ) {
                      return;
                    }

                    setDraggedIndex(
                      absoluteIndex,
                    );
                  }}
                  onDragOver={(
                    event,
                  ) => {
                    if (
                      !allowEditing
                    ) {
                      return;
                    }

                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (
                      !allowEditing ||
                      draggedIndex ===
                        null
                    ) {
                      return;
                    }

                    onMove(
                      draggedIndex,
                      absoluteIndex,
                    );

                    setDraggedIndex(
                      null,
                    );
                  }}
                  onDragEnd={() =>
                    setDraggedIndex(
                      null,
                    )
                  }
                >
                  <div className="overrun-queue-order">
                    {absoluteIndex + 1}
                  </div>

                  <div className="overrun-queue-member">
                    <strong>
                      {item.memberName}
                    </strong>

                    <span>
                      {absoluteIndex <
                      CURRENT_QUEUE_SIZE
                        ? 'รอบปัจจุบัน'
                        : 'รอรอบถัดไป'}
                    </span>
                  </div>

                  {allowEditing && (
                    <button
                      type="button"
                      className="overrun-remove-button"
                      onClick={() =>
                        onRemove(
                          absoluteIndex,
                        )
                      }
                      aria-label={`ลบ ${item.memberName} ออกจากคิว`}
                    >
                      ✕
                    </button>
                  )}
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

export function OverrunPage({
  members,
  isLoadingMembers,
}: OverrunPageProps) {
  const [eventDate, setEventDate] =
    useState(getTodayDate);

  const [
    selectedMember,
    setSelectedMember,
  ] = useState('');

  const [
    selectedResult,
    setSelectedResult,
  ] = useState<
    OverrunResult | ''
  >('');

  const [
    noItemMember,
    setNoItemMember,
  ] = useState('');

  const {
    queue,
    currentQueue,
    waitingQueue,
    preview,

    isLoading,
    isSaving,
    isConfirming,

    errorMessage,
    saveMessage,

    reloadQueue,
    addMemberToQueue,
    removeMemberFromQueue,
    moveMemberInQueue,
    saveCurrentQueue,
    createPreview,
    clearPreview,
    confirmPreview,
  } = useOverrunAuction({
    eventDate,
  });

  const availableMembers =
    useMemo(() => {
      const queuedNames =
        new Set(
          queue.map(
            (item) =>
              item.memberName,
          ),
        );

      return members
        .map((member) =>
          member.ign.trim(),
        )
        .filter(
          (memberName) =>
            memberName !== '' &&
            !queuedNames.has(
              memberName,
            ),
        )
        .sort(
          (
            firstName,
            secondName,
          ) =>
            firstName.localeCompare(
              secondName,
              'en',
              {
                sensitivity:
                  'base',
                numeric: true,
              },
            ),
        );
    }, [members, queue]);

  function handleAddMember(): void {
    if (!selectedMember) {
      return;
    }

    addMemberToQueue(
      selectedMember,
    );

    setSelectedMember('');
  }

  function handleCreatePreview(): void {
    if (!selectedResult) {
      return;
    }

    createPreview(
      selectedResult,
      noItemMember,
    );
  }

  function handleResultChange(
    result: OverrunResult,
  ): void {
    setSelectedResult(result);
    setNoItemMember('');
    clearPreview();
  }

  async function handleConfirm(): Promise<void> {
    const confirmed =
      window.confirm(
        'ยืนยันผล Overrun และเลื่อนคิวรอบถัดไปหรือไม่?',
      );

    if (!confirmed) {
      return;
    }

    const success =
      await confirmPreview();

    if (success) {
      setSelectedResult('');
      setNoItemMember('');
    }
  }

  return (
    <main className="overrun-page">
      <section className="overrun-toolbar">
        <div>
          <h2>
            Overrun Auction
          </h2>

          <p>
            เตรียมคิวประมูลก่อนวอ และยืนยันผลหลังจบวอ
          </p>
        </div>

        <div className="overrun-toolbar-actions">
          <button
            type="button"
            className="overrun-reload-button"
            onClick={() =>
              void reloadQueue()
            }
            disabled={
              isLoading ||
              isSaving ||
              isConfirming
            }
          >
            {isLoading
              ? 'กำลังโหลด...'
              : 'โหลดใหม่'}
          </button>

          <button
            type="button"
            className="overrun-save-button"
            onClick={() =>
              void saveCurrentQueue()
            }
            disabled={
              isLoading ||
              isSaving ||
              isConfirming
            }
          >
            {isSaving
              ? 'กำลังบันทึก...'
              : 'บันทึกคิว'}
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="overrun-error">
          {errorMessage}
        </div>
      )}

      {saveMessage && (
        <div className="overrun-success">
          {saveMessage}
        </div>
      )}

      {isLoading ? (
        <div className="overrun-status">
          กำลังโหลดคิว Overrun...
        </div>
      ) : (
        <>
          <section className="overrun-add-member">
            <div>
              <h3>
                เพิ่มสมาชิกเข้าคิว
              </h3>

              <p>
                สมาชิกใหม่จะถูกเพิ่มต่อท้ายคิว
              </p>
            </div>

            <div className="overrun-add-member-controls">
              <select
                value={selectedMember}
                onChange={(event) =>
                  setSelectedMember(
                    event.target.value,
                  )
                }
                disabled={
                  isLoadingMembers ||
                  availableMembers.length ===
                    0
                }
              >
                <option value="">
                  {isLoadingMembers
                    ? 'กำลังโหลดสมาชิก...'
                    : availableMembers.length ===
                        0
                      ? 'ไม่มีสมาชิกที่เพิ่มได้'
                      : 'เลือกสมาชิก'}
                </option>

                {availableMembers.map(
                  (memberName) => (
                    <option
                      key={
                        memberName
                      }
                      value={
                        memberName
                      }
                    >
                      {memberName}
                    </option>
                  ),
                )}
              </select>

              <button
                type="button"
                onClick={
                  handleAddMember
                }
                disabled={
                  !selectedMember
                }
              >
                + เพิ่มเข้าคิว
              </button>
            </div>
          </section>

          <section className="overrun-queue-grid">
            <QueueList
              title="Current Queue"
              description="13 คนที่มีสิทธิประมูลในรอบนี้"
              queue={currentQueue}
              startIndex={0}
              allowEditing
              onRemove={
                removeMemberFromQueue
              }
              onMove={
                moveMemberInQueue
              }
            />

            <QueueList
              title="Waiting Queue"
              description="สมาชิกที่รอขึ้นรอบถัดไป"
              queue={waitingQueue}
              startIndex={
                CURRENT_QUEUE_SIZE
              }
              allowEditing
              onRemove={
                removeMemberFromQueue
              }
              onMove={
                moveMemberInQueue
              }
            />
          </section>

          <section className="overrun-result-panel">
            <header>
              <div>
                <h3>
                  ผล Overrun
                </h3>

                <p>
                  กรอกหลังจบวอเพื่อคำนวณคิวรอบถัดไป
                </p>
              </div>

              <label className="overrun-date-field">
                <span>วันที่วอ</span>

                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => {
                    setEventDate(
                      event.target
                        .value,
                    );

                    clearPreview();
                  }}
                />
              </label>
            </header>

            <div className="overrun-result-options">
              <button
                type="button"
                className={
                  selectedResult ===
                  'win'
                    ? 'active win'
                    : ''
                }
                onClick={() =>
                  handleResultChange(
                    'win',
                  )
                }
              >
                <strong>
                  ชนะ
                </strong>

                <span>
                  ทั้ง 13 คนได้ประมูล
                </span>
              </button>

              <button
                type="button"
                className={
                  selectedResult ===
                  'lose'
                    ? 'active lose'
                    : ''
                }
                onClick={() =>
                  handleResultChange(
                    'lose',
                  )
                }
              >
                <strong>
                  แพ้
                </strong>

                <span>
                  มี 1 คนไม่ได้ประมูล
                </span>
              </button>
            </div>

            {selectedResult ===
              'lose' && (
              <label className="overrun-no-item-field">
                <span>
                  คนที่ไม่ได้ประมูล
                </span>

                <select
                  value={noItemMember}
                  onChange={(event) => {
                    setNoItemMember(
                      event.target
                        .value,
                    );

                    clearPreview();
                  }}
                >
                  <option value="">
                    เลือกจาก 13 คนในรอบนี้
                  </option>

                  {currentQueue.map(
                    (item) => (
                      <option
                        key={
                          item.memberName
                        }
                        value={
                          item.memberName
                        }
                      >
                        {item.memberName}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}

            <button
              type="button"
              className="overrun-preview-button"
              onClick={
                handleCreatePreview
              }
              disabled={
                !selectedResult ||
                (selectedResult ===
                  'lose' &&
                  !noItemMember)
              }
            >
              ดูคิวรอบถัดไป
            </button>
          </section>

          {preview && (
            <section className="overrun-preview-panel">
              <header>
                <div>
                  <h3>
                    Preview คิวรอบถัดไป
                  </h3>

                  <p>
                    ตรวจสอบให้ถูกต้องก่อนยืนยันผล
                  </p>
                </div>

                <span
                  className={[
                    'overrun-result-badge',
                    preview.result,
                  ].join(' ')}
                >
                  {preview.result ===
                  'win'
                    ? 'ชนะ'
                    : 'แพ้'}
                </span>
              </header>

              {preview.result ===
                'lose' && (
                <div className="overrun-preview-note">
                  <strong>
                    {
                      preview.noItemMember
                    }
                  </strong>{' '}
                  จะกลับมาเป็นลำดับ 1
                  ของรอบถัดไป
                </div>
              )}

              <div className="overrun-preview-columns">
                <div>
                  <h4>
                    รอบปัจจุบัน
                  </h4>

                  <ol>
                    {preview.queueBefore
                      .slice(
                        0,
                        CURRENT_QUEUE_SIZE,
                      )
                      .map(
                        (
                          memberName,
                          index,
                        ) => (
                          <li
                            key={`${memberName}-${index}`}
                          >
                            {
                              memberName
                            }
                          </li>
                        ),
                      )}
                  </ol>
                </div>

                <div className="overrun-preview-arrow">
                  →
                </div>

                <div>
                  <h4>
                    รอบถัดไป
                  </h4>

                  <ol>
                    {preview.queueAfter
                      .slice(
                        0,
                        CURRENT_QUEUE_SIZE,
                      )
                      .map(
                        (
                          memberName,
                          index,
                        ) => (
                          <li
                            key={`${memberName}-${index}`}
                          >
                            {
                              memberName
                            }
                          </li>
                        ),
                      )}
                  </ol>
                </div>
              </div>

              <footer>
                <button
                  type="button"
                  className="overrun-preview-cancel"
                  onClick={
                    clearPreview
                  }
                  disabled={
                    isConfirming
                  }
                >
                  ย้อนกลับ
                </button>

                <button
                  type="button"
                  className="overrun-preview-confirm"
                  onClick={() =>
                    void handleConfirm()
                  }
                  disabled={
                    isConfirming
                  }
                >
                  {isConfirming
                    ? 'กำลังยืนยัน...'
                    : 'ยืนยันผลและเลื่อนคิว'}
                </button>
              </footer>
            </section>
          )}
        </>
      )}
    </main>
  );
}