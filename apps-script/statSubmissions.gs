/**
 * Stat-submission module for the existing Google Apps Script Web App.
 * Add the routing calls documented in apps-script/README.md to the existing
 * doGet/doPost instead of defining a second router here.
 */
const STAT_SUBMISSION_SHEET = 'StatSubmissions';
const STAT_FOCUS_CONFIG_SHEET = 'StatFocusConfig';
const STAT_HEADERS = [
  'id',
  'memberId',
  'ign',
  'submittedByDiscordId',
  'submittedByDiscordName',
  'submittedAt',
  'statsJson',
];
const CHARACTER_STAT_KEYS = [
  'hp', 'patk', 'matk', 'pdef', 'mdef', 'crit', 'critDmg', 'critRes',
  'critDmgRes', 'pdmg', 'mdmg', 'pdmgReduction', 'mdmgReduction',
  'ignorePdef', 'ignoreMdef', 'pvpDmgBonus', 'pvpDmgReduction',
  'healingDone', 'healingTaken', 'maxHpPercent', 'equipmentPatkPercent',
  'equipmentMatkPercent', 'equipmentPdefPercent', 'equipmentMdefPercent',
  'dmgVsDemiHuman', 'dmgReductionVsDemiHuman', 'dmgVsMedium',
  'dmgReductionVsMedium',
];
const STAT_FOCUS_CONFIG_HEADERS = [
  'className', 'statKeysJson', 'criteriaJson', 'updatedAt',
];
const MAX_FOCUS_STATS = 10;

function handleStatGetAction(action, parameters) {
  if (action === 'getMemberStatSubmissions') {
    return {
      handled: true,
      data: getMemberStatSubmissions_(requiredString_(parameters.memberId, 'memberId')),
    };
  }
  if (action === 'getLatestMemberStats') {
    return {
      handled: true,
      data: getLatestMemberStats_(requiredString_(parameters.memberId, 'memberId')),
    };
  }
  if (action === 'getLatestGuildStats') {
    return {
      handled: true,
      data: getLatestGuildStats_(),
    };
  }
  if (action === 'getStatFocusConfig') {
    return {
      handled: true,
      data: getStatFocusConfig_(),
    };
  }
  return { handled: false };
}

function handleStatPostAction(action, body) {
  if (action === 'saveStatSubmission') {
    const submission = saveStatSubmission_(body);
    return {
      handled: true,
      data: submission,
      message: 'Stat submission saved',
    };
  }
  if (action === 'saveStatFocusConfig') {
    const config = saveStatFocusConfig_(body);
    return {
      handled: true,
      data: config,
      message: 'Stat focus config saved',
    };
  }
  return { handled: false };
}

function saveStatSubmission_(body) {
  const memberId = requiredString_(body.memberId, 'memberId');
  const discordId = requiredString_(body.submittedByDiscordId, 'submittedByDiscordId');
  const member = findMemberById_(memberId);
  if (!member) throw new Error('Member not found');

  const stats = validateStats_(body.stats);
  if (Object.keys(stats).length === 0) throw new Error('At least one valid stat is required');

  const submission = {
    id: Utilities.getUuid(),
    memberId: member.memberId,
    ign: member.ign,
    submittedByDiscordId: discordId,
    submittedByDiscordName: optionalString_(body.submittedByDiscordName),
    submittedAt: new Date().toISOString(),
    stats: stats,
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getStatSheet_();
    sheet.appendRow([
      submission.id,
      submission.memberId,
      submission.ign,
      submission.submittedByDiscordId,
      submission.submittedByDiscordName || '',
      submission.submittedAt,
      JSON.stringify(submission.stats),
    ]);
  } finally {
    lock.releaseLock();
  }
  return submission;
}

function getMemberStatSubmissions_(memberId) {
  if (!findMemberById_(memberId)) throw new Error('Member not found');
  const sheet = getStatSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, STAT_HEADERS.length)
    .getValues()
    .filter(function (row) { return String(row[1]) === memberId; })
    .map(statRowToObject_)
    .sort(function (a, b) { return b.submittedAt.localeCompare(a.submittedAt); });
}

function getLatestMemberStats_(memberId) {
  const history = getMemberStatSubmissions_(memberId);
  return history.length ? history[0] : null;
}

function getLatestGuildStats_() {
  const sheet = getStatSheet_();
  if (sheet.getLastRow() < 2) return [];

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, STAT_HEADERS.length)
    .getValues();
  const latestByMemberId = {};

  rows.forEach(function (row, rowIndex) {
    const submission = statRowToObject_(row);
    const memberId = submission.memberId;
    const parsedSubmittedTime = new Date(submission.submittedAt).getTime();
    const submittedTime = isNaN(parsedSubmittedTime)
      ? Number.NEGATIVE_INFINITY
      : parsedSubmittedTime;
    const current = latestByMemberId[memberId];

    if (
      !current
      || submittedTime > current.submittedTime
      || (submittedTime === current.submittedTime && rowIndex > current.rowIndex)
    ) {
      latestByMemberId[memberId] = {
        submission: submission,
        submittedTime: submittedTime,
        rowIndex: rowIndex,
      };
    }
  });

  return Object.keys(latestByMemberId).map(function (memberId) {
    return latestByMemberId[memberId].submission;
  });
}

function statRowToObject_(row) {
  return {
    id: String(row[0]),
    memberId: String(row[1]),
    ign: String(row[2]),
    submittedByDiscordId: String(row[3]),
    submittedByDiscordName: row[4] ? String(row[4]) : undefined,
    submittedAt: row[5] instanceof Date ? row[5].toISOString() : String(row[5]),
    stats: validateStats_(JSON.parse(String(row[6]) || '{}')),
  };
}

function getStatFocusConfig_() {
  const sheet = getStatFocusConfigSheet_();
  if (sheet.getLastRow() < 2) return [];

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, STAT_FOCUS_CONFIG_HEADERS.length)
    .getValues()
    .filter(function (row) { return String(row[0]).trim(); })
    .map(function (row) {
      const statKeys = validateFocusStatKeys_(JSON.parse(String(row[1]) || '[]'));
      return {
        className: String(row[0]).trim(),
        statKeys: statKeys,
        criteria: validateStatCriteria_(
          JSON.parse(String(row[2]) || '[]'),
          statKeys,
        ),
      };
    });
}

function saveStatFocusConfig_(body) {
  const className = requiredString_(body.className, 'className');
  const statKeys = validateFocusStatKeys_(body.statKeys);
  const criteria = validateStatCriteria_(body.criteria || [], statKeys);
  const updatedAt = new Date().toISOString();
  const sheet = getStatFocusConfigSheet_();
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);
  try {
    const lastRow = sheet.getLastRow();
    let targetRow = -1;
    if (lastRow >= 2) {
      const classNames = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let index = 0; index < classNames.length; index += 1) {
        if (String(classNames[index][0]).trim() === className) {
          targetRow = index + 2;
          break;
        }
      }
    }

    const values = [[
      className,
      JSON.stringify(statKeys),
      JSON.stringify(criteria),
      updatedAt,
    ]];
    if (targetRow === -1) sheet.appendRow(values[0]);
    else sheet.getRange(targetRow, 1, 1, values[0].length).setValues(values);
  } finally {
    lock.releaseLock();
  }

  return { className: className, statKeys: statKeys, criteria: criteria };
}

function validateFocusStatKeys_(input) {
  if (!Array.isArray(input)) throw new Error('statKeys must be an array');
  if (input.length < 1 || input.length > MAX_FOCUS_STATS) {
    throw new Error('statKeys must contain between 1 and ' + MAX_FOCUS_STATS + ' items');
  }

  const seen = {};
  return input.map(function (key) {
    if (typeof key !== 'string' || CHARACTER_STAT_KEYS.indexOf(key) < 0) {
      throw new Error('Unknown focus stat key: ' + key);
    }
    if (seen[key]) throw new Error('Duplicate focus stat key: ' + key);
    seen[key] = true;
    return key;
  });
}

function validateStatCriteria_(input, statKeys) {
  if (!Array.isArray(input)) throw new Error('criteria must be an array');

  const seen = {};
  return input.map(function (criterion) {
    if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) {
      throw new Error('Each criterion must be an object');
    }
    const statKey = criterion.statKey;
    if (typeof statKey !== 'string' || CHARACTER_STAT_KEYS.indexOf(statKey) < 0) {
      throw new Error('Unknown criterion stat key: ' + statKey);
    }
    if (statKeys.indexOf(statKey) < 0) {
      throw new Error('Criterion stat key must be included in statKeys: ' + statKey);
    }
    if (seen[statKey]) throw new Error('Duplicate criterion stat key: ' + statKey);
    if (criterion.operator !== 'gte' && criterion.operator !== 'lte') {
      throw new Error('Criterion operator must be gte or lte: ' + statKey);
    }
    if (typeof criterion.target !== 'number' || !isFinite(criterion.target)) {
      throw new Error('Criterion target must be a finite number: ' + statKey);
    }

    seen[statKey] = true;
    return {
      statKey: statKey,
      operator: criterion.operator,
      target: criterion.target,
    };
  });
}

function getStatFocusConfigSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(STAT_FOCUS_CONFIG_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(STAT_FOCUS_CONFIG_SHEET);
    sheet.getRange(1, 1, 1, STAT_FOCUS_CONFIG_HEADERS.length)
      .setValues([STAT_FOCUS_CONFIG_HEADERS]);
    sheet.setFrozenRows(1);
  } else if (String(sheet.getRange(1, 3).getValue()) === 'updatedAt') {
    sheet.insertColumnAfter(2);
    sheet.getRange(1, 3).setValue('criteriaJson');
  }
  return sheet;
}

function getStatSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(STAT_SUBMISSION_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(STAT_SUBMISSION_SHEET);
    sheet.getRange(1, 1, 1, STAT_HEADERS.length).setValues([STAT_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findMemberById_(memberId) {
  const members = getMembers();
  for (let index = 0; index < members.length; index += 1) {
    if (String(members[index].memberId) === String(memberId)) {
      return {
        memberId: members[index].memberId,
        ign: members[index].ign,
      };
    }
  }
  return null;
}

function validateStats_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('stats must be an object');
  }
  const output = {};
  CHARACTER_STAT_KEYS.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const value = input[key];
      if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error('Invalid stat value: ' + key);
      }
      output[key] = value;
    }
  });
  Object.keys(input).forEach(function (key) {
    if (CHARACTER_STAT_KEYS.indexOf(key) < 0) throw new Error('Unknown stat key: ' + key);
  });
  return output;
}

function requiredString_(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(fieldName + ' is required');
  return value.trim();
}

function optionalString_(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
