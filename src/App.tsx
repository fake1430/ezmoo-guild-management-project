import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MemberPanel } from './components/member/MemberPanel';
import { PartyBoard } from './components/party/PartyBoard';
import { useMembers } from './hooks/useMembers';
import { useParties } from './hooks/useParties';
import type { PartyMode } from './types/member';
import type { Party } from './types/partyTypes';

const EMPTY_SLOTS = ['', '', '', '', ''];

function App() {
  const [mode, setMode] =
    useState<PartyMode>('guildLeague');

  const [editableParties, setEditableParties] =
    useState<Party[]>([]);

  const assignedMemberNames = useMemo(() => {
    return new Set(
      editableParties.flatMap((party) =>
        party.slots
          .map((memberName) => memberName.trim())
          .filter(Boolean),
      ),
    );
  }, [editableParties]);

  const {
    members,
    isLoading: isLoadingMembers,
    errorMessage: memberErrorMessage,
    reloadMembers,
  } = useMembers();

  const {
    parties,
    isLoading: isLoadingParties,
    errorMessage: partyErrorMessage,
    reloadParties,
  } = useParties(mode);

  useEffect(() => {
    setEditableParties(
      parties.map((party) => ({
        ...party,
        slots: Array.from(
          { length: 5 },
          (_, index) => party.slots[index] ?? '',
        ),
      })),
    );
  }, [parties]);

  const modeLabel =
    mode === 'guildLeague'
      ? 'Guild League'
      : 'Overrun';

  function handleAddParty(): void {
    setEditableParties((currentParties) => {
      const highestPartyNumber = currentParties.reduce(
        (highest, party, index) =>
          Math.max(
            highest,
            party.party ?? index + 1,
          ),
        0,
      );

      return [
        ...currentParties,
        {
          party: highestPartyNumber + 1,
          slots: [...EMPTY_SLOTS],
        },
      ];
    });
  }

  function handleClearAll(): void {
    if (editableParties.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      'ต้องการล้างสมาชิกออกจากทุกปาร์ตี้หรือไม่?\n\nจำนวนปาร์ตี้จะยังคงเดิม',
    );

    if (!confirmed) {
      return;
    }

    setEditableParties((currentParties) =>
      currentParties.map((party) => ({
        ...party,
        slots: [...EMPTY_SLOTS],
      })),
    );
  }

  function handleClearParty(
    partyIndex: number,
  ): void {
    setEditableParties((currentParties) =>
      currentParties.map((party, index) =>
        index === partyIndex
          ? {
              ...party,
              slots: [...EMPTY_SLOTS],
            }
          : party,
      ),
    );
  }

  function handleDeleteParty(
    partyIndex: number,
  ): void {
    setEditableParties((currentParties) =>
      currentParties
        .filter((_, index) => index !== partyIndex)
        .map((party, index) => ({
          ...party,
          party: index + 1,
        })),
    );
  }

  async function handleReloadAll(): Promise<void> {
    await Promise.all([
      reloadMembers(),
      reloadParties(),
    ]);
  }

function handleDropMember(
  memberName: string,
  targetPartyIndex: number,
  targetSlotIndex: number,
): void {
  setEditableParties((currentParties) => {
    let sourcePartyIndex = -1;
    let sourceSlotIndex = -1;

    currentParties.forEach((party, partyIndex) => {
      party.slots.forEach((currentMember, slotIndex) => {
        if (currentMember === memberName) {
          sourcePartyIndex = partyIndex;
          sourceSlotIndex = slotIndex;
        }
      });
    });

    const targetMember =
      currentParties[targetPartyIndex]?.slots[
        targetSlotIndex
      ] ?? '';

    const updatedParties = currentParties.map(
      (party) => ({
        ...party,
        slots: Array.from(
          { length: 5 },
          (_, slotIndex) =>
            party.slots[slotIndex] ?? '',
        ),
      }),
    );

    if (
      sourcePartyIndex !== -1 &&
      sourceSlotIndex !== -1
    ) {
      updatedParties[sourcePartyIndex].slots[
        sourceSlotIndex
      ] = targetMember;
    }

    updatedParties[targetPartyIndex].slots[
      targetSlotIndex
    ] = memberName;

    return updatedParties;
  });
}

  function handleRemoveMemberFromParty(
    memberName: string,
  ): void {
    setEditableParties((currentParties) =>
      currentParties.map((party) => ({
        ...party,
        slots: party.slots.map((currentMember) =>
          currentMember === memberName
            ? ''
            : currentMember,
        ),
      })),
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">EZ</div>

          <div>
            <h1>EZMOO Guild Manager</h1>
            <p>Party management system</p>
          </div>
        </div>

        <button
          type="button"
          className="reload-button"
          onClick={() => void handleReloadAll()}
          disabled={
            isLoadingMembers || isLoadingParties
          }
        >
          {isLoadingMembers || isLoadingParties
            ? 'กำลังโหลด...'
            : 'โหลดข้อมูลใหม่'}
        </button>
      </header>

      <nav className="mode-selector">
        <button
          type="button"
          className={
            mode === 'guildLeague' ? 'active' : ''
          }
          onClick={() => setMode('guildLeague')}
        >
          Guild League
        </button>

        <button
          type="button"
          className={
            mode === 'overrun' ? 'active' : ''
          }
          onClick={() => setMode('overrun')}
        >
          Overrun
        </button>
      </nav>

      {memberErrorMessage && (
        <div className="error-message">
          <p>{memberErrorMessage}</p>

          <button
            type="button"
            onClick={() => void reloadMembers()}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {!memberErrorMessage && (
        <main className="workspace">
          <PartyBoard
            modeLabel={modeLabel}
            members={members}
            mode={mode}
            parties={editableParties}
            isLoading={isLoadingParties}
            errorMessage={partyErrorMessage}
            onReload={reloadParties}
            onAddParty={handleAddParty}
            onClearAll={handleClearAll}
            onClearParty={handleClearParty}
            onDeleteParty={handleDeleteParty}
            onDropMember={handleDropMember}
          />

          <MemberPanel
            members={members}
            mode={mode}
            assignedMemberNames={assignedMemberNames}
            onRemoveMemberFromParty={
              handleRemoveMemberFromParty
            }
          />
        </main>
      )}
    </div>
  );
}

export default App;