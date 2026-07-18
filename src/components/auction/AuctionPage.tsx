import {
  useMemo,
  useState,
} from 'react';

import { useGuildLeagueAuction } from '../../hooks/useGuildLeagueAuction';

import type { Member } from '../../types/member';
import cardBookIcon from '../../assets/auction/album-book.png';
import whiteFeatherIcon from '../../assets/auction/white-feather.png';
import redFeatherIcon from '../../assets/auction/red-feather.png';


interface AuctionPageProps {
  members: Member[];
}

function getTodayDate(): string {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    today.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateValue(
  date: Date,
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isValidGuildLeagueDate(
  date: string,
): boolean {
  if (!date) {
    return false;
  }

  const selectedDate = new Date(
    `${date}T00:00:00`,
  );

  if (
    Number.isNaN(
      selectedDate.getTime(),
    )
  ) {
    return false;
  }

  const day = selectedDate.getDay();

  return day === 2 || day === 4;
}

function getNextGuildLeagueDate(
  startDate: string,
): string {
  const date = new Date(
    `${startDate}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return getTodayDate();
  }

  for (
    let daysToAdd = 0;
    daysToAdd <= 7;
    daysToAdd += 1
  ) {
    const candidate = new Date(date);

    candidate.setDate(
      date.getDate() + daysToAdd,
    );

    const candidateValue =
      formatDateValue(candidate);

    if (
      isValidGuildLeagueDate(
        candidateValue,
      )
    ) {
      return candidateValue;
    }
  }

  return startDate;
}

export function AuctionPage({
  members,
}: AuctionPageProps) {
  const [eventDate, setEventDate] =
    useState(() =>
      getNextGuildLeagueDate(
        getTodayDate(),
      ),
    );

  const [
    dateValidationMessage,
    setDateValidationMessage,
  ] = useState('');

  const {
    auctionRows,
    isLoading,
    isSaving,
    errorMessage,
    saveMessage,
    reloadAuction,
    setQueueOwner,
    setSoldTo,
    setCardCount,
    setWhiteFeatherCount,
    setRedFeatherCount,
    saveCurrentAuction,
  } = useGuildLeagueAuction({
    eventDate,
  });

  const memberNames = useMemo(() => {
    return members
      .map((member) =>
        member.ign.trim(),
      )
      .filter(Boolean)
      .sort((firstName, secondName) =>
        firstName.localeCompare(
          secondName,
          'en',
          {
            sensitivity: 'base',
            numeric: true,
          },
        ),
      );
  }, [members]);

  const soldPartyCount =
    auctionRows.filter(
      (row) =>
        row.soldTo.trim() !== '',
    ).length;

  const totalCardCount =
    auctionRows.reduce(
      (total, row) =>
        total + row.cardCount,
      0,
    );

  const totalWhiteFeatherCount =
    auctionRows.reduce(
      (total, row) =>
        total +
        row.whiteFeatherCount,
      0,
    );

  const totalRedFeatherCount =
    auctionRows.reduce(
      (total, row) =>
        total +
        row.redFeatherCount,
      0,
    );

  function handleDateChange(
    nextDate: string,
  ): void {
    if (
      !isValidGuildLeagueDate(
        nextDate,
      )
    ) {
      setDateValidationMessage(
        'Guild League มีวอเฉพาะวันอังคารและวันพฤหัสบดี',
      );

      return;
    }

    setDateValidationMessage('');
    setEventDate(nextDate);
  }

  return (
    <main className="auction-page">
      <section className="auction-toolbar">
        <div>
          <h2>
            Guild League Auction
          </h2>

          <p>
            จัดการเจ้าของสิทธิและการขายสิทธิประมูลของตี้ 5–16
          </p>
        </div>

        <div className="auction-toolbar-actions">
          <button
            type="button"
            className="auction-reload-button"
            onClick={() =>
              void reloadAuction()
            }
            disabled={
              isLoading || isSaving
            }
          >
            {isLoading
              ? 'กำลังโหลด...'
              : 'โหลดใหม่'}
          </button>

          <button
            type="button"
            className="auction-save-button"
            onClick={() =>
              void saveCurrentAuction()
            }
            disabled={
              isLoading ||
              isSaving ||
              !eventDate
            }
          >
            {isSaving
              ? 'กำลังบันทึก...'
              : 'บันทึก'}
          </button>
        </div>
      </section>

      <section className="auction-controls">
        <label>
          <span>วันที่วอ</span>

          <input
            type="date"
            value={eventDate}
            onChange={(event) =>
              handleDateChange(
                event.target.value,
              )
            }
          />

          <small>
            เลือกได้เฉพาะวันอังคารและวันพฤหัสบดี
          </small>
        </label>
      </section>

      {dateValidationMessage && (
        <div className="auction-warning">
          ⚠ {dateValidationMessage}
        </div>
      )}

      <section className="auction-summary-grid">
        <article className="auction-summary-card">
          <span>ขายสิทธิ</span>
          <strong>
            {soldPartyCount} ตี้
          </strong>
        </article>

        <article className="auction-summary-card">
          <span>การ์ดทั้งหมด</span>
          <strong>
            {totalCardCount}
          </strong>
        </article>

        <article className="auction-summary-card">
          <span>ขนนกขาวทั้งหมด</span>
          <strong>
            {totalWhiteFeatherCount}
          </strong>
        </article>

        <article className="auction-summary-card">
          <span>ขนนกแดงทั้งหมด</span>
          <strong>
            {totalRedFeatherCount}
          </strong>
        </article>
      </section>

      {saveMessage && (
        <div className="auction-success">
          {saveMessage}
        </div>
      )}

      {errorMessage && (
        <div className="auction-error">
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() =>
              void reloadAuction()
            }
          >
            ลองใหม่
          </button>
        </div>
      )}

      {isLoading && (
        <div className="auction-status">
          กำลังโหลดข้อมูลประมูล...
        </div>
      )}

      {!isLoading &&
        !errorMessage && (
<section className="auction-card-grid">
  {auctionRows.map((row) => {
    const hasOwner =
      row.queueOwner.trim() !== '';

    const isSold =
      row.soldTo.trim() !== '';

    const cardClassName = [
      'auction-party-card',
      isSold ? 'sold' : '',
      !hasOwner ? 'missing-owner' : '',
    ]
      .filter(Boolean)
      .join(' ');

return (
  <article
    className={[
      'auction-v2-card',
      isSold ? 'is-sold' : '',
      !hasOwner ? 'needs-owner' : '',
    ]
      .filter(Boolean)
      .join(' ')}
    key={row.partyNo}
  >
    <header className="auction-v2-header">
      <div>
        <span className="auction-v2-eyebrow">
          AUCTION PARTY
        </span>

        <h3>Party {row.partyNo}</h3>
      </div>

      <span
        className={[
          'auction-v2-status',
          isSold
            ? 'sold'
            : hasOwner
              ? 'ready'
              : 'waiting',
        ].join(' ')}
      >
        {isSold
          ? 'ขายสิทธิแล้ว'
          : hasOwner
            ? 'พร้อมประมูล'
            : 'ยังไม่เลือกสิทธิ'}
      </span>
    </header>

    <div className="auction-v2-body">
      <label className="auction-v2-person-field">
<span className="auction-v2-field-label">
  <span className="auction-v2-field-icon">
    👤
  </span>
  เจ้าของสิทธิ
</span>

        <select
        className={
            !isSold && hasOwner
            ? 'auction-v2-active-user'
            : ''
        }
        value={row.queueOwner}
          onChange={(event) =>
            setQueueOwner(
              row.partyNo,
              event.target.value,
            )
          }
        >
          <option value="">
            เลือกสมาชิกในตี้
          </option>

          {row.partyMembers.map(
            (memberName) => (
              <option
                key={memberName}
                value={memberName}
              >
                {memberName}
              </option>
            ),
          )}
        </select>
      </label>

      <label className="auction-v2-person-field">
<span className="auction-v2-field-label">
  <span className="auction-v2-field-icon">
    💰
  </span>
  ขายให้
</span>

            <select
            className={
                isSold
                ? 'auction-v2-active-user'
                : 'auction-v2-muted-user'
            }
            value={row.soldTo}
          onChange={(event) =>
            setSoldTo(
              row.partyNo,
              event.target.value,
            )
          }
        >
            <option value="">
            {' '}
            </option>

          {memberNames.map(
            (memberName) => (
              <option
                key={memberName}
                value={memberName}
              >
                {memberName}
              </option>
            ),
          )}
        </select>
      </label>

      <div className="auction-v2-items">
        <label className="auction-v2-item">
          <img
            src={cardBookIcon}
            alt="สมุดการ์ด"
          />

          <span>การ์ด</span>

          <input
            type="number"
            min={0}
            step={1}
            value={row.cardCount}
            onChange={(event) =>
              setCardCount(
                row.partyNo,
                Number(event.target.value),
              )
            }
          />
        </label>

        <label className="auction-v2-item">
          <img
            src={whiteFeatherIcon}
            alt="ขนนกขาว"
          />

          <span>ขนนกขาว</span>

          <input
            type="number"
            min={0}
            step={1}
            value={row.whiteFeatherCount}
            onChange={(event) =>
              setWhiteFeatherCount(
                row.partyNo,
                Number(event.target.value),
              )
            }
          />
        </label>

        <label className="auction-v2-item">
          <img
            src={redFeatherIcon}
            alt="ขนนกแดง"
          />

          <span>ขนนกแดง</span>

          <input
            type="number"
            min={0}
            step={1}
            value={row.redFeatherCount}
            onChange={(event) =>
              setRedFeatherCount(
                row.partyNo,
                Number(event.target.value),
              )
            }
          />
        </label>
      </div>
    </div>

    <footer className="auction-v2-footer">
      <span>
        สมาชิก {row.partyMembers.length}/5
      </span>

      {isSold ? (
        <strong>
          {row.queueOwner || '—'}
          {' → '}
          {row.soldTo}
        </strong>
      ) : (
        <span>
          {hasOwner
            ? `สิทธิของ ${row.queueOwner}`
            : 'รอเลือกเจ้าของสิทธิ'}
        </span>
      )}
    </footer>
  </article>
);
  })}
</section>
        )}
    </main>
  );
}