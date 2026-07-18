export type AuctionEventType =
  | 'GuildLeague'
  | 'Overrun';

export interface GuildLeagueAuctionRecord {
  auctionId: string;

  eventDate: string;

  eventType: AuctionEventType;

  partyNo: number;

  queueOwner: string;

  soldTo: string;

  cardCount: number;

  whiteFeatherCount: number;

  redFeatherCount: number;

  updatedAt: string;
}

export interface GuildLeagueAuctionSaveItem {
  partyNo: number;

  queueOwner: string;

  soldTo: string;

  cardCount: number;

  whiteFeatherCount: number;

  redFeatherCount: number;
}
export interface GuildLeagueAuctionRow
  extends GuildLeagueAuctionSaveItem {
  partyMembers: string[];
}