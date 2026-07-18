export type OverrunResult =
  | 'win'
  | 'lose';

export interface OverrunQueueItem {
  queueOrder: number;
  memberName: string;
}

export interface OverrunQueueData {
  queue: OverrunQueueItem[];
}

export interface OverrunAuctionRecord {
  auctionId: string;
  eventDate: string;
  eventType: 'Overrun';
  queueOrder: number;
  queueOwner: string;
  soldTo: string;
  cardCount: number;
  whiteFeatherCount: number;
  redFeatherCount: number;
  updatedAt: string;
}

export interface OverrunAuctionSaveItem {
  queueOrder: number;
  queueOwner: string;
  soldTo: string;
  cardCount: number;
  whiteFeatherCount: number;
  redFeatherCount: number;
}

export interface OverrunAuctionRow
  extends OverrunAuctionSaveItem {}

export interface OverrunPreview {
  result: OverrunResult;
  noItemMember: string;
  queueBefore: string[];
  queueAfter: string[];
}

export interface OverrunHistoryRecord {
  eventDate: string;
  result: OverrunResult;
  noItemMember: string;
  queueBefore: string[];
  queueAfter: string[];
  createdAt?: string;
}

export interface SaveOverrunQueueItem {
  queueOrder: number;
  memberName: string;
}

export interface ConfirmOverrunResultPayload {
  eventDate: string;
  result: OverrunResult;
  noItemMember: string;
  queueBefore: string[];
  queueAfter: string[];
}