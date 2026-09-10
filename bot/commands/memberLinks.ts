import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Member } from '../../src/types/member.js';
import {
  createDiscordMemberLink,
  getDiscordMemberLinksCached,
  removeDiscordMemberLink,
} from '../services/discordMemberLinks.js';

const ADMIN_PERMISSIONS = PermissionFlagsBits.ManageGuild;
const MAX_MESSAGE_LENGTH = 1_900;

function safeAutocompleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500);
}

export async function runLinkMemberAutocomplete(
  interaction: AutocompleteInteraction,
  members: Member[],
): Promise<void> {
  try {
    const focused = interaction.options.getFocused(true);
    const query = String(focused.value).trim().toLocaleLowerCase();
    console.log(`[Link Member Autocomplete] focused=${JSON.stringify(String(focused.value))}`);
    console.log(`[Link Member Autocomplete] cache size=${members.length}`);

    if (focused.name !== 'member') {
      console.warn(
        `[Link Member Autocomplete] unexpected focused option=${JSON.stringify(focused.name)}`,
      );
      await interaction.respond([]);
      return;
    }

    const matches = members
      .filter((member) => {
        const memberId = String(member.memberId);
        const ign = String(member.ign);
        return memberId.toLocaleLowerCase().includes(query)
          || ign.toLocaleLowerCase().includes(query);
      })
      .slice(0, 25)
      .map((member) => {
        const memberId = String(member.memberId);
        return {
          name: `${memberId} | ${String(member.ign)}`.slice(0, 100),
          value: memberId,
        };
      });
    console.log(`[Link Member Autocomplete] matches=${matches.length}`);
    await interaction.respond(matches);
  } catch (error) {
    console.warn(`[Link Member Autocomplete] failed: ${safeAutocompleteError(error)}`);
    if (!interaction.responded) {
      await interaction.respond([]).catch((respondError: unknown) => {
        console.warn(
          `[Link Member Autocomplete] empty response failed: ${safeAutocompleteError(respondError)}`,
        );
      });
    }
  }
}

export const linkMemberCommand = new SlashCommandBuilder()
  .setName('link-member')
  .setDescription('เชื่อม Discord user กับสมาชิก EZMOO')
  .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
  .setDMPermission(false)
  .addUserOption((option) =>
    option.setName('discord').setDescription('Discord user').setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('member')
      .setDescription('ค้นหาด้วย Member ID หรือ IGN')
      .setRequired(true)
      .setAutocomplete(true),
  );

export const unlinkMemberCommand = new SlashCommandBuilder()
  .setName('unlink-member')
  .setDescription('ยกเลิกการเชื่อม Discord user กับสมาชิก EZMOO')
  .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
  .setDMPermission(false)
  .addUserOption((option) =>
    option.setName('discord').setDescription('Discord user').setRequired(true),
  );

export const linksCommand = new SlashCommandBuilder()
  .setName('links')
  .setDescription('ดูสถานะ Discord member links')
  .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
  .setDMPermission(false);

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild),
  );
}

async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (interaction.inGuild() && isAdmin(interaction)) return true;
  await interaction.reply({
    content: 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลที่มีสิทธิ์ Manage Server',
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

function splitLines(header: string, lines: string[]): string[] {
  const chunks: string[] = [];
  let current = header;
  for (const line of lines) {
    if (`${current}\n${line}`.length > MAX_MESSAGE_LENGTH) {
      chunks.push(current);
      current = line;
    } else {
      current += `\n${line}`;
    }
  }
  chunks.push(current);
  return chunks;
}

async function sendChunks(
  interaction: ChatInputCommandInteraction,
  chunks: string[],
): Promise<void> {
  await interaction.editReply(chunks[0]);
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
  }
}

export async function runLinkMemberCommand(
  interaction: ChatInputCommandInteraction,
  members: Member[],
): Promise<void> {
  if (!(await requireAdmin(interaction))) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = interaction.options.getUser('discord', true);
  const memberId = interaction.options.getString('member', true);
  const member = members.find((item) => item.memberId === memberId);
  if (!member) {
    await interaction.editReply('ไม่พบสมาชิกนี้ในระบบ กรุณาเลือกใหม่จากรายการ');
    return;
  }
  await createDiscordMemberLink({
    discordUserId: user.id,
    memberId: member.memberId,
    linkedByDiscordId: interaction.user.id,
  });
  await interaction.editReply(`🔗 **Linked Member**\n\n<@${user.id}>\n${member.memberId} | ${member.ign}`);
}

export async function runUnlinkMemberCommand(
  interaction: ChatInputCommandInteraction,
  members: Member[],
): Promise<void> {
  if (!(await requireAdmin(interaction))) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = interaction.options.getUser('discord', true);
  const links = await getDiscordMemberLinksCached();
  const existing = links.find((link) => link.discordUserId === user.id);
  if (!existing) {
    await interaction.editReply('Discord user นี้ยังไม่ได้ link กับสมาชิก');
    return;
  }
  const removed = await removeDiscordMemberLink(user.id);
  const member = members.find((item) => item.memberId === removed.memberId);
  const label = member ? `${member.memberId} | ${member.ign}` : removed.memberId;
  await interaction.editReply(`🔓 **Unlinked**\n\n<@${user.id}>\n${label}`);
}

export async function runLinksCommand(
  interaction: ChatInputCommandInteraction,
  members: Member[],
): Promise<void> {
  if (!(await requireAdmin(interaction))) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const links = await getDiscordMemberLinksCached();
  const memberIds = new Set(members.map((member) => member.memberId));
  const linkedMemberIds = new Set(
    links.filter((link) => memberIds.has(link.memberId)).map((link) => link.memberId),
  );
  const unlinked = members.filter((member) => !linkedMemberIds.has(member.memberId));
  const header = `🔗 **Discord Member Links**\n\nLinked: ${linkedMemberIds.size} / ${members.length}\nUnlinked: ${unlinked.length}\n\n**Unlinked Members:**`;
  const lines = unlinked.length
    ? unlinked.map((member) => `${member.memberId} | ${member.ign}`)
    : ['ไม่มี'];
  await sendChunks(interaction, splitLines(header, lines));
}
