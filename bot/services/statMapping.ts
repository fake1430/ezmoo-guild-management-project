import {
  CHARACTER_STAT_KEYS,
  type CharacterStatKey,
  type CharacterStats,
} from '../../shared/characterStats.js';

export interface RawStatEntry {
  label: string;
  value: string;
}

export interface RawStatExtraction {
  stats: RawStatEntry[];
}

const EXACT_LABEL_ALIASES: Readonly<Record<string, CharacterStatKey>> = {
  HP: 'hp',
  PATK: 'patk',
  MATK: 'matk',
  PDEF: 'pdef',
  MDEF: 'mdef',
  CRIT: 'crit',
  'CRIT DMG': 'critDmg',
  'CRIT RES': 'critRes',
  'CRIT DMG RES': 'critDmgRes',
  'CRIT DMG RE': 'critDmgRes',
  'CRIT DMC RES': 'critDmgRes',
  PDMG: 'pdmg',
  MDMG: 'mdmg',
  'PDMG.R': 'pdmgReduction',
  'MDMG.R': 'mdmgReduction',
  'IGNORE PDEF': 'ignorePdef',
  'IGNORE MDEF': 'ignoreMdef',
  'PVP DMG BONUS': 'pvpDmgBonus',
  'PVP DMG RED': 'pvpDmgReduction',
  'HEALING DONE': 'healingDone',
  'HEALING TAKEN': 'healingTaken',
  'MAX HP': 'maxHpPercent',
  'EQUIPMENT PATK': 'equipmentPatkPercent',
  'EQUIPMENT MATK': 'equipmentMatkPercent',
  'EQUIPMENT PDEF': 'equipmentPdefPercent',
  'EQUIPMENT MDEF': 'equipmentMdefPercent',
  'DMG VS DEMI-HUMAN': 'dmgVsDemiHuman',
  'DMG REDUCTION VS DEMI-HUMAN': 'dmgReductionVsDemiHuman',
  'DMG VS MEDIUM ENEMIES': 'dmgVsMedium',
  'DMG REDUCTION VS MEDIUM ENEMIES': 'dmgReductionVsMedium',
};

export function normalizeRawLabel(label: string): string {
  return label
    .normalize('NFKC')
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function cleanupNumericArtifact(value: number): number {
  return Number(value.toFixed(6));
}

export function parseDisplayedStatValue(value: string): number {
  const normalized = value.trim().replace(/,/g, '').replace(/%$/, '').trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    throw new Error(`malformed numeric value "${value}"`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`non-finite numeric value "${value}"`);
  }
  return cleanupNumericArtifact(parsed);
}

export function validateCharacterStats(stats: CharacterStats): CharacterStats {
  const allowedKeys = new Set<string>(CHARACTER_STAT_KEYS);
  for (const key of Object.keys(stats)) {
    if (!allowedKeys.has(key)) throw new Error(`stat key ที่ไม่อนุญาต: ${key}`);
    const value = stats[key as CharacterStatKey];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`ค่าที่ไม่ใช่ finite number สำหรับ ${key}`);
    }
  }
  return stats;
}

export function mapRawStats(
  extraction: RawStatExtraction,
  imageNumber: number,
): CharacterStats {
  const mapped: CharacterStats = {};
  let knownLabelCount = 0;

  for (const entry of extraction.stats) {
    const normalizedLabel = normalizeRawLabel(entry.label);
    const key = EXACT_LABEL_ALIASES[normalizedLabel];
    if (!key) continue;
    knownLabelCount += 1;

    if (
      (key === 'ignorePdef' || key === 'ignoreMdef') &&
      entry.value.trim().endsWith('%')
    ) {
      console.debug(
        `[Vision image ${imageNumber}] ignored percentage variant: ${entry.label}=${entry.value}`,
      );
      continue;
    }

    let value: number;
    try {
      value = parseDisplayedStatValue(entry.value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Vision image ${imageNumber}] malformed value ignored: ${entry.label}=${entry.value} (${message})`,
      );
      continue;
    }

    const existingValue = mapped[key];
    if (existingValue === undefined) {
      mapped[key] = value;
    } else if (existingValue !== value) {
      console.warn(
        `[Vision image ${imageNumber}] conflicting ${key}: keeping ${existingValue}; ignored ${value}`,
      );
    }
  }

  if (Object.keys(mapped).length === 0) {
    if (knownLabelCount > 0) {
      throw new Error('พบ label ที่รองรับ แต่ value ไม่ใช่ตัวเลขที่ถูกต้อง');
    }
    throw new Error('Gemini อ่านข้อความได้ แต่ไม่มี label ใดตรงกับ CharacterStats 28 fields');
  }
  return validateCharacterStats(mapped);
}
