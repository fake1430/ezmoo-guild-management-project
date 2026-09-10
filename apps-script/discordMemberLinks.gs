/** Discord-to-member mapping module for the existing Apps Script Web App. */
const DISCORD_MEMBER_LINKS_SHEET = 'DiscordMemberLinks';
const DISCORD_MEMBER_LINK_HEADERS = [
  'discordUserId', 'memberId', 'linkedAt', 'linkedByDiscordId',
];

function handleDiscordMemberLinkGetAction(action) {
  if (action !== 'getDiscordMemberLinks') return { handled: false };
  return { handled: true, data: getDiscordMemberLinks_() };
}

function handleDiscordMemberLinkPostAction(action, body) {
  if (action === 'saveDiscordMemberLink') {
    return {
      handled: true,
      data: saveDiscordMemberLink_(body),
      message: 'Discord member link saved',
    };
  }
  if (action === 'deleteDiscordMemberLink') {
    return {
      handled: true,
      data: deleteDiscordMemberLink_(body),
      message: 'Discord member link deleted',
    };
  }
  return { handled: false };
}

function getDiscordMemberLinks_() {
  const sheet = getDiscordMemberLinksSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, DISCORD_MEMBER_LINK_HEADERS.length)
    .getValues()
    .filter(function (row) { return String(row[0]).trim() && String(row[1]).trim(); })
    .map(discordMemberLinkRowToObject_);
}

function saveDiscordMemberLink_(body) {
  const discordUserId = requiredDiscordLinkString_(body.discordUserId, 'discordUserId');
  const memberId = requiredDiscordLinkString_(body.memberId, 'memberId');
  const linkedByDiscordId = requiredDiscordLinkString_(
    body.linkedByDiscordId,
    'linkedByDiscordId',
  );
  if (!findDiscordLinkMemberById_(memberId)) throw new Error('Member not found: ' + memberId);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const links = getDiscordMemberLinks_();
    const byDiscord = links.find(function (link) {
      return link.discordUserId === discordUserId;
    });
    const byMember = links.find(function (link) { return link.memberId === memberId; });
    if (byDiscord && byDiscord.memberId === memberId) return byDiscord;
    if (byDiscord) {
      throw new Error(
        'Conflict: Discord user ' + discordUserId
        + ' is already linked to member ' + byDiscord.memberId,
      );
    }
    if (byMember) {
      throw new Error(
        'Conflict: Member ' + memberId
        + ' is already linked to another Discord user',
      );
    }
    const link = {
      discordUserId: discordUserId,
      memberId: memberId,
      linkedAt: new Date().toISOString(),
      linkedByDiscordId: linkedByDiscordId,
    };
    getDiscordMemberLinksSheet_().appendRow([
      link.discordUserId,
      link.memberId,
      link.linkedAt,
      link.linkedByDiscordId,
    ]);
    return link;
  } finally {
    lock.releaseLock();
  }
}

function deleteDiscordMemberLink_(body) {
  const discordUserId = requiredDiscordLinkString_(body.discordUserId, 'discordUserId');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getDiscordMemberLinksSheet_();
    if (sheet.getLastRow() < 2) throw new Error('Discord member link not found');
    const rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, DISCORD_MEMBER_LINK_HEADERS.length)
      .getValues();
    for (let index = 0; index < rows.length; index += 1) {
      if (String(rows[index][0]).trim() === discordUserId) {
        const link = discordMemberLinkRowToObject_(rows[index]);
        sheet.deleteRow(index + 2);
        return link;
      }
    }
    throw new Error('Discord member link not found');
  } finally {
    lock.releaseLock();
  }
}

function getDiscordMemberLinksSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(DISCORD_MEMBER_LINKS_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(DISCORD_MEMBER_LINKS_SHEET);
    sheet.getRange(1, 1, 1, DISCORD_MEMBER_LINK_HEADERS.length)
      .setValues([DISCORD_MEMBER_LINK_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function discordMemberLinkRowToObject_(row) {
  return {
    discordUserId: String(row[0]).trim(),
    memberId: String(row[1]).trim(),
    linkedAt: row[2] instanceof Date ? row[2].toISOString() : String(row[2]),
    linkedByDiscordId: String(row[3]).trim(),
  };
}

function findDiscordLinkMemberById_(memberId) {
  const members = getMembers();
  for (let index = 0; index < members.length; index += 1) {
    if (String(members[index].memberId) === memberId) return members[index];
  }
  return null;
}

function requiredDiscordLinkString_(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(fieldName + ' is required');
  }
  return value.trim();
}
