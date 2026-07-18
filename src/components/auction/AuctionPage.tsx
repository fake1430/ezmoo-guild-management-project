import {
  useMemo,
  useState,
} from 'react';

import { useGuildLeagueAuction } from '../../hooks/useGuildLeagueAuction';

import type { Member } from '../../types/member';

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
          <section className="auction-table-container">
            <header className="auction-table-header">
              <span>ตี้</span>
              <span>เจ้าของสิทธิ</span>
              <span>ขายให้</span>
              <span>การ์ด</span>
              <span>ขนนกขาว</span>
              <span>ขนนกแดง</span>
            </header>

            {auctionRows.map((row) => (
              <article
                className={
                  row.soldTo.trim()
                    ? 'auction-row sold'
                    : 'auction-row'
                }
                key={row.partyNo}
              >
                <strong className="auction-party-number">
                  {row.partyNo}
                </strong>

                <select
                  value={row.queueOwner}
                  onChange={(event) =>
                    setQueueOwner(
                      row.partyNo,
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    เลือกเจ้าของสิทธิ
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

<select
  value={row.soldTo}
  onChange={(event) =>
    setSoldTo(
      row.partyNo,
      event.target.value,
    )
  }
>
  <option value="">
    ไม่ได้ขายสิทธิ
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

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={row.cardCount}
                  onChange={(event) =>
                    setCardCount(
                      row.partyNo,
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    row.whiteFeatherCount
                  }
                  onChange={(event) =>
                    setWhiteFeatherCount(
                      row.partyNo,
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    row.redFeatherCount
                  }
                  onChange={(event) =>
                    setRedFeatherCount(
                      row.partyNo,
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />
              </article>
            ))}
          </section>
        )}
    </main>
  );
}