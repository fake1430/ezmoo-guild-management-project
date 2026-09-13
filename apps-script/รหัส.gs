const SHEETS = {
  MEMBERS: 'Member',
  CLASSES: 'Class',
  GUILD_LEAGUE: 'GuildLeague',
  OVERRUN: 'Overrun',
  AUCTION_PARTY: 'AuctionParty',
  GUILD_LEAGUE_AUCTION: 'GuildLeagueAuction',
  OVERRUN_AUCTION: 'OverrunAuction',
  ATTENDANCE: 'Attendance',

  OVERRUN_QUEUE: 'OverrunQueue',
  OVERRUN_HISTORY: 'OverrunAuctionHistory',
  WAR_PLANNER: 'WarPlanner',
};


const OVERRUN_QUEUE_SIZE = 12;

const ATTENDANCE_HEADERS = [
  'AttendanceID',
  'EventDate',
  'EventType',
  'MemberID',
  'WarStatus',
  'DiscordStatus',
  'Note',
  'UpdatedAt',
];
const GUILD_LEAGUE_AUCTION_HEADERS = [
  'AuctionID',
  'EventDate',
  'PartyNo',
  'QueueOwner',
  'SoldTo',
  'CardCount',
  'WhiteFeatherCount',
  'RedFeatherCount',
  'UpdatedAt',
];

const OVERRUN_AUCTION_HEADERS = [
  'AuctionID',
  'EventDate',
  'QueueNo',
  'QueueOwner',
  'SoldTo',
  'CardCount',
  'WhiteFeatherCount',
  'RedFeatherCount',
  'UpdatedAt',
];

const OVERRUN_QUEUE_HEADERS = [
  'QueueNo',
  'MemberID',
  'IGN',
];

const OVERRUN_HISTORY_HEADERS = [
  'HistoryID',
  'EventDate',
  'Result',
  'NoItemMember',
  'QueueBefore',
  'QueueAfter',
  'UpdatedAt',
];

const WAR_PLANNER_HEADERS = [
  'PlanKey',
  'PlanJson',
  'UpdatedAt',
];

/**
 * ตัวอย่างการเรียก:
 *
 * URL?action=members
 * URL?action=classes
 * URL?action=party&sheet=GuildLeague
 * URL?action=party&sheet=Overrun
 *
 * URL?action=getAttendance
 *   &date=2026-07-17
 *   &eventType=GuildLeague
 *
 * URL?action=getLeaveSummary
 *   &month=2026-07
 *   &eventType=GuildLeague
 */
function doGet(e) {
  try {
    const action = String(
      e && e.parameter
        ? e.parameter.action || ''
        : '',
    ).trim();

    const statResult = handleStatGetAction(
  action,
  e.parameter,
);

if (statResult.handled) {
  return jsonResponse({
    success: true,
    data: statResult.data,
  });
}

const discordLinkResult =
  handleDiscordMemberLinkGetAction(action);

if (discordLinkResult.handled) {
  return jsonResponse({
    success: true,
    data: discordLinkResult.data,
  });
}

    switch (action) {
      case 'members':
        return jsonResponse({
          success: true,
          data: getMembers(),
        });

      case 'classes':
        return jsonResponse({
          success: true,
          data: getClasses(),
        });

      case 'party': {
        const sheetName = String(
          e.parameter.sheet || '',
        ).trim();

        validatePartySheetName(sheetName);

        return jsonResponse({
          success: true,
          data: getPartyData(sheetName),
        });
      }

      case 'getAttendance': {
        const eventDate = normalizeDateString(
          e.parameter.date,
        );

        const eventType = normalizeEventType(
          e.parameter.eventType,
        );

        return jsonResponse({
          success: true,
          data: getAttendanceData(
            eventDate,
            eventType,
          ),
        });
      }

      case 'getGuildLeagueAuction':
        return jsonResponse({
          success: true,
          data: getGuildLeagueAuction(
            e.parameter.date,
          ),
        });

      case 'getOverrunAuction':
        return jsonResponse({
          success: true,
          data: getOverrunAuction(
            e.parameter.date,
          ),
        });

      case 'getOverrunQueue':
        return jsonResponse({
          success: true,
          data: getOverrunQueue(),
        });

      case 'getWarPlanner':
        return jsonResponse({
          success: true,
          data: getWarPlannerData(
            e.parameter.mapId,
          ),
        });

      case 'getLeaveSummary': {
        const month = normalizeMonthString(
          e.parameter.month,
        );

        const eventTypeText = String(
          e.parameter.eventType || '',
        ).trim();

        const eventType = eventTypeText
          ? normalizeEventType(eventTypeText)
          : '';

        return jsonResponse({
          success: true,
          data: getLeaveSummary(
            month,
            eventType,
          ),
        });
      }

      default:
        return jsonResponse({
          success: true,
          message: 'EZMOO API is running',
          endpoints: [
            '?action=members',
            '?action=classes',
            '?action=party&sheet=GuildLeague',
            '?action=party&sheet=Overrun',
            '?action=getAttendance&date=2026-07-17&eventType=GuildLeague',
            '?action=getLeaveSummary&month=2026-07&eventType=GuildLeague',
          ],
        });
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      error: getErrorMessage(error),
    });
  }
}

function doPost(e) {
  try {
    const body =
      e &&
      e.postData &&
      e.postData.contents
        ? e.postData.contents
        : '{}';

    const payload = JSON.parse(body);

    const action = String(
      payload.action || '',
    ).trim();

    const statResult = handleStatPostAction(
  action,
  payload,
);

if (statResult.handled) {
  return jsonResponse({
    success: true,
    data: statResult.data,
    message: statResult.message,
  });
}

const discordLinkResult =
  handleDiscordMemberLinkPostAction(
    action,
    payload,
  );

if (discordLinkResult.handled) {
  return jsonResponse({
    success: true,
    data: discordLinkResult.data,
    message: discordLinkResult.message,
  });
}

switch (action) {
  case 'saveParty':
    return handleSaveParty(payload);

  case 'saveAttendance':
    return handleSaveAttendance(payload);

  case 'saveGuildLeagueAuction':
    return handleSaveGuildLeagueAuction(
      payload,
    );

  case 'saveOverrunAuction':
    return handleSaveOverrunAuction(
      payload,
    );

  case 'saveOverrunQueue':
    return handleSaveOverrunQueue(
      payload,
    );

  case 'confirmOverrunResult':
    return handleConfirmOverrunResult(
      payload,
    );

  case 'saveWarPlanner':
    return handleSaveWarPlanner(
      payload,
    );

  default:
        throw new Error(
          `ไม่รู้จัก action "${action}"`,
        );
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      error: getErrorMessage(error),
    });
  }
}

/* =========================================================
   MEMBER
========================================================= */

function getMembers() {
  const sheet = getRequiredSheet(
    SHEETS.MEMBERS,
  );

  const values =
    sheet.getDataRange().getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const headers =
    values[0].map(normalizeHeader);

  const memberIdIndex = findHeaderIndex(
    headers,
    [
      'member id',
      'memberid',
    ],
  );

  const ignIndex = findHeaderIndex(
    headers,
    ['ign'],
  );

  const guildLeagueIndex =
    findHeaderIndex(headers, [
      'guild league',
      'guild league class',
      'guildleague',
      'guildleagueclass',
    ]);

  const overrunIndex =
    findHeaderIndex(headers, [
      'overrun',
      'overrun class',
      'overrunclass',
    ]);

  return values
    .slice(1)
    .filter(function (row) {
      return String(
        row[ignIndex] || '',
      ).trim() !== '';
    })
    .map(function (row) {
      return {
        memberId: String(
          row[memberIdIndex] || '',
        ).trim(),

        ign: String(
          row[ignIndex] || '',
        ).trim(),

        guildLeagueClass: String(
          row[guildLeagueIndex] || '',
        ).trim(),

        overrunClass: String(
          row[overrunIndex] || '',
        ).trim(),
      };
    });
}

/* =========================================================
   CLASS
========================================================= */

function getClasses() {
  const sheet = getRequiredSheet(
    SHEETS.CLASSES,
  );

  const values =
    sheet.getDataRange().getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const headers =
    values[0].map(normalizeHeader);

  const classIdIndex = findHeaderIndex(
    headers,
    [
      'classid',
      'class id',
    ],
  );

  const classNameIndex =
    findHeaderIndex(headers, [
      'classname',
      'class name',
    ]);

  return values
    .slice(1)
    .filter(function (row) {
      return String(
        row[classNameIndex] || '',
      ).trim() !== '';
    })
    .map(function (row) {
      return {
        classId: String(
          row[classIdIndex] || '',
        ).trim(),

        className: String(
          row[classNameIndex] || '',
        ).trim(),
      };
    });
}

/* =========================================================
   PARTY
========================================================= */

function handleSaveParty(payload) {
  const sheetName = String(
    payload.sheet || '',
  ).trim();

  const parties = payload.parties;

  validatePartySheetName(sheetName);

  if (!Array.isArray(parties)) {
    throw new Error(
      'รูปแบบข้อมูล parties ไม่ถูกต้อง',
    );
  }

  savePartyData(
    sheetName,
    parties,
  );

  return jsonResponse({
    success: true,
    message:
      `บันทึกข้อมูล ${sheetName} สำเร็จ`,
  });
}

function getPartyData(sheetName) {
  const sheet =
    getRequiredSheet(sheetName);

  const values =
    sheet.getDataRange().getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const headers =
    values[0].map(normalizeHeader);

  const partyIndex = findHeaderIndex(
    headers,
    ['party'],
  );

  const slotIndexes = [
    1,
    2,
    3,
    4,
    5,
  ].map(function (slotNumber) {
    return findHeaderIndex(headers, [
      `slot${slotNumber}`,
      `slot ${slotNumber}`,
    ]);
  });

  return values
    .slice(1)
    .filter(function (row) {
      const partyNumber = String(
        row[partyIndex] || '',
      ).trim();

      const hasMember =
        slotIndexes.some(function (index) {
          return String(
            row[index] || '',
          ).trim() !== '';
        });

      return (
        partyNumber !== '' ||
        hasMember
      );
    })
    .map(function (row) {
      return {
        party:
          Number(row[partyIndex]) ||
          null,

        slots: slotIndexes.map(
          function (index) {
            return String(
              row[index] || '',
            ).trim();
          },
        ),
      };
    });
}

function savePartyData(
  sheetName,
  parties,
) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getRequiredSheet(sheetName);

    const headers = [
      'Party',
      'Slot1',
      'Slot2',
      'Slot3',
      'Slot4',
      'Slot5',
    ];

    const rows = parties.map(
      function (party, index) {
        const slots = Array.from(
          { length: 5 },
          function (_, slotIndex) {
            return String(
              party &&
              party.slots &&
              party.slots[slotIndex]
                ? party.slots[slotIndex]
                : '',
            ).trim();
          },
        );

        return [
          Number(
            party && party.party,
          ) || index + 1,
          ...slots,
        ];
      },
    );

    sheet.clearContents();

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length,
      )
      .setValues([headers]);

    if (rows.length > 0) {
      sheet
        .getRange(
          2,
          1,
          rows.length,
          headers.length,
        )
        .setValues(rows);
    }

    sheet.autoResizeColumns(
      1,
      headers.length,
    );
  } finally {
    lock.releaseLock();
  }
}

function validatePartySheetName(
  sheetName,
) {
const allowedSheets = [
  SHEETS.GUILD_LEAGUE,
  SHEETS.OVERRUN,
  SHEETS.AUCTION_PARTY,
];

  if (
    !allowedSheets.includes(sheetName)
  ) {
throw new Error(
  'อนุญาตเฉพาะ GuildLeague, Overrun หรือ AuctionParty',
);
  }
}

/* =========================================================
   ATTENDANCE
========================================================= */

function handleSaveAttendance(payload) {
  const eventDate =
    normalizeDateString(payload.date);

  const eventType =
    normalizeEventType(
      payload.eventType,
    );

  const attendance =
    payload.attendance;

  if (!Array.isArray(attendance)) {
    throw new Error(
      'รูปแบบข้อมูล attendance ไม่ถูกต้อง',
    );
  }

  saveAttendanceData(
    eventDate,
    eventType,
    attendance,
  );

  return jsonResponse({
    success: true,
    message:
      `บันทึกเช็กชื่อ ${eventType} วันที่ ${eventDate} สำเร็จ`,
  });
}

function getAttendanceData(
  eventDate,
  eventType,
) {
  const sheet =
    getRequiredSheet(
      SHEETS.ATTENDANCE,
    );

  ensureAttendanceHeaders(sheet);

  const values =
    sheet.getDataRange().getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const indexes =
    getAttendanceColumnIndexes(
      values[0],
    );

  return values
    .slice(1)
    .filter(function (row) {
      return (
        normalizeStoredDate(
          row[indexes.eventDate],
        ) === eventDate &&
        String(
          row[indexes.eventType] || '',
        ).trim() === eventType
      );
    })
    .map(function (row) {
      return {
        attendanceId: String(
          row[indexes.attendanceId] || '',
        ).trim(),

        eventDate: normalizeStoredDate(
          row[indexes.eventDate],
        ),

        eventType: String(
          row[indexes.eventType] || '',
        ).trim(),

        memberId: String(
          row[indexes.memberId] || '',
        ).trim(),

        warStatus: String(
          row[indexes.warStatus] || '',
        ).trim(),

        discordStatus: String(
          row[indexes.discordStatus] || '',
        ).trim(),

        note: String(
          row[indexes.note] || '',
        ).trim(),

        updatedAt: String(
          row[indexes.updatedAt] || '',
        ).trim(),
      };
    });
}

function getLeaveSummary(
  month,
  eventType,
) {
  const sheet =
    getRequiredSheet(
      SHEETS.ATTENDANCE,
    );

  ensureAttendanceHeaders(sheet);

  const values =
    sheet.getDataRange().getDisplayValues();

  const summary = {};

  if (values.length < 2) {
    return summary;
  }

  const indexes =
    getAttendanceColumnIndexes(
      values[0],
    );

  values
    .slice(1)
    .forEach(function (row) {
      const rowDate =
        normalizeStoredDate(
          row[indexes.eventDate],
        );

      const rowEventType = String(
        row[indexes.eventType] || '',
      ).trim();

      const memberId = String(
        row[indexes.memberId] || '',
      ).trim();

      const warStatus = String(
        row[indexes.warStatus] || '',
      ).trim();

      const matchesMonth =
        rowDate.slice(0, 7) === month;

      const matchesEventType =
        !eventType ||
        rowEventType === eventType;

      if (
        matchesMonth &&
        matchesEventType &&
        memberId &&
        warStatus === 'Leave'
      ) {
        summary[memberId] =
          (summary[memberId] || 0) + 1;
      }
    });

  return summary;
}

function saveAttendanceData(
  eventDate,
  eventType,
  attendance,
) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getRequiredSheet(
        SHEETS.ATTENDANCE,
      );

    ensureAttendanceHeaders(sheet);

    const existingValues =
      sheet
        .getDataRange()
        .getValues();

    const existingDisplayValues =
      sheet
        .getDataRange()
        .getDisplayValues();

    const indexes =
      getAttendanceColumnIndexes(
        existingDisplayValues[0],
      );

    /*
     * เก็บแถวอื่นไว้ตามเดิม
     * และลบเฉพาะข้อมูลของวัน + ประเภทวอ
     * ที่กำลังบันทึก เพื่อป้องกันข้อมูลซ้ำ
     */
    const remainingRows =
      existingValues
        .slice(1)
        .filter(function (
          row,
          rowIndex,
        ) {
          const displayRow =
            existingDisplayValues[
              rowIndex + 1
            ];

          const rowDate =
            normalizeStoredDate(
              displayRow[
                indexes.eventDate
              ],
            );

          const rowEventType =
            String(
              displayRow[
                indexes.eventType
              ] || '',
            ).trim();

          return !(
            rowDate === eventDate &&
            rowEventType === eventType
          );
        });

    const updatedAt = new Date();

    const newRows = attendance
      .map(function (record) {
        const memberId = String(
          record &&
          record.memberId
            ? record.memberId
            : '',
        ).trim();

        if (!memberId) {
          return null;
        }

        const warStatus =
          normalizeWarStatus(
            record.warStatus,
          );

        const discordStatus =
          normalizeDiscordStatus(
            record.discordStatus,
          );

        const note = String(
          record.note || '',
        ).trim();

        return [
          createAttendanceId(
            eventDate,
            eventType,
            memberId,
          ),
          eventDate,
          eventType,
          memberId,
          warStatus,
          discordStatus,
          note,
          updatedAt,
        ];
      })
      .filter(function (row) {
        return row !== null;
      });

    const allRows =
      remainingRows.concat(newRows);

    sheet.clearContents();

    sheet
      .getRange(
        1,
        1,
        1,
        ATTENDANCE_HEADERS.length,
      )
      .setValues([
        ATTENDANCE_HEADERS,
      ]);

    if (allRows.length > 0) {
      sheet
        .getRange(
          2,
          1,
          allRows.length,
          ATTENDANCE_HEADERS.length,
        )
        .setValues(allRows);
    }

    sheet
      .getRange('B:B')
      .setNumberFormat(
        '@',
      );

    sheet
      .getRange('H:H')
      .setNumberFormat(
        'yyyy-mm-dd hh:mm:ss',
      );

    sheet.autoResizeColumns(
      1,
      ATTENDANCE_HEADERS.length,
    );
  } finally {
    lock.releaseLock();
  }
}

function ensureAttendanceHeaders(
  sheet,
) {
  const lastColumn =
    sheet.getLastColumn();

  const firstRow =
    lastColumn > 0
      ? sheet
          .getRange(
            1,
            1,
            1,
            Math.max(
              lastColumn,
              ATTENDANCE_HEADERS.length,
            ),
          )
          .getDisplayValues()[0]
      : [];

  const hasHeaders =
    ATTENDANCE_HEADERS.every(
      function (header) {
        return firstRow
          .map(normalizeHeader)
          .includes(
            normalizeHeader(header),
          );
      },
    );

  if (!hasHeaders) {
    if (
      sheet.getLastRow() > 1
    ) {
      throw new Error(
        'หัวตาราง Attendance ไม่ถูกต้อง กรุณาตรวจสอบชื่อคอลัมน์',
      );
    }

    sheet
      .getRange(
        1,
        1,
        1,
        ATTENDANCE_HEADERS.length,
      )
      .setValues([
        ATTENDANCE_HEADERS,
      ]);
  }
}

function getAttendanceColumnIndexes(
  headerRow,
) {
  const headers =
    headerRow.map(normalizeHeader);

  return {
    attendanceId: findHeaderIndex(
      headers,
      [
        'attendanceid',
        'attendance id',
      ],
    ),

    eventDate: findHeaderIndex(
      headers,
      [
        'eventdate',
        'event date',
      ],
    ),

    eventType: findHeaderIndex(
      headers,
      [
        'eventtype',
        'event type',
      ],
    ),

    memberId: findHeaderIndex(
      headers,
      [
        'memberid',
        'member id',
      ],
    ),

    warStatus: findHeaderIndex(
      headers,
      [
        'warstatus',
        'war status',
      ],
    ),

    discordStatus:
      findHeaderIndex(
        headers,
        [
          'discordstatus',
          'discord status',
        ],
      ),

    note: findHeaderIndex(
      headers,
      ['note'],
    ),

    updatedAt: findHeaderIndex(
      headers,
      [
        'updatedat',
        'updated at',
      ],
    ),
  };
}

function createAttendanceId(
  eventDate,
  eventType,
  memberId,
) {
  const compactDate =
    eventDate.replace(/-/g, '');

  return [
    compactDate,
    eventType,
    memberId,
  ].join('_');
}

function normalizeWarStatus(value) {
  const status = String(
    value || '',
  ).trim();

  const allowedStatuses = [
    '',
    'Present',
    'Leave',
    'Absent',
  ];

  if (
    !allowedStatuses.includes(status)
  ) {
    throw new Error(
      `WarStatus "${status}" ไม่ถูกต้อง`,
    );
  }

  return status;
}

function normalizeDiscordStatus(value) {
  const status = String(
    value || '',
  ).trim();

  const allowedStatuses = [
    '',
    'Online',
    'Offline',
  ];

  if (
    !allowedStatuses.includes(status)
  ) {
    throw new Error(
      `DiscordStatus "${status}" ไม่ถูกต้อง`,
    );
  }

  return status;
}

function normalizeEventType(value) {
  const eventType = String(
    value || '',
  ).trim();

  const allowedTypes = [
    'GuildLeague',
    'Overrun',
  ];

  if (
    !allowedTypes.includes(eventType)
  ) {
    throw new Error(
      'EventType ต้องเป็น GuildLeague หรือ Overrun',
    );
  }

  return eventType;
}

function normalizeDateString(value) {
  const date = String(
    value || '',
  ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new Error(
      'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD',
    );
  }

  const parsedDate =
    new Date(`${date}T00:00:00`);

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    throw new Error(
      'วันที่ไม่ถูกต้อง',
    );
  }

  return date;
}

function normalizeMonthString(value) {
  const month = String(
    value || '',
  ).trim();

  if (
    !/^\d{4}-\d{2}$/.test(month)
  ) {
    throw new Error(
      'เดือนต้องอยู่ในรูปแบบ YYYY-MM',
    );
  }

  const monthNumber =
    Number(month.slice(5, 7));

  if (
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error(
      'เดือนไม่ถูกต้อง',
    );
  }

  return month;
}

function normalizeStoredDate(value) {
  if (
    Object.prototype.toString.call(
      value,
    ) === '[object Date]' &&
    !Number.isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd',
    );
  }

  const text = String(
    value || '',
  ).trim();

  const directMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/,
    );

  if (directMatch) {
    return [
      directMatch[1],
      directMatch[2],
      directMatch[3],
    ].join('-');
  }

  return text;
}
/* =========================================================
   AUCTION
========================================================= */

function handleSaveGuildLeagueAuction(
  payload,
) {
  const eventDate =
    normalizeDateString(
      payload.date,
    );

  const auction =
    payload.auction;

  if (!Array.isArray(auction)) {
    throw new Error(
      'รูปแบบข้อมูล auction ไม่ถูกต้อง',
    );
  }

  saveGuildLeagueAuctionData(
    eventDate,
    auction,
  );

  return jsonResponse({
    success: true,
    message:
      `บันทึกข้อมูลประมูล Guild League วันที่ ${eventDate} สำเร็จ`,
  });
}

function getGuildLeagueAuction(
  eventDate,
) {
  const normalizedEventDate =
    normalizeDateString(eventDate);

  const sheet =
    getRequiredSheet(
      SHEETS.GUILD_LEAGUE_AUCTION,
    );

  ensureGuildLeagueAuctionHeaders(
    sheet,
  );

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const indexes =
    getGuildLeagueAuctionColumnIndexes(
      values[0],
    );

  return values
    .slice(1)
    .filter(function (row) {
      return (
        normalizeStoredDate(
          row[indexes.eventDate],
        ) === normalizedEventDate
      );
    })
    .map(function (row) {
      return {
        auctionId: String(
          row[indexes.auctionId] || '',
        ).trim(),

        eventDate:
          normalizeStoredDate(
            row[indexes.eventDate],
          ),

        eventType: 'GuildLeague',

        partyNo:
          Number(
            row[indexes.partyNo],
          ) || 0,

        queueOwner: String(
          row[indexes.queueOwner] || '',
        ).trim(),

        soldTo: String(
          row[indexes.soldTo] || '',
        ).trim(),

        cardCount:
          Number(
            row[indexes.cardCount],
          ) || 0,

        whiteFeatherCount:
          Number(
            row[
              indexes.whiteFeatherCount
            ],
          ) || 0,

        redFeatherCount:
          Number(
            row[
              indexes.redFeatherCount
            ],
          ) || 0,

        updatedAt: String(
          row[indexes.updatedAt] || '',
        ).trim(),
      };
    })
    .sort(function (
      firstRecord,
      secondRecord,
    ) {
      return (
        firstRecord.partyNo -
        secondRecord.partyNo
      );
    });
}

function saveGuildLeagueAuctionData(
  eventDate,
  auction,
) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getRequiredSheet(
        SHEETS.GUILD_LEAGUE_AUCTION,
      );

    ensureGuildLeagueAuctionHeaders(
      sheet,
    );

    const existingValues =
      sheet
        .getDataRange()
        .getValues();

    const existingDisplayValues =
      sheet
        .getDataRange()
        .getDisplayValues();

    const indexes =
      getGuildLeagueAuctionColumnIndexes(
        existingDisplayValues[0],
      );

    /*
     * เก็บข้อมูลวันอื่นไว้
     * และลบเฉพาะข้อมูลของวันที่กำลังบันทึก
     */
    const remainingRows =
      existingValues
        .slice(1)
        .filter(function (
          row,
          rowIndex,
        ) {
          const displayRow =
            existingDisplayValues[
              rowIndex + 1
            ];

          const rowDate =
            normalizeStoredDate(
              displayRow[
                indexes.eventDate
              ],
            );

          return rowDate !== eventDate;
        });

    const updatedAt = new Date();

    const usedPartyNumbers = {};

    const newRows = auction.map(
      function (record) {
        const partyNo =
          normalizeAuctionPartyNumber(
            record &&
              record.partyNo,
          );

        if (usedPartyNumbers[partyNo]) {
          throw new Error(
            `พบข้อมูล Party ${partyNo} ซ้ำ`,
          );
        }

        usedPartyNumbers[partyNo] = true;

        const queueOwner = String(
          record &&
          record.queueOwner
            ? record.queueOwner
            : '',
        ).trim();

        const soldTo = String(
          record &&
          record.soldTo
            ? record.soldTo
            : '',
        ).trim();

        const cardCount =
          normalizeAuctionCount(
            record &&
              record.cardCount,
            'CardCount',
          );

        const whiteFeatherCount =
          normalizeAuctionCount(
            record &&
              record.whiteFeatherCount,
            'WhiteFeatherCount',
          );

        const redFeatherCount =
          normalizeAuctionCount(
            record &&
              record.redFeatherCount,
            'RedFeatherCount',
          );

        return [
          createGuildLeagueAuctionId(
            eventDate,
            partyNo,
          ),
          eventDate,
          partyNo,
          queueOwner,
          soldTo,
          cardCount,
          whiteFeatherCount,
          redFeatherCount,
          updatedAt,
        ];
      },
    );

    const allRows =
      remainingRows.concat(
        newRows,
      );

    sheet.clearContents();

    sheet
      .getRange(
        1,
        1,
        1,
        GUILD_LEAGUE_AUCTION_HEADERS.length,
      )
      .setValues([
        GUILD_LEAGUE_AUCTION_HEADERS,
      ]);

    if (allRows.length > 0) {
      sheet
        .getRange(
          2,
          1,
          allRows.length,
          GUILD_LEAGUE_AUCTION_HEADERS.length,
        )
        .setValues(allRows);
    }

    sheet
      .getRange('B:B')
      .setNumberFormat('@');

    sheet
      .getRange('I:I')
      .setNumberFormat(
        'yyyy-mm-dd hh:mm:ss',
      );

    sheet.autoResizeColumns(
      1,
      GUILD_LEAGUE_AUCTION_HEADERS.length,
    );
  } finally {
    lock.releaseLock();
  }
}

function createGuildLeagueAuctionId(
  eventDate,
  partyNo,
) {
  const compactDate =
    eventDate.replace(/-/g, '');

  return [
    compactDate,
    'GuildLeague',
    partyNo,
  ].join('_');
}
function normalizeAuctionPartyNumber(
  value,
) {
  const partyNo =
    Number(value);

  if (
    !Number.isInteger(partyNo) ||
    partyNo < 5 ||
    partyNo > 16
  ) {
    throw new Error(
      'PartyNo ต้องเป็นเลขจำนวนเต็มตั้งแต่ 5 ถึง 16',
    );
  }

  return partyNo;
}
function normalizeAuctionCount(
  value,
  fieldName,
) {
  const count =
    Number(value);

  if (
    !Number.isInteger(count) ||
    count < 0
  ) {
    throw new Error(
      `${fieldName} ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป`,
    );
  }

  return count;
}

function ensureGuildLeagueAuctionHeaders(
  sheet,
) {
  const lastColumn =
    sheet.getLastColumn();

  const firstRow =
    lastColumn > 0
      ? sheet
          .getRange(
            1,
            1,
            1,
            Math.max(
              lastColumn,
              GUILD_LEAGUE_AUCTION_HEADERS.length,
            ),
          )
          .getDisplayValues()[0]
      : [];

  const normalizedFirstRow =
    firstRow.map(normalizeHeader);

  const hasHeaders =
    GUILD_LEAGUE_AUCTION_HEADERS.every(
      function (header) {
        return normalizedFirstRow.includes(
          normalizeHeader(header),
        );
      },
    );

  if (!hasHeaders) {
    if (sheet.getLastRow() > 1) {
      throw new Error(
        'หัวตาราง GuildLeagueAuction ไม่ถูกต้อง กรุณาตรวจสอบชื่อคอลัมน์',
      );
    }

    sheet
      .getRange(
        1,
        1,
        1,
        GUILD_LEAGUE_AUCTION_HEADERS.length,
      )
      .setValues([
        GUILD_LEAGUE_AUCTION_HEADERS,
      ]);
  }
}
function getGuildLeagueAuctionColumnIndexes(
  headerRow,
) {
  const headers =
    headerRow.map(normalizeHeader);

  return {
    auctionId: findHeaderIndex(
      headers,
      [
        'auctionid',
        'auction id',
      ],
    ),

    eventDate: findHeaderIndex(
      headers,
      [
        'eventdate',
        'event date',
      ],
    ),

    partyNo: findHeaderIndex(
      headers,
      [
        'partyno',
        'party no',
      ],
    ),

    queueOwner: findHeaderIndex(
      headers,
      [
        'queueowner',
        'queue owner',
      ],
    ),

    soldTo: findHeaderIndex(
      headers,
      [
        'soldto',
        'sold to',
      ],
    ),

    cardCount: findHeaderIndex(
      headers,
      [
        'cardcount',
        'card count',
      ],
    ),

    whiteFeatherCount:
      findHeaderIndex(
        headers,
        [
          'whitefeathercount',
          'white feather count',
        ],
      ),

    redFeatherCount:
      findHeaderIndex(
        headers,
        [
          'redfeathercount',
          'red feather count',
        ],
      ),

    updatedAt: findHeaderIndex(
      headers,
      [
        'updatedat',
        'updated at',
      ],
    ),
  };
}

/* =========================================================
   OVERRUN AUCTION DATA
========================================================= */

function handleSaveOverrunAuction(
  payload,
) {
  const eventDate =
    normalizeDateString(
      payload.date,
    );

  const auction =
    payload.auction;

  if (!Array.isArray(auction)) {
    throw new Error(
      'รูปแบบข้อมูล auction ไม่ถูกต้อง',
    );
  }

  saveOverrunAuctionData(
    eventDate,
    auction,
  );

  return jsonResponse({
    success: true,
    message:
      `บันทึกข้อมูลประมูล Overrun วันที่ ${eventDate} สำเร็จ`,
  });
}

function getOverrunAuction(
  eventDate,
) {
  const normalizedEventDate =
    normalizeDateString(eventDate);

  const sheet =
    getRequiredSheet(
      SHEETS.OVERRUN_AUCTION,
    );

  ensureOverrunAuctionHeaders(
    sheet,
  );

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const indexes =
    getOverrunAuctionColumnIndexes(
      values[0],
    );

  return values
    .slice(1)
    .filter(function (row) {
      return (
        normalizeStoredDate(
          row[indexes.eventDate],
        ) === normalizedEventDate
      );
    })
    .map(function (row) {
      return {
        auctionId: String(
          row[indexes.auctionId] || '',
        ).trim(),

        eventDate:
          normalizeStoredDate(
            row[indexes.eventDate],
          ),

        eventType: 'Overrun',

        queueOrder:
          Number(
            row[indexes.queueNo],
          ) || 0,

        queueOwner: String(
          row[indexes.queueOwner] || '',
        ).trim(),

        soldTo: String(
          row[indexes.soldTo] || '',
        ).trim(),

        cardCount:
          Number(
            row[indexes.cardCount],
          ) || 0,

        whiteFeatherCount:
          Number(
            row[
              indexes.whiteFeatherCount
            ],
          ) || 0,

        redFeatherCount:
          Number(
            row[
              indexes.redFeatherCount
            ],
          ) || 0,

        updatedAt: String(
          row[indexes.updatedAt] || '',
        ).trim(),
      };
    })
    .sort(function (
      firstRecord,
      secondRecord,
    ) {
      return (
        firstRecord.queueOrder -
        secondRecord.queueOrder
      );
    });
}

function saveOverrunAuctionData(
  eventDate,
  auction,
) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getRequiredSheet(
        SHEETS.OVERRUN_AUCTION,
      );

    ensureOverrunAuctionHeaders(
      sheet,
    );

    const existingValues =
      sheet
        .getDataRange()
        .getValues();

    const existingDisplayValues =
      sheet
        .getDataRange()
        .getDisplayValues();

    const indexes =
      getOverrunAuctionColumnIndexes(
        existingDisplayValues[0],
      );

    const remainingRows =
      existingValues
        .slice(1)
        .filter(function (
          row,
          rowIndex,
        ) {
          const displayRow =
            existingDisplayValues[
              rowIndex + 1
            ];

          const rowDate =
            normalizeStoredDate(
              displayRow[
                indexes.eventDate
              ],
            );

          return rowDate !== eventDate;
        });

    const updatedAt = new Date();
    const usedQueueNumbers = {};

    const newRows = auction.map(
      function (record) {
        const queueNo =
          normalizeOverrunAuctionQueueNumber(
            record &&
              (
                record.queueOrder ??
                record.queueNo
              ),
          );

        if (
          usedQueueNumbers[
            queueNo
          ]
        ) {
          throw new Error(
            `พบข้อมูล Queue ${queueNo} ซ้ำ`,
          );
        }

        usedQueueNumbers[
          queueNo
        ] = true;

        const queueOwner = String(
          record &&
          record.queueOwner
            ? record.queueOwner
            : '',
        ).trim();

        if (!queueOwner) {
          throw new Error(
            `Queue ${queueNo} ไม่มีเจ้าของสิทธิ`,
          );
        }

        const soldTo = String(
          record &&
          record.soldTo
            ? record.soldTo
            : '',
        ).trim();

        const cardCount =
          normalizeAuctionCount(
            record &&
              record.cardCount,
            'CardCount',
          );

        const whiteFeatherCount =
          normalizeAuctionCount(
            record &&
              record.whiteFeatherCount,
            'WhiteFeatherCount',
          );

        const redFeatherCount =
          normalizeAuctionCount(
            record &&
              record.redFeatherCount,
            'RedFeatherCount',
          );

        return [
          createOverrunAuctionId(
            eventDate,
            queueNo,
          ),
          eventDate,
          queueNo,
          queueOwner,
          soldTo,
          cardCount,
          whiteFeatherCount,
          redFeatherCount,
          updatedAt,
        ];
      },
    );

    const allRows =
      remainingRows.concat(
        newRows,
      );

    sheet.clearContents();

    sheet
      .getRange(
        1,
        1,
        1,
        OVERRUN_AUCTION_HEADERS.length,
      )
      .setValues([
        OVERRUN_AUCTION_HEADERS,
      ]);

    if (allRows.length > 0) {
      sheet
        .getRange(
          2,
          1,
          allRows.length,
          OVERRUN_AUCTION_HEADERS.length,
        )
        .setValues(allRows);
    }

    sheet
      .getRange('B:B')
      .setNumberFormat('@');

    sheet
      .getRange('I:I')
      .setNumberFormat(
        'yyyy-mm-dd hh:mm:ss',
      );

    sheet.autoResizeColumns(
      1,
      OVERRUN_AUCTION_HEADERS.length,
    );
  } finally {
    lock.releaseLock();
  }
}

function createOverrunAuctionId(
  eventDate,
  queueNo,
) {
  const compactDate =
    eventDate.replace(/-/g, '');

  return [
    compactDate,
    'Overrun',
    queueNo,
  ].join('_');
}

function normalizeOverrunAuctionQueueNumber(
  value,
) {
  const queueNo =
    Number(value);

  if (
    !Number.isInteger(queueNo) ||
    queueNo < 1 ||
    queueNo > OVERRUN_QUEUE_SIZE
  ) {
    throw new Error(
      `QueueNo ต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง ${OVERRUN_QUEUE_SIZE}`,
    );
  }

  return queueNo;
}

function ensureOverrunAuctionHeaders(
  sheet,
) {
  ensureSheetHeaders(
    sheet,
    OVERRUN_AUCTION_HEADERS,
    'OverrunAuction',
  );
}

function getOverrunAuctionColumnIndexes(
  headerRow,
) {
  const headers =
    headerRow.map(normalizeHeader);

  return {
    auctionId: findHeaderIndex(
      headers,
      [
        'auctionid',
        'auction id',
      ],
    ),

    eventDate: findHeaderIndex(
      headers,
      [
        'eventdate',
        'event date',
      ],
    ),

    queueNo: findHeaderIndex(
      headers,
      [
        'queueno',
        'queue no',
        'queueorder',
        'queue order',
      ],
    ),

    queueOwner: findHeaderIndex(
      headers,
      [
        'queueowner',
        'queue owner',
      ],
    ),

    soldTo: findHeaderIndex(
      headers,
      [
        'soldto',
        'sold to',
      ],
    ),

    cardCount: findHeaderIndex(
      headers,
      [
        'cardcount',
        'card count',
      ],
    ),

    whiteFeatherCount:
      findHeaderIndex(
        headers,
        [
          'whitefeathercount',
          'white feather count',
        ],
      ),

    redFeatherCount:
      findHeaderIndex(
        headers,
        [
          'redfeathercount',
          'red feather count',
        ],
      ),

    updatedAt: findHeaderIndex(
      headers,
      [
        'updatedat',
        'updated at',
      ],
    ),
  };
}

/* =========================================================
   OVERRUN QUEUE & RESULT
========================================================= */

function getOverrunQueue() {
  const sheet =
    getRequiredSheet(
      SHEETS.OVERRUN_QUEUE,
    );

  ensureOverrunQueueHeaders(
    sheet,
  );

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  if (values.length < 2) {
    return [];
  }

  const indexes =
    getOverrunQueueColumnIndexes(
      values[0],
    );

  return values
    .slice(1)
    .map(function (row) {
      return {
        queueOrder:
          Number(
            row[indexes.queueNo],
          ) || 0,

        memberId: String(
          row[indexes.memberId] || '',
        ).trim(),

        memberName: String(
          row[indexes.ign] || '',
        ).trim(),
      };
    })
    .filter(function (item) {
      return (
        item.queueOrder > 0 &&
        item.memberName !== ''
      );
    })
    .sort(function (
      firstItem,
      secondItem,
    ) {
      return (
        firstItem.queueOrder -
        secondItem.queueOrder
      );
    })
    .map(function (item, index) {
      return {
        queueOrder: index + 1,
        memberId: item.memberId,
        memberName: item.memberName,
      };
    });
}

function handleSaveOverrunQueue(
  payload,
) {
  const queue = payload.queue;

  if (!Array.isArray(queue)) {
    throw new Error(
      'รูปแบบข้อมูล queue ไม่ถูกต้อง',
    );
  }

  saveOverrunQueueData(queue);

  return jsonResponse({
    success: true,
    message:
      'บันทึกคิวประมูล Overrun สำเร็จ',
  });
}

function saveOverrunQueueData(
  queue,
) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getRequiredSheet(
        SHEETS.OVERRUN_QUEUE,
      );

    ensureOverrunQueueHeaders(
      sheet,
    );

    const memberIdByIgn =
      getMemberIdByIgnMap();

    const normalizedQueue =
      normalizeOverrunQueue(queue);

    const rows =
      normalizedQueue.map(
        function (item, index) {
          const memberName =
            item.memberName;

          return [
            index + 1,
            memberIdByIgn[
              memberName
            ] || '',
            memberName,
          ];
        },
      );

    writeOverrunQueueRows(
      sheet,
      rows,
    );
  } finally {
    lock.releaseLock();
  }
}

function handleConfirmOverrunResult(payload) {

  const eventDate =
    normalizeDateString(
      payload.eventDate,
    );

  const result =
    normalizeOverrunResult(
      payload.result,
    );

  const noItemMember =
    String(
      payload.noItemMember || '',
    ).trim();

  const queueSize = Number(
    payload.queueSize,
  );

  if (queueSize !== OVERRUN_QUEUE_SIZE) {
    throw new Error(
      `ขนาดคิว Overrun ไม่ถูกต้อง ต้องเป็น ${OVERRUN_QUEUE_SIZE} คน`,
    );
  }

  const queueBefore =
    normalizeMemberNameArray(
      payload.queueBefore,
      'queueBefore',
    );

  const queueAfter =
    normalizeMemberNameArray(
      payload.queueAfter,
      'queueAfter',
    );

  if (
    queueBefore.length <
    OVERRUN_QUEUE_SIZE
  ) {
    throw new Error(
      `คิวก่อนยืนยันผลต้องมีอย่างน้อย ${OVERRUN_QUEUE_SIZE} คน`,
    );
  }

  if (result === 'lose') {
    if (!noItemMember) {
      throw new Error(
        'กรุณาระบุคนที่ไม่ได้ประมูล',
      );
    }

    const currentQueue =
      queueBefore.slice(
        0,
        OVERRUN_QUEUE_SIZE,
      );

    if (
      !currentQueue.includes(
        noItemMember,
      )
    ) {
      throw new Error(
        `คนที่ไม่ได้ประมูลต้องอยู่ใน ${OVERRUN_QUEUE_SIZE} คนแรก`,
      );
    }
  }

  confirmOverrunResultData({
    eventDate,
    result,
    noItemMember:
      result === 'lose'
        ? noItemMember
        : '',
    queueSize,
    queueBefore,
    queueAfter,
  });

  return jsonResponse({
    success: true,
    message:
      `ยืนยันผล Overrun วันที่ ${eventDate} สำเร็จ`,
  });
}

function confirmOverrunResultData(
  data,
) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const queueSheet =
      getRequiredSheet(
        SHEETS.OVERRUN_QUEUE,
      );

    const historySheet =
      getRequiredSheet(
        SHEETS.OVERRUN_HISTORY,
      );

    ensureOverrunQueueHeaders(
      queueSheet,
    );

    ensureOverrunHistoryHeaders(
      historySheet,
    );

    const currentStoredQueue =
      getOverrunQueue().map(
        function (item) {
          return item.memberName;
        },
      );

    if (
      JSON.stringify(
        currentStoredQueue,
      ) !==
      JSON.stringify(
        data.queueBefore,
      )
    ) {
      throw new Error(
        'คิวมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่ก่อนยืนยันผล',
      );
    }

    const expectedQueueAfter =
      calculateOverrunQueueAfter(
        data.queueBefore,
        data.result,
        data.noItemMember,
        data.queueSize,
      );

    const firstMismatchIndex =
      findFirstQueueMismatchIndex(
        expectedQueueAfter,
        data.queueAfter,
      );

    console.log(
      JSON.stringify({
        diagnostic:
          'Overrun confirm validation',
        queueSize: data.queueSize,
        queueBeforeLength:
          data.queueBefore.length,
        queueAfterLength:
          data.queueAfter.length,
        expectedQueueAfter,
        queueAfter: data.queueAfter,
        firstMismatchIndex,
      }),
    );

    if (firstMismatchIndex !== -1) {
      throw new Error(
        'ข้อมูลคิวรอบถัดไปไม่ถูกต้อง กรุณาสร้าง Preview ใหม่',
      );
    }

    const memberIdByIgn =
      getMemberIdByIgnMap();

    const queueRows =
      data.queueAfter.map(
        function (
          memberName,
          index,
        ) {
          return [
            index + 1,
            memberIdByIgn[
              memberName
            ] || '',
            memberName,
          ];
        },
      );

    writeOverrunQueueRows(
      queueSheet,
      queueRows,
    );

    appendOverrunHistory(
      historySheet,
      data,
    );
  } finally {
    lock.releaseLock();
  }
}

function calculateOverrunQueueAfter(
  queueBefore,
  result,
  noItemMember,
  queueSize,
) {
  const waitingQueue =
    queueBefore.slice(
      queueSize,
    );

  if (result === 'win') {
    return waitingQueue;
  }

  return [
    noItemMember,
    ...waitingQueue,
  ];
}

function findFirstQueueMismatchIndex(
  expectedQueue,
  actualQueue,
) {
  const sharedLength = Math.min(
    expectedQueue.length,
    actualQueue.length,
  );

  for (let index = 0; index < sharedLength; index += 1) {
    if (expectedQueue[index] !== actualQueue[index]) {
      return index;
    }
  }

  return expectedQueue.length === actualQueue.length
    ? -1
    : sharedLength;
}

function appendOverrunHistory(
  sheet,
  data,
) {
  const historyId =
    createOverrunHistoryId(
      data.eventDate,
    );

  const updatedAt =
    new Date();

  const row = [
    historyId,
    data.eventDate,
    data.result,
    data.noItemMember,
    JSON.stringify(
      data.queueBefore,
    ),
    JSON.stringify(
      data.queueAfter,
    ),
    updatedAt,
  ];

  sheet.appendRow(row);

  sheet
    .getRange('B:B')
    .setNumberFormat('@');

  sheet
    .getRange('G:G')
    .setNumberFormat(
      'yyyy-mm-dd hh:mm:ss',
    );

  sheet.autoResizeColumns(
    1,
    OVERRUN_HISTORY_HEADERS.length,
  );
}

function writeOverrunQueueRows(
  sheet,
  rows,
) {
  sheet.clearContents();

  sheet
    .getRange(
      1,
      1,
      1,
      OVERRUN_QUEUE_HEADERS.length,
    )
    .setValues([
      OVERRUN_QUEUE_HEADERS,
    ]);

  if (rows.length > 0) {
    sheet
      .getRange(
        2,
        1,
        rows.length,
        OVERRUN_QUEUE_HEADERS.length,
      )
      .setValues(rows);
  }

  sheet.autoResizeColumns(
    1,
    OVERRUN_QUEUE_HEADERS.length,
  );
}

function normalizeOverrunQueue(
  queue,
) {
  const usedNames = {};

  return queue
    .map(function (
      item,
      index,
    ) {
      const memberName =
        String(
          item &&
          item.memberName
            ? item.memberName
            : '',
        ).trim();

      const queueOrder =
        Number(
          item &&
          item.queueOrder,
        ) || index + 1;

      return {
        queueOrder,
        memberName,
      };
    })
    .filter(function (item) {
      return (
        item.memberName !== ''
      );
    })
    .sort(function (
      firstItem,
      secondItem,
    ) {
      return (
        firstItem.queueOrder -
        secondItem.queueOrder
      );
    })
    .map(function (item, index) {
      if (
        usedNames[
          item.memberName
        ]
      ) {
        throw new Error(
          `พบชื่อ ${item.memberName} ซ้ำในคิว`,
        );
      }

      usedNames[
        item.memberName
      ] = true;

      return {
        queueOrder: index + 1,
        memberName:
          item.memberName,
      };
    });
}

function normalizeMemberNameArray(
  value,
  fieldName,
) {
  if (!Array.isArray(value)) {
    throw new Error(
      `${fieldName} ต้องเป็น Array`,
    );
  }

  const usedNames = {};

  return value.map(
    function (memberName) {
      const cleanMemberName =
        String(
          memberName || '',
        ).trim();

      if (!cleanMemberName) {
        throw new Error(
          `${fieldName} มีชื่อสมาชิกว่าง`,
        );
      }

      if (
        usedNames[
          cleanMemberName
        ]
      ) {
        throw new Error(
          `${fieldName} มีชื่อ ${cleanMemberName} ซ้ำ`,
        );
      }

      usedNames[
        cleanMemberName
      ] = true;

      return cleanMemberName;
    },
  );
}

function normalizeOverrunResult(
  value,
) {
  const result =
    String(
      value || '',
    ).trim();

  if (
    result !== 'win' &&
    result !== 'lose'
  ) {
    throw new Error(
      'ผล Overrun ต้องเป็น win หรือ lose',
    );
  }

  return result;
}

function getMemberIdByIgnMap() {
  const members =
    getMembers();

  const result = {};

  members.forEach(
    function (member) {
      const ign =
        String(
          member.ign || '',
        ).trim();

      if (ign) {
        result[ign] =
          String(
            member.memberId || '',
          ).trim();
      }
    },
  );

  return result;
}

function createOverrunHistoryId(
  eventDate,
) {
  const compactDate =
    eventDate.replace(/-/g, '');

  return [
    compactDate,
    'Overrun',
    new Date().getTime(),
  ].join('_');
}

function ensureOverrunQueueHeaders(
  sheet,
) {
  ensureSheetHeaders(
    sheet,
    OVERRUN_QUEUE_HEADERS,
    'OverrunQueue',
  );
}

function ensureOverrunHistoryHeaders(
  sheet,
) {
  ensureSheetHeaders(
    sheet,
    OVERRUN_HISTORY_HEADERS,
    'OverrunAuctionHistory',
  );
}

function ensureSheetHeaders(
  sheet,
  expectedHeaders,
  sheetLabel,
) {
  const lastColumn =
    sheet.getLastColumn();

  const firstRow =
    lastColumn > 0
      ? sheet
          .getRange(
            1,
            1,
            1,
            Math.max(
              lastColumn,
              expectedHeaders.length,
            ),
          )
          .getDisplayValues()[0]
      : [];

  const normalizedFirstRow =
    firstRow.map(
      normalizeHeader,
    );

  const hasHeaders =
    expectedHeaders.every(
      function (header) {
        return normalizedFirstRow.includes(
          normalizeHeader(header),
        );
      },
    );

  if (!hasHeaders) {
    if (
      sheet.getLastRow() > 1
    ) {
      throw new Error(
        `หัวตาราง ${sheetLabel} ไม่ถูกต้อง กรุณาตรวจสอบชื่อคอลัมน์`,
      );
    }

    sheet
      .getRange(
        1,
        1,
        1,
        expectedHeaders.length,
      )
      .setValues([
        expectedHeaders,
      ]);
  }
}

function getOverrunQueueColumnIndexes(
  headerRow,
) {
  const headers =
    headerRow.map(
      normalizeHeader,
    );

  return {
    queueNo: findHeaderIndex(
      headers,
      [
        'queueno',
        'queue no',
      ],
    ),

    memberId: findHeaderIndex(
      headers,
      [
        'memberid',
        'member id',
      ],
    ),

    ign: findHeaderIndex(
      headers,
      ['ign'],
    ),
  };
}




/* =========================================================
   WAR PLANNER
========================================================= */

const LEGACY_WAR_PLANNER_KEY = 'default';
const DEFAULT_WAR_MAP_ID = 'guild-war-default';

function handleSaveWarPlanner(payload) {
  const plan = payload.plan;

  validateWarPlannerData(plan);
  saveWarPlannerData(plan);

  return jsonResponse({
    success: true,
    message:
      `บันทึก War Planner ของแมพ ${plan.mapId} สำเร็จ`,
  });
}

function getWarPlannerData(mapIdValue) {
  const mapId = normalizeWarMapId(
    mapIdValue || DEFAULT_WAR_MAP_ID,
  );

  const sheet = getRequiredSheet(
    SHEETS.WAR_PLANNER,
  );

  ensureSheetHeaders(
    sheet,
    WAR_PLANNER_HEADERS,
    'WarPlanner',
  );

  const values = sheet
    .getDataRange()
    .getDisplayValues();

  if (values.length < 2) {
    return null;
  }

  const headers =
    values[0].map(normalizeHeader);

  const planKeyIndex = findHeaderIndex(
    headers,
    ['plankey', 'plan key'],
  );

  const planJsonIndex = findHeaderIndex(
    headers,
    ['planjson', 'plan json'],
  );

  let row = values
    .slice(1)
    .find(function (currentRow) {
      return String(
        currentRow[planKeyIndex] || '',
      ).trim() === mapId;
    });

  /*
   * รองรับข้อมูลเก่าที่เคยบันทึกด้วย PlanKey = default
   * โดยย้ายมาใช้กับแมพหลักอัตโนมัติ
   */
  if (
    !row &&
    mapId === DEFAULT_WAR_MAP_ID
  ) {
    row = values
      .slice(1)
      .find(function (currentRow) {
        return String(
          currentRow[planKeyIndex] || '',
        ).trim() === LEGACY_WAR_PLANNER_KEY;
      });
  }

  if (!row) {
    return null;
  }

  const jsonText = String(
    row[planJsonIndex] || '',
  ).trim();

  if (!jsonText) {
    return null;
  }

  const plan = JSON.parse(jsonText);

  if (!plan.mapId) {
    plan.mapId = mapId;
  }

  validateWarPlannerData(plan);

  if (plan.mapId !== mapId) {
    throw new Error(
      'MapID ในข้อมูล War Planner ไม่ตรงกับแมพที่ร้องขอ',
    );
  }

  return plan;
}

function saveWarPlannerData(plan) {
  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getRequiredSheet(
      SHEETS.WAR_PLANNER,
    );

    ensureSheetHeaders(
      sheet,
      WAR_PLANNER_HEADERS,
      'WarPlanner',
    );

    const existingValues = sheet
      .getDataRange()
      .getValues();

    const headers =
      existingValues.length > 0
        ? existingValues[0]
        : WAR_PLANNER_HEADERS;

    const normalizedHeaders =
      headers.map(normalizeHeader);

    const planKeyIndex = findHeaderIndex(
      normalizedHeaders,
      ['plankey', 'plan key'],
    );

    const keysToReplace = {};
    keysToReplace[plan.mapId] = true;

    if (
      plan.mapId === DEFAULT_WAR_MAP_ID
    ) {
      keysToReplace[
        LEGACY_WAR_PLANNER_KEY
      ] = true;
    }

    const remainingRows =
      existingValues
        .slice(1)
        .filter(function (row) {
          const rowKey = String(
            row[planKeyIndex] || '',
          ).trim();

          return !keysToReplace[rowKey];
        });

    const newRow = [
      plan.mapId,
      JSON.stringify(plan),
      new Date(),
    ];

    const allRows =
      remainingRows.concat([newRow]);

    sheet.clearContents();

    sheet
      .getRange(
        1,
        1,
        1,
        WAR_PLANNER_HEADERS.length,
      )
      .setValues([
        WAR_PLANNER_HEADERS,
      ]);

    if (allRows.length > 0) {
      sheet
        .getRange(
          2,
          1,
          allRows.length,
          WAR_PLANNER_HEADERS.length,
        )
        .setValues(allRows);
    }

    sheet
      .getRange('C:C')
      .setNumberFormat(
        'yyyy-mm-dd hh:mm:ss',
      );

    sheet.autoResizeColumns(
      1,
      WAR_PLANNER_HEADERS.length,
    );
  } finally {
    lock.releaseLock();
  }
}

function validateWarPlannerData(plan) {
  if (
    !plan ||
    typeof plan !== 'object'
  ) {
    throw new Error(
      'รูปแบบข้อมูล War Planner ไม่ถูกต้อง',
    );
  }

  plan.mapId = normalizeWarMapId(
    plan.mapId,
  );

  const phaseIds = [
    'running-lines',
    'start',
    '15-minutes',
    '10-minutes',
  ];

  const stateKeys = [
    'markersByPhase',
    'routesByPhase',
    'notesByPhase',
    'areasByPhase',
  ];

  stateKeys.forEach(function (stateKey) {
    const state = plan[stateKey];

    if (
      !state ||
      typeof state !== 'object'
    ) {
      throw new Error(
        `ข้อมูล ${stateKey} ไม่ถูกต้อง`,
      );
    }

    phaseIds.forEach(function (phaseId) {
      if (!Array.isArray(state[phaseId])) {
        throw new Error(
          `ข้อมูล ${stateKey}.${phaseId} ต้องเป็น Array`,
        );
      }
    });
  });
}

function normalizeWarMapId(value) {
  const mapId = String(
    value || '',
  ).trim();

  if (!mapId) {
    throw new Error(
      'กรุณาระบุ MapID ของ War Planner',
    );
  }

  if (
    !/^[a-z0-9][a-z0-9-]{1,59}$/.test(
      mapId,
    )
  ) {
    throw new Error(
      'MapID ใช้ได้เฉพาะ a-z, 0-9 และเครื่องหมาย -',
    );
  }

  return mapId;
}

/* =========================================================
   COMMON UTILITIES
========================================================= */

function getRequiredSheet(sheetName) {
  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      `ไม่พบชีตชื่อ "${sheetName}"`,
    );
  }

  return sheet;
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function findHeaderIndex(
  headers,
  acceptedNames,
) {
  const normalizedNames =
    acceptedNames.map(normalizeHeader);

  const index =
    headers.findIndex(
      function (header) {
        return normalizedNames.includes(
          header,
        );
      },
    );

  if (index === -1) {
    throw new Error(
      `ไม่พบหัวคอลัมน์: ${acceptedNames.join(
        ' หรือ ',
      )}`,
    );
  }

  return index;
}

function getErrorMessage(error) {
  if (
    error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        data,
        null,
        2,
      ),
    )
    .setMimeType(
      ContentService.MimeType.JSON,
    );
}
