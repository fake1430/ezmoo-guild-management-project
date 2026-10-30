import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { PARTY_MODES } from '../constants/partyModes';
import { getParties } from '../services/googleApi';
import type { PartyMode } from '../types/member';
import type { Party } from '../types/partyTypes';
import {
  createPartyHistory, editPartyHistory, undoPartyHistory, redoPartyHistory,
  type PartyHistory,
} from '../models/partyHistory';

interface ModeDraft {
  history: PartyHistory;
  isLoading: boolean;
  errorMessage: string;
}

// Drafts belong to their mode, including requests which finish after a mode switch.
export function usePartyBuilder(mode: PartyMode, enabled: boolean) {
  const [drafts, setDrafts] = useState<Partial<Record<PartyMode, ModeDraft>>>({});
  const requested = useRef(new Set<PartyMode>());
  const generations = useRef<Partial<Record<PartyMode, number>>>({});

  const load = useCallback(async (target: PartyMode, forceRefresh = false) => {
    requested.current.add(target);
    const generation = (generations.current[target] ?? 0) + 1;
    generations.current[target] = generation;
    setDrafts(current => ({ ...current, [target]: {
      history: current[target]?.history ?? createPartyHistory([]),
      isLoading: true, errorMessage: '',
    } }));
    try {
      const parties = await getParties(PARTY_MODES[target].sheet, forceRefresh);
      if (generations.current[target] !== generation) return;
      setDrafts(current => ({ ...current, [target]: {
        // A manual load remains undoable, including an empty remote save.
        history: forceRefresh && current[target]
          ? editPartyHistory(current[target].history, createPartyHistory(parties).present)
          : createPartyHistory(parties),
        isLoading: false, errorMessage: '',
      } }));
    } catch (error) {
      if (generations.current[target] !== generation) return;
      setDrafts(current => ({ ...current, [target]: {
        history: current[target]?.history ?? createPartyHistory([]),
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลปาร์ตี้ได้',
      } }));
    }
  }, []);

  useEffect(() => {
    if (enabled && !requested.current.has(mode)) void load(mode);
  }, [enabled, mode, load]);

  function updateHistory(update: (history: PartyHistory) => PartyHistory) {
    setDrafts(current => {
      const draft = current[mode];
      if (!draft || draft.isLoading || draft.errorMessage) return current;
      return { ...current, [mode]: { ...draft, history: update(draft.history) } };
    });
  }

  const draft = drafts[mode];
  return {
    parties: draft?.history.present ?? [],
    isLoading: enabled && (!draft || draft.isLoading),
    errorMessage: draft?.errorMessage ?? '',
    setParties: (action: SetStateAction<Party[]>) => updateHistory(history =>
      editPartyHistory(history, typeof action === 'function' ? action(history.present) : action)),
    reloadParties: () => load(mode, true),
    undo: () => updateHistory(undoPartyHistory),
    redo: () => updateHistory(redoPartyHistory),
    canUndo: Boolean(draft?.history.past.length) && !draft?.isLoading && !draft?.errorMessage,
    canRedo: Boolean(draft?.history.future.length) && !draft?.isLoading && !draft?.errorMessage,
  };
}
