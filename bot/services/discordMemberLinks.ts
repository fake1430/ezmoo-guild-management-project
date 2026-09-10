import type { DiscordMemberLink } from '../types/discordMemberLink.js';
import {
  deleteDiscordMemberLink,
  getDiscordMemberLinks,
  saveDiscordMemberLink,
} from './guildApi.js';

const LINK_CACHE_TTL_MS = 5 * 60 * 1000;
let cache: DiscordMemberLink[] = [];
let cacheUpdatedAt = 0;
let refreshPromise: Promise<DiscordMemberLink[]> | null = null;

export function refreshDiscordMemberLinks(): Promise<DiscordMemberLink[]> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = getDiscordMemberLinks()
    .then((links) => {
      cache = links;
      cacheUpdatedAt = Date.now();
      return links;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function getDiscordMemberLinksCached(): Promise<DiscordMemberLink[]> {
  if (!cacheUpdatedAt || Date.now() - cacheUpdatedAt >= LINK_CACHE_TTL_MS) {
    return refreshDiscordMemberLinks();
  }
  return cache;
}

export async function createDiscordMemberLink(input: {
  discordUserId: string;
  memberId: string;
  linkedByDiscordId: string;
}): Promise<DiscordMemberLink> {
  const link = await saveDiscordMemberLink(input);
  await refreshDiscordMemberLinks();
  return link;
}

export async function removeDiscordMemberLink(
  discordUserId: string,
): Promise<DiscordMemberLink> {
  const link = await deleteDiscordMemberLink(discordUserId);
  await refreshDiscordMemberLinks();
  return link;
}
