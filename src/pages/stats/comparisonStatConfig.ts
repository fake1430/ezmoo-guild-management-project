import type { FocusStatKey } from '../../types/characterStats';
import { STAT_OPTIONS } from './statDisplay';

export const DEFAULT_COMPARISON_LAYOUT_KEY = 'default';
export const COMPARISON_LAYOUT_STORAGE_KEY = 'statsComparisonColumnOrder';

export const AVAILABLE_COMPARISON_STATS = STAT_OPTIONS;

export const DEFAULT_COMPARISON_STATS: readonly FocusStatKey[] = [
  'hp', 'patk', 'matk', 'rawDef', 'rawMdef',
  'pdmg', 'mdmg', 'pdmgReduction', 'mdmgReduction',
];

const PHYSICAL_DAMAGE_STATS: readonly FocusStatKey[] = [
  'hp', 'patk', 'rawDef', 'rawMdef', 'pdmg', 'crit', 'critDmg',
  'ignorePdef', 'pdmgReduction', 'mdmgReduction', 'pvpDmgBonus',
  'pvpDmgReduction',
];

const MAGIC_DAMAGE_STATS: readonly FocusStatKey[] = [
  'hp', 'matk', 'rawDef', 'rawMdef', 'mdmg', 'crit', 'critDmg',
  'ignoreMdef', 'pdmgReduction', 'mdmgReduction', 'pvpDmgBonus',
  'pvpDmgReduction',
];

const SUPPORT_STATS: readonly FocusStatKey[] = [
  'hp', 'patk', 'matk', 'rawDef', 'rawMdef', 'pdmgReduction',
  'mdmgReduction', 'healingDone', 'healingTaken', 'pvpDmgReduction',
  'dmgReductionVsDemiHuman',
];

const TANK_STATS: readonly FocusStatKey[] = [
  'hp', 'patk', 'rawDef', 'rawMdef', 'pdmgReduction', 'mdmgReduction',
  'critDmgRes', 'pvpDmgReduction', 'dmgReductionVsDemiHuman',
  'dmgReductionVsMedium',
];

export const COMPARISON_STATS_BY_CLASS: Readonly<
  Partial<Record<string, readonly FocusStatKey[]>>
> = {
  Assassin: PHYSICAL_DAMAGE_STATS,
  Rogue: PHYSICAL_DAMAGE_STATS,
  Sniper: PHYSICAL_DAMAGE_STATS,
  Hunter: PHYSICAL_DAMAGE_STATS,
  Gunslinger: PHYSICAL_DAMAGE_STATS,
  Blacksmith: PHYSICAL_DAMAGE_STATS,
  Merchant: PHYSICAL_DAMAGE_STATS,
  Monk: PHYSICAL_DAMAGE_STATS,
  Crusader: PHYSICAL_DAMAGE_STATS,
  Wizard: MAGIC_DAMAGE_STATS,
  Sage: MAGIC_DAMAGE_STATS,
  Biochemist: MAGIC_DAMAGE_STATS,
  Alchemist: MAGIC_DAMAGE_STATS,
  Priest: SUPPORT_STATS,
  'Bard/Dancer': SUPPORT_STATS,
  Doram: SUPPORT_STATS,
  Knight: TANK_STATS,
  Paladin: TANK_STATS,
};

export function getComparisonLayoutKey(selectedClass: string): string {
  return selectedClass === 'all' ? DEFAULT_COMPARISON_LAYOUT_KEY : selectedClass;
}

export function getDefaultComparisonStats(selectedClass: string): FocusStatKey[] {
  const configured = selectedClass === 'all'
    ? DEFAULT_COMPARISON_STATS
    : COMPARISON_STATS_BY_CLASS[selectedClass] ?? DEFAULT_COMPARISON_STATS;
  return [...configured];
}

export function parseComparisonLayouts(value: string | null): Record<string, FocusStatKey[]> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const availableKeys = new Set(AVAILABLE_COMPARISON_STATS.map(({ key }) => key));
    const layouts: Record<string, FocusStatKey[]> = {};
    Object.entries(parsed).forEach(([layoutKey, keys]) => {
      if (!Array.isArray(keys)) return;
      const validKeys = keys.filter(
        (key): key is FocusStatKey => typeof key === 'string' && availableKeys.has(key as FocusStatKey),
      );
      layouts[layoutKey] = [...new Set(validKeys)];
    });
    return layouts;
  } catch {
    return {};
  }
}
