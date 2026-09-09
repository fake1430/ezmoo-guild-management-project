import { GoogleGenAI, Type, type Part } from '@google/genai';
import {
  CHARACTER_STAT_KEYS,
  type CharacterStatKey,
  type CharacterStats,
} from '../../shared/characterStats.js';
import { getStatGameLabel } from '../commands/statPreview.js';
import {
  mapRawStats,
  validateCharacterStats,
  type RawStatExtraction,
} from './statMapping.js';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 5;
const GEMINI_TIMEOUT_MS = 30_000;
const DOWNLOAD_ATTEMPT_TIMEOUT_MS = 10_000;
const DOWNLOAD_MAX_ATTEMPTS = 3;
const DOWNLOAD_FINAL_RETRY_DELAY_MS = 400;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    stats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ['label', 'value'],
      },
    },
  },
  required: ['stats'],
};

const IMAGE_EXPECTED_STATS: ReadonlyArray<readonly CharacterStatKey[]> = [
  ['hp', 'patk', 'matk', 'pdef', 'mdef'],
  [
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
  ],
  [
    'maxHpPercent',
    'equipmentPatkPercent',
    'equipmentMatkPercent',
    'equipmentPdefPercent',
    'equipmentMdefPercent',
    'dmgVsMedium',
    'dmgReductionVsMedium',
  ],
  ['dmgVsDemiHuman', 'dmgReductionVsDemiHuman'],
];

export interface VisionAttachment {
  url: string;
  proxyUrl?: string;
}

class NonRetryableDownloadError extends Error {}

async function downloadAttempt(
  sourceUrl: string,
  imageNumber: number,
  attempt: number,
  sourceLabel: 'url' | 'proxyURL',
): Promise<Part> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let stage: 'fetch' | 'arrayBuffer' = 'fetch';
  const timeout = setTimeout(
    () => controller.abort(),
    DOWNLOAD_ATTEMPT_TIMEOUT_MS,
  );
  console.log(
    `[Vision image ${imageNumber}] Download attempt ${attempt} START source=${sourceLabel}`,
  );

  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    console.log(
      `[Vision image ${imageNumber}] headers RECEIVED ${Date.now() - startedAt}ms`,
    );
    if (!response.ok) {
      throw new Error(`Discord CDN HTTP ${response.status}`);
    }
    const mimeType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      throw new NonRetryableDownloadError(
        `รูปภาพไม่รองรับ (${mimeType || 'unknown MIME type'}): ใช้ PNG, JPEG หรือ WebP`,
      );
    }
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      throw new NonRetryableDownloadError('รูปภาพมีขนาดเกิน 20 MB');
    }

    stage = 'arrayBuffer';
    const bodyStartedAt = Date.now();
    console.log(`[Vision image ${imageNumber}] arrayBuffer START`);
    const arrayBuffer = await response.arrayBuffer();
    console.log(
      `[Vision image ${imageNumber}] arrayBuffer DONE ${Date.now() - bodyStartedAt}ms`,
    );
    const imageBuffer = Buffer.from(arrayBuffer);
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new NonRetryableDownloadError('รูปภาพมีขนาดเกิน 20 MB');
    }
    const data = imageBuffer.toString('base64');
    console.log(
      `[Vision image ${imageNumber}] Download DONE ${Date.now() - startedAt}ms`,
    );
    return { inlineData: { data, mimeType } };
  } catch (error) {
    if (controller.signal.aborted) {
      console.warn(
        `[Vision image ${imageNumber}] ${stage} TIMEOUT ${Date.now() - startedAt}ms`,
      );
    } else if (!(error instanceof NonRetryableDownloadError)) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Vision image ${imageNumber}] Download attempt ${attempt} FAILED: ${message}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function attachmentToInlineData(
  attachment: VisionAttachment,
  imageNumber: number,
): Promise<Part> {
  const proxyIsUsable = Boolean(
    attachment.proxyUrl && attachment.proxyUrl !== attachment.url,
  );
  const attempts = [
    { url: attachment.url, label: 'url' as const },
    proxyIsUsable
      ? { url: attachment.proxyUrl as string, label: 'proxyURL' as const }
      : { url: attachment.url, label: 'url' as const },
    { url: attachment.url, label: 'url' as const },
  ];

  for (let index = 0; index < DOWNLOAD_MAX_ATTEMPTS; index += 1) {
    if (index === 2) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, DOWNLOAD_FINAL_RETRY_DELAY_MS),
      );
    }
    if (index > 0) {
      console.warn(
        `[Vision image ${imageNumber}] Download RETRY source=${attempts[index].label}`,
      );
    }
    try {
      return await downloadAttempt(
        attempts[index].url,
        imageNumber,
        index + 1,
        attempts[index].label,
      );
    } catch (error) {
      if (error instanceof NonRetryableDownloadError) throw error;
    }
  }

  console.warn(`[Vision image ${imageNumber}] Download FAILED after 3 attempts`);
  throw new Error(`ดาวน์โหลดรูปที่ ${imageNumber} ไม่สำเร็จ กรุณาลองส่งใหม่`);
}

function validateRawExtraction(raw: unknown): RawStatExtraction {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Gemini ส่ง JSON/schema response ที่ไม่ถูกต้อง');
  }
  const input = raw as Record<string, unknown>;
  if (!Array.isArray(input.stats)) {
    throw new Error('Gemini ส่ง raw stats ที่ไม่ใช่ array');
  }
  const stats = input.stats.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Gemini ส่ง raw stat entry ${index + 1} ไม่ถูกต้อง`);
    }
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.label !== 'string' || typeof candidate.value !== 'string') {
      throw new Error(`Gemini ส่ง label/value ของ entry ${index + 1} ไม่ใช่ string`);
    }
    return { label: candidate.label, value: candidate.value };
  });
  return { stats };
}

function mergePartialStats(
  target: CharacterStats,
  incoming: CharacterStats,
  imageNumber: number,
): void {
  for (const key of CHARACTER_STAT_KEYS) {
    const incomingValue = incoming[key];
    if (incomingValue === undefined) continue;
    const existingValue = target[key];
    if (existingValue === undefined) {
      target[key] = incomingValue;
    } else if (existingValue !== incomingValue) {
      console.warn(
        `[Vision] Conflicting ${key}: keeping ${existingValue} from an earlier image; ignored ${incomingValue} from image ${imageNumber}`,
      );
    }
  }
}

function geminiErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object'
    ? error as { status?: number; code?: number; message?: string }
    : undefined;
  const status = details?.status ?? details?.code;
  const message = details?.message ?? String(error);
  if (status === 429 || /quota|rate.?limit|resource_exhausted/i.test(message)) {
    return 'Gemini API quota/rate limit หมด กรุณารอสักครู่แล้วลองใหม่';
  }
  if (/mime|image|unsupported|invalid argument/i.test(message)) {
    return `Gemini ไม่รองรับหรืออ่านรูปไม่ได้: ${message}`;
  }
  return `Gemini API request failed${status ? ` (HTTP ${status})` : ''}: ${message}`;
}

async function extractSingleImage(
  ai: GoogleGenAI,
  imagePart: Part,
  prompt: string,
  model: string,
  imageNumber: number,
): Promise<CharacterStats> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const startedAt = Date.now();
  console.log(`[Vision image ${imageNumber}] Gemini START`);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ text: prompt }, imagePart],
      config: {
        abortSignal: controller.signal,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0,
      },
    });
    console.log(`[Vision image ${imageNumber}] Gemini DONE ${Date.now() - startedAt}ms`);
    const parseStartedAt = Date.now();
    console.log(`[Vision image ${imageNumber}] Parse START`);
    const text = response.text;
    if (!text) throw new Error('Gemini ไม่ส่ง JSON response กลับมา');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini ส่ง JSON/schema response ที่ parse ไม่ได้');
    }
    const rawExtraction = validateRawExtraction(parsed);
    console.log(`[Vision image ${imageNumber}] Parse DONE ${Date.now() - parseStartedAt}ms`);
    const rawLogStartedAt = Date.now();
    console.log(`[Vision image ${imageNumber}] Raw log START`);
    console.debug(
      `[Vision image ${imageNumber}] raw:\n${rawExtraction.stats
        .map((entry) => `${entry.label}=${entry.value}`)
        .join('\n')}`,
    );
    console.log(`[Vision image ${imageNumber}] Raw log DONE ${Date.now() - rawLogStartedAt}ms`);
    const mappingStartedAt = Date.now();
    console.log(`[Vision image ${imageNumber}] Mapping START`);
    const mapped = mapRawStats(rawExtraction, imageNumber);
    console.log(
      `[Vision image ${imageNumber}] Mapping DONE ${Date.now() - mappingStartedAt}ms`,
    );
    const mappedLogStartedAt = Date.now();
    console.log(`[Vision image ${imageNumber}] Mapped log START`);
    console.debug(
      `[Vision image ${imageNumber}] mapped:\n${CHARACTER_STAT_KEYS
        .flatMap((key) => mapped[key] === undefined ? [] : [`${key}=${mapped[key]}`])
        .join('\n')}`,
    );
    console.log(
      `[Vision image ${imageNumber}] Mapped log DONE ${Date.now() - mappedLogStartedAt}ms`,
    );
    return mapped;
  } catch (error) {
    if (controller.signal.aborted) {
      console.warn(`[Vision image ${imageNumber}] Gemini TIMEOUT ${Date.now() - startedAt}ms`);
      throw new Error(`Gemini รูปที่ ${imageNumber} หมดเวลา 30 วินาที`);
    }
    if (error instanceof Error && (
      error.message.startsWith('Gemini ส่ง') ||
      error.message.startsWith('พบ label') ||
      error.message.startsWith('Gemini อ่านข้อความ')
    )) {
      throw error;
    }
    throw new Error(geminiErrorMessage(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function recoverMissingStats(
  ai: GoogleGenAI,
  imagePart: Part,
  model: string,
  imageNumber: number,
  missingKeys: readonly CharacterStatKey[],
  mergedStats: CharacterStats,
): Promise<void> {
  const requestedLabels = missingKeys.map(getStatGameLabel);
  const prompt = [
    'You are reading a Ragnarok Origin character stat screenshot.',
    'The previous extraction missed only the following specific stats:',
    ...requestedLabels.map((label) => `- ${label}`),
    'Read ONLY these requested stats from the provided screenshot.',
    'Do not extract unrelated stats. Do not infer, calculate, guess, or substitute a similar stat.',
    'Read the exact visible label and exact visible value. Preserve percent signs when visible.',
    'If a requested stat is genuinely not visible, omit it.',
    'PvP DMG Bonus must not be confused with PvE DMG Bonus. PvP DMG Red must not be confused with PvE DMG Red.',
    'Ignore PDEF and Ignore MDEF must use the flat numeric value, never their percentage variants.',
    'DMG vs Demi-Human must not be confused with DMG Reduction vs Demi-Human.',
    'DMG vs Medium Enemies must not be confused with DMG Reduction vs Medium Enemies.',
    'Return JSON only in the provided RawStatExtraction schema.',
  ].join('\n');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const startedAt = Date.now();
  console.log(
    `[Vision image ${imageNumber}] Recovery START fields=${missingKeys.join(',')}`,
  );
  console.log(`[Vision image ${imageNumber}] Recovery Gemini START`);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ text: prompt }, imagePart],
      config: {
        abortSignal: controller.signal,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0,
      },
    });
    console.log(
      `[Vision image ${imageNumber}] Recovery Gemini DONE ${Date.now() - startedAt}ms`,
    );
    const text = response.text;
    if (!text) throw new Error('Gemini ไม่ส่ง recovery JSON กลับมา');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini ส่ง recovery JSON ที่ parse ไม่ได้');
    }
    const rawExtraction = validateRawExtraction(parsed);
    console.debug(
      `[Vision image ${imageNumber}] Recovery raw:\n${rawExtraction.stats
        .map((entry) => `${entry.label}=${entry.value}`)
        .join('\n')}`,
    );
    const recovered = mapRawStats(rawExtraction, imageNumber);
    console.debug(
      `[Vision image ${imageNumber}] Recovery mapped:\n${CHARACTER_STAT_KEYS
        .flatMap((key) => recovered[key] === undefined ? [] : [`${key}=${recovered[key]}`])
        .join('\n')}`,
    );

    const requested = new Set<CharacterStatKey>(missingKeys);
    const mergedKeys: CharacterStatKey[] = [];
    for (const key of CHARACTER_STAT_KEYS) {
      const value = recovered[key];
      if (requested.has(key) && mergedStats[key] === undefined && value !== undefined) {
        mergedStats[key] = value;
        mergedKeys.push(key);
      }
    }
    console.log(
      `[Vision image ${imageNumber}] Recovery MERGED:\n${mergedKeys.join('\n') || '(none)'}`,
    );
  } catch (error) {
    const message = controller.signal.aborted
      ? `หมดเวลา ${GEMINI_TIMEOUT_MS / 1000} วินาที`
      : error instanceof Error
        ? error.message
        : String(error);
    console.warn(`[Vision image ${imageNumber}] Recovery failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  const unresolved = missingKeys.filter((key) => mergedStats[key] === undefined);
  if (unresolved.length > 0) {
    console.warn(
      `[Vision image ${imageNumber}] Recovery unresolved:\n${unresolved.join('\n')}`,
    );
  }
  console.log(`[Vision image ${imageNumber}] Recovery DONE ${Date.now() - startedAt}ms`);
}

export async function extractCharacterStats(
  attachments: VisionAttachment[],
): Promise<CharacterStats> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('ไม่พบ GEMINI_API_KEY สำหรับ Vision extraction');
  if (attachments.length === 0 || attachments.length > MAX_IMAGES) {
    throw new Error('ต้องแนบรูปอย่างน้อย 1 รูป และไม่เกิน 5 รูป');
  }

  const prompt = [
    'You are performing strict visual transcription of the LEFT character statistics panel from Ragnarok Origin Classic > Character > Details.',
    'Your only task is to COPY visible stat labels and their displayed values.',
    'Do NOT map them to application field names. Do NOT calculate, infer, estimate, convert, normalize, combine, or reinterpret values.',
    'Scan the entire visible statistics panel carefully from TOP to BOTTOM. The panel may contain TWO COLUMNS. Read BOTH columns independently, row by row.',
    'For every visible stat: copy the label as displayed; copy the value as displayed; preserve % signs, decimal digits, commas, and negative signs.',
    'PDEF and Ignore PDEF are DIFFERENT labels. MDEF and Ignore MDEF are DIFFERENT labels.',
    'PDMG and PDMG.R are DIFFERENT labels. MDMG and MDMG.R are DIFFERENT labels.',
    'The correct game labels are CRIT DMG and CRIT DMG RES. CRIT DMG RES may have tightly spaced final letters. Read the full label.',
    'DMG vs Demi-Human and DMG Reduction vs Demi-Human are DIFFERENT labels.',
    'DMG vs Medium Enemies and DMG Reduction vs Medium Enemies are DIFFERENT labels.',
    'Pay special attention to the PvE/PvP damage rows.',
    'These are distinct labels: PDMG Bonus; MDMG Bonus; PvE DMG Red; PvE DMG Bonus; PvP DMG Red; PvP DMG Bonus.',
    "The lowercase 'v' in PvP and PvE may be visually small. Do not omit it.",
    'PvP DMG Bonus must be transcribed exactly as PvP DMG Bonus when visible. PvP DMG Red must be transcribed exactly as PvP DMG Red when visible.',
    'Do not confuse PDMG Bonus, PvE DMG Bonus, and PvP DMG Bonus.',
    'Do not match or rename a field because another label contains the same word. Ignore PDEF must never be transcribed as PDEF.',
    'Zero and 0% are valid visible values.',
    'Ignore the STR/AGI/VIT/INT/DEX/LUK allocation panel on the right side.',
    'Ignore section headers such as General Stats, Quasi-Stats, and Special.',
    'Before returning, perform a second pass from top to bottom and verify that no clearly visible label/value pair was skipped.',
    'Return JSON only according to the response schema.',
  ].join(' ');

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_VISION_MODEL || DEFAULT_GEMINI_MODEL;
  const mergedStats: CharacterStats = {};
  const imageErrors: string[] = [];
  const startedAt = Date.now();

  for (let index = 0; index < attachments.length; index += 1) {
    const imageNumber = index + 1;
    const imageStartedAt = Date.now();
    console.log(`[Vision image ${imageNumber}] START`);
    try {
      const imagePart = await attachmentToInlineData(attachments[index], imageNumber);
      const partialStats = await extractSingleImage(
        ai,
        imagePart,
        prompt,
        model,
        imageNumber,
      );
      const mergeStartedAt = Date.now();
      console.log(`[Vision image ${imageNumber}] Merge START`);
      mergePartialStats(mergedStats, partialStats, imageNumber);
      console.log(`[Vision image ${imageNumber}] Merge DONE ${Date.now() - mergeStartedAt}ms`);
      const expectedStats = IMAGE_EXPECTED_STATS[index] ?? [];
      const missingStats = expectedStats.filter(
        (key) => mergedStats[key] === undefined,
      );
      if (missingStats.length > 0) {
        console.warn(
          `[Vision image ${imageNumber}] Missing expected stats:\n${missingStats.join('\n')}`,
        );
        await recoverMissingStats(
          ai,
          imagePart,
          model,
          imageNumber,
          missingStats,
          mergedStats,
        );
      }
      console.log(`[Vision image ${imageNumber}] DONE ${Date.now() - imageStartedAt}ms`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      imageErrors.push(`รูปที่ ${imageNumber}: ${message}`);
      console.warn(`[Vision] Image ${imageNumber} failed: ${message}`);
    }
  }

  console.log(
    `[Vision] Extraction completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
  if (Object.keys(mergedStats).length === 0) {
    throw new Error(`ไม่สามารถอ่าน stat ได้จากทุกรูป (${imageErrors.join(' | ')})`);
  }
  return validateCharacterStats(mergedStats);
}
