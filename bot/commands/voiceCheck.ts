import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Member } from '../../src/types/member.js';
import { getDiscordMemberLinksCached } from '../services/discordMemberLinks.js';
import { buildVoiceCheckReport } from '../services/voiceCheck.js';

export const voiceCheckCommand = new SlashCommandBuilder()
  .setName('voice-check')
  .setDescription('ตรวจสมาชิก EZMOO ที่อยู่ใน Voice ตอนนี้')
  .setDMPermission(false);

export async function runVoiceCheckCommand(
  interaction: ChatInputCommandInteraction,
  loadMembers: () => Promise<Member[]>,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inCachedGuild()) {
    await interaction.editReply('คำสั่งนี้ใช้ได้เฉพาะใน Discord server');
    return;
  }
  const [members, links] = await Promise.all([
    loadMembers(),
    getDiscordMemberLinksCached(),
  ]);
  const report = buildVoiceCheckReport(interaction.guild, members, links);
  await interaction.editReply(report.chunks[0]);
  for (const chunk of report.chunks.slice(1)) {
    await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
  }
}
