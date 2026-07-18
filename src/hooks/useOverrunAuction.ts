import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  confirmOverrunResult,
  getOverrunQueue,
  saveOverrunQueue,
} from '../services/googleApi';

import type {
  ConfirmOverrunResultPayload,
  OverrunPreview,
  OverrunQueueItem,
  OverrunResult,
} from '../types/overrun';

const CURRENT_QUEUE_SIZE = 13;

interface UseOverrunAuctionParameters {
  eventDate: string;
}

interface UseOverrunAuctionResult {
  queue: OverrunQueueItem[];
  currentQueue: OverrunQueueItem[];
  waitingQueue: OverrunQueueItem[];

  preview: OverrunPreview | null;

  isLoading: boolean;
  isSaving: boolean;
  isConfirming: boolean;

  errorMessage: string;
  saveMessage: string;

  reloadQueue: () => Promise<void>;

  addMemberToQueue: (
    memberName: string,
  ) => void;

  removeMemberFromQueue: (
    queueIndex: number,
  ) => void;

  moveMemberInQueue: (
    sourceIndex: number,
    targetIndex: number,
  ) => void;

  saveCurrentQueue: () => Promise<boolean>;

  createPreview: (
    result: OverrunResult,
    noItemMember?: string,
  ) => boolean;

  clearPreview: () => void;

  confirmPreview: () => Promise<boolean>;
}

function normalizeQueue(
  queue: OverrunQueueItem[],
): OverrunQueueItem[] {
  return queue
    .map((item) => ({
      queueOrder:
        Number(item.queueOrder),
      memberName:
        String(
          item.memberName ?? '',
        ).trim(),
    }))
    .filter(
      (item) =>
        item.memberName !== '',
    )
    .sort(
      (firstItem, secondItem) =>
        firstItem.queueOrder -
        secondItem.queueOrder,
    )
    .map((item, index) => ({
      ...item,
      queueOrder: index + 1,
    }));
}

function buildQueueItems(
  memberNames: string[],
): OverrunQueueItem[] {
  return memberNames.map(
    (memberName, index) => ({
      queueOrder: index + 1,
      memberName,
    }),
  );
}

export function useOverrunAuction({
  eventDate,
}: UseOverrunAuctionParameters): UseOverrunAuctionResult {
  const [
    queue,
    setQueue,
  ] = useState<
    OverrunQueueItem[]
  >([]);

  const [
    preview,
    setPreview,
  ] = useState<
    OverrunPreview | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isConfirming,
    setIsConfirming,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    saveMessage,
    setSaveMessage,
  ] = useState('');

  const currentQueue =
    useMemo(
      () =>
        queue.slice(
          0,
          CURRENT_QUEUE_SIZE,
        ),
      [queue],
    );

  const waitingQueue =
    useMemo(
      () =>
        queue.slice(
          CURRENT_QUEUE_SIZE,
        ),
      [queue],
    );

  const loadQueue =
    useCallback(
      async (): Promise<void> => {
        try {
          setIsLoading(true);
          setErrorMessage('');
          setSaveMessage('');
          setPreview(null);

          const loadedQueue =
            await getOverrunQueue();

          setQueue(
            normalizeQueue(
              Array.isArray(
                loadedQueue,
              )
                ? loadedQueue
                : [],
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'ไม่สามารถโหลดคิว Overrun ได้';

          setErrorMessage(message);
          setQueue([]);
        } finally {
          setIsLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  function updateQueue(
    nextQueue: OverrunQueueItem[],
  ): void {
    setQueue(
      normalizeQueue(nextQueue),
    );

    setPreview(null);
    setSaveMessage('');
  }

  function addMemberToQueue(
    memberName: string,
  ): void {
    const cleanMemberName =
      memberName.trim();

    if (!cleanMemberName) {
      return;
    }

    const alreadyExists =
      queue.some(
        (item) =>
          item.memberName ===
          cleanMemberName,
      );

    if (alreadyExists) {
      setErrorMessage(
        'สมาชิกคนนี้อยู่ในคิวแล้ว',
      );

      return;
    }

    setErrorMessage('');

    updateQueue([
      ...queue,
      {
        queueOrder:
          queue.length + 1,
        memberName:
          cleanMemberName,
      },
    ]);
  }

  function removeMemberFromQueue(
    queueIndex: number,
  ): void {
    updateQueue(
      queue.filter(
        (_, index) =>
          index !== queueIndex,
      ),
    );
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

    const [movedItem] =
      nextQueue.splice(
        sourceIndex,
        1,
      );

    if (!movedItem) {
      return;
    }

    nextQueue.splice(
      targetIndex,
      0,
      movedItem,
    );

    updateQueue(nextQueue);
  }

  async function saveCurrentQueue(): Promise<boolean> {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSaveMessage('');

      const message =
        await saveOverrunQueue(
          normalizeQueue(queue),
        );

      setSaveMessage(message);

      await loadQueue();

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถบันทึกคิว Overrun ได้';

      setErrorMessage(message);

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
      setErrorMessage(
        'กรุณาเลือกวันที่',
      );

      return false;
    }

    if (
      currentQueue.length <
      CURRENT_QUEUE_SIZE
    ) {
      setErrorMessage(
        'คิวรอบปัจจุบันต้องมีครบ 13 คนก่อนยืนยันผล',
      );

      return false;
    }

    const queueBefore =
      queue.map(
        (item) =>
          item.memberName,
      );

    let queueAfter: string[];

    if (result === 'win') {
      queueAfter =
        queueBefore.slice(
          CURRENT_QUEUE_SIZE,
        );
    } else {
      const cleanNoItemMember =
        noItemMember.trim();

      const noItemMemberExists =
        currentQueue.some(
          (item) =>
            item.memberName ===
            cleanNoItemMember,
        );

      if (
        !cleanNoItemMember ||
        !noItemMemberExists
      ) {
        setErrorMessage(
          'กรุณาเลือกคนที่ไม่ได้ของจาก 13 คนในรอบนี้',
        );

        return false;
      }

      queueAfter = [
        cleanNoItemMember,
        ...queueBefore.slice(
          CURRENT_QUEUE_SIZE,
        ),
      ];
    }

    setErrorMessage('');

    setPreview({
      result,
      noItemMember:
        result === 'lose'
          ? noItemMember.trim()
          : '',
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

      const payload:
        ConfirmOverrunResultPayload = {
          eventDate,
          result:
            preview.result,
          noItemMember:
            preview.noItemMember,
          queueBefore:
            preview.queueBefore,
          queueAfter:
            preview.queueAfter,
        };

      const message =
        await confirmOverrunResult(
          payload,
        );

      setQueue(
        buildQueueItems(
          preview.queueAfter,
        ),
      );

      setPreview(null);
      setSaveMessage(message);

      await loadQueue();

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถยืนยันผล Overrun ได้';

      setErrorMessage(message);

      return false;
    } finally {
      setIsConfirming(false);
    }
  }

  return {
    queue,
    currentQueue,
    waitingQueue,

    preview,

    isLoading,
    isSaving,
    isConfirming,

    errorMessage,
    saveMessage,

    reloadQueue:
      loadQueue,

    addMemberToQueue,
    removeMemberFromQueue,
    moveMemberInQueue,

    saveCurrentQueue,

    createPreview,
    clearPreview,
    confirmPreview,
  };
}