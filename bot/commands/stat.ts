import {
  Attachment,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getMembers } from '../services/guildApi.js';
import { extractCharacterStats } from '../services/vision.js';
import type { PendingStatSubmission } from '../types/session.js';
import { buildStatPreview } from './statPreview.js';

export const statCommand = new SlashCommandBuilder()
  .setName('stat')
  .setDescription('ส่งรูป Character Stats ของสมาชิก')
  .addStringOption((option) =>
    option
      .setName('member')
      .setDescription('เลือก IGN จากระบบสมาชิก')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addAttachmentOption((option) =>
    option.setName('image1').setDescription('รูป stat รูปที่ 1').setRequired(true),
  )
  .addAttachmentOption((option) =>
    option.setName('image2').setDescription('รูป stat รูปที่ 2'),
  )
  .addAttachmentOption((option) =>
    option.setName('image3').setDescription('รูป stat รูปที่ 3'),
  )
  .addAttachmentOption((option) =>
    option.setName('image4').setDescription('รูป stat รูปที่ 4'),
  )
  .addAttachmentOption((option) =>
    option.setName('image5').setDescription('รูป stat รูปที่ 5'),
  );

export async function runStatCommand(
  interaction: ChatInputCommandInteraction,
  sessions: Map<string, PendingStatSubmission>,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const memberId = interaction.options.getString('member', true);
  const members = await getMembers();
  const member = members.find((item) => item.memberId === memberId);
  if (!member) {
    await interaction.editReply('ไม่พบสมาชิกนี้ในระบบ กรุณาเลือกใหม่จากรายการ IGN');
    return;
  }

  const attachments = Array.from({ length: 5 }, (_, index) =>
    interaction.options.getAttachment(`image${index + 1}`),
  ).filter((item): item is Attachment => Boolean(item));

  const stats = await extractCharacterStats(
    attachments.map((item) => ({
      url: item.url,
      proxyUrl: item.proxyURL,
    })),
  );
  const sessionId = crypto.randomUUID();
  const pending: PendingStatSubmission = {
    submissionId: sessionId,
    memberId: member.memberId,
    ign: member.ign,
    submittedByDiscordId: interaction.user.id,
    submittedByDiscordName: interaction.user.globalName ?? interaction.user.username,
    stats,
    editedFields: new Set(),
    createdAt: Date.now(),
  };
  sessions.set(sessionId, pending);
  await interaction.editReply(buildStatPreview(sessionId, pending));
}
