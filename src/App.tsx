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
import { saveParties } from './services/googleApi';
import { AttendancePage } from './components/attendance/AttendancePage';
import { AuctionPage } from './components/auction/AuctionPage';
import { OverrunPage } from './components/overrun/OverrunPage';
import { WarPlannerPage } from './pages/warPlanner/WarPlannerPage';
import { MemberDashboardPage } from './pages/memberDashboard/MemberDashboardPage';


const EMPTY_SLOTS = ['', '', '', '', ''];

type AppPage =
  | 'partyBuilder'
  | 'attendance'
  | 'auction'
  | 'overrun'
  | 'warPlanner'
  | 'memberDashboard';

function App() {
  const [currentPage, setCurrentPage] =
    useState<AppPage>('partyBuilder');

  const [mode, setMode] =
    useState<PartyMode>('guildLeague');

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    editableParties,
    setEditableParties,
  ] = useState<Party[]>([]);

  const assignedMemberNames = useMemo(() => {
    return new Set(
      editableParties.flatMap((party) =>
        party.slots
          .map((memberName) =>
            memberName.trim(),
          )
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
          (_, index) =>
            party.slots[index] ?? '',
        ),
      })),
    );
  }, [parties]);

  const modeLabel =
    mode === 'guildLeague'
      ? 'Guild League'
      : mode === 'overrun'
        ? 'Overrun'
        : 'Auction Party';

  function handleAddParty(): void {
    setEditableParties(
      (currentParties) => {
        const highestPartyNumber =
          currentParties.reduce(
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
            party:
              highestPartyNumber + 1,
            slots: [...EMPTY_SLOTS],
          },
        ];
      },
    );
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

    setEditableParties(
      (currentParties) =>
        currentParties.map((party) => ({
          ...party,
          slots: [...EMPTY_SLOTS],
        })),
    );
  }

  function handleClearParty(
    partyIndex: number,
  ): void {
    setEditableParties(
      (currentParties) =>
        currentParties.map(
          (party, index) =>
            index === partyIndex
              ? {
                  ...party,
                  slots: [
                    ...EMPTY_SLOTS,
                  ],
                }
              : party,
        ),
    );
  }

  function handleDeleteParty(
    partyIndex: number,
  ): void {
    setEditableParties(
      (currentParties) =>
        currentParties
          .filter(
            (_, index) =>
              index !== partyIndex,
          )
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
    setEditableParties(
      (currentParties) => {
        let sourcePartyIndex = -1;
        let sourceSlotIndex = -1;

        currentParties.forEach(
          (party, partyIndex) => {
            party.slots.forEach(
              (
                currentMember,
                slotIndex,
              ) => {
                if (
                  currentMember ===
                  memberName
                ) {
                  sourcePartyIndex =
                    partyIndex;
                  sourceSlotIndex =
                    slotIndex;
                }
              },
            );
          },
        );

        const targetMember =
          currentParties[
            targetPartyIndex
          ]?.slots[targetSlotIndex] ?? '';

        const updatedParties =
          currentParties.map((party) => ({
            ...party,
            slots: Array.from(
              { length: 5 },
              (_, slotIndex) =>
                party.slots[
                  slotIndex
                ] ?? '',
            ),
          }));

        if (
          sourcePartyIndex !== -1 &&
          sourceSlotIndex !== -1
        ) {
          updatedParties[
            sourcePartyIndex
          ].slots[sourceSlotIndex] =
            targetMember;
        }

        updatedParties[
          targetPartyIndex
        ].slots[targetSlotIndex] =
          memberName;

        return updatedParties;
      },
    );
  }

  function handleRemoveMemberFromParty(
    memberName: string,
  ): void {
    setEditableParties(
      (currentParties) =>
        currentParties.map((party) => ({
          ...party,
          slots: party.slots.map(
            (currentMember) =>
              currentMember ===
              memberName
                ? ''
                : currentMember,
          ),
        })),
    );
  }

  function handleRemoveMember(
    partyIndex: number,
    slotIndex: number,
  ): void {
    setEditableParties(
      (currentParties) =>
        currentParties.map(
          (party, index) => {
            if (index !== partyIndex) {
              return party;
            }

            return {
              ...party,
              slots: party.slots.map(
                (
                  memberName,
                  currentSlotIndex,
                ) =>
                  currentSlotIndex ===
                  slotIndex
                    ? ''
                    : memberName,
              ),
            };
          },
        ),
    );
  }

  async function handleSaveParties(): Promise<void> {
    try {
      setIsSaving(true);

      const sheetName =
        mode === 'guildLeague'
          ? 'GuildLeague'
          : mode === 'overrun'
            ? 'Overrun'
            : 'AuctionParty';

      const message =
        await saveParties(
          sheetName,
          editableParties,
        );

      window.alert(message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'เกิดข้อผิดพลาดขณะบันทึกข้อมูล';

      window.alert(message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSwapParties(
    sourcePartyIndex: number,
    targetPartyIndex: number,
  ): void {
    if (
      sourcePartyIndex ===
      targetPartyIndex
    ) {
      return;
    }

    setEditableParties(
      (currentParties) => {
        const sourceParty =
          currentParties[
            sourcePartyIndex
          ];

        const targetParty =
          currentParties[
            targetPartyIndex
          ];

        if (
          !sourceParty ||
          !targetParty
        ) {
          return currentParties;
        }

        return currentParties.map(
          (party, index) => {
            if (
              index === sourcePartyIndex
            ) {
              return {
                ...party,
                slots: [
                  ...targetParty.slots,
                ],
              };
            }

            if (
              index === targetPartyIndex
            ) {
              return {
                ...party,
                slots: [
                  ...sourceParty.slots,
                ],
              };
            }

            return party;
          },
        );
      },
    );
  }

  const isPartyPage =
    currentPage === 'partyBuilder';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">
            EZ
          </div>

          <div>
            <h1>
              EZMOO Guild Manager
            </h1>

            <p>
              Guild management system
            </p>
          </div>
        </div>

        {isPartyPage && (
          <button
            type="button"
            className="reload-button"
            onClick={() =>
              void handleReloadAll()
            }
            disabled={
              isLoadingMembers ||
              isLoadingParties
            }
          >
            {isLoadingMembers ||
            isLoadingParties
              ? 'กำลังโหลด...'
              : 'โหลดข้อมูลใหม่'}
          </button>
        )}
      </header>

      <nav className="main-navigation">
        <button
          type="button"
          className={
            currentPage ===
            'partyBuilder'
              ? 'active'
              : ''
          }
          onClick={() =>
            setCurrentPage(
              'partyBuilder',
            )
          }
        >
          Party Builder
        </button>

        <button
          type="button"
          className={
            currentPage ===
            'attendance'
              ? 'active'
              : ''
          }
          onClick={() =>
            setCurrentPage(
              'attendance',
            )
          }
        >
          Attendance
        </button>

        <button
          type="button"
          className={
            currentPage === 'auction'
              ? 'active'
              : ''
          }
          onClick={() =>
            setCurrentPage('auction')
          }
        >
          Auction
        </button>

        <button
          type="button"
          className={
            currentPage === 'overrun'
              ? 'active'
              : ''
          }
          onClick={() =>
            setCurrentPage('overrun')
          }
        >
          Overrun Auction
        </button>

        <button
          type="button"
          className={
            currentPage === 'warPlanner'
              ? 'active'
              : ''
          }
          onClick={() =>
            setCurrentPage('warPlanner')
          }
        >
          War Planner
        </button>
                <button
          type="button"
          className={
            currentPage === 'memberDashboard'
              ? 'active'
              : ''
          }
          onClick={() =>
            setCurrentPage('memberDashboard')
          }
        >
          Members
</button>
      </nav>

      {isPartyPage && (
        <>
          <nav className="mode-selector">
            <button
              type="button"
              className={
                mode ===
                'guildLeague'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setMode(
                  'guildLeague',
                )
              }
            >
              Guild League
            </button>

            <button
              type="button"
              className={
                mode === 'overrun'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setMode('overrun')
              }
            >
              Overrun
            </button>

            <button
              type="button"
              className={
                mode === 'auctionParty'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setMode('auctionParty')
              }
            >
              Auction Party
            </button>
          </nav>

          {memberErrorMessage && (
            <div className="error-message">
              <p>
                {memberErrorMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  void reloadMembers()
                }
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
                parties={
                  editableParties
                }
                isLoading={
                  isLoadingParties
                }
                errorMessage={
                  partyErrorMessage
                }
                onReload={
                  handleReloadAll
                }
                onSave={
                  handleSaveParties
                }
                isSaving={isSaving}
                onAddParty={
                  handleAddParty
                }
                onClearAll={
                  handleClearAll
                }
                onClearParty={
                  handleClearParty
                }
                onDeleteParty={
                  handleDeleteParty
                }
                onDropMember={
                  handleDropMember
                }
                onSwapParties={
                  handleSwapParties
                }
                onRemoveMember={
                  handleRemoveMember
                }
              />

              <MemberPanel
                members={members}
                mode={mode}
                assignedMemberNames={
                  assignedMemberNames
                }
                onRemoveMemberFromParty={
                  handleRemoveMemberFromParty
                }
              />
            </main>
          )}
        </>
      )}

      {currentPage === 'attendance' && (
        <AttendancePage
          members={members}
          isLoadingMembers={isLoadingMembers}
          memberErrorMessage={memberErrorMessage}
          onReloadMembers={reloadMembers}
        />
      )}

      {currentPage === 'auction' && (
        <AuctionPage
          members={members}
        />
      )}

      {currentPage === 'overrun' && (
        <OverrunPage
          members={members}
          isLoadingMembers={
            isLoadingMembers
          }
        />
      )}

      {currentPage === 'warPlanner' && (
        <WarPlannerPage />
      )}
      {currentPage === 'memberDashboard' && (
        <MemberDashboardPage
          members={members}
          isLoading={isLoadingMembers}
          errorMessage={memberErrorMessage}
        />
      )}
    </div>
  );
}

export default App;