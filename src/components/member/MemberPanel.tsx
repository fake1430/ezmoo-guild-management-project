import { useEffect, useMemo, useState } from 'react';
import type { Member, PartyMode } from '../../types/member';
import { MemberList } from './MemberList';

interface MemberPanelProps {
  members: Member[];
  mode: PartyMode;
  assignedMemberNames: Set<string>;
  onRemoveMemberFromParty: (memberName: string) => void;
}

const CLASS_ORDER = [
  'Priest',
  'High Priest',
  'Knight',
  'Lord Knight',
  'Crusader',
  'Paladin',
  'Wizard',
  'High Wizard',
  'Sage',
  'Professor',
  'Assassin',
  'Assassin Cross',
  'Rogue',
  'Stalker',
  'Hunter',
  'Sniper',
  'Bard/Dancer',
  'Clown/Gypsy',
  'Merchant',
  'Blacksmith',
  'Whitesmith',
  'Alchemist',
  'Biochemist',
  'Creator',
  'Gunslinger',
  'Doram',
];

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
  assignedMemberNames,
  onRemoveMemberFromParty,
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

    return Array.from(uniqueClasses).sort((a, b) => {
      const indexA = CLASS_ORDER.indexOf(a);
      const indexB = CLASS_ORDER.indexOf(b);

      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }

      if (indexA === -1) {
        return 1;
      }

      if (indexB === -1) {
        return -1;
      }

      return indexA - indexB;
    });
  }, [members, mode]);

  useEffect(() => {
    setSelectedClass('');
  }, [mode]);

  const filteredMembers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return members
      .filter((member) => {
        const className = getMemberClass(member, mode);

        const matchesName = member.ign
          .toLowerCase()
          .includes(keyword);

        const matchesClass =
          selectedClass === '' ||
          className === selectedClass;

        return matchesName && matchesClass;
      })
      .sort((a, b) => {
        const classA = getMemberClass(a, mode);
        const classB = getMemberClass(b, mode);

        const orderA = CLASS_ORDER.indexOf(classA);
        const orderB = CLASS_ORDER.indexOf(classB);

        if (orderA !== orderB) {
          if (orderA === -1) {
            return 1;
          }

          if (orderB === -1) {
            return -1;
          }

          return orderA - orderB;
        }

        return a.ign.localeCompare(
          b.ign,
          'en',
          {
            sensitivity: 'base',
          },
        );
      });
  }, [members, mode, searchText, selectedClass]);

  return (
    <aside
      className="member-panel"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();

        const memberName =
          event.dataTransfer.getData(
            'application/x-ezmoo-member',
          ) || event.dataTransfer.getData('text/plain');

        const normalizedName = memberName.trim();

        if (normalizedName) {
          onRemoveMemberFromParty(normalizedName);
        }
      }}
    >
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
            <option
              key={className}
              value={className}
            >
              {className}
            </option>
          ))}
        </select>
      </div>

      <MemberList
        members={filteredMembers}
        mode={mode}
        assignedMemberNames={assignedMemberNames}
      />
    </aside>
  );
}
