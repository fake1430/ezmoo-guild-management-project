import type { CharacterStatKey } from '../../types/characterStats';

export interface StatSection {
  title: string;
  stats: ReadonlyArray<readonly [CharacterStatKey, string]>;
}

export const STAT_SECTIONS: readonly StatSection[] = [
  { title: 'Basic', stats: [['hp', 'HP'], ['patk', 'PATK'], ['matk', 'MATK'], ['pdef', 'PDEF'], ['mdef', 'MDEF']] },
  { title: 'Critical', stats: [['crit', 'CRIT'], ['critDmg', 'CRIT DMG'], ['critRes', 'CRIT RES'], ['critDmgRes', 'CRIT DMG RES']] },
  { title: 'Damage', stats: [['pdmg', 'PDMG'], ['mdmg', 'MDMG'], ['pdmgReduction', 'PDMG.R'], ['mdmgReduction', 'MDMG.R'], ['ignorePdef', 'Ignore PDEF'], ['ignoreMdef', 'Ignore MDEF'], ['pvpDmgBonus', 'PvP DMG Bonus'], ['pvpDmgReduction', 'PvP DMG Red']] },
  { title: 'Healing', stats: [['healingDone', 'Healing Done'], ['healingTaken', 'Healing Taken']] },
  { title: 'Equipment', stats: [['maxHpPercent', 'Max HP'], ['equipmentPatkPercent', 'Equipment PATK'], ['equipmentMatkPercent', 'Equipment MATK'], ['equipmentPdefPercent', 'Equipment PDEF'], ['equipmentMdefPercent', 'Equipment MDEF']] },
  { title: 'Race / Size', stats: [['dmgVsDemiHuman', 'DMG vs Demi-Human'], ['dmgReductionVsDemiHuman', 'DMG Reduction vs Demi-Human'], ['dmgVsMedium', 'DMG vs Medium'], ['dmgReductionVsMedium', 'DMG Reduction vs Medium']] },
];

export const STAT_OPTIONS = STAT_SECTIONS.flatMap((section) => (
  section.stats.map(([key, label]) => ({ key, label }))
));

const STAT_LABELS = new Map(STAT_OPTIONS.map(({ key, label }) => [key, label]));

export function getStatLabel(key: CharacterStatKey): string {
  return STAT_LABELS.get(key) ?? key;
}

const PERCENT_KEYS = new Set<CharacterStatKey>([
  'critDmg', 'critDmgRes', 'pdmg', 'mdmg', 'pdmgReduction',
  'mdmgReduction', 'healingDone', 'healingTaken', 'maxHpPercent',
  'equipmentPatkPercent', 'equipmentMatkPercent', 'equipmentPdefPercent',
  'equipmentMdefPercent', 'dmgVsDemiHuman', 'dmgReductionVsDemiHuman',
  'dmgVsMedium', 'dmgReductionVsMedium',
]);

export function formatStatValue(
  key: CharacterStatKey,
  value: number | undefined,
): string {
  if (value === undefined) return '—';
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(value);
  return `${formatted}${PERCENT_KEYS.has(key) ? '%' : ''}`;
}

export function formatRawDef(
  pdef: number | null | undefined,
  equipmentPdefPercent: number | null | undefined,
): string {
  if (pdef == null || equipmentPdefPercent == null) return '—';

  const rawDef = (pdef - 140) / (1 + equipmentPdefPercent / 100);
  if (!Number.isFinite(rawDef)) return '—';

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(rawDef);
}
