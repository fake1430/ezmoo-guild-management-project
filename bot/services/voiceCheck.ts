import type { Guild } from 'discord.js';
import type { Member } from '../../src/types/member.js';
import type { DiscordMemberLink } from '../types/discordMemberLink.js';

const MAX_MESSAGE_LENGTH = 1_900;
const VOICE_CHECK_TIME_ZONE = 'Asia/Bangkok';

interface ReportSection {
  header: string;
  lines: string[];
  showNone?: boolean;
}

export interface VoiceCheckReport {
  chunks: string[];
  onlineCount: number;
  memberCount: number;
  unlinkedDiscordCount: number;
}

// V1 includes every voice channel. Add category/channel filtering here later.
function includeVoiceState(): boolean {
  return true;
}

export function splitVoiceCheckSections(sections: ReportSection[]): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const section of sections) {
    const lines = section.lines.length
      ? section.lines
      : section.showNone === false ? [] : ['ไม่มี'];
    for (const line of [section.header, ...lines]) {
      const candidate = current ? `${current}\n${line}` : line;
      if (candidate.length > MAX_MESSAGE_LENGTH) {
        chunks.push(current);
        current = line;
      } else {
        current = candidate;
      }
    }
    current += '\n';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function buildVoiceCheckReport(
  guild: Guild,
  members: Member[],
  links: DiscordMemberLink[],
  now = new Date(),
): VoiceCheckReport {
  const linkByDiscordId = new Map(links.map((link) => [link.discordUserId, link]));
  const memberById = new Map(members.map((member) => [member.memberId, member]));
  const onlineMemberIds = new Set<string>();
  const unlinkedDiscordNames: string[] = [];

  // Copy the cache now so manual and automatic checks use one best-effort snapshot.
  const voiceStates = [...guild.voiceStates.cache.values()];
  for (const voiceState of voiceStates) {
    if (!voiceState.channelId || !includeVoiceState()) continue;
    const guildMember = voiceState.member;
    if (!guildMember || guildMember.user.bot) continue;
    const link = linkByDiscordId.get(guildMember.id);
    if (!link) {
      unlinkedDiscordNames.push(guildMember.displayName);
      continue;
    }
    if (!memberById.has(link.memberId)) {
      console.warn(`[Voice check] Linked member no longer exists: memberId=${link.memberId}`);
      continue;
    }
    onlineMemberIds.add(link.memberId);
  }

  const online = members.filter((member) => onlineMemberIds.has(member.memberId));
  const offline = members.filter((member) => !onlineMemberIds.has(member.memberId));
  const time = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VOICE_CHECK_TIME_ZONE,
  }).format(now);
  const sections: ReportSection[] = [
    {
      header: `🎧 **Voice Check — ${time}**\nVoice: ${online.length} / ${members.length}`,
      lines: [],
      showNone: false,
    },
    {
      header: `✅ **คนออน Voice (${online.length})**`,
      lines: online.map((member) => `${member.memberId} | ${member.ign}`),
    },
    {
      header: `❌ **คนไม่ออน Voice (${offline.length})**`,
      lines: offline.map((member) => `${member.memberId} | ${member.ign}`),
    },
    {
      header: `⚠️ **อยู่ Voice แต่ยังไม่ได้ Link (${unlinkedDiscordNames.length})**`,
      lines: unlinkedDiscordNames,
    },
  ];

  return {
    chunks: splitVoiceCheckSections(sections),
    onlineCount: online.length,
    memberCount: members.length,
    unlinkedDiscordCount: unlinkedDiscordNames.length,
  };
}
