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
): UsePartiesResult {
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadParties = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setErrorMessage('');

  const sheetName =
    mode === 'guildLeague'
      ? 'GuildLeague'
      : mode === 'overrun'
        ? 'Overrun'
        : 'AuctionParty';

      const data = await getParties(sheetName);
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
  }, [mode]);

  useEffect(() => {
    void loadParties();
  }, [loadParties]);

  return {
    parties,
    isLoading,
    errorMessage,
    reloadParties: loadParties,
  };
}