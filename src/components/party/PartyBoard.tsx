import {
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { toBlob } from 'html-to-image';
import type {
  Member,
  PartyMode,
} from '../../types/member';
import type { Party } from '../../types/partyTypes';
import { getClassColor } from '../../constants/classColors';

interface PartyBoardProps {
  modeLabel: string;
  members: Member[];
  mode: PartyMode;
  parties: Party[];
  isLoading: boolean;
  errorMessage: string;
  onReload: () => Promise<void>;
  onSave: () => Promise<void>;
  isSaving: boolean;
  onAddParty: () => void;
  onClearAll: () => void;
  onRemoveMember: (
    partyIndex: number,
    slotIndex: number,
  ) => void;
  onClearParty: (partyIndex: number) => void;
  onDeleteParty: (partyIndex: number) => void;
  onDropMember: (
    memberName: string,
    partyIndex: number,
    slotIndex: number,
  ) => void;
  onSwapParties: (
    sourcePartyIndex: number,
    targetPartyIndex: number,
  ) => void;
}

interface RaidColumnProps {
  title: string;
  parties: Party[];
  startIndex: number;
}

function normalizeSlots(slots: string[]): string[] {
  return Array.from(
    { length: 5 },
    (_, index) => slots[index]?.trim() ?? '',
  );
}

function countMembers(party: Party): number {
  return normalizeSlots(party.slots).filter(Boolean).length;
}

function getMemberClass(
  memberName: string,
  members: Member[],
  mode: PartyMode,
): string {
  const member = members.find(
    (currentMember) =>
      currentMember.ign ===
      memberName,
  );

  if (!member) {
    return '';
  }

  if (mode === 'guildLeague') {
    return member.guildLeagueClass;
  }

  if (mode === 'overrun') {
    return member.overrunClass;
  }

  return '';
}

export function PartyBoard({
  modeLabel,
  members,
  mode,
  parties,
  isLoading,
  errorMessage,
  onReload,
  onSave,
  isSaving,
  onAddParty,
  onClearAll,
  onRemoveMember,
  onClearParty,
  onDeleteParty,
  onDropMember,
  onSwapParties,
}: PartyBoardProps) {
    const isAuctionParty =
    mode === 'auctionParty';

  const boardTitle =
    isAuctionParty
      ? modeLabel
      : `${modeLabel} 40 vs 40`;
  const captureAreaRef =
    useRef<HTMLDivElement | null>(null);

  const [isDraggingParty, setIsDraggingParty] =
    useState(false);
    
  const [dragTargetSlot, setDragTargetSlot] = useState<{
  partyIndex: number;
  slotIndex: number;
} | null>(null);

  const [dragTargetParty, setDragTargetParty] =
    useState<number | null>(null);
    
  const [isCapturing, setIsCapturing] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  function handleMemberDragStart(
    event: DragEvent<HTMLDivElement>,
    memberName: string,
  ): void {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';

    event.dataTransfer.setData(
      'application/x-ezmoo-member',
      memberName,
    );

    event.dataTransfer.setData(
      'text/plain',
      memberName,
    );
    setDragTargetSlot(null);
  }

  function handleMemberDragOver(
    event: DragEvent<HTMLDivElement>,
    partyIndex: number,
    slotIndex: number,
  ): void {
    const draggingWholeParty =
      event.dataTransfer.types.includes(
        'application/x-ezmoo-party',
      );

    if (draggingWholeParty) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    setDragTargetSlot({
      partyIndex,
      slotIndex,
    });
  }

function handleMemberDragLeave(
  event: DragEvent<HTMLDivElement>,
  partyIndex: number,
  slotIndex: number,
): void {
  const nextElement = event.relatedTarget;

  if (
    nextElement instanceof Node &&
    event.currentTarget.contains(nextElement)
  ) {
    return;
  }

  setDragTargetSlot((currentTarget) => {
    if (
      currentTarget?.partyIndex === partyIndex &&
      currentTarget.slotIndex === slotIndex
    ) {
      return null;
    }

    return currentTarget;
  });
}

  function handleMemberDrop(
    event: DragEvent<HTMLDivElement>,
    partyIndex: number,
    slotIndex: number,
  ): void {
    const draggingWholeParty =
      event.dataTransfer.types.includes(
        'application/x-ezmoo-party',
      );

    if (draggingWholeParty) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragTargetSlot(null);

    const memberName =
      event.dataTransfer.getData(
        'application/x-ezmoo-member',
      ) ||
      event.dataTransfer.getData('text/plain');

    const normalizedName = memberName.trim();

    if (!normalizedName) {
      return;
    }

    onDropMember(
      normalizedName,
      partyIndex,
      slotIndex,
    );
  }

  function handlePartyDragStart(
    event: DragEvent<HTMLDivElement>,
    partyIndex: number,
  ): void {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';

    event.dataTransfer.setData(
      'application/x-ezmoo-party',
      String(partyIndex),
    );

    setDragTargetParty(null);
    setIsDraggingParty(true);
    setDragTargetSlot(null);
  }

  function handlePartyDragOver(
    event: DragEvent<HTMLElement>,
    targetPartyIndex?: number,
  ): void {
    const hasPartyData =
      event.dataTransfer.types.includes(
        'application/x-ezmoo-party',
      );

    if (!hasPartyData) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (targetPartyIndex !== undefined) {
      setDragTargetParty(targetPartyIndex);
    }
  }

  function handlePartyDragLeave(
    event: DragEvent<HTMLElement>,
    partyIndex: number,
  ): void {
    const nextElement = event.relatedTarget;

    if (
      nextElement instanceof Node &&
      event.currentTarget.contains(nextElement)
    ) {
      return;
    }

    setDragTargetParty((currentTarget) =>
      currentTarget === partyIndex
        ? null
        : currentTarget,
    );
  }

  function handlePartyDrop(
    event: DragEvent<HTMLElement>,
    targetPartyIndex: number,
  ): void {
    const sourceIndexText =
      event.dataTransfer.getData(
        'application/x-ezmoo-party',
      );

    if (!sourceIndexText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const sourcePartyIndex =
      Number(sourceIndexText);

    setDragTargetParty(null);
    setIsDraggingParty(false);

    if (
      Number.isNaN(sourcePartyIndex) ||
      sourcePartyIndex === targetPartyIndex
    ) {
      return;
    }

    onSwapParties(
      sourcePartyIndex,
      targetPartyIndex,
    );
  }

  function handleDeleteDrop(
    event: DragEvent<HTMLDivElement>,
  ): void {
    const sourceIndexText =
      event.dataTransfer.getData(
        'application/x-ezmoo-party',
      );

    if (!sourceIndexText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const sourcePartyIndex =
      Number(sourceIndexText);

    if (!Number.isNaN(sourcePartyIndex)) {
      onDeleteParty(sourcePartyIndex);
    }

    setDragTargetParty(null);
    setIsDraggingParty(false);
  }

  function handleClearPartyContextMenu(
    event: MouseEvent<HTMLDivElement>,
    partyIndex: number,
  ): void {
    event.preventDefault();
    onClearParty(partyIndex);
  }

  async function handleCopyRaidImage(): Promise<void> {
    const captureElement = captureAreaRef.current;

    if (!captureElement) {
      return;
    }

    try {
      setIsCapturing(true);

      const blob = await toBlob(captureElement, {
        backgroundColor: '#f8fafc',
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
        'ไม่สามารถคัดลอกรูปภาพได้',
        error,
      );
    } finally {
      setIsCapturing(false);
    }
  }

  function renderRaidColumn({
    title,
    parties: raidParties,
    startIndex,
  }: RaidColumnProps) {
    const raidMemberCount = raidParties.reduce(
      (total, party) =>
        total + countMembers(party),
      0,
    );

    const canAddParty =
      parties.length < 16 &&
      (
        (startIndex === 0 &&
          parties.length < 8) ||
        (startIndex === 8 &&
          parties.length >= 8)
      );

    return (
      <section className="compact-raid-column">
        <header className="compact-raid-header">
          <h3>{title}</h3>

          <span
            className={
              raidMemberCount === 40
                ? 'raid-count full'
                : 'raid-count'
            }
          >
            {raidMemberCount}/40
          </span>
        </header>

        <div className="compact-party-list">
          {raidParties.map(
            (party, localIndex) => {
              const actualPartyIndex =
                startIndex + localIndex;

              let displayPartyNumber: number;

              if (isAuctionParty) {
                displayPartyNumber =
                  party.party ?? actualPartyIndex + 1;
              } else {
                displayPartyNumber =
                  party.party != null
                    ? ((party.party - 1) % 8) + 1
                    : ((actualPartyIndex % 8) + 1);
              }

              const slots =
                normalizeSlots(party.slots);

              return (
                <article
                  className={
                    dragTargetParty ===
                    actualPartyIndex
                      ? 'compact-party-row drag-target'
                      : 'compact-party-row'
                  }
                  key={`${title}-${actualPartyIndex}`}
                  onDragOver={(event) =>
                    handlePartyDragOver(
                      event,
                      actualPartyIndex,
                    )
                  }
                  onDragLeave={(event) =>
                    handlePartyDragLeave(
                      event,
                      actualPartyIndex,
                    )
                  }
                  onDrop={(event) =>
                    handlePartyDrop(
                      event,
                      actualPartyIndex,
                    )
                  }
                >
                  <div
                    className="compact-party-number"
                    draggable
                    onDragStart={(event) =>
                      handlePartyDragStart(
                        event,
                        actualPartyIndex,
                      )
                    }
                    onDragEnd={() => {
                      setIsDraggingParty(false);
                      setDragTargetParty(null);
                    }}
                    onContextMenu={(event) =>
                      handleClearPartyContextMenu(
                        event,
                        actualPartyIndex,
                      )
                    }
                    title={
                      'ลากเพื่อสลับปาร์ตี้\nคลิกขวาเพื่อล้างปาร์ตี้'
                    }
                  >
                    {displayPartyNumber}
                  </div>

                  <div className="compact-party-slots">
                    {slots.map(
                      (
                        memberName,
                        slotIndex,
                      ) => {
                        const className =
                          memberName
                            ? getMemberClass(
                                memberName,
                                members,
                                mode,
                              )
                            : '';

                        return (
                          <div
                            className={[
                              'compact-party-slot',
                              memberName ? 'occupied' : 'empty',
                              dragTargetSlot?.partyIndex === actualPartyIndex &&
                              dragTargetSlot.slotIndex === slotIndex
                                ? 'member-drag-target'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            key={slotIndex}
                            draggable={Boolean(
                              memberName,
                            )}
                            onDragStart={(
                              event,
                            ) => {
                              if (memberName) {
                                handleMemberDragStart(
                                  event,
                                  memberName,
                                );
                              }
                            }}
                            onDragEnd={() => {
                              setDragTargetSlot(null);
                            }}
                            onDragOver={(event) =>
                              handleMemberDragOver(
                                event,
                                actualPartyIndex,
                                slotIndex,
                              )
                            }
                            onDragLeave={(event) =>
                              handleMemberDragLeave(
                                event,
                                actualPartyIndex,
                                slotIndex,
                              )
                            }
                            onDrop={(event) =>
                              handleMemberDrop(
                                event,
                                actualPartyIndex,
                                slotIndex,
                              )
                            }
                          >
                            {memberName ? (
                              <>
                                <button
                                  type="button"
                                  className="member-remove-button"
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    onRemoveMember(
                                      actualPartyIndex,
                                      slotIndex,
                                    );
                                  }}
                                  aria-label={`นำ ${memberName} ออกจากปาร์ตี้`}
                                  title="นำสมาชิกออก"
                                >
                                  ✕
                                </button>

                                  {mode !== 'auctionParty' && (
                                    <span
                                      className="party-member-class"
                                      style={{
                                        backgroundColor:
                                          getClassColor(
                                            className ||
                                              'ไม่ระบุอาชีพ',
                                          ),
                                      }}
                                    >
                                      {className ||
                                        'ไม่ระบุอาชีพ'}
                                    </span>
                                  )}

                                <strong>
                                  {memberName}
                                </strong>
                              </>
                            ) : (
                              <span className="compact-empty-text">
                                Empty
                              </span>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </article>
              );
            },
          )}

          {canAddParty && (
            <button
              type="button"
              className="compact-add-party"
              onClick={onAddParty}
            >
              + เพิ่ม Party{' '}
              {raidParties.length + 1}
            </button>
          )}
        </div>
      </section>
    );
  }

  const raidAParties =
    parties.slice(0, 8);

  const raidBParties =
    parties.slice(8, 16);

  return (
    <section className="party-board">
      <div className="party-toolbar">
        <div>
          <h2>{boardTitle}</h2>

          <p>
            {parties.length} ปาร์ตี้ ·
            รองรับสูงสุด 80 คน
          </p>
        </div>

        <div className="party-toolbar-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => void onReload()}
            disabled={isLoading}
          >
            {isLoading
              ? 'กำลังโหลด...'
              : 'โหลดใหม่'}
          </button>

          <button
            type="button"
            className="toolbar-button save-button"
            onClick={() => void onSave()}
            disabled={
              isLoading || isSaving
            }
          >
            {isSaving
              ? 'กำลังบันทึก...'
              : 'บันทึก'}
          </button>

          <button
            type="button"
            className="toolbar-button capture-button"
            onClick={() =>
              void handleCopyRaidImage()
            }
            disabled={
              isCapturing || isLoading
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
            className="toolbar-button add-button"
            onClick={onAddParty}
            disabled={parties.length >= 16}
          >
            + เพิ่มปาร์ตี้
          </button>

          <button
            type="button"
            className="toolbar-button danger-outline-button"
            onClick={onClearAll}
            disabled={parties.length === 0}
          >
            ล้างทั้งหมด
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="party-status">
          กำลังโหลดข้อมูลปาร์ตี้...
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="party-error">
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() =>
              void onReload()
            }
          >
            ลองใหม่
          </button>
        </div>
      )}

      {!isLoading &&
        !errorMessage &&
        parties.length === 0 && (
          <div className="empty-party-board">
            <strong>
              ยังไม่มีปาร์ตี้
            </strong>

            <p>
              กด “เพิ่มปาร์ตี้”
              เพื่อเริ่มจัดทีม
            </p>

            <button
              type="button"
              className="add-first-party-button"
              onClick={onAddParty}
            >
              + เพิ่มปาร์ตี้
            </button>
          </div>
        )}

      {!isLoading &&
        !errorMessage &&
        parties.length > 0 && (
          <div
            ref={captureAreaRef}
            className="compact-raid-grid capture-area"
          >
            {renderRaidColumn({
              title: isAuctionParty
                ? 'Party 1–8'
                : 'Raid A',
              parties: raidAParties,
              startIndex: 0,
            })}

            {renderRaidColumn({
              title: isAuctionParty
                ? 'Party 9–16'
                : 'Raid B',
              parties: raidBParties,
              startIndex: 8,
            })}
          </div>
        )}

      {isDraggingParty && (
        <div
          className="party-delete-drop-zone"
          onDragOver={(event) =>
            handlePartyDragOver(event)
          }
          onDrop={handleDeleteDrop}
        >
          🗑 ลากปาร์ตี้มาวางที่นี่เพื่อลบ
        </div>
      )}
    </section>
  );
}