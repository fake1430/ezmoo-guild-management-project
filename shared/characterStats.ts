export const CHARACTER_STAT_KEYS = [
  'hp',
  'patk',
  'matk',
  'pdef',
  'mdef',
  'crit',
  'critDmg',
  'critRes',
  'critDmgRes',
  'pdmg',
  'mdmg',
  'pdmgReduction',
  'mdmgReduction',
  'ignorePdef',
  'ignoreMdef',
  'pvpDmgBonus',
  'pvpDmgReduction',
  'healingDone',
  'healingTaken',
  'maxHpPercent',
  'equipmentPatkPercent',
  'equipmentMatkPercent',
  'equipmentPdefPercent',
  'equipmentMdefPercent',
  'dmgVsDemiHuman',
  'dmgReductionVsDemiHuman',
  'dmgVsMedium',
  'dmgReductionVsMedium',
] as const;

export type CharacterStatKey =
  (typeof CHARACTER_STAT_KEYS)[number];

export type CharacterStats = Partial<
  Record<CharacterStatKey, number>
>;

export interface StatSubmission {
  id: string;
  memberId: string;
  ign: string;
  submittedByDiscordId: string;
  submittedByDiscordName?: string;
  submittedAt: string;
  stats: CharacterStats;
}

export const CHARACTER_STAT_LABELS: Record<
  CharacterStatKey,
  string
> = {
  hp: 'HP',
  patk: 'PATK',
  matk: 'MATK',
  pdef: 'PDEF',
  mdef: 'MDEF',
  crit: 'Crit',
  critDmg: 'Crit DMG',
  critRes: 'Crit Res',
  critDmgRes: 'Crit DMG Res',
  pdmg: 'PDMG',
  mdmg: 'MDMG',
  pdmgReduction: 'PDMG.R',
  mdmgReduction: 'MDMG.R',
  ignorePdef: 'Ignore PDEF',
  ignoreMdef: 'Ignore MDEF',
  pvpDmgBonus: 'PvP DMG Bonus',
  pvpDmgReduction: 'PvP DMG Red',
  healingDone: 'Healing Done',
  healingTaken: 'Healing Taken',
  maxHpPercent: 'Max HP %',
  equipmentPatkPercent: 'Equipment PATK %',
  equipmentMatkPercent: 'Equipment MATK %',
  equipmentPdefPercent: 'Equipment PDEF %',
  equipmentMdefPercent: 'Equipment MDEF %',
  dmgVsDemiHuman: 'DMG vs Demi-Human',
  dmgReductionVsDemiHuman: 'DMG Reduction vs Demi-Human',
  dmgVsMedium: 'DMG vs Medium',
  dmgReductionVsMedium: 'DMG Reduction vs Medium',
};
