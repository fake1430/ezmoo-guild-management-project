import type { Member, PartyMode } from '../../types/member';

interface MemberListProps {
  members: Member[];
  mode: PartyMode;
}

function getMemberClass(
  member: Member,
  mode: PartyMode,
): string {
  if (mode === 'guildLeague') {
    return member.guildLeagueClass;
  }

  return member.overrunClass;
}

export function MemberList({
  members,
  mode,
}: MemberListProps) {
  if (members.length === 0) {
    return <p className="empty-message">ไม่พบสมาชิก</p>;
  }

  return (
    <div className="member-list">
      {members.map((member) => {
        const className =
          getMemberClass(member, mode) || 'ไม่ระบุอาชีพ';

        return (
          <article
            className="member-card"
            key={member.memberId}
          >
            <span className="class-badge">{className}</span>

            <strong className="member-name">
              {member.ign}
            </strong>
          </article>
        );
      })}
    </div>
  );
}