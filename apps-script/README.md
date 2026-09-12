# Google Apps Script integration

Copy `statSubmissions.gs` into the Apps Script project that already serves the
guild API. It deliberately reuses the existing `getMembers()`, which reads
`SHEETS.MEMBERS` (`Member`), so it does not introduce another member source.

The Discord member mapping feature also requires uploading
`discordMemberLinks.gs`. It creates `DiscordMemberLinks` lazily with columns
`discordUserId | memberId | linkedAt | linkedByDiscordId`.

Keep the existing `doGet` and insert this block immediately after the existing
`action` declaration and before `switch (action)`:

```js
const statResult = handleStatGetAction(action, e.parameter);
if (statResult.handled) {
  return jsonResponse({ success: true, data: statResult.data });
}
const discordLinkResult = handleDiscordMemberLinkGetAction(action);
if (discordLinkResult.handled) {
  return jsonResponse({ success: true, data: discordLinkResult.data });
}
```

The beginning of `doGet` will therefore be:

```js
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

    const discordLinkResult = handleDiscordMemberLinkGetAction(action);
    if (discordLinkResult.handled) {
      return jsonResponse({
        success: true,
        data: discordLinkResult.data,
      });
    }

    switch (action) {
      // Keep every existing case unchanged.
```

Keep the existing `doPost` and insert this block immediately after the existing
`action` declaration and before `switch (action)`:

```js
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
const discordLinkResult = handleDiscordMemberLinkPostAction(action, payload);
if (discordLinkResult.handled) {
  return jsonResponse({
    success: true,
    data: discordLinkResult.data,
    message: discordLinkResult.message,
  });
}

switch (action) {
  // Keep every existing case unchanged.
```

Do not paste a second `doGet` or `doPost`; only insert the two routing blocks.
The module uses the existing `jsonResponse()` output shape. It creates
`StatSubmissions` on first save with these columns: `id`, `memberId`, `ign`,
`submittedByDiscordId`, `submittedByDiscordName`, `submittedAt`, `statsJson`.
Every confirmed submission is appended as a new row.

Deploy a new Web App version after adding the module and routes. Execute as the
owner and grant access appropriate to the existing API. The bot URL must point
to that deployment.

When Focus Stats derived keys change, deploy a new Web App version as well.
The deployed `statSubmissions.gs` must include `rawDef` and `rawMdef` in
`FOCUS_STAT_KEYS`; otherwise saving those choices returns
`Unknown focus stat key`. These keys belong only to Focus Stats config and must
not be added to `CHARACTER_STAT_KEYS` or persisted in `statsJson`.
