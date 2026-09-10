import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Member } from '../../src/types/member.js';
import { getDiscordMemberLinksCached } from '../services/discordMemberLinks.js';

const MAX_MESSAGE_LENGTH = 1_900;

export const voiceCheckCommand = new SlashCommandBuilder()
  .setName('voice-check')
  .setDescription('ตรวจสมาชิก EZMOO ที่อยู่ใน Voice ตอนนี้')
  .setDMPermission(false);

// V1 includes every voice channel. Add category/channel filtering here later.
function includeVoiceState(): boolean {
  return true;
}

function splitSections(
  sections: Array<{ header: string; lines: string[]; showNone?: boolean }>,
): string[] {
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

export async function runVoiceCheckCommand(
  interaction: ChatInputCommandInteraction,
  members: Member[],
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'คำสั่งนี้ใช้ได้เฉพาะใน Discord server',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const links = await getDiscordMemberLinksCached();
  const linkByDiscordId = new Map(links.map((link) => [link.discordUserId, link]));
  const memberById = new Map(members.map((member) => [member.memberId, member]));
  const onlineMemberIds = new Set<string>();
  const unlinkedDiscordNames: string[] = [];

  // Copy the cache now so the command represents one best-effort snapshot.
  const voiceStates = [...interaction.guild.voiceStates.cache.values()];
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
    timeZone: 'Asia/Bangkok',
  }).format(new Date());
  const sections = [
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
  const chunks = splitSections(sections);
  await interaction.editReply(chunks[0]);
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
  }
}
