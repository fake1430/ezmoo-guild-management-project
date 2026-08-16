import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  confirmOverrunResult,
  getOverrunAuction,
  getOverrunQueue,
  saveOverrunAuction,
  saveOverrunQueue,
} from '../services/googleApi';
import { OVERRUN_QUEUE_SIZE } from '../constants/overrun';

import type {
  ConfirmOverrunResultPayload,
  OverrunAuctionRow,
  OverrunAuctionSaveItem,
  OverrunPreview,
  OverrunQueueItem,
  OverrunResult,
} from '../types/overrun';

const DEFAULT_CARD_COUNT = 2;
const DEFAULT_WHITE_FEATHER_COUNT = 8;
const DEFAULT_RED_FEATHER_COUNT = 10;

interface UseOverrunAuctionParameters {
  eventDate: string;
}

interface UseOverrunAuctionResult {
  queue: OverrunQueueItem[];
  currentQueue: OverrunQueueItem[];
  waitingQueue: OverrunQueueItem[];
  auctionRows: OverrunAuctionRow[];
  preview: OverrunPreview | null;
  isLoading: boolean;
  isSaving: boolean;
  isConfirming: boolean;
  errorMessage: string;
  saveMessage: string;
  reloadQueue: () => Promise<void>;
  addMemberToQueue: (memberName: string) => void;
  replaceQueue: (memberNames: string[]) => void;
  removeMemberFromQueue: (queueIndex: number) => void;
  moveMemberInQueue: (
    sourceIndex: number,
    targetIndex: number,
  ) => void;
  saveCurrentQueue: () => Promise<boolean>;
  saveAuction: () => Promise<boolean>;
  setSoldTo: (
    queueOrder: number,
    soldTo: string,
  ) => void;
  setCardCount: (queueOrder: number, value: number) => void;
  setWhiteFeatherCount: (queueOrder: number, value: number) => void;
  setRedFeatherCount: (queueOrder: number, value: number) => void;
  setAllCounts: (
    cardCount: number,
    whiteFeatherCount: number,
    redFeatherCount: number,
  ) => void;
  createPreview: (result: OverrunResult, noItemMember?: string) => boolean;
  clearPreview: () => void;
  confirmPreview: () => Promise<boolean>;
}

function normalizeQueue(queue: OverrunQueueItem[]): OverrunQueueItem[] {
  return queue
    .map((item) => ({
      queueOrder: Number(item.queueOrder),
      memberName: String(item.memberName ?? '').trim(),
    }))
    .filter((item) => item.memberName !== '')
    .sort((a, b) => a.queueOrder - b.queueOrder)
    .map((item, index) => ({
      ...item,
      queueOrder: index + 1,
    }));
}

function buildQueueItems(memberNames: string[]): OverrunQueueItem[] {
  return memberNames.map((memberName, index) => ({
    queueOrder: index + 1,
    memberName,
  }));
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function buildAuctionRows(
  currentQueue: OverrunQueueItem[],
  previousRows: OverrunAuctionRow[] = [],
): OverrunAuctionRow[] {
  const previousByOwner = new Map(
    previousRows.map((row) => [
      row.queueOwner,
      row,
    ]),
  );

  return currentQueue.map((item, index) => {
    const previous = previousByOwner.get(item.memberName);

    return {
      queueOrder: index + 1,
      queueOwner: item.memberName,
      soldTo: previous?.soldTo ?? '',
      cardCount: previous?.cardCount ?? DEFAULT_CARD_COUNT,
      whiteFeatherCount:
        previous?.whiteFeatherCount ?? DEFAULT_WHITE_FEATHER_COUNT,
      redFeatherCount:
        previous?.redFeatherCount ?? DEFAULT_RED_FEATHER_COUNT,
    };
  });
}

export function useOverrunAuction({
  eventDate,
}: UseOverrunAuctionParameters): UseOverrunAuctionResult {
  const [queue, setQueue] = useState<OverrunQueueItem[]>([]);
  const [auctionRows, setAuctionRows] = useState<OverrunAuctionRow[]>([]);
  const [preview, setPreview] = useState<OverrunPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const currentQueue = useMemo(
    () => queue.slice(0, OVERRUN_QUEUE_SIZE),
    [queue],
  );

  const waitingQueue = useMemo(
    () => queue.slice(OVERRUN_QUEUE_SIZE),
    [queue],
  );

  useEffect(() => {
    setAuctionRows((currentRows) =>
      buildAuctionRows(currentQueue, currentRows),
    );
  }, [currentQueue]);

  const loadOverrun =
    useCallback(async (): Promise<void> => {
      if (!eventDate) {
        setQueue([]);
        setAuctionRows([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage('');
        setSaveMessage('');
        setPreview(null);

        const [
          loadedQueue,
          savedAuction,
        ] = await Promise.all([
          getOverrunQueue(),
          getOverrunAuction(
            eventDate,
          ),
        ]);

        const normalizedQueue =
          normalizeQueue(
            Array.isArray(loadedQueue)
              ? loadedQueue
              : [],
          );

        const savedRows =
          Array.isArray(savedAuction)
            ? savedAuction.map(
                (record) => ({
                  queueOrder:
                    Number(
                      record.queueOrder,
                    ),
                  queueOwner:
                    String(
                      record.queueOwner ??
                        '',
                    ).trim(),
                  soldTo:
                    String(
                      record.soldTo ?? '',
                    ).trim(),
                  cardCount:
                    normalizeCount(
                      Number(
                        record.cardCount,
                      ),
                    ),
                  whiteFeatherCount:
                    normalizeCount(
                      Number(
                        record.whiteFeatherCount,
                      ),
                    ),
                  redFeatherCount:
                    normalizeCount(
                      Number(
                        record.redFeatherCount,
                      ),
                    ),
                }),
              )
            : [];

        setQueue(normalizedQueue);
        setAuctionRows(
          buildAuctionRows(
            normalizedQueue.slice(
              0,
              OVERRUN_QUEUE_SIZE,
            ),
            savedRows,
          ),
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'ไม่สามารถโหลดข้อมูล Overrun ได้',
        );

        setQueue([]);
        setAuctionRows([]);
      } finally {
        setIsLoading(false);
      }
    }, [eventDate]);

  useEffect(() => {
    void loadOverrun();
  }, [loadOverrun]);

  function updateQueue(nextQueue: OverrunQueueItem[]): void {
    setQueue(normalizeQueue(nextQueue));
    setPreview(null);
    setSaveMessage('');
  }

  function addMemberToQueue(memberName: string): void {
    const cleanMemberName = memberName.trim();

    if (!cleanMemberName) {
      return;
    }

    if (queue.some((item) => item.memberName === cleanMemberName)) {
      setErrorMessage('สมาชิกคนนี้อยู่ในคิวแล้ว');
      return;
    }

    setErrorMessage('');
    updateQueue([
      ...queue,
      {
        queueOrder: queue.length + 1,
        memberName: cleanMemberName,
      },
    ]);
  }

  function replaceQueue(memberNames: string[]): void {
    const usedNames = new Set<string>();

    const cleanMemberNames = memberNames
      .map((name) => name.trim())
      .filter((name) => {
        if (!name || usedNames.has(name)) {
          return false;
        }

        usedNames.add(name);
        return true;
      });

    setQueue(buildQueueItems(cleanMemberNames));
    setPreview(null);
    setErrorMessage('');
    setSaveMessage('');
  }

  function removeMemberFromQueue(queueIndex: number): void {
    updateQueue(queue.filter((_, index) => index !== queueIndex));
  }

  function moveMemberInQueue(
    sourceIndex: number,
    targetIndex: number,
  ): void {
    if (
      sourceIndex === targetIndex ||
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex >= queue.length ||
      targetIndex >= queue.length
    ) {
      return;
    }

    const nextQueue = [...queue];
    const [movedItem] = nextQueue.splice(sourceIndex, 1);

    if (!movedItem) {
      return;
    }

    nextQueue.splice(targetIndex, 0, movedItem);
    updateQueue(nextQueue);
  }

  async function saveCurrentQueue(): Promise<boolean> {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSaveMessage('');

      const message = await saveOverrunQueue(normalizeQueue(queue));

      await loadOverrun();
      setSaveMessage(message);

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'ไม่สามารถบันทึกคิว Overrun ได้',
      );

      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function updateAuctionRow(
    queueOrder: number,
    update: Partial<OverrunAuctionSaveItem>,
  ): void {
    setAuctionRows((currentRows) =>
      currentRows.map((row) =>
        row.queueOrder === queueOrder
          ? {
              ...row,
              ...update,
            }
          : row,
      ),
    );

    setPreview(null);
    setSaveMessage('');
  }

  function setSoldTo(queueOrder: number, soldTo: string): void {
    updateAuctionRow(queueOrder, {
      soldTo,
    });
  }

  function setCardCount(queueOrder: number, value: number): void {
    updateAuctionRow(queueOrder, {
      cardCount: normalizeCount(value),
    });
  }

  function setWhiteFeatherCount(
    queueOrder: number,
    value: number,
  ): void {
    updateAuctionRow(queueOrder, {
      whiteFeatherCount: normalizeCount(value),
    });
  }

  function setRedFeatherCount(
    queueOrder: number,
    value: number,
  ): void {
    updateAuctionRow(queueOrder, {
      redFeatherCount: normalizeCount(value),
    });
  }

  function setAllCounts(
    cardCount: number,
    whiteFeatherCount: number,
    redFeatherCount: number,
  ): void {
    const normalizedCardCount =
      normalizeCount(cardCount);

    const normalizedWhiteFeatherCount =
      normalizeCount(whiteFeatherCount);

    const normalizedRedFeatherCount =
      normalizeCount(redFeatherCount);

    setAuctionRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        cardCount: normalizedCardCount,
        whiteFeatherCount:
          normalizedWhiteFeatherCount,
        redFeatherCount:
          normalizedRedFeatherCount,
      })),
    );

    setPreview(null);
    setSaveMessage('');
  }

  async function saveAuction(): Promise<boolean> {
    if (!eventDate) {
      setErrorMessage('กรุณาเลือกวันที่');
      return false;
    }

    if (auctionRows.length === 0) {
      setErrorMessage(
        'ไม่มีข้อมูลประมูลให้บันทึก',
      );
      return false;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setSaveMessage('');

      const auction: OverrunAuctionSaveItem[] =
        auctionRows.map((row) => ({
          queueOrder: row.queueOrder,
          queueOwner:
            row.queueOwner.trim(),
          soldTo: row.soldTo.trim(),
          cardCount: row.cardCount,
          whiteFeatherCount:
            row.whiteFeatherCount,
          redFeatherCount:
            row.redFeatherCount,
        }));

      const message =
        await saveOverrunAuction(
          eventDate,
          auction,
        );

      setSaveMessage(message);

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'ไม่สามารถบันทึกข้อมูลประมูล Overrun ได้',
      );

      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function createPreview(
    result: OverrunResult,
    noItemMember = '',
  ): boolean {
    if (!eventDate) {
      setErrorMessage('กรุณาเลือกวันที่');
      return false;
    }

    if (currentQueue.length < OVERRUN_QUEUE_SIZE) {
      setErrorMessage(
        `คิวรอบปัจจุบันต้องมีครบ ${OVERRUN_QUEUE_SIZE} คนก่อนยืนยันผล`,
      );
      return false;
    }

    const queueBefore = queue.map((item) => item.memberName);
    let queueAfter: string[];

    if (result === 'win') {
      queueAfter = queueBefore.slice(OVERRUN_QUEUE_SIZE);
    } else {
      const cleanNoItemMember = noItemMember.trim();

      if (
        !cleanNoItemMember ||
        !currentQueue.some(
          (item) => item.memberName === cleanNoItemMember,
        )
      ) {
        setErrorMessage(
          `กรุณาเลือกคนที่ไม่ได้ของจาก ${OVERRUN_QUEUE_SIZE} คนในรอบนี้`,
        );
        return false;
      }

      queueAfter = [
        cleanNoItemMember,
        ...queueBefore.slice(OVERRUN_QUEUE_SIZE),
      ];
    }

    setErrorMessage('');
    setPreview({
      result,
      noItemMember:
        result === 'lose' ? noItemMember.trim() : '',
      queueBefore,
      queueAfter,
    });

    return true;
  }

  function clearPreview(): void {
    setPreview(null);
  }

  async function confirmPreview(): Promise<boolean> {
    if (!preview) {
      return false;
    }

    try {
      setIsConfirming(true);
      setErrorMessage('');
      setSaveMessage('');

      const payload: ConfirmOverrunResultPayload = {
        eventDate,
        result: preview.result,
        noItemMember: preview.noItemMember,
        queueBefore: preview.queueBefore,
        queueAfter: preview.queueAfter,
      };

      const auction: OverrunAuctionSaveItem[] =
        auctionRows
          .filter((row) => {
            if (preview.result !== 'lose') {
              return true;
            }

            return (
              row.queueOwner.trim() !==
              preview.noItemMember.trim()
            );
          })
          .map((row) => ({
            queueOrder: row.queueOrder,
            queueOwner:
              row.queueOwner.trim(),
            soldTo: row.soldTo.trim(),
            cardCount: row.cardCount,
            whiteFeatherCount:
              row.whiteFeatherCount,
            redFeatherCount:
              row.redFeatherCount,
          }));

      await saveOverrunAuction(
        eventDate,
        auction,
      );

      const message =
        await confirmOverrunResult(
          payload,
        );

      setQueue(buildQueueItems(preview.queueAfter));
      setPreview(null);

      await loadOverrun();
      setSaveMessage(message);

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'ไม่สามารถยืนยันผล Overrun ได้',
      );

      return false;
    } finally {
      setIsConfirming(false);
    }
  }

  return {
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
    reloadQueue: loadOverrun,
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
  };
}
