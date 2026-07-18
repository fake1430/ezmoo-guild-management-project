export type PartyMode =
  | 'guildLeague'
  | 'overrun'
  | 'auctionParty';

export interface Member {
  memberId: string;
  ign: string;
  guildLeagueClass: string;
  overrunClass: string;
}