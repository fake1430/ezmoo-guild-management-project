import type { Member } from '../../types/member';
import { getClassColor } from '../../constants/classColors';

interface MemberStatCardProps {
  member: Member;
}

export function MemberStatCard({
  member,
}: MemberStatCardProps) {
  const className =
    member.guildLeagueClass.trim() ||
    'ไม่ระบุอาชีพ';

  return (
    <article className="member-dashboard-card">
      <header className="member-dashboard-card-header">
        <div>
          <strong>{member.ign}</strong>

          <span
            style={{
              backgroundColor:
                getClassColor(className),
            }}
          >
            {className}
          </span>
        </div>

        <span className="member-dashboard-card-arrow">
          ›
        </span>
      </header>

      <section className="member-dashboard-auction-summary">
        <h3>ข้อมูลการประมูล</h3>

        <div className="member-dashboard-auction-grid">
          <div>
            <span>ได้สิทธิ</span>
            <strong>0</strong>
          </div>

          <div>
            <span>รับเอง</span>
            <strong>0</strong>
          </div>

          <div>
            <span>ขายสิทธิ</span>
            <strong>0</strong>
          </div>
        </div>
      </section>
    </article>
  );
}