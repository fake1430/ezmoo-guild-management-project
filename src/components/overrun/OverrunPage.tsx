import {
  useMemo,
  useRef,
  useState,
} from 'react';
import { toBlob } from 'html-to-image';

import { useOverrunAuction } from '../../hooks/useOverrunAuction';

import type { Member } from '../../types/member';
import type {
  OverrunQueueItem,
  OverrunResult,
} from '../../types/overrun';
import { shuffle } from '../../utils/shuffle';

import cardBookIcon from '../../assets/auction/album-book.png';
import whiteFeatherIcon from '../../assets/auction/white-feather.png';
import redFeatherIcon from '../../assets/auction/red-feather.png';

interface OverrunPageProps {
  members: Member[];
  isLoadingMembers: boolean;
}

const CURRENT_QUEUE_SIZE = 13;

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function isValidOverrunDate(
  date: string,
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

  return selectedDate.getDay() === 0;
}

function getNextOverrunDate(
  startDate: string,
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
      isValidOverrunDate(
        candidateValue,
      )
    ) {
      return candidateValue;
    }
  }

  return startDate;
}

function QueueList({
  title,
  description,
  queue,
  startIndex,
  onRemove,
  onMove,
}: {
  title: string;
  description: string;
  queue: OverrunQueueItem[];
  startIndex: number;
  onRemove: (queueIndex: number) => void;
  onMove: (sourceIndex: number, targetIndex: number) => void;
}) {
  const [draggedIndex, setDraggedIndex] =
    useState<number | null>(null);

  return (
    <section className="overrun-manager-section">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        <span>{queue.length}</span>
      </header>

      {queue.length === 0 ? (
        <div className="overrun-manager-empty">
          ยังไม่มีสมาชิกในส่วนนี้
        </div>
      ) : (
        <div className="overrun-manager-list">
          {queue.map((item, localIndex) => {
            const absoluteIndex = startIndex + localIndex;

            return (
              <article
                key={`${item.memberName}-${absoluteIndex}`}
                className="overrun-manager-row"
                draggable
                onDragStart={() =>
                  setDraggedIndex(absoluteIndex)
                }
                onDragOver={(event) =>
                  event.preventDefault()
                }
                onDrop={() => {
                  if (draggedIndex === null) {
                    return;
                  }

                  onMove(draggedIndex, absoluteIndex);
                  setDraggedIndex(null);
                }}
                onDragEnd={() =>
                  setDraggedIndex(null)
                }
              >
                <div className="overrun-manager-order">
                  {absoluteIndex + 1}
                </div>

                <strong>{item.memberName}</strong>

                <button
                  type="button"
                  onClick={() =>
                    onRemove(absoluteIndex)
                  }
                  aria-label={`ลบ ${item.memberName} ออกจากคิว`}
                  title="ลบออกจากคิว"
                >
                  ✕
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function OverrunPage({
  members,
  isLoadingMembers,
}: OverrunPageProps) {
  const captureAreaRef =
    useRef<HTMLDivElement | null>(null);

  const [eventDate, setEventDate] =
    useState(() =>
      getNextOverrunDate(
        getTodayDate(),
      ),
    );

  const [
    dateValidationMessage,
    setDateValidationMessage,
  ] = useState('');

  const [selectedResult, setSelectedResult] =
    useState<OverrunResult | ''>('');

  const [noItemMember, setNoItemMember] =
    useState('');

  const [selectedMember, setSelectedMember] =
    useState('');

  const [isQueueManagerOpen, setIsQueueManagerOpen] =
    useState(false);

  const [isCountDialogOpen, setIsCountDialogOpen] =
    useState(false);

  const [bulkCardCount, setBulkCardCount] =
    useState(2);

  const [
    bulkWhiteFeatherCount,
    setBulkWhiteFeatherCount,
  ] = useState(8);

  const [
    bulkRedFeatherCount,
    setBulkRedFeatherCount,
  ] = useState(10);

  const [isCapturing, setIsCapturing] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const {
    queue,
    currentQueue,
    waitingQueue,
    auctionRows,
    preview,
    isLoading,
    isSaving,
    isConfirming,
    errorMessage,
    saveMessage,
    reloadQueue,
    addMemberToQueue,
    replaceQueue,
    removeMemberFromQueue,
    moveMemberInQueue,
    saveCurrentQueue,
    saveAuction,
    setSoldTo,
    setCardCount,
    setWhiteFeatherCount,
    setRedFeatherCount,
    setAllCounts,
    createPreview,
    clearPreview,
    confirmPreview,
  } = useOverrunAuction({
    eventDate,
  });

  const memberNames = useMemo(
    () =>
      members
        .map((member) => member.ign.trim())
        .filter(Boolean)
        .sort((firstName, secondName) =>
          firstName.localeCompare(
            secondName,
            'en',
            {
              sensitivity: 'base',
              numeric: true,
            },
          ),
        ),
    [members],
  );

  const availableMembers = useMemo(() => {
    const queuedNames = new Set(
      queue.map((item) => item.memberName),
    );

    return memberNames.filter(
      (memberName) =>
        !queuedNames.has(memberName),
    );
  }, [memberNames, queue]);

  const soldCount = auctionRows.filter(
    (row) => row.soldTo.trim() !== '',
  ).length;

  const totalCardCount = auctionRows.reduce(
    (total, row) => total + row.cardCount,
    0,
  );

  const totalWhiteFeatherCount =
    auctionRows.reduce(
      (total, row) =>
        total + row.whiteFeatherCount,
      0,
    );

  const totalRedFeatherCount =
    auctionRows.reduce(
      (total, row) =>
        total + row.redFeatherCount,
      0,
    );

  function handleDateChange(
    nextDate: string,
  ): void {
    if (
      !isValidOverrunDate(
        nextDate,
      )
    ) {
      setDateValidationMessage(
        'Overrun มีกิจกรรมเฉพาะวันอาทิตย์',
      );

      return;
    }

    setDateValidationMessage('');
    setEventDate(nextDate);
    clearPreview();
  }

  function handleResultChange(
    result: OverrunResult,
  ): void {
    setSelectedResult(result);
    setNoItemMember('');
    clearPreview();
  }

  function handleCreatePreview(): void {
    if (!selectedResult) {
      return;
    }

    const success = createPreview(
      selectedResult,
      noItemMember,
    );

    if (success) {
      // preview state controls the dialog
    }
  }

  async function handleConfirm(): Promise<void> {
    const success = await confirmPreview();

    if (success) {
      setSelectedResult('');
      setNoItemMember('');
    }
  }

  function handleAddMember(): void {
    if (!selectedMember) {
      return;
    }

    addMemberToQueue(selectedMember);
    setSelectedMember('');
  }

  function handleShuffleQueue(): void {
    const memberNamesToShuffle = members
      .map((member) => member.ign.trim())
      .filter(Boolean);

    if (memberNamesToShuffle.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      [
        'ต้องการสุ่มคิว Overrun ใหม่ทั้งกิลหรือไม่?',
        '',
        `สมาชิกทั้งหมด ${memberNamesToShuffle.length} คน`,
        'คิวปัจจุบันจะถูกแทนที่ทั้งหมด',
        'หลังสุ่มแล้วต้องกด "บันทึกคิว" อีกครั้ง',
      ].join('\n'),
    );

    if (!confirmed) {
      return;
    }

    replaceQueue(shuffle(memberNamesToShuffle));
    setSelectedMember('');
    setSelectedResult('');
    setNoItemMember('');
  }

  function openCountDialog(): void {
    const firstRow = auctionRows[0];

    if (firstRow) {
      setBulkCardCount(firstRow.cardCount);
      setBulkWhiteFeatherCount(
        firstRow.whiteFeatherCount,
      );
      setBulkRedFeatherCount(
        firstRow.redFeatherCount,
      );
    }

    setIsCountDialogOpen(true);
  }

  function applyAllCounts(): void {
    setAllCounts(
      bulkCardCount,
      bulkWhiteFeatherCount,
      bulkRedFeatherCount,
    );

    setIsCountDialogOpen(false);
  }

  async function handleCopyAuctionImage(): Promise<void> {
    const captureElement = captureAreaRef.current;

    if (!captureElement) {
      return;
    }

    try {
      setIsCapturing(true);

      const blob = await toBlob(captureElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });

      if (!blob) {
        throw new Error('สร้างภาพไม่สำเร็จ');
      }

      if (
        !navigator.clipboard ||
        typeof ClipboardItem === 'undefined'
      ) {
        throw new Error(
          'เบราว์เซอร์นี้ไม่รองรับการคัดลอกรูปภาพ',
        );
      }

      const pngBlob =
        blob.type === 'image/png'
          ? blob
          : new Blob([blob], {
              type: 'image/png',
            });

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
        'ไม่สามารถคัดลอกรูปภาพ Overrun ได้',
        error,
      );
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <main className="overrun-page overrun-v2-page">
      <section className="overrun-toolbar">
        <div>
          <h2>Overrun Auction</h2>
          <p>
            จัดการสิทธิประมูลตามลำดับคิวรายคน
          </p>
        </div>

        <div className="overrun-toolbar-actions">
          <button
            type="button"
            className="overrun-reload-button"
            onClick={() => void reloadQueue()}
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
            className="overrun-capture-button"
            onClick={() =>
              void handleCopyAuctionImage()
            }
            disabled={
              isLoading ||
              isCapturing ||
              auctionRows.length === 0
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
            className="overrun-bulk-button"
            onClick={openCountDialog}
            disabled={
              isLoading ||
              isSaving ||
              auctionRows.length === 0
            }
          >
            📦 ตั้งค่าจำนวน
          </button>

            <button
            type="button"
            className="overrun-manage-button"
            onClick={() =>
                setIsQueueManagerOpen(true)
            }
            disabled={isLoading}
            >
            ☰ จัดการคิว
            </button>

            <button
            type="button"
            className="overrun-save-button"
            onClick={() =>
                void saveAuction()
            }
            disabled={
                isLoading ||
                isSaving ||
                isConfirming ||
                auctionRows.length === 0
            }
            >
            {isSaving
                ? 'กำลังบันทึก...'
                : '💾 บันทึก'}
            </button>

            <button
            type="button"
            className="overrun-confirm-button"
            onClick={handleCreatePreview}
            disabled={
            isLoading ||
            isSaving ||
            isConfirming ||
            !selectedResult ||
            currentQueue.length <
                CURRENT_QUEUE_SIZE ||
            (selectedResult === 'lose' &&
                !noItemMember)
            }
          >
            ยืนยันผล
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
          กำลังโหลดข้อมูล Overrun...
        </div>
      ) : (
        <>
          <section className="overrun-v2-control-panel">
            <label className="overrun-v2-date">
              <span>วันที่วอ</span>

              <input
                type="date"
                value={eventDate}
                onChange={(event) =>
                  handleDateChange(
                    event.target.value,
                  )
                }
              />

              <small>
                เลือกได้เฉพาะวันอาทิตย์
              </small>
            </label>

            <div className="overrun-v2-result">
              <span>ผล Overrun</span>

              <div>
                <button
                  type="button"
                  className={
                    selectedResult === 'win'
                      ? 'active win'
                      : ''
                  }
                  onClick={() =>
                    handleResultChange('win')
                  }
                >
                  ชนะ
                </button>

                <button
                  type="button"
                  className={
                    selectedResult === 'lose'
                      ? 'active lose'
                      : ''
                  }
                  onClick={() =>
                    handleResultChange('lose')
                  }
                >
                  แพ้
                </button>
              </div>
            </div>

            {selectedResult === 'lose' && (
              <label className="overrun-v2-no-item">
                <span>คนที่ไม่ได้ประมูล</span>

                <select
                  value={noItemMember}
                  onChange={(event) => {
                    setNoItemMember(
                      event.target.value,
                    );
                    clearPreview();
                  }}
                >
                  <option value="">
                    เลือกจาก 13 คน
                  </option>

                  {currentQueue.map((item) => (
                    <option
                      key={item.memberName}
                      value={item.memberName}
                    >
                      {item.memberName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {dateValidationMessage && (
            <div className="overrun-warning">
              ⚠ {dateValidationMessage}
            </div>
          )}

          <section className="overrun-v2-summary-grid">
            <article>
              <span>คิวปัจจุบัน</span>
              <strong>
                {currentQueue.length}/
                {CURRENT_QUEUE_SIZE}
              </strong>
            </article>

            <article>
              <span>ขายสิทธิ</span>
              <strong>{soldCount} คน</strong>
            </article>

            <article>
              <span>การ์ดทั้งหมด</span>
              <strong>{totalCardCount}</strong>
            </article>

            <article>
              <span>ขนนกขาวทั้งหมด</span>
              <strong>
                {totalWhiteFeatherCount}
              </strong>
            </article>

            <article>
              <span>ขนนกแดงทั้งหมด</span>
              <strong>
                {totalRedFeatherCount}
              </strong>
            </article>
          </section>

          <section className="overrun-v2-table">
            <header className="overrun-v2-table-header">
              <div>คิว</div>
              <div>เจ้าของสิทธิ</div>
              <div>ขายให้</div>
              <div>
                <img
                  src={cardBookIcon}
                  alt="การ์ด"
                />
              </div>
              <div>
                <img
                  src={whiteFeatherIcon}
                  alt="ขนนกขาว"
                />
              </div>
              <div>
                <img
                  src={redFeatherIcon}
                  alt="ขนนกแดง"
                />
              </div>
            </header>

            <div className="overrun-v2-table-body">
              {auctionRows.map((row) => {
                const isSold =
                  row.soldTo.trim() !== '';

                return (
                  <article
                    className={[
                      'overrun-v2-row',
                      isSold ? 'is-sold' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={row.queueOrder}
                  >
                    <div className="overrun-v2-order">
                      {String(
                        row.queueOrder,
                      ).padStart(2, '0')}
                    </div>

                    <div
                      className={[
                        'overrun-v2-owner',
                        !isSold
                          ? 'is-active'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <small>เจ้าของสิทธิ</small>
                      <strong>
                        {row.queueOwner}
                      </strong>
                    </div>

                    <label className="overrun-v2-buyer">
                      <small>ขายให้</small>

                      <select
                        className={
                          isSold
                            ? 'is-active'
                            : ''
                        }
                        value={row.soldTo}
                        onChange={(event) =>
                          setSoldTo(
                            row.queueOrder,
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          {' '}
                        </option>

                        {memberNames.map(
                          (memberName) => (
                            <option
                              key={memberName}
                              value={memberName}
                            >
                              {memberName}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label className="overrun-v2-count">
                      <span>การ์ด</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.cardCount}
                        onChange={(event) =>
                          setCardCount(
                            row.queueOrder,
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>

                    <label className="overrun-v2-count">
                      <span>ขนนกขาว</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={
                          row.whiteFeatherCount
                        }
                        onChange={(event) =>
                          setWhiteFeatherCount(
                            row.queueOrder,
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>

                    <label className="overrun-v2-count">
                      <span>ขนนกแดง</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={
                          row.redFeatherCount
                        }
                        onChange={(event) =>
                          setRedFeatherCount(
                            row.queueOrder,
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="overrun-discord-capture-wrapper">
            <section
              ref={captureAreaRef}
              className="overrun-discord-capture"
            >
              <div className="overrun-discord-title">
                <strong>{eventDate}</strong>

                <span>
                  OVER­RUN{' '}
                  {selectedResult
                    ? `— ${selectedResult.toUpperCase()}`
                    : ''}
                </span>
              </div>

              <div className="overrun-discord-table">
                <div className="overrun-discord-row overrun-discord-header">
                  <div>Queue</div>
                  <div>👤</div>
                  <div>💰</div>
                  <div>
                    <img
                      src={cardBookIcon}
                      alt="การ์ด"
                    />
                  </div>
                  <div>
                    <img
                      src={whiteFeatherIcon}
                      alt="ขนนกขาว"
                    />
                  </div>
                  <div>
                    <img
                      src={redFeatherIcon}
                      alt="ขนนกแดง"
                    />
                  </div>
                </div>

                {auctionRows.map((row) => (
                  <div
                    className="overrun-discord-row"
                    key={`capture-${row.queueOrder}`}
                  >
                    <div className="overrun-discord-order">
                      Q
                      {String(
                        row.queueOrder,
                      ).padStart(2, '0')}
                    </div>

                        <div
                        className={[
                            'overrun-discord-name',
                            row.soldTo.trim() !== ''
                            ? 'is-muted'
                            : 'is-active',
                        ].join(' ')}
                        >
                        {row.queueOwner || '—'}
                        </div>

                        <div
                        className={[
                            'overrun-discord-name',
                            row.soldTo.trim() !== ''
                            ? 'is-active'
                            : 'is-placeholder',
                        ].join(' ')}
                        >
                        {row.soldTo || '—'}
                        </div>

                    <div className="overrun-discord-count">
                      {row.cardCount}
                    </div>

                    <div className="overrun-discord-count">
                      {row.whiteFeatherCount}
                    </div>

                    <div className="overrun-discord-count">
                      {row.redFeatherCount}
                    </div>
                  </div>
                ))}
              </div>

              {selectedResult && (
                <div className="overrun-discord-result">
                  <strong>
                    Result:{' '}
                    {selectedResult === 'win'
                      ? 'Win'
                      : 'Lose'}
                  </strong>

                  {selectedResult === 'lose' &&
                    noItemMember && (
                      <span>
                        ไม่ได้รับสิทธิ:{' '}
                        {noItemMember}
                      </span>
                    )}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {isQueueManagerOpen && (
        <div
          className="overrun-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setIsQueueManagerOpen(false);
            }
          }}
        >
          <section
            className="overrun-queue-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h3>จัดการคิว Overrun</h3>
                <p>
                  เพิ่ม ลบ ลากเรียง หรือสุ่มคิวใหม่
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsQueueManagerOpen(false)
                }
                aria-label="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </header>

            <div className="overrun-queue-dialog-toolbar">
              <select
                value={selectedMember}
                onChange={(event) =>
                  setSelectedMember(
                    event.target.value,
                  )
                }
                disabled={
                  isLoadingMembers ||
                  availableMembers.length === 0
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
                      key={memberName}
                      value={memberName}
                    >
                      {memberName}
                    </option>
                  ),
                )}
              </select>

              <button
                type="button"
                onClick={handleAddMember}
                disabled={!selectedMember}
              >
                + เพิ่มเข้าคิว
              </button>

              <button
                type="button"
                onClick={handleShuffleQueue}
                disabled={
                  isLoadingMembers ||
                  members.length === 0
                }
              >
                🎲 สุ่มคิวใหม่
              </button>
            </div>

            <div className="overrun-manager-grid">
              <QueueList
                title="Current Queue"
                description="13 คนในรอบปัจจุบัน"
                queue={currentQueue}
                startIndex={0}
                onRemove={
                  removeMemberFromQueue
                }
                onMove={moveMemberInQueue}
              />

              <QueueList
                title="Waiting Queue"
                description="สมาชิกที่รอรอบถัดไป"
                queue={waitingQueue}
                startIndex={
                  CURRENT_QUEUE_SIZE
                }
                onRemove={
                  removeMemberFromQueue
                }
                onMove={moveMemberInQueue}
              />
            </div>

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setIsQueueManagerOpen(false)
                }
              >
                ปิด
              </button>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  void saveCurrentQueue()
                }
                disabled={isSaving}
              >
                {isSaving
                  ? 'กำลังบันทึก...'
                  : 'บันทึกคิว'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {isCountDialogOpen && (
        <div
          className="overrun-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setIsCountDialogOpen(false);
            }
          }}
        >
          <section
            className="overrun-count-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h3>ตั้งค่าจำนวนทั้งหน้า</h3>
                <p>
                  ใช้ค่ากับคิวปัจจุบันทั้ง 13 คน
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsCountDialogOpen(false)
                }
                aria-label="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </header>

            <div>
              <label>
                <span>
                  <img
                    src={cardBookIcon}
                    alt=""
                  />
                  การ์ด
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={bulkCardCount}
                  onChange={(event) =>
                    setBulkCardCount(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  <img
                    src={whiteFeatherIcon}
                    alt=""
                  />
                  ขนนกขาว
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    bulkWhiteFeatherCount
                  }
                  onChange={(event) =>
                    setBulkWhiteFeatherCount(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  <img
                    src={redFeatherIcon}
                    alt=""
                  />
                  ขนนกแดง
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    bulkRedFeatherCount
                  }
                  onChange={(event) =>
                    setBulkRedFeatherCount(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setIsCountDialogOpen(false)
                }
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="primary"
                onClick={applyAllCounts}
              >
                ใช้กับทุกคน
              </button>
            </footer>
          </section>
        </div>
      )}

      {preview && (
        <div
          className="overrun-dialog-backdrop"
          role="presentation"
        >
          <section
            className="overrun-preview-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <h3>ยืนยันผล Overrun</h3>
                <p>
                  ตรวจสอบคิวรอบถัดไปก่อนยืนยัน
                </p>
              </div>

              <span
                className={[
                  'overrun-result-badge',
                  preview.result,
                ].join(' ')}
              >
                {preview.result === 'win'
                  ? 'ชนะ'
                  : 'แพ้'}
              </span>
            </header>

            {preview.result === 'lose' && (
              <div className="overrun-preview-note">
                <strong>
                  {preview.noItemMember}
                </strong>{' '}
                จะเป็นคิวอันดับ 1 ในรอบถัดไป
              </div>
            )}

            <div className="overrun-preview-columns">
              <div>
                <h4>รอบปัจจุบัน</h4>

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
                          {memberName}
                        </li>
                      ),
                    )}
                </ol>
              </div>

              <div className="overrun-preview-arrow">
                →
              </div>

              <div>
                <h4>รอบถัดไป</h4>

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
                          {memberName}
                        </li>
                      ),
                    )}
                </ol>
              </div>
            </div>

            <footer>
              <button
                type="button"
                className="secondary"
                onClick={clearPreview}
                disabled={isConfirming}
              >
                ย้อนกลับ
              </button>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  void handleConfirm()
                }
                disabled={isConfirming}
              >
                {isConfirming
                  ? 'กำลังยืนยัน...'
                  : 'ยืนยันและเลื่อนคิว'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}