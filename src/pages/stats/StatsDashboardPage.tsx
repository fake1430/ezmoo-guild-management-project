import {
  useMemo,
  useRef,
  useState,
} from 'react';
import { getLatestMemberStats } from '../../services/googleApi';
import type { StatSubmission } from '../../types/characterStats';
import type { Member } from '../../types/member';

interface StatsDashboardPageProps {
  members: Member[];
  isLoadingMembers: boolean;
  memberErrorMessage: string;
  onReloadMembers: () => Promise<void>;
}

const PERCENT_KEYS = new Set([
  'critDmg', 'critDmgRes', 'pdmg', 'mdmg', 'pdmgReduction',
  'mdmgReduction', 'healingDone', 'healingTaken', 'maxHpPercent',
  'equipmentPatkPercent', 'equipmentMatkPercent', 'equipmentPdefPercent',
  'equipmentMdefPercent', 'dmgVsDemiHuman', 'dmgReductionVsDemiHuman',
  'dmgVsMedium', 'dmgReductionVsMedium',
]);

const STAT_SECTIONS = [
  { title: 'Basic', stats: [['hp', 'HP'], ['patk', 'PATK'], ['matk', 'MATK'], ['pdef', 'PDEF'], ['mdef', 'MDEF']] },
  { title: 'Critical', stats: [['crit', 'CRIT'], ['critDmg', 'CRIT DMG'], ['critRes', 'CRIT RES'], ['critDmgRes', 'CRIT DMG RES']] },
  { title: 'Damage', stats: [['pdmg', 'PDMG'], ['mdmg', 'MDMG'], ['pdmgReduction', 'PDMG.R'], ['mdmgReduction', 'MDMG.R'], ['ignorePdef', 'Ignore PDEF'], ['ignoreMdef', 'Ignore MDEF'], ['pvpDmgBonus', 'PvP DMG Bonus'], ['pvpDmgReduction', 'PvP DMG Red']] },
  { title: 'Healing', stats: [['healingDone', 'Healing Done'], ['healingTaken', 'Healing Taken']] },
  { title: 'Equipment', stats: [['maxHpPercent', 'Max HP'], ['equipmentPatkPercent', 'Equipment PATK'], ['equipmentMatkPercent', 'Equipment MATK'], ['equipmentPdefPercent', 'Equipment PDEF'], ['equipmentMdefPercent', 'Equipment MDEF']] },
  { title: 'Race / Size', stats: [['dmgVsDemiHuman', 'DMG vs Demi-Human'], ['dmgReductionVsDemiHuman', 'DMG Reduction vs Demi-Human'], ['dmgVsMedium', 'DMG vs Medium'], ['dmgReductionVsMedium', 'DMG Reduction vs Medium']] },
] as const;

function memberClass(member: Member): string {
  return member.guildLeagueClass.trim() || member.overrunClass.trim() || 'ไม่ระบุอาชีพ';
}

function formatStatValue(key: string, value: number | undefined): string {
  if (value === undefined) return '—';
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(value);
  return `${formatted}${PERCENT_KEYS.has(key) ? '%' : ''}`;
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

export function StatsDashboardPage({
  members,
  isLoadingMembers,
  memberErrorMessage,
  onReloadMembers,
}: StatsDashboardPageProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<StatSubmission | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statErrorMessage, setStatErrorMessage] = useState('');
  const requestSequence = useRef(0);

  const filteredMembers = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return members
      .filter((member) => !query || [
        member.ign,
        member.guildLeagueClass,
        member.overrunClass,
      ].some((value) => value.toLocaleLowerCase().includes(query)))
      .sort((first, second) => first.ign.localeCompare(second.ign, 'th'));
  }, [members, searchText]);

  async function loadLatest(member: Member): Promise<void> {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setSelectedMember(member);
    setLatestSubmission(null);
    setStatErrorMessage('');
    setIsLoadingStats(true);
    try {
      const submission = await getLatestMemberStats(member.memberId);
      if (requestSequence.current === requestId) setLatestSubmission(submission);
    } catch (error) {
      if (requestSequence.current === requestId) {
        setStatErrorMessage(
          error instanceof Error ? error.message : 'โหลดข้อมูล Stat ไม่สำเร็จ',
        );
      }
    } finally {
      if (requestSequence.current === requestId) setIsLoadingStats(false);
    }
  }

  return (
    <main className="stats-dashboard-page">
      <header className="stats-dashboard-heading">
        <div>
          <h2>Stat Dashboard</h2>
          <p>ดู Character Stat ล่าสุดของสมาชิกในกิล</p>
        </div>
      </header>

      <div className="stats-dashboard-layout">
        <aside className="stats-member-panel">
          <input
            type="search"
            value={searchText}
            placeholder="ค้นหา IGN หรือ Class..."
            onChange={(event) => setSearchText(event.target.value)}
          />

          {isLoadingMembers && <div className="stats-panel-state">กำลังโหลดสมาชิก...</div>}
          {!isLoadingMembers && memberErrorMessage && (
            <div className="stats-panel-state error">
              <p>{memberErrorMessage}</p>
              <button type="button" onClick={() => void onReloadMembers()}>ลองใหม่</button>
            </div>
          )}
          {!isLoadingMembers && !memberErrorMessage && (
            <div className="stats-member-list">
              {filteredMembers.map((member) => (
                <button
                  type="button"
                  key={member.memberId}
                  className={selectedMember?.memberId === member.memberId ? 'active' : ''}
                  onClick={() => void loadLatest(member)}
                >
                  <strong>{member.ign}</strong>
                  <span>{memberClass(member)}</span>
                </button>
              ))}
              {filteredMembers.length === 0 && (
                <div className="stats-panel-state">ไม่พบสมาชิก</div>
              )}
            </div>
          )}
        </aside>

        <section className="latest-stat-panel">
          {!selectedMember && (
            <div className="latest-stat-empty">เลือกสมาชิกเพื่อดู Stat</div>
          )}
          {selectedMember && isLoadingStats && (
            <div className="latest-stat-empty">กำลังโหลด Stat ของ {selectedMember.ign}...</div>
          )}
          {selectedMember && !isLoadingStats && statErrorMessage && (
            <div className="latest-stat-empty error">
              <p>{statErrorMessage}</p>
              <button type="button" onClick={() => void loadLatest(selectedMember)}>ลองใหม่</button>
            </div>
          )}
          {selectedMember && !isLoadingStats && !statErrorMessage && !latestSubmission && (
            <div className="latest-stat-empty">ยังไม่มีข้อมูล Stat ของสมาชิกคนนี้</div>
          )}
          {selectedMember && !isLoadingStats && !statErrorMessage && latestSubmission && (
            <>
              <header className="latest-stat-header">
                <div>
                  <span className="latest-stat-eyebrow">Latest Stat</span>
                  <h3>{selectedMember.ign}</h3>
                  <span className="latest-stat-class">{memberClass(selectedMember)}</span>
                </div>
                <dl>
                  <div><dt>อัปเดตล่าสุด</dt><dd>{formatSubmittedAt(latestSubmission.submittedAt)}</dd></div>
                  {latestSubmission.submittedByDiscordName && (
                    <div><dt>Submitted by</dt><dd>{latestSubmission.submittedByDiscordName}</dd></div>
                  )}
                </dl>
              </header>

              <div className="latest-stat-sections">
                {STAT_SECTIONS.map((section) => (
                  <section key={section.title} className="latest-stat-section">
                    <h4>{section.title}</h4>
                    <div className="latest-stat-grid">
                      {section.stats.map(([key, label]) => (
                        <div key={key} className="latest-stat-cell">
                          <span>{label}</span>
                          <strong>{formatStatValue(key, latestSubmission.stats[key])}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
