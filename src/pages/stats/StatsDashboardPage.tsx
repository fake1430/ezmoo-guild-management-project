import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { toBlob } from 'html-to-image';
import { getClassColor } from '../../constants/classColors';
import {
  getLatestGuildStats,
  getStatFocusConfig,
  saveStatFocusConfig,
} from '../../services/googleApi';
import type {
  CharacterStatKey,
  ClassFocusStatConfig,
  FocusStatKey,
  StatCriterion,
  StatSubmission,
} from '../../types/characterStats';
import type { Member } from '../../types/member';
import { StatDetailContent } from './StatDetailContent';
import {
  COMPARISON_EVALUATIONS_STORAGE_KEY,
  COMPARISON_LAYOUT_STORAGE_KEY,
  COMPARISON_STAT_GROUPS,
  LEGACY_COMPARISON_LAYOUT_STORAGE_KEY,
  type ComparisonCellStatus,
  type ComparisonEvaluations,
  type ComparisonLayout,
  type ComparisonStatKey,
  getComparisonLayoutKey,
  getDefaultComparisonLayout,
  parseComparisonEvaluations,
  parseComparisonLayouts,
} from './comparisonStatConfig';
import {
  formatFocusStatTarget,
  formatFocusStatValue,
  getFocusStatValue,
  getStatLabel,
  STAT_OPTIONS,
} from './statDisplay';

interface StatsDashboardPageProps {
  members: Member[];
  isLoadingMembers: boolean;
  memberErrorMessage: string;
  onReloadMembers: () => Promise<void>;
}

type SortMode = 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc';
type ViewMode = 'card' | 'comparison';
type ComparisonSortDirection = 'asc' | 'desc';
interface ComparisonSort {
  key: 'ign' | ComparisonStatKey;
  direction: ComparisonSortDirection;
}
interface ComparisonCellPosition { row: number; column: number }
interface CardSummaryField { key: FocusStatKey; label: string }
interface DraftCriterion {
  operator: StatCriterion['operator'];
  targetText: string;
}
type DraftCriteria = Partial<Record<FocusStatKey, DraftCriterion>>;

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FOCUS_STATS = 10;
const CARD_SUMMARY_KEYS: readonly CharacterStatKey[] = [
  'hp', 'pvpDmgBonus', 'pvpDmgReduction',
];

function memberClass(member: Member): string {
  return member.guildLeagueClass.trim()
    || member.overrunClass.trim()
    || 'ไม่ระบุอาชีพ';
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function latestTime(submission: StatSubmission | null): number {
  if (!submission) return Number.NEGATIVE_INFINITY;
  const time = new Date(submission.submittedAt).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function sortMembersByToolbar(
  source: Member[],
  sortMode: SortMode,
  latestByMember: Map<string, StatSubmission | null>,
): Member[] {
  return [...source].sort((first, second) => {
    if (sortMode === 'name-desc') return second.ign.localeCompare(first.ign, 'th');
    if (sortMode === 'updated-desc' || sortMode === 'updated-asc') {
      const difference = latestTime(latestByMember.get(first.memberId) ?? null)
        - latestTime(latestByMember.get(second.memberId) ?? null);
      return sortMode === 'updated-desc' ? -difference : difference;
    }
    return first.ign.localeCompare(second.ign, 'th');
  });
}

function sortMembersByComparisonColumn(
  source: Member[],
  comparisonSort: ComparisonSort | null,
  latestByMember: Map<string, StatSubmission | null>,
): Member[] {
  if (!comparisonSort) return source;
  return [...source].sort((first, second) => {
    let difference: number;
    if (comparisonSort.key === 'ign') {
      difference = first.ign.localeCompare(second.ign, 'th');
    } else {
      const firstSubmission = latestByMember.get(first.memberId);
      const secondSubmission = latestByMember.get(second.memberId);
      const firstValue = firstSubmission
        ? getFocusStatValue(firstSubmission.stats, comparisonSort.key)
        : undefined;
      const secondValue = secondSubmission
        ? getFocusStatValue(secondSubmission.stats, comparisonSort.key)
        : undefined;
      if (firstValue === undefined && secondValue === undefined) {
        difference = first.ign.localeCompare(second.ign, 'th');
      } else if (firstValue === undefined) {
        return 1;
      } else if (secondValue === undefined) {
        return -1;
      } else {
        difference = firstValue - secondValue;
      }
    }
    return comparisonSort.direction === 'asc' ? difference : -difference;
  });
}

function comparisonCaptureDate(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function attackSummary(submission: StatSubmission): CardSummaryField {
  const key = (submission.stats.matk ?? 0) > (submission.stats.patk ?? 0)
    ? 'matk'
    : 'patk';
  return { key, label: getStatLabel(key) };
}

function criteriaDraft(config: ClassFocusStatConfig | undefined): DraftCriteria {
  return Object.fromEntries(
    (config?.criteria ?? []).map((criterion) => [
      criterion.statKey,
      { operator: criterion.operator, targetText: String(criterion.target) },
    ]),
  );
}

function parseCriterionTarget(input: string): number | null {
  const normalized = input.trim().replace(/,/g, '').replace(/%$/, '').trim();
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function StatsDashboardPage({
  members,
  isLoadingMembers,
  memberErrorMessage,
  onReloadMembers,
}: StatsDashboardPageProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [comparisonSort, setComparisonSort] = useState<ComparisonSort | null>(null);
  const [comparisonLayouts, setComparisonLayouts] = useState<Record<string, ComparisonLayout>>(() => {
    try {
      return parseComparisonLayouts(
        window.localStorage.getItem(COMPARISON_LAYOUT_STORAGE_KEY)
          ?? window.localStorage.getItem(LEGACY_COMPARISON_LAYOUT_STORAGE_KEY),
      );
    } catch {
      return {};
    }
  });
  const [isComparisonEditMode, setIsComparisonEditMode] = useState(false);
  const [isStatPickerOpen, setIsStatPickerOpen] = useState(false);
  const [statPickerSearch, setStatPickerSearch] = useState('');
  const [copyLayoutSource, setCopyLayoutSource] = useState('all');
  const [draggedStatKey, setDraggedStatKey] = useState<ComparisonStatKey | null>(null);
  const [dropTargetStatKey, setDropTargetStatKey] = useState<ComparisonStatKey | null>(null);
  const [selectedComparisonCells, setSelectedComparisonCells] = useState<Set<string>>(new Set());
  const [comparisonEvaluations, setComparisonEvaluations] = useState<ComparisonEvaluations>(() => {
    try {
      return parseComparisonEvaluations(window.localStorage.getItem(COMPARISON_EVALUATIONS_STORAGE_KEY));
    } catch {
      return {};
    }
  });
  const [isCapturingComparison, setIsCapturingComparison] = useState(false);
  const [comparisonCaptureMessage, setComparisonCaptureMessage] = useState('');
  const [onlyWithStats, setOnlyWithStats] = useState(true);
  const [latestByMember, setLatestByMember] = useState<Map<string, StatSubmission | null>>(new Map());
  const [focusConfigByClass, setFocusConfigByClass] = useState<Map<string, ClassFocusStatConfig>>(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statErrorMessage, setStatErrorMessage] = useState('');
  const [modalMember, setModalMember] = useState<Member | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [criteriaClassName, setCriteriaClassName] = useState('');
  const [isCapturingCriteria, setIsCapturingCriteria] = useState(false);
  const [criteriaCaptureMessage, setCriteriaCaptureMessage] = useState('');
  const [focusClassName, setFocusClassName] = useState('');
  const [draftFocusKeys, setDraftFocusKeys] = useState<FocusStatKey[]>([]);
  const [draftCriteria, setDraftCriteria] = useState<DraftCriteria>({});
  const [focusConfigError, setFocusConfigError] = useState('');
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const [dashboardNow] = useState(() => Date.now());
  const loadGenerationRef = useRef(0);
  const criteriaCaptureRef = useRef<HTMLDivElement>(null);
  const comparisonCaptureRef = useRef<HTMLDivElement>(null);
  const comparisonSelectionAnchorRef = useRef<ComparisonCellPosition | null>(null);
  const isSelectingComparisonCellsRef = useRef(false);

  const classOptions = useMemo(() => Array.from(new Set(
    members.map(memberClass).filter((value) => value !== 'ไม่ระบุอาชีพ'),
  )).sort((first, second) => first.localeCompare(second, 'th')), [members]);

  async function loadGuildStats(forceRefresh = false): Promise<void> {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setIsLoadingStats(true);
    setStatErrorMessage('');

    try {
      const [latestStats, focusConfigs] = await Promise.all([
        getLatestGuildStats(forceRefresh),
        getStatFocusConfig(forceRefresh),
      ]);
      console.info(
        `[Stats Dashboard] latest guild stats loaded=${latestStats.length}`,
      );
      const nextLatestByMember = new Map<string, StatSubmission>();
      latestStats.forEach((submission) => {
        nextLatestByMember.set(submission.memberId, submission);
      });
      const nextFocusConfig = new Map<string, ClassFocusStatConfig>(
        focusConfigs.map((config) => [config.className, config]),
      );

      if (loadGenerationRef.current === generation) {
        setLatestByMember(nextLatestByMember);
        setFocusConfigByClass(nextFocusConfig);
        console.info(
          `[Stats Dashboard] indexed latest stats=${nextLatestByMember.size}`,
        );
      }
    } catch (error) {
      if (loadGenerationRef.current === generation) {
        setStatErrorMessage(
          error instanceof Error ? error.message : 'โหลดข้อมูล Stat ไม่สำเร็จ',
        );
      }
    } finally {
      if (loadGenerationRef.current === generation) {
        setIsLoadingStats(false);
      }
    }
  }

  useEffect(() => {
    // Loading remote data is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGuildStats();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!modalMember && !isFocusModalOpen && !isCriteriaModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setModalMember(null);
        if (!isSavingFocus) setIsFocusModalOpen(false);
        setIsCriteriaModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCriteriaModalOpen, isFocusModalOpen, isSavingFocus, modalMember]);

  function openCriteriaReference(): void {
    setCriteriaClassName(
      selectedClass !== 'all' ? selectedClass : classOptions[0] ?? '',
    );
    setCriteriaCaptureMessage('');
    setIsCriteriaModalOpen(true);
  }

  async function captureCriteria(): Promise<void> {
    if (!criteriaCaptureRef.current) return;
    setIsCapturingCriteria(true);
    setCriteriaCaptureMessage('');
    try {
      const blob = await toBlob(criteriaCaptureRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });
      if (!blob) throw new Error('สร้างภาพไม่สำเร็จ');

      let copiedToClipboard = false;
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const pngBlob = blob.type === 'image/png'
          ? blob
          : new Blob([blob], { type: 'image/png' });
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob }),
          ]);
          copiedToClipboard = true;
        } catch {
          copiedToClipboard = false;
        }
      }

      if (copiedToClipboard) {
        setCriteriaCaptureMessage('คัดลอกภาพแล้ว');
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `ezmoo-${criteriaClassName || 'class'}-stat-criteria.png`;
        link.click();
        URL.revokeObjectURL(objectUrl);
        setCriteriaCaptureMessage('ดาวน์โหลดภาพแล้ว');
      }
    } catch (error) {
      setCriteriaCaptureMessage(
        error instanceof Error ? error.message : 'แคป Criteria ไม่สำเร็จ',
      );
    } finally {
      setIsCapturingCriteria(false);
    }
  }

  async function captureClassComparison(): Promise<void> {
    if (selectedClass === 'all') {
      setComparisonCaptureMessage('กรุณาเลือกอาชีพก่อนสร้าง Screenshot');
      return;
    }
    if (!comparisonCaptureRef.current || comparisonCaptureMembers.length === 0) {
      setComparisonCaptureMessage('ไม่พบสมาชิกในอาชีพที่เลือก');
      return;
    }

    setIsCapturingComparison(true);
    setComparisonCaptureMessage('');
    try {
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const captureElement = comparisonCaptureRef.current;
      const width = Math.ceil(captureElement.scrollWidth);
      const height = Math.ceil(captureElement.scrollHeight);
      const maxDimension = 30_000;
      if (width < 1 || height < 1 || width > maxDimension || height > maxDimension) {
        throw new Error('ตารางมีขนาดใหญ่เกินขีดจำกัดการสร้างภาพของ Browser');
      }
      const pixelRatio = Math.max(1, Math.min(
        2,
        maxDimension / width,
        maxDimension / height,
        Math.sqrt(32_000_000 / (width * height)),
      ));
      const blob = await toBlob(captureElement, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio,
        width,
        height,
      });
      if (!blob) throw new Error('Browser ไม่สามารถสร้างไฟล์ PNG ได้');

      const safeClassName = selectedClass.replace(/[^a-zA-Z0-9_-]+/g, '_');
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `EZMOO_${safeClassName}_Comparison_${comparisonCaptureDate()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setComparisonCaptureMessage(`ดาวน์โหลดภาพ ${comparisonCaptureMembers.length} คนแล้ว`);
    } catch (error) {
      setComparisonCaptureMessage(
        error instanceof Error ? `สร้าง Screenshot ไม่สำเร็จ: ${error.message}` : 'สร้าง Screenshot ไม่สำเร็จ',
      );
    } finally {
      setIsCapturingComparison(false);
    }
  }

  function openFocusConfig(): void {
    const initialClass = selectedClass !== 'all'
      ? selectedClass
      : classOptions[0] ?? '';
    setFocusClassName(initialClass);
    const config = focusConfigByClass.get(initialClass);
    setDraftFocusKeys([...(config?.statKeys ?? [])]);
    setDraftCriteria(criteriaDraft(config));
    setFocusConfigError('');
    setIsFocusModalOpen(true);
  }

  function closeFocusConfig(): void {
    if (isSavingFocus) return;
    setIsFocusModalOpen(false);
    setFocusConfigError('');
  }

  function chooseFocusClass(className: string): void {
    setFocusClassName(className);
    const config = focusConfigByClass.get(className);
    setDraftFocusKeys([...(config?.statKeys ?? [])]);
    setDraftCriteria(criteriaDraft(config));
    setFocusConfigError('');
  }

  function addFocusKey(key: FocusStatKey): void {
    if (draftFocusKeys.includes(key)) return;
    if (draftFocusKeys.length >= MAX_FOCUS_STATS) {
      setFocusConfigError(`เลือก Focus Stats ได้สูงสุด ${MAX_FOCUS_STATS} ค่า`);
      return;
    }
    setDraftFocusKeys((current) => [...current, key]);
    setFocusConfigError('');
  }

  function moveFocusKey(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draftFocusKeys.length) return;
    setDraftFocusKeys((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function removeFocusKey(key: FocusStatKey): void {
    setDraftFocusKeys((current) => current.filter((item) => item !== key));
    setDraftCriteria((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function setCriterionOperator(
    key: FocusStatKey,
    operator: 'none' | StatCriterion['operator'],
  ): void {
    setDraftCriteria((current) => {
      if (operator === 'none') {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return {
        ...current,
        [key]: {
          operator,
          targetText: current[key]?.targetText ?? '',
        },
      };
    });
    setFocusConfigError('');
  }

  async function handleSaveFocusConfig(): Promise<void> {
    if (!focusClassName || draftFocusKeys.length < 1) {
      setFocusConfigError('กรุณาเลือก Focus Stat อย่างน้อย 1 ค่า');
      return;
    }

    setIsSavingFocus(true);
    setFocusConfigError('');
    const criteria: StatCriterion[] = [];
    for (const statKey of draftFocusKeys) {
      const draft = draftCriteria[statKey];
      if (!draft) continue;
      const target = parseCriterionTarget(draft.targetText);
      if (target === null) {
        setFocusConfigError(`Target ของ ${getStatLabel(statKey)} ต้องเป็นตัวเลข`);
        setIsSavingFocus(false);
        return;
      }
      criteria.push({ statKey, operator: draft.operator, target });
    }

    const config: ClassFocusStatConfig = {
      className: focusClassName,
      statKeys: [...draftFocusKeys],
      criteria,
    };
    try {
      await saveStatFocusConfig(config);
      setFocusConfigByClass((current) => {
        const next = new Map(current);
        next.set(config.className, config);
        return next;
      });
      setIsFocusModalOpen(false);
    } catch (error) {
      setFocusConfigError(
        error instanceof Error ? error.message : 'บันทึก Focus Stats ไม่สำเร็จ',
      );
    } finally {
      setIsSavingFocus(false);
    }
  }

  const filteredMembers = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    const result = members.filter((member) => {
      const submission = latestByMember.get(member.memberId);
      return (!query || member.ign.toLocaleLowerCase().includes(query))
        && (selectedClass === 'all' || memberClass(member) === selectedClass)
        && (!onlyWithStats || Boolean(submission));
    });

    return sortMembersByToolbar(result, sortMode, latestByMember);
  }, [latestByMember, members, onlyWithStats, searchText, selectedClass, sortMode]);

  const comparisonMembers = useMemo(() => (
    sortMembersByComparisonColumn(filteredMembers, comparisonSort, latestByMember)
  ), [comparisonSort, filteredMembers, latestByMember]);

  const comparisonCaptureMembers = (() => {
    if (selectedClass === 'all') return [];
    const classMembers = members.filter((member) => memberClass(member) === selectedClass);
    const toolbarSorted = sortMembersByToolbar(classMembers, sortMode, latestByMember);
    return sortMembersByComparisonColumn(toolbarSorted, comparisonSort, latestByMember);
  })();

  const comparisonLayoutKey = getComparisonLayoutKey(selectedClass);
  const comparisonLayout = comparisonLayouts[comparisonLayoutKey]
    ?? getDefaultComparisonLayout(selectedClass);
  const comparisonColumns = comparisonLayout.statKeys;
  const normalizedStatSearch = statPickerSearch.trim().toLocaleLowerCase();
  const visibleStatGroups = COMPARISON_STAT_GROUPS.map((group) => ({
    ...group,
    stats: group.stats.filter(({ label }) => !normalizedStatSearch || label.toLocaleLowerCase().includes(normalizedStatSearch)),
  })).filter((group) => group.stats.length > 0);

  function persistComparisonLayouts(layouts: Record<string, ComparisonLayout>): void {
    try {
      window.localStorage.setItem(COMPARISON_LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
    } catch {
      // The layout remains usable for this session when storage is unavailable.
    }
  }

  function saveComparisonLayout(layout: ComparisonLayout): void {
    const nextLayouts = { ...comparisonLayouts, [comparisonLayoutKey]: layout };
    setComparisonLayouts(nextLayouts);
    persistComparisonLayouts(nextLayouts);
  }

  function addComparisonColumn(key: ComparisonStatKey): void {
    if (comparisonColumns.includes(key)) return;
    saveComparisonLayout({ ...comparisonLayout, statKeys: [...comparisonColumns, key] });
  }

  function removeComparisonColumn(key: ComparisonStatKey): void {
    if (comparisonColumns.length === 1) return;
    saveComparisonLayout({ statKeys: comparisonColumns.filter((columnKey) => columnKey !== key) });
    if (comparisonSort?.key === key) setComparisonSort(null);
  }

  function resetComparisonColumns(): void {
    const nextLayouts = { ...comparisonLayouts };
    delete nextLayouts[comparisonLayoutKey];
    setComparisonLayouts(nextLayouts);
    persistComparisonLayouts(nextLayouts);
    setComparisonSort(null);
  }

  function copyComparisonLayout(): void {
    const sourceKey = getComparisonLayoutKey(copyLayoutSource);
    const sourceLayout = comparisonLayouts[sourceKey] ?? getDefaultComparisonLayout(copyLayoutSource);
    saveComparisonLayout({ statKeys: [...sourceLayout.statKeys] });
    setComparisonSort(null);
  }

  function reorderComparisonColumn(targetKey: ComparisonStatKey): void {
    if (!draggedStatKey || draggedStatKey === targetKey) return;
    const nextColumns = [...comparisonColumns];
    const sourceIndex = nextColumns.indexOf(draggedStatKey);
    const targetIndex = nextColumns.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    nextColumns.splice(sourceIndex, 1);
    nextColumns.splice(targetIndex, 0, draggedStatKey);
    saveComparisonLayout({ ...comparisonLayout, statKeys: nextColumns });
  }

  function comparisonCellId(memberId: string, statKey: ComparisonStatKey): string {
    return JSON.stringify([memberId, statKey]);
  }

  function selectComparisonRange(anchor: ComparisonCellPosition, target: ComparisonCellPosition): void {
    const rowStart = Math.min(anchor.row, target.row);
    const rowEnd = Math.max(anchor.row, target.row);
    const columnStart = Math.min(anchor.column, target.column);
    const columnEnd = Math.max(anchor.column, target.column);
    const selected = new Set<string>();
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let column = columnStart; column <= columnEnd; column += 1) {
        const member = comparisonMembers[row];
        const statKey = comparisonColumns[column];
        if (member && statKey) selected.add(comparisonCellId(member.memberId, statKey));
      }
    }
    setSelectedComparisonCells(selected);
  }

  const visibleComparisonCellIds = new Set(
    comparisonMembers.flatMap((member) => comparisonColumns.map((key) => comparisonCellId(member.memberId, key))),
  );
  const visibleSelectedComparisonCells = [...selectedComparisonCells].filter((id) => visibleComparisonCellIds.has(id));

  function persistComparisonEvaluations(evaluations: ComparisonEvaluations): void {
    try {
      window.localStorage.setItem(COMPARISON_EVALUATIONS_STORAGE_KEY, JSON.stringify(evaluations));
    } catch {
      // Manual evaluations remain usable for this session when storage is unavailable.
    }
  }

  const applyComparisonStatus = useCallback((status: ComparisonCellStatus | null): void => {
    if (visibleSelectedComparisonCells.length === 0) return;
    const nextEvaluations: ComparisonEvaluations = { ...comparisonEvaluations };
    visibleSelectedComparisonCells.forEach((id) => {
      const [memberId, statKey] = JSON.parse(id) as [string, ComparisonStatKey];
      const memberEvaluation = { ...nextEvaluations[memberId] };
      if (status) memberEvaluation[statKey] = status;
      else delete memberEvaluation[statKey];
      if (Object.keys(memberEvaluation).length > 0) nextEvaluations[memberId] = memberEvaluation;
      else delete nextEvaluations[memberId];
    });
    setComparisonEvaluations(nextEvaluations);
    persistComparisonEvaluations(nextEvaluations);
  }, [comparisonEvaluations, visibleSelectedComparisonCells]);

  function setComparisonSortKey(key: ComparisonSort['key']): void {
    setComparisonSort((current) => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  function comparisonSortIndicator(key: ComparisonSort['key']): string {
    if (comparisonSort?.key !== key) return '';
    return comparisonSort.direction === 'asc' ? ' ↑' : ' ↓';
  }

  useEffect(() => {
    function stopSelecting(): void {
      isSelectingComparisonCellsRef.current = false;
    }
    window.addEventListener('mouseup', stopSelecting);
    return () => window.removeEventListener('mouseup', stopSelecting);
  }, []);

  useEffect(() => {
    function handleComparisonShortcut(event: KeyboardEvent): void {
      if (viewMode !== 'comparison' || visibleSelectedComparisonCells.length === 0) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const key = event.key.toLocaleLowerCase();
      const status = key === 'g' ? 'green' : key === 'y' ? 'yellow' : key === 'r' ? 'red' : null;
      if (status) {
        event.preventDefault();
        applyComparisonStatus(status);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        applyComparisonStatus(null);
      }
    }
    window.addEventListener('keydown', handleComparisonShortcut);
    return () => window.removeEventListener('keydown', handleComparisonShortcut);
  }, [applyComparisonStatus, viewMode, visibleSelectedComparisonCells.length]);

  const submissions = Array.from(latestByMember.values()).filter(
    (submission): submission is StatSubmission => Boolean(submission),
  );
  const staleCount = submissions.filter(
    (submission) => dashboardNow - latestTime(submission) > STALE_AFTER_MS,
  ).length;
  const modalSubmission = modalMember
    ? latestByMember.get(modalMember.memberId) ?? null
    : null;
  const loadingDashboard = isLoadingMembers || isLoadingStats;
  const criteriaReferenceConfig = focusConfigByClass.get(criteriaClassName);
  const criteriaReferenceRows = (criteriaReferenceConfig?.criteria ?? [])
    .filter((criterion) => criteriaReferenceConfig?.statKeys.includes(criterion.statKey))
    .sort((first, second) => (
      (criteriaReferenceConfig?.statKeys.indexOf(first.statKey) ?? 0)
      - (criteriaReferenceConfig?.statKeys.indexOf(second.statKey) ?? 0)
    ));

  return (
    <main className="stats-dashboard-page">
      <header className="stats-dashboard-heading">
        <div><h2>Stat Dashboard</h2><p>ดู Character Stat ล่าสุดของสมาชิกในกิล</p></div>
        <div className="stats-heading-actions">
          <button type="button" onClick={openCriteriaReference}>ดู Criteria</button>
          <button type="button" onClick={openFocusConfig}>⚙ ตั้งค่า Focus Stats</button>
        </div>
      </header>

      <section className="stats-summary-grid">
        {[
          ['สมาชิกทั้งหมด', members.length],
          ['มีข้อมูล Stat', submissions.length],
          ['ยังไม่มีข้อมูล Stat', members.length - submissions.length],
          ['อัปเดตเกิน 7 วัน', staleCount],
        ].map(([label, value]) => (
          <div key={label} className="stats-summary-card">
            <span>{label}</span><strong>{loadingDashboard ? '—' : value}</strong>
          </div>
        ))}
      </section>

      <section className="stats-dashboard-toolbar">
        <input type="search" value={searchText} placeholder="ค้นหา IGN..." onChange={(event) => setSearchText(event.target.value)} />
        <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
          <option value="all">ทุกอาชีพ</option>
          {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
        <select value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setComparisonSort(null); }}>
          <option value="name-asc">A–Z</option><option value="name-desc">Z–A</option>
          <option value="updated-desc">อัปเดตล่าสุด</option><option value="updated-asc">อัปเดตเก่าสุด</option>
        </select>
        <label className="stats-only-toggle">
          <input type="checkbox" checked={onlyWithStats} onChange={(event) => setOnlyWithStats(event.target.checked)} />
          เฉพาะคนที่มี Stat
        </label>
      </section>

      <div className="stats-view-toggle" role="group" aria-label="รูปแบบการแสดงผล">
        <button type="button" className={viewMode === 'card' ? 'active' : ''} aria-pressed={viewMode === 'card'} onClick={() => { setViewMode('card'); setIsComparisonEditMode(false); setIsStatPickerOpen(false); }}>Card View</button>
        <button type="button" className={viewMode === 'comparison' ? 'active' : ''} aria-pressed={viewMode === 'comparison'} onClick={() => setViewMode('comparison')}>Comparison View</button>
      </div>

      {viewMode === 'comparison' && (
        <div className="comparison-customize-area">
          <button type="button" className={`comparison-customize-trigger${isComparisonEditMode ? ' active' : ''}`} aria-pressed={isComparisonEditMode} onClick={() => { setIsComparisonEditMode((editing) => !editing); setIsStatPickerOpen(false); }}>✎ {isComparisonEditMode ? 'เสร็จสิ้น' : 'จัดตาราง'}</button>
          <span>Layout: {selectedClass === 'all' ? 'ทุกอาชีพ' : selectedClass} · {comparisonColumns.length} columns</span>
          {selectedClass !== 'all' && (
            <button type="button" className="comparison-screenshot-button" disabled={loadingDashboard || isCapturingComparison || comparisonCaptureMembers.length === 0} onClick={() => void captureClassComparison()}>
              {isCapturingComparison ? 'กำลังสร้าง PNG...' : `📷 Screenshot ${selectedClass}`}
            </button>
          )}
          {isComparisonEditMode && (
            <div className="comparison-edit-actions">
              <button type="button" onClick={() => setIsStatPickerOpen((open) => !open)}>+ เพิ่ม Stat</button>
              <select aria-label="คัดลอก Layout จาก" value={copyLayoutSource} onChange={(event) => setCopyLayoutSource(event.target.value)}>
                <option value="all">ทุกอาชีพ</option>
                {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
              <button type="button" onClick={copyComparisonLayout}>คัดลอก Layout</button>
              <button type="button" onClick={resetComparisonColumns}>คืนค่าเริ่มต้น</button>
            </div>
          )}
          {isComparisonEditMode && isStatPickerOpen && (
            <section className="comparison-stat-picker" aria-label="เพิ่ม Stat ใน Comparison View">
              <header><div><h3>เพิ่ม Stat</h3><p>เลือกเพิ่มได้หลายรายการโดยไม่ปิดหน้าต่าง</p></div><button type="button" aria-label="ปิด" onClick={() => setIsStatPickerOpen(false)}>×</button></header>
              <input type="search" value={statPickerSearch} placeholder="ค้นหา เช่น PDMG..." onChange={(event) => setStatPickerSearch(event.target.value)} autoFocus />
              <div className="comparison-stat-groups">
                {visibleStatGroups.map((group) => (
                  <section key={group.title}><h4>{group.title}</h4><div>{group.stats.map(({ key, label }) => {
                    const added = comparisonColumns.includes(key);
                    return <button type="button" key={key} className={added ? 'added' : ''} disabled={added} onClick={() => addComparisonColumn(key)}>{added ? '✓ ' : '+ '}{label}</button>;
                  })}</div></section>
                ))}
                {visibleStatGroups.length === 0 && <p className="comparison-picker-empty">ไม่พบ Stat ที่ค้นหา</p>}
              </div>
            </section>
          )}
          {comparisonCaptureMessage && <span className="comparison-capture-message" role="status">{comparisonCaptureMessage}</span>}
        </div>
      )}

      {viewMode === 'comparison' && visibleSelectedComparisonCells.length > 0 && (
        <div className="comparison-status-toolbar" role="toolbar" aria-label="กำหนดสถานะ Cell">
          <strong>{visibleSelectedComparisonCells.length} cells</strong>
          <button type="button" className="status-green" title="Shortcut: G" onClick={() => applyComparisonStatus('green')}>● ผ่าน</button>
          <button type="button" className="status-yellow" title="Shortcut: Y" onClick={() => applyComparisonStatus('yellow')}>● กลาง</button>
          <button type="button" className="status-red" title="Shortcut: R" onClick={() => applyComparisonStatus('red')}>● ไม่ผ่าน</button>
          <button type="button" title="Shortcut: Delete / Backspace" onClick={() => applyComparisonStatus(null)}>○ ล้างสี</button>
        </div>
      )}

      {memberErrorMessage && (
        <section className="stats-dashboard-error"><span>{memberErrorMessage}</span><button type="button" onClick={() => void onReloadMembers()}>ลองใหม่</button></section>
      )}
      {statErrorMessage && (
        <section className="stats-dashboard-error"><span>{statErrorMessage}</span><button type="button" onClick={() => void loadGuildStats(true)}>ลองใหม่</button></section>
      )}

      {loadingDashboard ? (
        <section className="stats-card-grid" aria-label="กำลังโหลดข้อมูล Stat">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="member-stat-card stats-card-skeleton" />)}
        </section>
      ) : filteredMembers.length === 0 ? (
        <section className="stats-dashboard-empty">
          {submissions.length === 0 && onlyWithStats ? 'ยังไม่มีสมาชิกส่งข้อมูล Stat' : 'ไม่พบสมาชิกตามตัวกรอง'}
        </section>
      ) : viewMode === 'comparison' ? (
        <section className="stats-comparison-shell" aria-label="ตารางเปรียบเทียบ Stat สมาชิก">
          <table className="stats-comparison-table">
            <thead>
              <tr>
                <th className="comparison-ign-column" aria-sort={comparisonSort?.key === 'ign' ? (comparisonSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => setComparisonSortKey('ign')}>IGN{comparisonSortIndicator('ign')}</button>
                </th>
                <th className="comparison-class-column">Class</th>
                {comparisonColumns.map((key) => (
                  <th
                    key={key}
                    className={`${draggedStatKey === key ? 'column-dragging ' : ''}${dropTargetStatKey === key && draggedStatKey !== key ? 'column-drop-target' : ''}`.trim() || undefined}
                    aria-sort={comparisonSort?.key === key ? (comparisonSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onDragOver={(event) => { event.preventDefault(); setDropTargetStatKey(key); }}
                    onDrop={(event) => { event.preventDefault(); reorderComparisonColumn(key); setDraggedStatKey(null); setDropTargetStatKey(null); }}
                  >
                    {isComparisonEditMode && <span className="comparison-drag-handle" draggable role="button" tabIndex={0} aria-label={`ลากเพื่อจัดลำดับ ${getStatLabel(key)}`} title="ลากเพื่อจัดลำดับ" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); setDraggedStatKey(key); }} onDragEnd={() => { setDraggedStatKey(null); setDropTargetStatKey(null); }}>⋮⋮</span>}
                    <button type="button" onClick={() => setComparisonSortKey(key)}>{getStatLabel(key)}{comparisonSortIndicator(key)}</button>
                    {isComparisonEditMode && <span className="comparison-header-actions"><button type="button" aria-label={`นำ ${getStatLabel(key)} ออก`} title="นำออก" disabled={comparisonColumns.length === 1} onClick={() => removeComparisonColumn(key)}>×</button></span>}
                  </th>
                ))}
                <th className="comparison-action-column" aria-label="ดูรายละเอียด" />
              </tr>
            </thead>
            <tbody>
              {comparisonMembers.map((member, rowIndex) => {
                const submission = latestByMember.get(member.memberId) ?? null;
                const memberClassName = memberClass(member);
                const rowStyle = { '--member-class-color': getClassColor(memberClassName) } as CSSProperties;
                return (
                  <tr key={member.memberId} style={rowStyle}>
                    <th className="comparison-ign-column" scope="row">
                      {submission
                        ? <button type="button" className="comparison-ign-button" onClick={() => setModalMember(member)}>{member.ign}</button>
                        : member.ign}
                    </th>
                    <td className="comparison-class-column"><span className="stats-class-badge">{memberClassName}</span></td>
                    {comparisonColumns.map((key, columnIndex) => {
                      const cellId = comparisonCellId(member.memberId, key);
                      const status = comparisonEvaluations[member.memberId]?.[key];
                      const selected = selectedComparisonCells.has(cellId);
                      const position = { row: rowIndex, column: columnIndex };
                      return (
                        <td
                          key={key}
                          className={`comparison-stat-value comparison-selectable-cell${status ? ` status-${status}` : ''}${selected ? ' selected' : ''}`}
                          title={status ? `${status === 'green' ? 'ผ่าน' : status === 'yellow' ? 'กลาง / ควรดู' : 'ไม่ผ่าน / ต้องแก้'} (Manual)` : 'คลิกหรือลากเพื่อเลือก Cell'}
                          aria-selected={selected}
                          onMouseDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            if (event.shiftKey && comparisonSelectionAnchorRef.current) {
                              selectComparisonRange(comparisonSelectionAnchorRef.current, position);
                              return;
                            }
                            comparisonSelectionAnchorRef.current = position;
                            isSelectingComparisonCellsRef.current = true;
                            setSelectedComparisonCells(new Set([cellId]));
                          }}
                          onMouseEnter={() => {
                            if (isSelectingComparisonCellsRef.current && comparisonSelectionAnchorRef.current) selectComparisonRange(comparisonSelectionAnchorRef.current, position);
                          }}
                          onMouseUp={() => { isSelectingComparisonCellsRef.current = false; }}
                        >{submission ? formatFocusStatValue(submission.stats, key) : '—'}</td>
                      );
                    })}
                    <td className="comparison-action-column">
                      {submission && <button type="button" aria-label={`ดูรายละเอียดของ ${member.ign}`} title="ดูรายละเอียด" onClick={() => setModalMember(member)}>›</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="stats-card-grid">
          {filteredMembers.map((member) => {
            const submission = latestByMember.get(member.memberId) ?? null;
            const memberClassName = memberClass(member);
            const focusConfig = focusConfigByClass.get(memberClassName);
            const cardStyle = {
              '--member-class-color': getClassColor(memberClassName),
            } as CSSProperties;
            const summaryFields = submission && focusConfig
              ? focusConfig.statKeys.map((key) => ({ key, label: getStatLabel(key) }))
              : submission
                ? [
                    { key: CARD_SUMMARY_KEYS[0], label: getStatLabel(CARD_SUMMARY_KEYS[0]) },
                    attackSummary(submission),
                    ...CARD_SUMMARY_KEYS.slice(1).map((key) => ({ key, label: getStatLabel(key) })),
                  ]
                : [];
            const criterionByKey = new Map(
              (focusConfig?.criteria ?? []).map((criterion) => [criterion.statKey, criterion]),
            );
            const evaluatedCriteria = submission
              ? summaryFields.flatMap((field) => {
                  const criterion = criterionByKey.get(field.key);
                  const actual = getFocusStatValue(submission.stats, field.key);
                  if (!criterion || actual === undefined) return [];
                  const met = criterion.operator === 'gte'
                    ? actual >= criterion.target
                    : actual <= criterion.target;
                  return [{ ...criterion, met }];
                })
              : [];
            const metCriteriaCount = evaluatedCriteria.filter((criterion) => criterion.met).length;
            return (
              <article
                key={member.memberId}
                className={`member-stat-card${submission ? '' : ' muted'}`}
                style={cardStyle}
                role={submission ? 'button' : undefined}
                tabIndex={submission ? 0 : undefined}
                onClick={() => submission && setModalMember(member)}
                onKeyDown={(event) => {
                  if (submission && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setModalMember(member);
                  }
                }}
              >
                <header><div><h3>{member.ign}</h3><span className="stats-class-badge">{memberClassName}</span></div>{submission && <time>{formatSubmittedAt(submission.submittedAt)}</time>}</header>
                {submission ? (
                  <>
                    <div className="member-stat-summary">
                      {summaryFields.map((field) => {
                        const criterion = criterionByKey.get(field.key);
                        const actual = getFocusStatValue(submission.stats, field.key);
                        const met = criterion && actual !== undefined
                          ? criterion.operator === 'gte'
                            ? actual >= criterion.target
                            : actual <= criterion.target
                          : null;
                        return (
                          <div key={field.key}>
                            <span>{field.label}</span>
                            <strong className={actual === undefined ? 'criterion-undefined' : met === true ? 'criterion-met' : met === false ? 'criterion-below' : ''}>
                              {formatFocusStatValue(submission.stats, field.key)}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                    {evaluatedCriteria.length > 0 && (
                      <div className="member-criteria-summary">
                        ถึงเป้า {metCriteriaCount}/{evaluatedCriteria.length}
                      </div>
                    )}
                    <button type="button" onClick={() => setModalMember(member)}>ดูรายละเอียด</button>
                  </>
                ) : <div className="member-stat-missing">ยังไม่มีข้อมูล Stat</div>}
              </article>
            );
          })}
        </section>
      )}

      {viewMode === 'comparison' && selectedClass !== 'all' && comparisonCaptureMembers.length > 0 && (
        <div className="comparison-capture-offscreen" aria-hidden="true">
          <section
            ref={comparisonCaptureRef}
            className="comparison-capture-card"
            style={{ '--capture-class-color': getClassColor(selectedClass) } as CSSProperties}
          >
            <header className="comparison-capture-header">
              <div><span>EZMOO Guild</span><h2>{selectedClass} Comparison</h2></div>
              <dl>
                <div><dt>รอบข้อมูล</dt><dd>Latest Stat</dd></div>
                <div><dt>สมาชิก</dt><dd>{comparisonCaptureMembers.length} คน</dd></div>
                <div><dt>วันที่สร้าง</dt><dd>{comparisonCaptureDate()}</dd></div>
              </dl>
            </header>
            <table className="stats-comparison-table comparison-capture-table">
              <thead><tr>
                <th className="comparison-ign-column">IGN{comparisonSortIndicator('ign')}</th>
                <th className="comparison-class-column">Class</th>
                {comparisonColumns.map((key) => <th key={key}>{getStatLabel(key)}{comparisonSortIndicator(key)}</th>)}
              </tr></thead>
              <tbody>
                {comparisonCaptureMembers.map((member) => {
                  const submission = latestByMember.get(member.memberId) ?? null;
                  const className = memberClass(member);
                  return (
                    <tr key={member.memberId} style={{ '--member-class-color': getClassColor(className) } as CSSProperties}>
                      <th className="comparison-ign-column" scope="row">{member.ign}</th>
                      <td className="comparison-class-column"><span className="stats-class-badge">{className}</span></td>
                      {comparisonColumns.map((key) => {
                        const status = comparisonEvaluations[member.memberId]?.[key];
                        return <td key={key} className={`comparison-stat-value${status ? ` status-${status}` : ''}`}>{submission ? formatFocusStatValue(submission.stats, key) : '—'}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {modalMember && modalSubmission && (
        <div className="stat-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalMember(null); }}>
          <section className="stat-detail-modal" role="dialog" aria-modal="true" aria-labelledby="stat-modal-title">
            <header className="latest-stat-header">
              <div><span className="latest-stat-eyebrow">Latest Stat</span><h3 id="stat-modal-title">{modalMember.ign}</h3><span className="latest-stat-class">{memberClass(modalMember)}</span></div>
              <dl>
                <div><dt>อัปเดตล่าสุด</dt><dd>{formatSubmittedAt(modalSubmission.submittedAt)}</dd></div>
                {modalSubmission.submittedByDiscordName && <div><dt>Submitted by</dt><dd>{modalSubmission.submittedByDiscordName}</dd></div>}
              </dl>
              <button className="stat-modal-close" type="button" aria-label="ปิด" onClick={() => setModalMember(null)}>×</button>
            </header>
            <StatDetailContent stats={modalSubmission.stats} />
          </section>
        </div>
      )}

      {isFocusModalOpen && (
        <div className="stat-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeFocusConfig(); }}>
          <section className="focus-config-modal" role="dialog" aria-modal="true" aria-labelledby="focus-config-title">
            <header>
              <div><h3 id="focus-config-title">ตั้งค่า Focus Stats</h3><p>เลือกค่า 1–{MAX_FOCUS_STATS} รายการสำหรับแสดงบนการ์ดของแต่ละอาชีพ</p></div>
              <button type="button" aria-label="ปิด" onClick={closeFocusConfig}>×</button>
            </header>
            <label className="focus-class-select">
              <span>เลือกอาชีพ</span>
              <select value={focusClassName} onChange={(event) => chooseFocusClass(event.target.value)}>
                {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
            </label>
            <div className="focus-config-layout">
              <section>
                <h4>Stats ทั้งหมด</h4>
                <div className="focus-stat-options">
                  {STAT_OPTIONS.map(({ key, label }) => {
                    const selected = draftFocusKeys.includes(key);
                    return <button type="button" key={key} className={selected ? 'selected' : ''} disabled={selected} onClick={() => addFocusKey(key)}>{label}</button>;
                  })}
                </div>
              </section>
              <section>
                <h4>เลือกแล้ว {draftFocusKeys.length} / {MAX_FOCUS_STATS}</h4>
                <ol className="selected-focus-stats">
                  {draftFocusKeys.map((key, index) => (
                    <li key={key}>
                      <div className="selected-focus-main">
                        <span>{getStatLabel(key)}</span>
                        <div>
                          <button type="button" aria-label="เลื่อนขึ้น" disabled={index === 0} onClick={() => moveFocusKey(index, -1)}>↑</button>
                          <button type="button" aria-label="เลื่อนลง" disabled={index === draftFocusKeys.length - 1} onClick={() => moveFocusKey(index, 1)}>↓</button>
                          <button type="button" aria-label="นำออก" onClick={() => removeFocusKey(key)}>×</button>
                        </div>
                      </div>
                      <div className="focus-criterion-controls">
                        <select
                          aria-label={`Criteria ของ ${getStatLabel(key)}`}
                          value={draftCriteria[key]?.operator ?? 'none'}
                          onChange={(event) => setCriterionOperator(key, event.target.value as 'none' | StatCriterion['operator'])}
                        >
                          <option value="none">ไม่กำหนด</option>
                          <option value="gte">≥</option>
                          <option value="lte">≤</option>
                        </select>
                        {draftCriteria[key] && (
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Target ของ ${getStatLabel(key)}`}
                            placeholder="Target"
                            value={draftCriteria[key]?.targetText ?? ''}
                            onChange={(event) => setDraftCriteria((current) => ({
                              ...current,
                              [key]: {
                                operator: current[key]?.operator ?? 'gte',
                                targetText: event.target.value,
                              },
                            }))}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            {focusConfigError && <div className="focus-config-error">{focusConfigError}</div>}
            <footer>
              <button type="button" disabled={isSavingFocus} onClick={closeFocusConfig}>ยกเลิก</button>
              <button type="button" disabled={isSavingFocus || draftFocusKeys.length < 1} onClick={() => void handleSaveFocusConfig()}>{isSavingFocus ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </footer>
          </section>
        </div>
      )}

      {isCriteriaModalOpen && (
        <div className="stat-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCriteriaModalOpen(false); }}>
          <section className="criteria-reference-modal" role="dialog" aria-modal="true" aria-labelledby="criteria-reference-title">
            <header>
              <div><h3 id="criteria-reference-title">Stat Criteria</h3><p>ดูเป้าหมายตามอาชีพสำหรับแชร์ใน Discord</p></div>
              <button type="button" aria-label="ปิด" onClick={() => setIsCriteriaModalOpen(false)}>×</button>
            </header>
            <div className="criteria-reference-controls">
              <select value={criteriaClassName} onChange={(event) => { setCriteriaClassName(event.target.value); setCriteriaCaptureMessage(''); }}>
                {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
              <button type="button" disabled={isCapturingCriteria || criteriaReferenceRows.length === 0} onClick={() => void captureCriteria()}>
                {isCapturingCriteria ? 'กำลังแคป...' : 'แคป Criteria'}
              </button>
            </div>
            {criteriaCaptureMessage && <div className="criteria-capture-message">{criteriaCaptureMessage}</div>}
            <div ref={criteriaCaptureRef} className="criteria-capture-panel">
              <header><span>EZMOO</span><h2>{criteriaClassName} Stat Criteria</h2></header>
              {criteriaReferenceRows.length > 0 ? (
                <table>
                  <thead><tr><th>Stat</th><th>Target</th></tr></thead>
                  <tbody>
                    {criteriaReferenceRows.map((criterion) => (
                      <tr key={criterion.statKey}>
                        <td>{getStatLabel(criterion.statKey)}</td>
                        <td>{criterion.operator === 'gte' ? '≥' : '≤'} {formatFocusStatTarget(criterion.statKey, criterion.target)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="criteria-reference-empty">ยังไม่มี Criteria สำหรับอาชีพนี้</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
