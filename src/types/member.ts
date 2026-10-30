export type PartyMode =
  | 'guildLeague'
  | 'overrun'
  | 'stellarClash'
  | 'valeOfClash'
  | 'vigridAvenge'
  | 'auctionParty';

export interface Member {
  memberId: string;
  ign: string;
  guildLeagueClass: string;
  overrunClass: string;
  stellarClashClass?: string;
  valeOfClashClass?: string;
  vigridAvengeClass?: string;
}
