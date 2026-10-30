import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual App event handlers and hook in a deterministic React harness.
// No requests reach Google and no production data is read or written.
let cells = [], cursor = 0, effects = [], tree;
const jsx = (type, props) => ({ type, props });
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
    return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next; }];
  },
  useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
  useMemo(fn) { return fn(); },
  useCallback(fn) { return fn; },
  useEffect(fn, deps) {
    const index = cursor++, previous = cells[index];
    if (!previous || deps.some((v, i) => v !== previous[i])) {
      cells[index] = deps; effects.push(fn);
    }
  },
};
const clone = value => JSON.parse(JSON.stringify(value));
const remote = new Map(), pending = new Map(), writes = [];
const api = {
  getParties(sheet) { return pending.has(sheet) ? pending.get(sheet).promise : Promise.resolve(clone(remote.get(sheet) ?? [])); },
  async saveParties(sheet, parties) { writes.push({ sheet, parties: clone(parties) }); remote.set(sheet, clone(parties)); return 'saved'; },
};
const alerts = [];
const windowMock = {
  location: { pathname: '/' }, history: { pushState() {} },
  addEventListener() {}, removeEventListener() {}, confirm: () => true,
  alert: message => alerts.push(message), setTimeout: fn => fn(),
};
const captures = [], downloads = [], clipboard = [];
const documentMock = { createElement: () => ({ click() { downloads.push(this.download); } }) };
const urlMock = { createObjectURL: () => 'blob:test', revokeObjectURL() {} };
const navigatorMock = { clipboard: { async write(items) { clipboard.push(items); } } };
class ClipboardItemMock { constructor(value) { this.value = value; } }
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} }; modules.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  function require(specifier) {
    if (specifier === 'html-to-image') return { toBlob: async (element, options) => { captures.push({ element, options }); return new Blob(['png'], { type: 'image/png' }); } };
    if (specifier === 'react') return react;
    if (specifier === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (specifier.endsWith('services/googleApi')) return api;
    if (specifier.endsWith('hooks/useMembers')) return { useMembers: () => ({ members: [], isLoading: false, errorMessage: '', reloadMembers: async () => {} }) };
    if (specifier.includes('/components/') || specifier.includes('/pages/')) {
      const name = specifier.split('/').at(-1); return { [name]: name };
    }
    const base = path.resolve(path.dirname(file), specifier);
    return load(['.ts', '.tsx'].map(ext => base + ext).find(p => fs.existsSync(p)));
  }
  vm.runInNewContext(code, { exports: mod.exports, require, window: windowMock, console, document: documentMock, URL: urlMock, navigator: navigatorMock, ClipboardItem: ClipboardItemMock, Blob, Node: class {} }, { filename: file });
  return mod.exports;
}
function all(node, result = []) {
  if (Array.isArray(node)) node.forEach(n => all(n, result));
  else if (node && typeof node === 'object') { result.push(node); all(node.props?.children, result); }
  return result;
}
const { PARTY_MODES, memberClassForMode } = load('src/constants/partyModes.ts');
const modes = Object.keys(PARTY_MODES);
assert.equal(modes.length, 6);
assert.equal(new Set(modes.map(mode => PARTY_MODES[mode].sheet)).size, 6);
for (const mode of modes) remote.set(PARTY_MODES[mode].sheet, [{ party: 1, slots: ['', '', '', '', ''] }]);
const App = load('src/App.tsx').default;
function render() { cursor = 0; tree = App(); const jobs = effects; effects = []; jobs.forEach(fn => fn()); return tree; }
async function settle() { for (let i = 0; i < 4; i++) { await Promise.resolve(); render(); } }
function board() { return all(tree).find(node => node.type === 'PartyBoard').props; }
function modeButton(mode) {
  return all(tree).find(node => node.type === 'button' && node.props.children === PARTY_MODES[mode].label);
}
async function select(mode) { modeButton(mode).props.onClick(); render(); await settle(); }
render(); await settle();
for (const mode of modes) {
  await select(mode);
  assert.equal(board().mode, mode);
  assert.equal(board().modeLabel, PARTY_MODES[mode].label);
  board().onDropMember(`${mode}-one`, 0, 0); render();
  board().onDropMember(`${mode}-two`, 0, 1); render();
  board().onDropMember(`${mode}-one`, 0, 1); render();
  assert.deepEqual(clone(board().parties[0].slots.slice(0, 2)), [`${mode}-two`, `${mode}-one`]);
  board().onUndo(); render();
  assert.equal(board().parties[0].slots[0], `${mode}-one`);
  board().onRedo(); render();
  board().onRemoveMember(0, 1); render();
  assert.equal(board().parties[0].slots[1], '');
  board().onUndo(); render();
  board().onAddParty(); render();
  board().onSwapParties(0, 1); render();
  assert.equal(board().parties[1].slots[0], `${mode}-two`);
  board().onClearParty(1); render();
  assert.ok(board().parties[1].slots.every(s => !s));
  board().onUndo(); render();
  board().onClearAll(); render();
  assert.ok(board().parties.every(p => p.slots.every(s => !s)));
  board().onUndo(); render();
  await board().onSave(); render();
  assert.equal(writes.at(-1).sheet, PARTY_MODES[mode].sheet);
  assert.equal(writes.at(-1).parties[1].slots[0], `${mode}-two`);
  // Unsaved edits must survive a round trip through another mode.
  board().onDropMember(`${mode}-draft`, 0, 0); render();
  await select(mode === 'guildLeague' ? 'overrun' : 'guildLeague');
  await select(mode);
  assert.equal(board().parties[0].slots[0], `${mode}-draft`);
  board().onUndo(); render();
  assert.equal(board().parties[0].slots[0], '');
  board().onRedo(); render();
  await board().onReload(); await settle();
  assert.equal(board().parties[0].slots[0], '');
  board().onUndo(); render(); // Reload itself is undoable.
  assert.equal(board().parties[0].slots[0], `${mode}-draft`);
}
const member = { memberId: 'same-id', ign: 'same-name', guildLeagueClass: 'Priest', overrunClass: 'Knight', stellarClashClass: 'Wizard', valeOfClashClass: 'Sage', vigridAvengeClass: 'Hunter' };
const originalMember = clone(member);
assert.deepEqual(modes.map(mode => memberClassForMode(member, mode)), ['Priest', 'Knight', 'Wizard', 'Sage', 'Hunter', '']);
for (const mode of ['stellarClash', 'valeOfClash', 'vigridAvenge']) {
  assert.equal(memberClassForMode({ memberId: 'x', ign: 'x', guildLeagueClass: 'Priest', overrunClass: 'Knight' }, mode), '');
}
assert.deepEqual(member, originalMember);
// Two concurrent reloads for one mode: the latest request wins.
await select('stellarClash');
let resolveOld, resolveNew;
pending.set('StellarClash', { promise: new Promise(resolve => { resolveOld = resolve; }) });
const oldRequest = board().onReload(); render();
pending.set('StellarClash', { promise: new Promise(resolve => { resolveNew = resolve; }) });
const newRequest = board().onReload(); render();
await select('overrun');
const overrunBefore = clone(board().parties);
resolveNew([{ party: 1, slots: ['newest', '', '', '', ''] }]); await newRequest; await settle();
resolveOld([{ party: 1, slots: ['stale', '', '', '', ''] }]); await oldRequest; await settle();
assert.equal(board().mode, 'overrun');
assert.deepEqual(clone(board().parties), overrunBefore);
await select('stellarClash');
assert.equal(board().parties[0].slots[0], 'newest');
pending.delete('StellarClash');
console.log('PASS: all six modes, swap/remove/clear, undo/redo, isolated save/load/drafts, class mapping, out-of-order requests');

// Execute the real Apps Script against in-memory sheets.
const sheets = new Map();
function sheet(values) {
  return {
    values: clone(values),
    getDataRange() { return { getDisplayValues: () => clone(this.values) }; },
    clearContents() { this.values = []; },
    getRange(row, col) { return { setValues: rows => rows.forEach((values, i) => {
      this.values[row - 1 + i] ??= [];
      values.forEach((value, j) => { this.values[row - 1 + i][col - 1 + j] = value; });
    }) }; },
    autoResizeColumns() {},
  };
}
sheets.set('Member', sheet([
  ['IGN', 'Overrun Class', 'Member ID', 'Guild League Class', 'valeOfClashClass', 'stellarClashClass', 'vigridAvengeClass'],
  ['same-name', 'Knight', 'same-id', 'Priest', 'Sage', 'Wizard', 'Hunter'],
]));
for (const mode of modes) sheets.set(PARTY_MODES[mode].sheet, sheet([['Party', 'Slot1', 'Slot2', 'Slot3', 'Slot4', 'Slot5'], [1, `${mode}-saved`, '', '', '', '']]));
const cache = new Map();
const context = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets.get(name) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: key => cache.get(key) ?? null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
  console,
});
vm.runInContext(fs.readFileSync('apps-script/รหัส.gs', 'utf8'), context);
assert.deepEqual(clone(context.getMembers(true)[0]), member);
const memberSheetBefore = clone(sheets.get('Member').values);
for (const mode of modes) {
  const name = PARTY_MODES[mode].sheet;
  context.validatePartySheetName(name);
  const othersBefore = new Map([...sheets].filter(([key]) => key !== name).map(([key, value]) => [key, clone(value.values)]));
  context.savePartyData(name, [{ party: 1, slots: [mode, '', '', '', ''] }]);
  assert.equal(context.getPartyData(name, true)[0].slots[0], mode);
  for (const [key, values] of othersBefore) assert.deepEqual(sheets.get(key).values, values);
}
assert.throws(() => context.validatePartySheetName('Member'));
assert.deepEqual(sheets.get('Member').values, memberSheetBefore);
sheets.set('Member', sheet([['Member ID', 'IGN', 'Guild League', 'Overrun'], ['same-id', 'same-name', 'Priest', 'Knight']]));
const legacy = clone(context.getMembers(true)[0]);
assert.equal(legacy.guildLeagueClass, 'Priest');
assert.equal(legacy.overrunClass, 'Knight');
assert.equal(legacy.stellarClashClass, '');
assert.equal(legacy.valeOfClashClass, '');
assert.equal(legacy.vigridAvengeClass, '');
console.log('PASS: Apps Script header mapping, optional new columns, legacy members, six isolated sheets, original data preserved');

// Exercise actual board drag/drop and screenshot button handlers with browser APIs mocked.
const { PartyBoard } = load('src/components/party/PartyBoard.tsx');
for (const mode of modes) {
  cells = []; cursor = 0; effects = [];
  const events = [];
  const props = {
    mode, modeLabel: PARTY_MODES[mode].label, members: [member],
    parties: [{ party: 1, slots: ['same-name', '', '', '', ''] }],
    isLoading: false, errorMessage: '', isSaving: false,
    onReload() {}, onSave() {}, onAddParty() {}, onClearAll() {}, onUndo() {}, onRedo() {},
    canUndo: false, canRedo: false,
    onDropMember: (...args) => events.push(['drop', ...args]),
    onSwapParties: (...args) => events.push(['swap', ...args]),
    onRemoveMember: (...args) => events.push(['remove', ...args]),
  };
  const boardTree = PartyBoard(props), nodes = all(boardTree);
  const capture = nodes.find(n => n.props?.className === 'compact-raid-grid capture-area');
  assert.ok(capture);
  capture.props.ref.current = { id: mode };
  const title = nodes.find(n => n.props?.className === 'party-capture-title');
  assert.ok(title.props.children.includes(PARTY_MODES[mode].label));
  if (mode !== 'auctionParty') {
    assert.equal(nodes.find(n => n.props?.className === 'party-member-class').props.children, memberClassForMode(member, mode));
  }
  const slots = nodes.filter(n => n.props?.className?.startsWith('compact-party-slot '));
  const dragEvent = {
    preventDefault() {}, stopPropagation() {},
    dataTransfer: { types: ['application/x-ezmoo-member'], getData: key => key === 'application/x-ezmoo-member' ? 'same-name' : '' },
  };
  slots[1].props.onDrop(dragEvent);
  assert.deepEqual(events.at(-1), ['drop', 'same-name', 0, 1]);
  nodes.find(n => n.props?.className === 'member-remove-button').props.onClick(dragEvent);
  assert.deepEqual(events.at(-1), ['remove', 0, 0]);
  const partyRow = nodes.find(n => n.props?.className === 'compact-party-row');
  partyRow.props.onDrop({ ...dragEvent, dataTransfer: { getData: () => '1' } });
  assert.deepEqual(events.at(-1), ['swap', 1, 0]);
  const download = nodes.find(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children[0].includes('ดาวน์โหลดภาพ'));
  await download.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(downloads.at(-1), `EZMOO-${PARTY_MODES[mode].label.replaceAll(' ', '-')}-Party.png`);
  assert.equal(captures.at(-1).element.id, mode);
  const copy = nodes.find(n => n.type === 'button' && n.props.children === '📷 คัดลอกรูป');
  const count = clipboard.length;
  await copy.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(clipboard.length, count + 1);
}
console.log('PASS: actual board drag/drop/swap/remove handlers, capture titles, mode-specific filenames, download and clipboard paths in all six modes (mock browser APIs)');

const { MemberPanel } = load('src/components/member/MemberPanel.tsx');
for (const mode of modes) {
  cells = []; effects = [];
  const props = { mode, members: [
    { ...member, ign: 'Zulu' },
    { ...member, memberId: 'second', ign: 'Alpha', guildLeagueClass: 'Knight', overrunClass: 'Priest', stellarClashClass: 'Priest', valeOfClashClass: 'Priest', vigridAvengeClass: 'Priest' },
  ], assignedMemberNames: new Set(), onRemoveMemberFromParty() {} };
  const panelRender = () => { cursor = 0; return MemberPanel(props); };
  let nodes = all(panelRender());
  const sort = nodes.find(n => n.props?.['aria-label'] === 'เรียงสมาชิก');
  sort.props.onChange({ target: { value: 'name' } });
  nodes = all(panelRender());
  const list = nodes.find(n => n.props?.assignedMemberNames);
  assert.deepEqual(list.props.members.map(m => m.ign), ['Alpha', 'Zulu']);
  sort.props.onChange({ target: { value: 'class' } });
  nodes = all(panelRender());
  const sorted = nodes.find(n => n.props?.assignedMemberNames).props.members;
  if (mode === 'guildLeague') assert.equal(sorted[0].ign, 'Zulu');
  if (mode !== 'guildLeague') assert.equal(sorted[0].ign, 'Alpha');
}
console.log('PASS: actual member panel sorts by mode class and IGN in all six modes');
