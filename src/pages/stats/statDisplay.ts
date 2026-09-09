import type { CharacterStatKey } from '../../types/characterStats';

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
