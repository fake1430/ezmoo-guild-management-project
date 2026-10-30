import type { Member, PartyMode } from '../types/member';

export const PARTY_MODES = {
  guildLeague: { label: 'Guild League', sheet: 'GuildLeague', classField: 'guildLeagueClass' },
  overrun: { label: 'Overrun', sheet: 'Overrun', classField: 'overrunClass' },
  stellarClash: { label: 'Stellar Clash', sheet: 'StellarClash', classField: 'stellarClashClass' },
  valeOfClash: { label: 'Vale of Clash', sheet: 'ValeOfClash', classField: 'valeOfClashClass' },
  vigridAvenge: { label: 'Vigrid Avenge', sheet: 'VigridAvenge', classField: 'vigridAvengeClass' },
  auctionParty: { label: 'Auction Party', sheet: 'AuctionParty', classField: null },
} as const satisfies Record<PartyMode, { label: string; sheet: string; classField: keyof Member | null }>;

export type PartySheetName = (typeof PARTY_MODES)[PartyMode]['sheet'];

export function memberClassForMode(member: Member, mode: PartyMode): string {
  const field = PARTY_MODES[mode].classField;
  return field ? (member[field] ?? '').trim() : '';
}
