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