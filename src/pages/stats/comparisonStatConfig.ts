import type { CharacterStatKey, DerivedStatKey } from '../../types/characterStats';
import { STAT_OPTIONS, STAT_SECTIONS } from './statDisplay';

export type ComparisonStatKey = CharacterStatKey | DerivedStatKey;
export type ComparisonColumnColor = 'blue' | 'cyan' | 'green' | 'yellow' | 'orange' | 'rose' | 'purple' | 'slate';

export interface ComparisonLayout {
  statKeys: ComparisonStatKey[];
  columnColors: Partial<Record<ComparisonStatKey, ComparisonColumnColor>>;
}

export const DEFAULT_COMPARISON_LAYOUT_KEY = '__all__';
export const COMPARISON_LAYOUT_STORAGE_KEY = 'statsComparisonLayouts';
export const LEGACY_COMPARISON_LAYOUT_STORAGE_KEY = 'statsComparisonColumnOrder';
export const AVAILABLE_COMPARISON_STATS = STAT_OPTIONS;
export const COMPARISON_STAT_GROUPS = [
  ...STAT_SECTIONS.map((section) => ({
    title: section.title,
    stats: section.stats.map(([key, label]) => ({ key: key as ComparisonStatKey, label })),
  })),
  { title: 'Derived Defense', stats: [{ key: 'rawDef' as const, label: 'Raw DEF' }, { key: 'rawMdef' as const, label: 'Raw MDEF' }] },
];

export const COMPARISON_COLOR_OPTIONS = [
  { value: null, label: 'ไม่มีสี', hex: '#e2e8f0' },
  { value: 'blue', label: 'น้ำเงิน', hex: '#3b82f6' },
  { value: 'cyan', label: 'ฟ้า', hex: '#06b6d4' },
  { value: 'green', label: 'เขียว', hex: '#22c55e' },
  { value: 'yellow', label: 'เหลือง', hex: '#eab308' },
  { value: 'orange', label: 'ส้ม', hex: '#f97316' },
  { value: 'rose', label: 'ชมพู', hex: '#f43f5e' },
  { value: 'purple', label: 'ม่วง', hex: '#a855f7' },
  { value: 'slate', label: 'เทา', hex: '#64748b' },
] as const;

const DEFAULT_STATS: readonly ComparisonStatKey[] = ['hp', 'patk', 'matk', 'rawDef', 'rawMdef', 'pdmg', 'mdmg', 'pdmgReduction', 'mdmgReduction'];
const PHYSICAL_STATS: readonly ComparisonStatKey[] = ['hp', 'patk', 'rawDef', 'rawMdef', 'pdmg', 'crit', 'critDmg', 'ignorePdef', 'pdmgReduction', 'mdmgReduction', 'pvpDmgBonus', 'pvpDmgReduction'];
const MAGIC_STATS: readonly ComparisonStatKey[] = ['hp', 'matk', 'rawDef', 'rawMdef', 'mdmg', 'crit', 'critDmg', 'ignoreMdef', 'pdmgReduction', 'mdmgReduction', 'pvpDmgBonus', 'pvpDmgReduction'];
const SUPPORT_STATS: readonly ComparisonStatKey[] = ['hp', 'patk', 'matk', 'rawDef', 'rawMdef', 'pdmgReduction', 'mdmgReduction', 'healingDone', 'healingTaken', 'pvpDmgReduction', 'dmgReductionVsDemiHuman'];
const TANK_STATS: readonly ComparisonStatKey[] = ['hp', 'patk', 'rawDef', 'rawMdef', 'pdmgReduction', 'mdmgReduction', 'critDmgRes', 'pvpDmgReduction', 'dmgReductionVsDemiHuman', 'dmgReductionVsMedium'];

const STATS_BY_CLASS: Readonly<Partial<Record<string, readonly ComparisonStatKey[]>>> = {
  Assassin: PHYSICAL_STATS, Rogue: PHYSICAL_STATS, Sniper: PHYSICAL_STATS, Hunter: PHYSICAL_STATS,
  Gunslinger: PHYSICAL_STATS, Blacksmith: PHYSICAL_STATS, Merchant: PHYSICAL_STATS, Monk: PHYSICAL_STATS,
  Crusader: PHYSICAL_STATS, Wizard: MAGIC_STATS, Sage: MAGIC_STATS, Biochemist: MAGIC_STATS,
  Alchemist: MAGIC_STATS, Priest: SUPPORT_STATS, 'Bard/Dancer': SUPPORT_STATS, Doram: SUPPORT_STATS,
  Knight: TANK_STATS, Paladin: TANK_STATS,
};

export function getComparisonLayoutKey(selectedClass: string): string {
  return selectedClass === 'all' ? DEFAULT_COMPARISON_LAYOUT_KEY : selectedClass;
}

export function getDefaultComparisonLayout(selectedClass: string): ComparisonLayout {
  const statKeys = selectedClass === 'all' ? DEFAULT_STATS : STATS_BY_CLASS[selectedClass] ?? DEFAULT_STATS;
  return { statKeys: [...statKeys], columnColors: {} };
}

export function parseComparisonLayouts(value: string | null): Record<string, ComparisonLayout> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const availableKeys = new Set(AVAILABLE_COMPARISON_STATS.map(({ key }) => key));
    const colorKeys = new Set(COMPARISON_COLOR_OPTIONS.flatMap(({ value: color }) => color ? [color] : []));
    const layouts: Record<string, ComparisonLayout> = {};
    Object.entries(parsed).forEach(([layoutKey, candidate]) => {
      const rawStatKeys = Array.isArray(candidate) ? candidate : candidate && typeof candidate === 'object' && 'statKeys' in candidate ? (candidate as { statKeys?: unknown }).statKeys : undefined;
      if (!Array.isArray(rawStatKeys)) return;
      const statKeys = rawStatKeys.filter((key): key is ComparisonStatKey => typeof key === 'string' && availableKeys.has(key as ComparisonStatKey));
      const rawColors = !Array.isArray(candidate) && candidate && typeof candidate === 'object' && 'columnColors' in candidate ? (candidate as { columnColors?: unknown }).columnColors : undefined;
      const columnColors: ComparisonLayout['columnColors'] = {};
      if (rawColors && typeof rawColors === 'object' && !Array.isArray(rawColors)) {
        Object.entries(rawColors).forEach(([key, color]) => {
          if (availableKeys.has(key as ComparisonStatKey) && colorKeys.has(color as ComparisonColumnColor)) columnColors[key as ComparisonStatKey] = color as ComparisonColumnColor;
        });
      }
      layouts[layoutKey === 'default' ? DEFAULT_COMPARISON_LAYOUT_KEY : layoutKey] = { statKeys: [...new Set(statKeys)], columnColors };
    });
    return layouts;
  } catch {
    return {};
  }
}
