import type { Party } from '../types/partyTypes';

export interface PartyHistory {
  past: Party[][];
  present: Party[];
  future: Party[][];
}

export function createPartyHistory(parties: Party[]): PartyHistory {
  return { past: [], present: parties.map(party => ({
    ...party,
    slots: Array.from({ length: 5 }, (_, i) => party.slots[i] ?? ''),
  })), future: [] };
}

export function editPartyHistory(history: PartyHistory, parties: Party[]): PartyHistory {
  if (JSON.stringify(history.present) === JSON.stringify(parties)) return history;
  return { past: [...history.past, history.present], present: parties, future: [] };
}

export function undoPartyHistory(history: PartyHistory): PartyHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redoPartyHistory(history: PartyHistory): PartyHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0], future: history.future.slice(1),
  };
}
