import { useEffect, useMemo, useState } from 'react';
import type { Member, PartyMode } from '../../types/member';
import { MemberList } from './MemberList';

interface MemberPanelProps {
  members: Member[];
  mode: PartyMode;
}

function getMemberClass(
  member: Member,
  mode: PartyMode,
): string {
  return mode === 'guildLeague'
    ? member.guildLeagueClass
    : member.overrunClass;
}

export function MemberPanel({
  members,
  mode,
}: MemberPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const classOptions = useMemo(() => {
    const uniqueClasses = new Set<string>();

    members.forEach((member) => {
      const className = getMemberClass(member, mode).trim();

      if (className) {
        uniqueClasses.add(className);
      }
    });

    return Array.from(uniqueClasses).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [members, mode]);

  useEffect(() => {
    setSelectedClass('');
  }, [mode]);

  const filteredMembers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return members.filter((member) => {
      const className = getMemberClass(member, mode);

      const matchesName = member.ign
        .toLowerCase()
        .includes(keyword);

      const matchesClass =
        selectedClass === '' ||
        className === selectedClass;

      return matchesName && matchesClass;
    });
  }, [members, mode, searchText, selectedClass]);

  return (
    <aside className="member-panel">
      <div className="panel-heading">
        <div>
          <h2>Member List</h2>
          <p>
            แสดง {filteredMembers.length} จาก {members.length} คน
          </p>
        </div>
      </div>

      <div className="member-filters">
        <input
          type="search"
          value={searchText}
          placeholder="ค้นหาชื่อสมาชิก..."
          onChange={(event) =>
            setSearchText(event.target.value)
          }
        />

        <select
          value={selectedClass}
          onChange={(event) =>
            setSelectedClass(event.target.value)
          }
        >
          <option value="">ทุกอาชีพ</option>

          {classOptions.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>
      </div>

      <MemberList
        members={filteredMembers}
        mode={mode}
      />
    </aside>
  );
}