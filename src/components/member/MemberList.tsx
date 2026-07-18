import type { DragEvent } from 'react';
import type {
  Member,
  PartyMode,
} from '../../types/member';
import { getClassColor } from '../../constants/classColors';

interface MemberListProps {
  members: Member[];
  mode: PartyMode;
  assignedMemberNames: Set<string>;
}

function getMemberClass(
  member: Member,
  mode: PartyMode,
): string {
  if (mode === 'guildLeague') {
    return member.guildLeagueClass;
  }

  if (mode === 'overrun') {
    return member.overrunClass;
  }

  return '';
}

function handleDragStart(
  event: DragEvent<HTMLElement>,
  member: Member,
): void {
  event.dataTransfer.effectAllowed = 'move';

  event.dataTransfer.setData(
    'application/x-ezmoo-member',
    member.ign,
  );

  event.dataTransfer.setData(
    'text/plain',
    member.ign,
  );
}

export function MemberList({
  members,
  mode,
  assignedMemberNames,
}: MemberListProps) {
  if (members.length === 0) {
    return (
      <p className="empty-message">
        ไม่พบสมาชิก
      </p>
    );
  }

  return (
    <div className="member-list">
      {members.map((member) => {
        const className =
          getMemberClass(
            member,
            mode,
          ).trim();

        const isAssigned =
          assignedMemberNames.has(member.ign);

        return (
          <article
            className={`member-card ${
              isAssigned ? 'assigned' : ''
            }`}
            key={member.memberId}
            draggable={!isAssigned}
            onDragStart={(event) => {
              if (!isAssigned) {
                handleDragStart(event, member);
              }
            }}
            title={
              isAssigned
                ? 'สมาชิกคนนี้มีปาร์ตี้แล้ว'
                : 'ลากสมาชิกลงช่องปาร์ตี้'
            }
          >
              {mode !== 'auctionParty' && (
                <span
                  className="class-badge"
                  style={{
                    backgroundColor:
                      getClassColor(
                        className ||
                          'ไม่ระบุอาชีพ',
                      ),
                  }}
                >
                  {className ||
                    'ไม่ระบุอาชีพ'}
                </span>
              )}

            <strong className="member-name">
              {member.ign}
            </strong>

            {isAssigned && (
              <span className="assigned-label">
                มีปาร์ตี้แล้ว
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}