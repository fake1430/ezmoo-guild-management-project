import type { DragEvent } from 'react';
import type { Party } from '../../types/partyTypes';
import type {
  Member,
  PartyMode,
} from '../../types/member';

interface PartyBoardProps {
  modeLabel: string;
  members: Member[];
  mode: PartyMode;
  parties: Party[];
  isLoading: boolean;
  errorMessage: string;
  onReload: () => Promise<void>;
  onAddParty: () => void;
  onClearAll: () => void;
  onClearParty: (partyIndex: number) => void;
  onDeleteParty: (partyIndex: number) => void;
  onDropMember: (
    memberName: string,
    partyIndex: number,
    slotIndex: number,
  ) => void;
}

interface DraggedPartyMember {
  memberName: string;
  sourcePartyIndex: number;
  sourceSlotIndex: number;
}

function handlePartyMemberDragStart(
  event: DragEvent<HTMLDivElement>,
  memberName: string,
  partyIndex: number,
  slotIndex: number,
): void {
  const payload: DraggedPartyMember = {
    memberName,
    sourcePartyIndex: partyIndex,
    sourceSlotIndex: slotIndex,
  };

  event.dataTransfer.effectAllowed = 'move';

  event.dataTransfer.setData(
    'application/x-ezmoo-party-member',
    JSON.stringify(payload),
  );

  event.dataTransfer.setData(
    'application/x-ezmoo-member',
    memberName,
  );

  event.dataTransfer.setData(
    'text/plain',
    memberName,
  );
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
    (item) => item.ign === memberName,
  );

  if (!member) {
    return '';
  }

  return mode === 'guildLeague'
    ? member.guildLeagueClass
    : member.overrunClass;
}

export function PartyBoard({
  modeLabel,
  members,
  mode,
  parties,
  isLoading,
  errorMessage,
  onReload,
  onAddParty,
  onClearAll,
  onClearParty,
  onDeleteParty,
  onDropMember,
}: PartyBoardProps) {
  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
  ): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    partyIndex: number,
    slotIndex: number,
  ): void {
    event.preventDefault();

    const memberName =
      event.dataTransfer.getData(
        'application/x-ezmoo-member',
      ) || event.dataTransfer.getData('text/plain');

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

  return (
    <section className="party-board">
      <div className="party-toolbar">
        <div>
          <h2>{modeLabel} Party</h2>

          <p>
            {parties.length} ปาร์ตี้ · ปาร์ตี้ละ 5 คน
          </p>
        </div>

        <div className="party-toolbar-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => void onReload()}
            disabled={isLoading}
          >
            {isLoading ? 'กำลังโหลด...' : 'โหลดใหม่'}
          </button>

          <button
            type="button"
            className="toolbar-button add-button"
            onClick={onAddParty}
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
            onClick={() => void onReload()}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {!isLoading &&
        !errorMessage &&
        parties.length === 0 && (
          <div className="empty-party-board">
            <strong>ยังไม่มีปาร์ตี้</strong>

            <p>กด “เพิ่มปาร์ตี้” เพื่อสร้างปาร์ตี้แรก</p>

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
          <div className="party-list">
            {parties.map((party, partyIndex) => {
              const partyNumber =
                party.party ?? partyIndex + 1;

              const slots = normalizeSlots(party.slots);
              const memberCount = countMembers(party);

              return (
                <article
                  className="party-card"
                  key={`${partyNumber}-${partyIndex}`}
                >
                  <div className="party-card-header">
                    <div className="party-title-group">
                      <span className="party-number">
                        {partyNumber}
                      </span>

                      <div>
                        <h3>Party {partyNumber}</h3>

                        <p
                          className={
                            memberCount === 5
                              ? 'party-capacity full'
                              : 'party-capacity'
                          }
                        >
                          {memberCount}/5 คน
                        </p>
                      </div>
                    </div>

                    <div className="party-card-actions">
                      <button
                        type="button"
                        className="small-action-button"
                        onClick={() =>
                          onClearParty(partyIndex)
                        }
                        disabled={memberCount === 0}
                      >
                        ล้างปาร์ตี้
                      </button>

                      <button
                        type="button"
                        className="small-action-button delete-button"
                        onClick={() =>
                          onDeleteParty(partyIndex)
                        }
                      >
                        ลบ
                      </button>
                    </div>
                  </div>

                  <div className="party-slots">
                    {slots.map(
                      (memberName, slotIndex) => (
                        <div
                          className={
                            memberName
                              ? 'party-slot occupied'
                              : 'party-slot empty'
                          }
                          key={slotIndex}
                          draggable={Boolean(memberName)}
                          onDragStart={(event) => {
                            if (memberName) {
                              handlePartyMemberDragStart(
                                event,
                                memberName,
                                partyIndex,
                                slotIndex,
                              );
                            }
                          }}
                          onDragOver={handleDragOver}
                          onDrop={(event) =>
                            handleDrop(
                              event,
                              partyIndex,
                              slotIndex,
                            )
                          }
                        >
                          <span className="slot-label">
                            Slot {slotIndex + 1}
                          </span>

                              {memberName ? (
                                <>
                                  <span className="party-member-class">
                                    {getMemberClass(
                                      memberName,
                                      members,
                                      mode,
                                    ) || 'ไม่ระบุอาชีพ'}
                                  </span>

                                  <strong>{memberName}</strong>
                                </>
                              ) : (
                                <strong>Empty</strong>
                              )}
                        </div>
                      ),
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
    </section>
  );
}