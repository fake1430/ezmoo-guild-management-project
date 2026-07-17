export type PartyMode = 'guildLeague' | 'overrun';

export interface Member {
  memberId: string;
  ign: string;
  guildLeagueClass: string;
  overrunClass: string;
}