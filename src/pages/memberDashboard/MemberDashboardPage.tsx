import {
  useMemo,
  useState,
} from 'react';
import type { Member } from '../../types/member';
import { MemberStatCard } from '../../components/member/MemberStatCard';

interface MemberDashboardPageProps {
  members: Member[];
  isLoading: boolean;
  errorMessage: string;
}

type SortMode =
  | 'name-asc'
  | 'name-desc'
  | 'class-asc';

export function MemberDashboardPage({
  members,
  isLoading,
  errorMessage,
}: MemberDashboardPageProps) {
  const [searchText, setSearchText] =
    useState('');

  const [selectedClass, setSelectedClass] =
    useState('all');

  const [sortMode, setSortMode] =
    useState<SortMode>('name-asc');

  const classOptions = useMemo(() => {
    return Array.from(
      new Set(
        members
          .map((member) =>
            member.guildLeagueClass.trim(),
          )
          .filter(Boolean),
      ),
    ).sort((firstClass, secondClass) =>
      firstClass.localeCompare(
        secondClass,
        'th',
      ),
    );
  }, [members]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    const result = members.filter(
      (member) => {
        const memberClass =
          member.guildLeagueClass.trim();

        const matchesSearch =
          !normalizedSearch ||
          member.ign
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesClass =
          selectedClass === 'all' ||
          memberClass === selectedClass;

        return (
          matchesSearch &&
          matchesClass
        );
      },
    );

    return [...result].sort(
      (firstMember, secondMember) => {
        if (sortMode === 'name-desc') {
          return secondMember.ign.localeCompare(
            firstMember.ign,
            'th',
          );
        }

        if (sortMode === 'class-asc') {
          const classComparison =
            firstMember.guildLeagueClass.localeCompare(
              secondMember.guildLeagueClass,
              'th',
            );

          if (classComparison !== 0) {
            return classComparison;
          }

          return firstMember.ign.localeCompare(
            secondMember.ign,
            'th',
          );
        }

        return firstMember.ign.localeCompare(
          secondMember.ign,
          'th',
        );
      },
    );
  }, [
    members,
    searchText,
    selectedClass,
    sortMode,
  ]);

  if (isLoading) {
    return (
      <main className="member-dashboard-page">
        <div className="member-dashboard-status">
          กำลังโหลดข้อมูลสมาชิก...
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="member-dashboard-page">
        <div className="member-dashboard-error">
          {errorMessage}
        </div>
      </main>
    );
  }

  return (
    <main className="member-dashboard-page">
      <section className="member-dashboard-header">
        <div>
          <h2>Members</h2>

          <p>
            ดูข้อมูลภาพรวมของสมาชิกในกิล
          </p>
        </div>

        <div className="member-dashboard-count">
          แสดง {filteredMembers.length} จาก{' '}
          {members.length} คน
        </div>
      </section>

      <section className="member-dashboard-toolbar">
        <input
          type="search"
          value={searchText}
          placeholder="ค้นหาชื่อสมาชิก..."
          onChange={(event) =>
            setSearchText(
              event.target.value,
            )
          }
        />

        <select
          value={selectedClass}
          onChange={(event) =>
            setSelectedClass(
              event.target.value,
            )
          }
        >
          <option value="all">
            ทุกอาชีพ
          </option>

          {classOptions.map(
            (className) => (
              <option
                key={className}
                value={className}
              >
                {className}
              </option>
            ),
          )}
        </select>

        <select
          value={sortMode}
          onChange={(event) =>
            setSortMode(
              event.target.value as SortMode,
            )
          }
        >
          <option value="name-asc">
            เรียงชื่อตาม A–Z
          </option>

          <option value="name-desc">
            เรียงชื่อตาม Z–A
          </option>

          <option value="class-asc">
            เรียงตามอาชีพ
          </option>
        </select>
      </section>

      {filteredMembers.length === 0 ? (
        <section className="member-dashboard-empty">
          <strong>
            ไม่พบสมาชิก
          </strong>

          <p>
            ลองเปลี่ยนคำค้นหาหรือตัวกรองอาชีพ
          </p>
        </section>
      ) : (
        <section className="member-dashboard-grid">
          {filteredMembers.map(
            (member) => (
              <MemberStatCard
                key={member.memberId}
                member={member}
              />
            ),
          )}
        </section>
      )}
    </main>
  );
}