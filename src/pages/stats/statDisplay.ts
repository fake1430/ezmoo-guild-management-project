import type {
  CharacterStatKey,
  CharacterStats,
  DerivedStatKey,
  FocusStatKey,
} from '../../types/characterStats';

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

export const STAT_OPTIONS: ReadonlyArray<{
  key: FocusStatKey;
  label: string;
}> = [
  ...STAT_SECTIONS.flatMap((section) => (
    section.stats.map(([key, label]) => ({ key, label }))
  )),
  { key: 'rawDef', label: 'Raw DEF' },
  { key: 'rawMdef', label: 'Raw MDEF' },
];

const STAT_LABELS = new Map(STAT_OPTIONS.map(({ key, label }) => [key, label]));

export function getStatLabel(key: FocusStatKey): string {
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
  const rawDef = calculateRawDef(pdef, equipmentPdefPercent);
  return formatDerivedStatValue(rawDef);
}

export function calculateRawDef(
  pdef: number | null | undefined,
  equipmentPdefPercent: number | null | undefined,
): number | undefined {
  return calculateRawDefense(pdef, equipmentPdefPercent, 140);
}

export function formatRawMdef(
  mdef: number | null | undefined,
  equipmentMdefPercent: number | null | undefined,
): string {
  const rawMdef = calculateRawMdef(mdef, equipmentMdefPercent);
  return formatDerivedStatValue(rawMdef);
}

export function calculateRawMdef(
  mdef: number | null | undefined,
  equipmentMdefPercent: number | null | undefined,
): number | undefined {
  return calculateRawDefense(mdef, equipmentMdefPercent, 100);
}

function calculateRawDefense(
  defense: number | null | undefined,
  equipmentPercent: number | null | undefined,
  baseDefense: number,
): number | undefined {
  if (defense == null || equipmentPercent == null) return undefined;

  const rawDefense = (defense - baseDefense) / (1 + equipmentPercent / 100);
  return Number.isFinite(rawDefense) ? rawDefense : undefined;
}

function formatDerivedStatValue(value: number | undefined): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function getDerivedStatValue(
  stats: CharacterStats,
  key: DerivedStatKey,
): number | undefined {
  return key === 'rawDef'
    ? calculateRawDef(stats.pdef, stats.equipmentPdefPercent)
    : calculateRawMdef(stats.mdef, stats.equipmentMdefPercent);
}

export function getFocusStatValue(
  stats: CharacterStats,
  key: FocusStatKey,
): number | undefined {
  return key === 'rawDef' || key === 'rawMdef'
    ? getDerivedStatValue(stats, key)
    : stats[key];
}

export function formatFocusStatValue(
  stats: CharacterStats,
  key: FocusStatKey,
): string {
  return key === 'rawDef' || key === 'rawMdef'
    ? formatDerivedStatValue(getDerivedStatValue(stats, key))
    : formatStatValue(key, stats[key]);
}

export function formatFocusStatTarget(
  key: FocusStatKey,
  value: number,
): string {
  return key === 'rawDef' || key === 'rawMdef'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
    : formatStatValue(key, value);
}
