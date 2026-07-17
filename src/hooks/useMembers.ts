import { useEffect, useState } from 'react';
import { getMembers } from '../services/googleApi';
import type { Member } from '../types/member';

interface UseMembersResult {
  members: Member[];
  isLoading: boolean;
  errorMessage: string;
  reloadMembers: () => Promise<void>;
}

export function useMembers(): UseMembersResult {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadMembers(): Promise<void> {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const data = await getMembers();
      setMembers(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  return {
    members,
    isLoading,
    errorMessage,
    reloadMembers: loadMembers,
  };
}