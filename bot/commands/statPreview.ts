import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type InteractionEditReplyOptions,
  type MessageEditOptions,
} from 'discord.js';
import type { CharacterStatKey } from '../../shared/characterStats.js';
import type { PendingStatSubmission } from '../types/session.js';

interface StatDisplayItem {
  key: CharacterStatKey;
  label: string;
  gameLabel?: string;
  isPercent: boolean;
}

export const STAT_DISPLAY_CONFIG: readonly StatDisplayItem[] = [
  { key: 'hp', label: 'HP', isPercent: false },
  { key: 'patk', label: 'PATK', isPercent: false },
  { key: 'matk', label: 'MATK', isPercent: false },
  { key: 'pdef', label: 'PDEF', isPercent: false },
  { key: 'mdef', label: 'MDEF', isPercent: false },
  { key: 'crit', label: 'CRIT', isPercent: false },
  { key: 'critDmg', label: 'CRIT DMG', isPercent: true },
  { key: 'critRes', label: 'CRIT RES', isPercent: false },
  { key: 'critDmgRes', label: 'CRIT DMG RES', isPercent: true },
  { key: 'pdmg', label: 'PDMG', isPercent: true },
  { key: 'mdmg', label: 'MDMG', isPercent: true },
  { key: 'pdmgReduction', label: 'PDMG.R', isPercent: true },
  { key: 'mdmgReduction', label: 'MDMG.R', isPercent: true },
  { key: 'ignorePdef', label: 'Ignore PDEF', isPercent: false },
  { key: 'ignoreMdef', label: 'Ignore MDEF', isPercent: false },
  { key: 'pvpDmgBonus', label: 'PvP DMG Bonus', isPercent: false },
  { key: 'pvpDmgReduction', label: 'PvP DMG Red', isPercent: false },
  { key: 'healingDone', label: 'Healing Done', isPercent: true },
  { key: 'healingTaken', label: 'Healing Taken', isPercent: true },
  { key: 'maxHpPercent', label: 'Max HP', isPercent: true },
  { key: 'equipmentPatkPercent', label: 'Equipment PATK', isPercent: true },
  { key: 'equipmentMatkPercent', label: 'Equipment MATK', isPercent: true },
  { key: 'equipmentPdefPercent', label: 'Equipment PDEF', isPercent: true },
  { key: 'equipmentMdefPercent', label: 'Equipment MDEF', isPercent: true },
  { key: 'dmgVsDemiHuman', label: 'DMG vs Demi-Human', isPercent: true },
  { key: 'dmgReductionVsDemiHuman', label: 'DMG Reduction vs Demi-Human', isPercent: true },
  { key: 'dmgVsMedium', label: 'DMG vs Medium', gameLabel: 'DMG vs Medium Enemies', isPercent: true },
  { key: 'dmgReductionVsMedium', label: 'DMG Reduction vs Medium', gameLabel: 'DMG Reduction vs Medium Enemies', isPercent: true },
] as const;

export function getStatDisplayItem(key: string): StatDisplayItem | undefined {
  return STAT_DISPLAY_CONFIG.find((item) => item.key === key);
}

export function getStatGameLabel(key: CharacterStatKey): string {
  const item = getStatDisplayItem(key);
  if (!item) throw new Error(`Missing display config for ${key}`);
  return item.gameLabel ?? item.label;
}

function formatValue(value: number | undefined, isPercent: boolean): string {
  if (value === undefined) return '—';
  return `${value}${isPercent ? '%' : ''}`;
}

export function parseEditedStatValue(input: string): number {
  const normalized = input.trim().replace(/,/g, '').replace(/%$/, '').trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    throw new Error('กรุณากรอกค่าเป็นตัวเลข เช่น 6090, 243.81% หรือ -19');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error('ค่าที่กรอกต้องเป็นตัวเลขที่ใช้งานได้');
  }
  return Object.is(value, -0) ? 0 : value;
}

export function buildStatPreview(
  sessionId: string,
  pending: PendingStatSubmission,
): InteractionEditReplyOptions & MessageEditOptions {
  const lines = STAT_DISPLAY_CONFIG.map((item) => {
    const edited = pending.editedFields.has(item.key) ? ' ✏️' : '';
    return `${item.label}: ${formatValue(pending.stats[item.key], item.isPercent)}${edited}`;
  });

  const menus = [
    { items: STAT_DISPLAY_CONFIG.slice(0, 14), suffix: '1', placeholder: '✏️ แก้ไขค่า 1–14' },
    { items: STAT_DISPLAY_CONFIG.slice(14), suffix: '2', placeholder: '✏️ แก้ไขค่า 15–28' },
  ].map(({ items, suffix, placeholder }) =>
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`stat:edit${suffix}:${sessionId}`)
        .setPlaceholder(placeholder)
        .addOptions(items.map((item) => ({
          label: `${item.label} — ${pending.stats[item.key] === undefined
            ? 'ไม่พบค่า'
            : formatValue(pending.stats[item.key], item.isPercent)}`,
          value: item.key,
        }))),
    ),
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`stat:confirm:${sessionId}`)
      .setLabel('ยืนยันและบันทึก')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`stat:cancel:${sessionId}`)
      .setLabel('ยกเลิก')
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    content: `📊 Stat Preview — **${pending.ign}**\n\n${lines.join('\n')}`,
    components: [...menus, buttons],
  };
}

export function formatModalDefaultValue(
  pending: PendingStatSubmission,
  key: CharacterStatKey,
): string | undefined {
  const item = getStatDisplayItem(key);
  const value = pending.stats[key];
  return item && value !== undefined ? formatValue(value, item.isPercent) : undefined;
}
