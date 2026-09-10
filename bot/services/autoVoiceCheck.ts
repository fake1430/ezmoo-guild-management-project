import cron, { type ScheduledTask } from 'node-cron';
import { PermissionFlagsBits, type Client } from 'discord.js';
import type { Member } from '../../src/types/member.js';
import { getDiscordMemberLinksCached } from './discordMemberLinks.js';
import { buildVoiceCheckReport } from './voiceCheck.js';

export const AUTO_VOICE_CHECK_CRON = '55 19 * * 0,2,4';
export const AUTO_VOICE_CHECK_TIME_ZONE = 'Asia/Bangkok';
let autoVoiceCheckStarted = false;

interface StartAutoVoiceCheckOptions {
  channelId: string | undefined;
  runOnReady: boolean;
  cachesReady: Promise<unknown>;
  loadMembers: () => Promise<Member[]>;
}

export function safeAutoVoiceCheckError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500);
}

async function resolveSendableGuildChannel(client: Client, channelId: string) {
  if (!client.user) return null;
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isSendable() || channel.isDMBased()) return null;
  const requiredPermission = channel.isThread()
    ? PermissionFlagsBits.SendMessagesInThreads
    : PermissionFlagsBits.SendMessages;
  if (!channel.permissionsFor(client.user)?.has(requiredPermission)) return null;
  return channel;
}

export async function validateAutoVoiceCheckChannel(
  client: Client,
  channelId: string,
): Promise<boolean> {
  try {
    const channel = await resolveSendableGuildChannel(client, channelId);
    if (!channel) {
      console.warn('[Auto Voice Check] Configured channel was not found or is not sendable');
      return false;
    }
    console.log(`[Auto Voice Check] Target channel ready: channelId=${channel.id}`);
    return true;
  } catch (error) {
    console.warn(`[Auto Voice Check] Channel validation failed: ${safeAutoVoiceCheckError(error)}`);
    return false;
  }
}

export async function runAutoVoiceCheck(
  client: Client,
  channelId: string,
  loadMembers: () => Promise<Member[]>,
): Promise<void> {
  const channel = await resolveSendableGuildChannel(client, channelId);
  if (!channel) throw new Error('Configured voice-check channel is unavailable or not sendable');

  const [members, links] = await Promise.all([
    loadMembers(),
    getDiscordMemberLinksCached(),
  ]);
  const report = buildVoiceCheckReport(channel.guild, members, links);
  for (const chunk of report.chunks) {
    await channel.send({ content: chunk, allowedMentions: { parse: [] } });
  }
  console.log(
    `[Auto Voice Check] Sent report: voice=${report.onlineCount}/${report.memberCount}, unlinked=${report.unlinkedDiscordCount}`,
  );
}

export function startAutoVoiceCheckScheduler(
  client: Client,
  channelId: string,
  loadMembers: () => Promise<Member[]>,
): ScheduledTask {
  return cron.schedule(
    AUTO_VOICE_CHECK_CRON,
    async () => {
      try {
        await runAutoVoiceCheck(client, channelId, loadMembers);
      } catch (error) {
        console.warn(`[Auto Voice Check] Failed: ${safeAutoVoiceCheckError(error)}`);
      }
    },
    {
      timezone: AUTO_VOICE_CHECK_TIME_ZONE,
      noOverlap: true,
      name: 'ezmoo-auto-voice-check',
    },
  );
}

export async function startAutoVoiceCheck(
  client: Client,
  options: StartAutoVoiceCheckOptions,
): Promise<void> {
  if (autoVoiceCheckStarted) {
    console.warn('[Auto Voice Check] Start skipped because scheduler is already initialized');
    return;
  }
  autoVoiceCheckStarted = true;

  console.log('[Auto Voice Check] Scheduler starting');
  console.log(
    `[Auto Voice Check] Schedule: ${AUTO_VOICE_CHECK_CRON} ${AUTO_VOICE_CHECK_TIME_ZONE}`,
  );
  console.log(`[Auto Voice Check] RUN_ON_READY=${String(options.runOnReady)}`);
  if (!options.channelId) {
    console.warn('[Auto Voice Check] VOICE_CHECK_CHANNEL_ID is not configured; scheduler disabled');
    return;
  }
  console.log('[Auto Voice Check] Channel ID configured');

  try {
    await options.cachesReady;
    await validateAutoVoiceCheckChannel(client, options.channelId);
    startAutoVoiceCheckScheduler(client, options.channelId, options.loadMembers);
    if (options.runOnReady) {
      console.log('[Auto Voice Check] Running startup test');
      await runAutoVoiceCheck(client, options.channelId, options.loadMembers);
      console.log('[Auto Voice Check] Sent report successfully');
    }
  } catch (error) {
    console.warn(`[Auto Voice Check] Failed: ${safeAutoVoiceCheckError(error)}`);
  }
}
