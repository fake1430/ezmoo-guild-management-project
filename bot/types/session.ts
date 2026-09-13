import type {
  CharacterStatKey,
  CharacterStats,
} from '../../shared/characterStats.js';

export interface PendingStatSubmission {
  submissionId: string;
  memberId: string;
  ign: string;
  submittedByDiscordId: string;
  submittedByDiscordName: string;
  stats: CharacterStats;
  editedFields: Set<CharacterStatKey>;
  createdAt: number;
}
