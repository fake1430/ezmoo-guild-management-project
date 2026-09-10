import {
  ActionRowBuilder,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { runStatCommand } from './commands/stat.js';
import {
  runLinkMemberAutocomplete,
  runLinkMemberCommand,
  runLinksCommand,
  runUnlinkMemberCommand,
} from './commands/memberLinks.js';
import { runVoiceCheckCommand } from './commands/voiceCheck.js';
import {
  buildStatPreview,
  formatModalDefaultValue,
  getStatDisplayItem,
  parseEditedStatValue,
} from './commands/statPreview.js';
import { getMembers, saveStatSubmission } from './services/guildApi.js';
import { DEFAULT_GEMINI_MODEL } from './services/vision.js';
import type { PendingStatSubmission } from './types/session.js';
import type { Member } from '../src/types/member.js';
import { refreshDiscordMemberLinks } from './services/discordMemberLinks.js';
import {
  startAutoVoiceCheck,
} from './services/autoVoiceCheck.js';

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'DISCORD_TOKEN',
  'GEMINI_API_KEY',
  'GOOGLE_API_URL',
] as const;
const missingEnvironmentVariables = REQUIRED_ENVIRONMENT_VARIABLES.filter(
  (name) => !process.env[name]?.trim(),
);

console.log('Discord bot starting...');
if (missingEnvironmentVariables.length > 0) {
  missingEnvironmentVariables.forEach((name) => {
    console.error(`Missing required environment variable: ${name}`);
  });
  process.exit(1);
}

console.log('Google API URL: configured');
console.log('Gemini key: configured');
console.log(
  `Gemini model: ${process.env.GEMINI_VISION_MODEL || DEFAULT_GEMINI_MODEL}`,
);

const token = process.env.DISCORD_TOKEN as string;
const voiceCheckChannelId = process.env.VOICE_CHECK_CHANNEL_ID?.trim();
const runVoiceCheckOnReady = process.env.VOICE_CHECK_RUN_ON_READY === 'true';

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object' && 'code' in error) {
    return `code=${String(error.code)}`;
  }
  const message = String(error);
  return message.trim() ? message : 'Unknown error';
}

process.on('unhandledRejection', (error) => {
  console.error(`[Fatal] Unhandled rejection: ${safeErrorMessage(error)}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(`[Fatal] Uncaught exception: ${safeErrorMessage(error)}`);
  process.exit(1);
});

const sessions = new Map<string, PendingStatSubmission>();
const SESSION_TTL_MS = 15 * 60 * 1000;
const MEMBER_CACHE_TTL_MS = 5 * 60 * 1000;
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
let memberCache: Member[] = [];
let memberCacheUpdatedAt = 0;
let memberRefreshPromise: Promise<Member[]> | null = null;

function refreshMemberCache(): Promise<Member[]> {
  if (memberRefreshPromise) return memberRefreshPromise;
  memberRefreshPromise = getMembers()
    .then((members) => {
      memberCache = members;
      memberCacheUpdatedAt = Date.now();
      return members;
    })
    .finally(() => {
      memberRefreshPromise = null;
    });
  return memberRefreshPromise;
}

function getMemberCacheSnapshot(): Member[] {
  if (Date.now() - memberCacheUpdatedAt >= MEMBER_CACHE_TTL_MS) {
    void refreshMemberCache().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Member cache] Refresh failed: ${message}`);
    });
  }
  return memberCache;
}

function discordErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : undefined;
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  const memberCacheReady = refreshMemberCache()
    .then((members) => console.log(`[Member cache] Preloaded ${members.length} members`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Member cache] Preload failed: ${message}`);
    });
  const discordLinkCacheReady = refreshDiscordMemberLinks()
    .then((links) => console.log(`[Discord member links] Preloaded ${links.length} links`))
    .catch((error: unknown) => {
      console.warn(`[Discord member links] Preload failed: ${safeErrorMessage(error)}`);
    });
  void startAutoVoiceCheck(readyClient, {
    channelId: voiceCheckChannelId,
    runOnReady: runVoiceCheckOnReady,
    cachesReady: Promise.all([memberCacheReady, discordLinkCacheReady]),
    loadMembers: refreshMemberCache,
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === 'stat') {
      const query = interaction.options.getFocused().toLocaleLowerCase();
      const members = getMemberCacheSnapshot();
      await interaction.respond(
        members
          .filter((member) => member.ign.toLocaleLowerCase().includes(query))
          .slice(0, 25)
          .map((member) => ({ name: member.ign, value: member.memberId })),
      );
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === 'link-member') {
      await runLinkMemberAutocomplete(interaction, getMemberCacheSnapshot());
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'stat') {
      await runStatCommand(interaction, sessions);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'link-member') {
      await runLinkMemberCommand(interaction, refreshMemberCache);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'unlink-member') {
      await runUnlinkMemberCommand(interaction, refreshMemberCache);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'links') {
      await runLinksCommand(interaction, refreshMemberCache);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'voice-check') {
      await runVoiceCheckCommand(interaction, refreshMemberCache);
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      /^stat:edit[12]:/.test(interaction.customId)
    ) {
      const [, , sessionId] = interaction.customId.split(':');
      const pending = sessions.get(sessionId);
      if (!pending || Date.now() - pending.createdAt > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        await interaction.update({
          content: 'รายการนี้หมดอายุแล้ว กรุณาใช้ /stat ใหม่',
          components: [],
        });
        return;
      }
      if (interaction.user.id !== pending.submittedByDiscordId) {
        await interaction.reply({
          content: 'รายการนี้เป็นของผู้ส่ง Stat คนอื่น',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const item = getStatDisplayItem(interaction.values[0]);
      if (!item) {
        await interaction.reply({
          content: 'ไม่พบ Stat ที่เลือก',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('ค่าใหม่')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);
      const currentValue = formatModalDefaultValue(pending, item.key);
      if (currentValue !== undefined) input.setValue(currentValue);

      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`stat:modal:${sessionId}:${item.key}`)
          .setTitle(`แก้ไข ${item.label}`)
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(input),
          ),
      );
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith('stat:modal:')
    ) {
      const [, , sessionId, statKey] = interaction.customId.split(':');
      const pending = sessions.get(sessionId);
      if (!pending || Date.now() - pending.createdAt > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        await interaction.reply({
          content: 'รายการนี้หมดอายุแล้ว กรุณาใช้ /stat ใหม่',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (interaction.user.id !== pending.submittedByDiscordId) {
        await interaction.reply({
          content: 'รายการนี้เป็นของผู้ส่ง Stat คนอื่น',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const item = getStatDisplayItem(statKey);
      if (!item) {
        await interaction.reply({
          content: 'ไม่พบ Stat ที่ต้องการแก้ไข',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let value: number;
      try {
        value = parseEditedStatValue(
          interaction.fields.getTextInputValue('value'),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
        return;
      }
      pending.stats[item.key] = value;
      pending.editedFields.add(item.key);
      pending.createdAt = Date.now();

      if (interaction.isFromMessage()) {
        await interaction.update(buildStatPreview(sessionId, pending));
      } else {
        await interaction.reply({
          content: 'แก้ไขค่าแล้ว กรุณากลับไปตรวจ Preview',
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (!interaction.isButton() || !interaction.customId.startsWith('stat:')) {
      return;
    }

    const [, action, sessionId] = interaction.customId.split(':');
    const pending = sessions.get(sessionId);
    if (!pending || Date.now() - pending.createdAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
      await interaction.update({ content: 'รายการนี้หมดอายุแล้ว กรุณาใช้ /stat ใหม่', components: [] });
      return;
    }
    if (interaction.user.id !== pending.submittedByDiscordId) {
      await interaction.reply({
        content: 'รายการนี้เป็นของผู้ส่ง Stat คนอื่น',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'cancel') {
      sessions.delete(sessionId);
      await interaction.update({ content: `ยกเลิกการส่ง stat ของ **${pending.ign}** แล้ว`, components: [] });
      return;
    }
    if (action === 'confirm') {
      await interaction.deferUpdate();
      await saveStatSubmission({
        memberId: pending.memberId,
        ign: pending.ign,
        submittedByDiscordId: pending.submittedByDiscordId,
        submittedByDiscordName: pending.submittedByDiscordName,
        stats: pending.stats,
      });
      sessions.delete(sessionId);
      await interaction.editReply({ content: `บันทึก stat ใหม่ของ **${pending.ign}** เรียบร้อยแล้ว`, components: [] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    if (interaction.isAutocomplete()) {
      if (discordErrorCode(error) === 10062) {
        console.warn('[Autocomplete] Interaction expired before response (10062)');
        return;
      }
      console.warn(`[Autocomplete] Failed: ${message}`);
      await interaction.respond([]).catch((respondError: unknown) => {
        if (discordErrorCode(respondError) !== 10062) {
          const respondMessage = respondError instanceof Error
            ? respondError.message
            : String(respondError);
          console.warn(`[Autocomplete] Empty response failed: ${respondMessage}`);
        }
      });
    } else if (interaction.isRepliable()) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `เกิดข้อผิดพลาด: ${message}`, components: [] }).catch(() => undefined);
      } else {
        await interaction.reply({
          content: `เกิดข้อผิดพลาด: ${message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => undefined);
      }
    }
  }
});

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
}, 60_000).unref();

await client.login(token);
