import { useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
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

  const classOptions = useMemo(() => Array.from(new Set(
    members.map(memberClass).filter((value) => value !== 'ไม่ระบุอาชีพ'),
  )).sort((first, second) => first.localeCompare(second, 'th')), [members]);

  async function loadGuildStats(): Promise<void> {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    console.info(`[Stats Dashboard] members loaded=${members.length}`);

    if (members.length === 0) {
      setLatestByMember(new Map());
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);
    setStatErrorMessage('');

    try {
      const [latestStats, focusConfigs] = await Promise.all([
        getLatestGuildStats(),
        getStatFocusConfig(),
      ]);
      console.info(
        `[Stats Dashboard] latest guild stats loaded=${latestStats.length}`,
      );
      const memberIds = new Set(members.map((member) => member.memberId));
      const nextLatestByMember = new Map<string, StatSubmission>();
      latestStats.forEach((submission) => {
        if (memberIds.has(submission.memberId)) {
          nextLatestByMember.set(submission.memberId, submission);
        }
      });
      const nextFocusConfig = new Map<string, ClassFocusStatConfig>(
        focusConfigs.map((config) => [config.className, config]),
      );

      if (loadGenerationRef.current === generation) {
        setLatestByMember(nextLatestByMember);
        setFocusConfigByClass(nextFocusConfig);
        console.info(
          `[Stats Dashboard] merge done withStats=${nextLatestByMember.size} withoutStats=${members.length - nextLatestByMember.size}`,
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
    if (!isLoadingMembers && !memberErrorMessage) void loadGuildStats();
    return () => {
      loadGenerationRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, isLoadingMembers, memberErrorMessage]);

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

    return result.sort((first, second) => {
      if (sortMode === 'name-desc') return second.ign.localeCompare(first.ign, 'th');
      if (sortMode === 'updated-desc' || sortMode === 'updated-asc') {
        const difference = latestTime(latestByMember.get(first.memberId) ?? null)
          - latestTime(latestByMember.get(second.memberId) ?? null);
        return sortMode === 'updated-desc' ? -difference : difference;
      }
      return first.ign.localeCompare(second.ign, 'th');
    });
  }, [latestByMember, members, onlyWithStats, searchText, selectedClass, sortMode]);

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
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="name-asc">A–Z</option><option value="name-desc">Z–A</option>
          <option value="updated-desc">อัปเดตล่าสุด</option><option value="updated-asc">อัปเดตเก่าสุด</option>
        </select>
        <label className="stats-only-toggle">
          <input type="checkbox" checked={onlyWithStats} onChange={(event) => setOnlyWithStats(event.target.checked)} />
          เฉพาะคนที่มี Stat
        </label>
      </section>

      {memberErrorMessage && (
        <section className="stats-dashboard-error"><span>{memberErrorMessage}</span><button type="button" onClick={() => void onReloadMembers()}>ลองใหม่</button></section>
      )}
      {statErrorMessage && (
        <section className="stats-dashboard-error"><span>{statErrorMessage}</span><button type="button" onClick={() => void loadGuildStats()}>ลองใหม่</button></section>
      )}

      {loadingDashboard ? (
        <section className="stats-card-grid" aria-label="กำลังโหลดข้อมูล Stat">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="member-stat-card stats-card-skeleton" />)}
        </section>
      ) : filteredMembers.length === 0 ? (
        <section className="stats-dashboard-empty">
          {submissions.length === 0 && onlyWithStats ? 'ยังไม่มีสมาชิกส่งข้อมูล Stat' : 'ไม่พบสมาชิกตามตัวกรอง'}
        </section>
      ) : (
        <section className="stats-card-grid">
          {filteredMembers.map((member) => {
            const submission = latestByMember.get(member.memberId) ?? null;
            const focusConfig = focusConfigByClass.get(memberClass(member));
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
                <header><div><h3>{member.ign}</h3><span className="stats-class-badge">{memberClass(member)}</span></div>{submission && <time>{formatSubmittedAt(submission.submittedAt)}</time>}</header>
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
