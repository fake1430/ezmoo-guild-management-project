import { useCallback, useEffect, useState } from 'react';
import { getParties } from '../services/googleApi';
import type { PartyMode } from '../types/member';
import type { Party } from '../types/partyTypes';

interface UsePartiesResult {
  parties: Party[];
  isLoading: boolean;
  errorMessage: string;
  reloadParties: () => Promise<void>;
}

export function useParties(
  mode: PartyMode,
  enabled = true,
): UsePartiesResult {
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadParties = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage('');

  const sheetName =
    mode === 'guildLeague'
      ? 'GuildLeague'
      : mode === 'overrun'
        ? 'Overrun'
        : 'AuctionParty';

      const data = await getParties(sheetName, forceRefresh);
      setParties(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถโหลดข้อมูลปาร์ตี้ได้';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, mode]);

  useEffect(() => {
    // Loading remote data is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadParties();
  }, [loadParties]);

  return {
    parties,
    isLoading,
    errorMessage,
    reloadParties: () => loadParties(true),
  };
}
