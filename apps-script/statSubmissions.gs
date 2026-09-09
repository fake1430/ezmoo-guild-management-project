/**
 * Stat-submission module for the existing Google Apps Script Web App.
 * Add the routing calls documented in apps-script/README.md to the existing
 * doGet/doPost instead of defining a second router here.
 */
const STAT_SUBMISSION_SHEET = 'StatSubmissions';
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
  return { handled: false };
}

function handleStatPostAction(action, body) {
  if (action !== 'saveStatSubmission') return { handled: false };
  const submission = saveStatSubmission_(body);
  return {
    handled: true,
    data: submission,
    message: 'Stat submission saved',
  };
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
