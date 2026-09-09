import { useEffect, useMemo, useRef, useState } from 'react';
import { getLatestMemberStats } from '../../services/googleApi';
import type { CharacterStatKey, StatSubmission } from '../../types/characterStats';
import type { Member } from '../../types/member';
import { StatDetailContent } from './StatDetailContent';
import { formatStatValue } from './statDisplay';

interface StatsDashboardPageProps {
  members: Member[];
  isLoadingMembers: boolean;
  memberErrorMessage: string;
  onReloadMembers: () => Promise<void>;
}

type SortMode = 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc';
interface CardSummaryField { key: CharacterStatKey; label: string }

const REQUEST_CONCURRENCY = 4;
const MEMBER_REQUEST_TIMEOUT_MS = 15_000;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const CARD_SUMMARY_FIELDS: readonly CardSummaryField[] = [
  { key: 'hp', label: 'HP' },
  { key: 'pvpDmgBonus', label: 'PvP DMG Bonus' },
  { key: 'pvpDmgReduction', label: 'PvP DMG Red' },
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
  return (submission.stats.matk ?? 0) > (submission.stats.patk ?? 0)
    ? { key: 'matk', label: 'MATK' }
    : { key: 'patk', label: 'PATK' };
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
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statErrorMessage, setStatErrorMessage] = useState('');
  const [modalMember, setModalMember] = useState<Member | null>(null);
  const [dashboardNow] = useState(() => Date.now());
  const cacheRef = useRef(new Map<string, StatSubmission | null>());
  const pendingRef = useRef(new Map<string, Promise<StatSubmission | null>>());
  const loadGenerationRef = useRef(0);

  const classOptions = useMemo(() => Array.from(new Set(
    members.map(memberClass).filter((value) => value !== 'ไม่ระบุอาชีพ'),
  )).sort((first, second) => first.localeCompare(second, 'th')), [members]);

  async function getCachedLatest(memberId: string): Promise<StatSubmission | null> {
    if (cacheRef.current.has(memberId)) return cacheRef.current.get(memberId) ?? null;
    const existingRequest = pendingRef.current.get(memberId);
    if (existingRequest) return existingRequest;

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      MEMBER_REQUEST_TIMEOUT_MS,
    );
    const request = getLatestMemberStats(memberId, controller.signal)
      .then((submission) => {
        cacheRef.current.set(memberId, submission);
        return submission;
      })
      .finally(() => {
        window.clearTimeout(timeout);
        pendingRef.current.delete(memberId);
      });
    pendingRef.current.set(memberId, request);
    return request;
  }

  async function loadGuildStats(): Promise<void> {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    console.info(`[Stats Dashboard] members loaded: ${members.length}`);

    if (members.length === 0) {
      setLatestByMember(new Map());
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);
    setStatErrorMessage('');
    let nextIndex = 0;
    let failureCount = 0;
    let successCount = 0;
    let noStatCount = 0;
    console.info(
      `[Stats Dashboard] load latest stats START members=${members.length}`,
    );

    async function worker(): Promise<void> {
      while (nextIndex < members.length) {
        const member = members[nextIndex];
        nextIndex += 1;
        console.info(
          `[Stats Dashboard] worker request START ${member.memberId}`,
        );
        try {
          const submission = await getCachedLatest(member.memberId);
          if (submission) successCount += 1;
          else noStatCount += 1;
          console.info(
            `[Stats Dashboard] worker request DONE ${member.memberId} hasStat=${Boolean(submission)}`,
          );
        } catch (error) {
          failureCount += 1;
          console.warn(
            `[Stats Dashboard] worker request FAILED ${member.memberId}`,
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      }
    }

    try {
      await Promise.all(Array.from(
        { length: Math.min(REQUEST_CONCURRENCY, members.length) },
        () => worker(),
      ));
    } finally {
      console.info(
        `[Stats Dashboard] load latest stats DONE success=${successCount} noStat=${noStatCount} failed=${failureCount}`,
      );
      if (loadGenerationRef.current === generation) {
        setLatestByMember(new Map(cacheRef.current));
        setIsLoadingStats(false);
        if (failureCount > 0) {
          setStatErrorMessage(`โหลดข้อมูล Stat ไม่สำเร็จ ${failureCount} คน`);
        }
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
    // The page-session cache keeps successful member requests from repeating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, isLoadingMembers, memberErrorMessage]);

  useEffect(() => {
    if (!modalMember) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setModalMember(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalMember]);

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

  return (
    <main className="stats-dashboard-page">
      <header className="stats-dashboard-heading">
        <div><h2>Stat Dashboard</h2><p>ดู Character Stat ล่าสุดของสมาชิกในกิล</p></div>
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
            const summaryFields = submission
              ? [CARD_SUMMARY_FIELDS[0], attackSummary(submission), ...CARD_SUMMARY_FIELDS.slice(1)]
              : [];
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
                      {summaryFields.map((field) => <div key={field.key}><span>{field.label}</span><strong>{formatStatValue(field.key, submission.stats[field.key])}</strong></div>)}
                    </div>
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
    </main>
  );
}
