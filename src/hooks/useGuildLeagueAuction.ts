import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  getGuildLeagueAuction,
  getParties,
  saveGuildLeagueAuction,
} from '../services/googleApi';

import type {
  GuildLeagueAuctionRow,
  GuildLeagueAuctionSaveItem,
} from '../types/auction';

const FIRST_AUCTION_PARTY = 5;
const LAST_AUCTION_PARTY = 16;

const DEFAULT_CARD_COUNT = 2;
const DEFAULT_WHITE_FEATHER_COUNT = 8;
const DEFAULT_RED_FEATHER_COUNT = 10;

interface UseGuildLeagueAuctionParameters {
  eventDate: string;
}

interface UseGuildLeagueAuctionResult {
  auctionRows: GuildLeagueAuctionRow[];
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string;
  saveMessage: string;

  reloadAuction: () => Promise<void>;

  setQueueOwner: (
    partyNo: number,
    queueOwner: string,
  ) => void;

  setSoldTo: (
    partyNo: number,
    soldTo: string,
  ) => void;

  setCardCount: (
    partyNo: number,
    value: number,
  ) => void;

  setWhiteFeatherCount: (
    partyNo: number,
    value: number,
  ) => void;

  setRedFeatherCount: (
    partyNo: number,
    value: number,
  ) => void;

  setAllCounts: (
    cardCount: number,
    whiteFeatherCount: number,
    redFeatherCount: number,
  ) => void;

  saveCurrentAuction: () => Promise<boolean>;
}

function normalizeCount(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0;
  }

  return Math.floor(value);
}

export function useGuildLeagueAuction({
  eventDate,
}: UseGuildLeagueAuctionParameters): UseGuildLeagueAuctionResult {
  const [
    auctionRows,
    setAuctionRows,
  ] = useState<GuildLeagueAuctionRow[]>([]);

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

  const loadAuction =
    useCallback(async (): Promise<void> => {
      if (!eventDate) {
        setAuctionRows([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage('');
        setSaveMessage('');

        const [
          auctionParties,
          savedAuction,
        ] = await Promise.all([
          getParties('AuctionParty'),
          getGuildLeagueAuction(
            eventDate,
          ),
        ]);

        const safeAuctionParties =
          Array.isArray(auctionParties)
            ? auctionParties
            : [];

        const safeSavedAuction =
          Array.isArray(savedAuction)
            ? savedAuction
            : [];

        const savedAuctionByParty =
          new Map(
            safeSavedAuction.map(
              (record) => [
                record.partyNo,
                record,
              ],
            ),
          );

        const partyByNumber =
          new Map(
            safeAuctionParties.map(
              (party) => [
                party.party,
                party,
              ],
            ),
          );

        const mergedRows =
          Array.from(
            {
              length:
                LAST_AUCTION_PARTY -
                FIRST_AUCTION_PARTY +
                1,
            },
            (_, index) => {
              const partyNo =
                FIRST_AUCTION_PARTY +
                index;

              const party =
                partyByNumber.get(
                  partyNo,
                );

              const savedRecord =
                savedAuctionByParty.get(
                  partyNo,
                );

              const partyMembers =
                party?.slots
                  .map((memberName) =>
                    memberName.trim(),
                  )
                  .filter(Boolean) ?? [];

              const savedOwner =
                savedRecord
                  ?.queueOwner ?? '';

              /*
               * ป้องกันกรณีสมาชิกถูกย้ายออกจากตี้
               * แต่ข้อมูลประมูลเก่ายังเก็บชื่อเดิมไว้
               */
              const queueOwner =
                partyMembers.includes(
                  savedOwner,
                )
                  ? savedOwner
                  : '';

              return {
                partyNo,
                partyMembers,
                queueOwner,
                soldTo:
                  savedRecord
                    ?.soldTo ?? '',
                cardCount:
                  savedRecord
                    ?.cardCount ??
                  DEFAULT_CARD_COUNT,
                whiteFeatherCount:
                  savedRecord
                    ?.whiteFeatherCount ??
                  DEFAULT_WHITE_FEATHER_COUNT,
                redFeatherCount:
                  savedRecord
                    ?.redFeatherCount ??
                  DEFAULT_RED_FEATHER_COUNT,
              };
            },
          );

        setAuctionRows(mergedRows);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'ไม่สามารถโหลดข้อมูลประมูลได้';

        setErrorMessage(message);
        setAuctionRows([]);
      } finally {
        setIsLoading(false);
      }
    }, [eventDate]);

  useEffect(() => {
    void loadAuction();
  }, [loadAuction]);

  function updateAuctionRow(
    partyNo: number,
    update: Partial<
      GuildLeagueAuctionSaveItem
    >,
  ): void {
    setAuctionRows(
      (currentRows) =>
        currentRows.map((row) =>
          row.partyNo === partyNo
            ? {
                ...row,
                ...update,
              }
            : row,
        ),
    );

    setSaveMessage('');
  }

  function setQueueOwner(
    partyNo: number,
    queueOwner: string,
  ): void {
    const targetRow =
      auctionRows.find(
        (row) =>
          row.partyNo === partyNo,
      );

    if (!targetRow) {
      return;
    }

    if (
      queueOwner !== '' &&
      !targetRow.partyMembers.includes(
        queueOwner,
      )
    ) {
      return;
    }

    updateAuctionRow(
      partyNo,
      {
        queueOwner,
      },
    );
  }

  function setSoldTo(
    partyNo: number,
    soldTo: string,
  ): void {
    updateAuctionRow(
      partyNo,
      {
        soldTo,
      },
    );
  }

  function setCardCount(
    partyNo: number,
    value: number,
  ): void {
    updateAuctionRow(
      partyNo,
      {
        cardCount:
          normalizeCount(value),
      },
    );
  }

  function setWhiteFeatherCount(
    partyNo: number,
    value: number,
  ): void {
    updateAuctionRow(
      partyNo,
      {
        whiteFeatherCount:
          normalizeCount(value),
      },
    );
  }

  function setRedFeatherCount(
    partyNo: number,
    value: number,
  ): void {
    updateAuctionRow(
      partyNo,
      {
        redFeatherCount:
          normalizeCount(value),
      },
    );
  }

  function setAllCounts(
    cardCount: number,
    whiteFeatherCount: number,
    redFeatherCount: number,
  ): void {
    const normalizedCardCount =
      normalizeCount(cardCount);

    const normalizedWhiteFeatherCount =
      normalizeCount(
        whiteFeatherCount,
      );

    const normalizedRedFeatherCount =
      normalizeCount(
        redFeatherCount,
      );

    setAuctionRows(
      (currentRows) =>
        currentRows.map((row) => ({
          ...row,
          cardCount:
            normalizedCardCount,
          whiteFeatherCount:
            normalizedWhiteFeatherCount,
          redFeatherCount:
            normalizedRedFeatherCount,
        })),
    );

    setSaveMessage('');
  }

  async function saveCurrentAuction(): Promise<boolean> {
    if (!eventDate) {
      setErrorMessage(
        'กรุณาเลือกวันที่วอ',
      );

      return false;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setSaveMessage('');

      const auction:
        GuildLeagueAuctionSaveItem[] =
        auctionRows.map((row) => ({
          partyNo: row.partyNo,
          queueOwner:
            row.queueOwner.trim(),
          soldTo:
            row.soldTo.trim(),
          cardCount:
            row.cardCount,
          whiteFeatherCount:
            row.whiteFeatherCount,
          redFeatherCount:
            row.redFeatherCount,
        }));

      const message =
        await saveGuildLeagueAuction(
          eventDate,
          auction,
        );

      await loadAuction();

      setSaveMessage(message);

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถบันทึกข้อมูลประมูลได้';

      setErrorMessage(message);

      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    auctionRows,
    isLoading,
    isSaving,
    errorMessage,
    saveMessage,

    reloadAuction:
      loadAuction,

    setQueueOwner,
    setSoldTo,
    setCardCount,
    setWhiteFeatherCount,
    setRedFeatherCount,
    setAllCounts,
    saveCurrentAuction,
  };
}