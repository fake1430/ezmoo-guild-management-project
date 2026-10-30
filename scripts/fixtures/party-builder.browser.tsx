import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';

const modes = [
  ['guildLeague', 'Guild League', 'GuildLeague'], ['overrun', 'Overrun', 'Overrun'],
  ['stellarClash', 'Stellar Clash', 'StellarClash'], ['valeOfClash', 'Vale of Clash', 'ValeOfClash'],
  ['vigridAvenge', 'Vigrid Avenge', 'VigridAvenge'], ['auctionParty', 'Auction Party', 'AuctionParty'],
];
const issues: string[] = [];
const oldError = console.error;
console.error = (...args) => { issues.push(args.map(String).join(' ')); oldError(...args); };
const apiCalls: string[] = [];
// Every request is mocked; the test can never read/write the real Google API.
window.fetch = async (input, options) => {
  const url = new URL(String(input), location.href);
  const action = options?.method === 'POST' ? JSON.parse(String(options.body)).action : url.searchParams.get('action');
  apiCalls.push(String(action));
  if (action === 'members') return Response.json({ success: true, data: [{
    memberId: 'fixture-id', ign: 'Fixture Member', guildLeagueClass: 'Priest', overrunClass: 'Knight',
    stellarClashClass: 'Wizard', valeOfClashClass: 'Sage', vigridAvengeClass: 'Hunter',
  }] });
  if (action === 'party') return Response.json({ success: true, data: Array.from({ length: 16 }, (_, i) => ({
    party: i + 1, slots: i === 0 ? ['Fixture Member', '', '', '', ''] : ['', '', '', '', ''],
  })) });
  throw new Error(`Unexpected request: ${action}`);
};
const pause = () => new Promise(resolve => setTimeout(resolve, 25));
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
async function waitFor(test: () => boolean) {
  for (let i = 0; i < 200; i++) { if (test()) return; await pause(); }
  throw new Error('Timed out waiting for rendered board');
}
function button(label: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === label);
  check(found, `Button missing: ${label}`); return found!;
}
async function select(label: string) {
  button(label).click();
  await waitFor(() => document.querySelector('.party-toolbar h2')?.textContent?.startsWith(label) === true && document.querySelectorAll('.compact-party-row').length === 16);
}
function inspect(label: string, className?: string) {
  check(document.querySelectorAll('.party-board').length === 1, `${label}: multiple boards`);
  check(document.querySelectorAll('.party-toolbar-actions').length === 1, `${label}: multiple toolbars`);
  check(document.querySelectorAll('.member-panel').length === 1, `${label}: multiple member panels`);
  const workspace = document.querySelector('.workspace')!;
  check(workspace.children.length === 2, `${label}: extra workspace children`);
  check(document.querySelectorAll('.compact-raid-column').length === 2, `${label}: must have Raid A/B`);
  for (const raid of document.querySelectorAll('.compact-raid-column')) {
    check(raid.querySelectorAll('.compact-party-row').length === 8, 'Each raid must contain eight teams');
    for (const party of raid.querySelectorAll('.compact-party-row')) check(party.querySelectorAll('.compact-party-slot').length === 5, 'Each team must contain five slots');
  }
  if (className) {
    check(document.querySelector('.party-member-class')?.textContent === className, `${label}: wrong board class`);
    check(document.querySelector('.member-panel .class-badge')?.textContent === className, `${label}: wrong member class`);
  }
  const board = document.querySelector('.party-board')!.getBoundingClientRect();
  const panel = document.querySelector('.member-panel')!.getBoundingClientRect();
  const columns = getComputedStyle(workspace).gridTemplateColumns.split(' ').length;
  if (innerWidth <= 900) {
    check(columns === 1, 'Small screen must use one workspace column');
    check(panel.top >= board.bottom - 1, 'Member panel must stack below board');
    check(board.width >= workspace.getBoundingClientRect().width - 2, 'Board must use the main width');
  } else {
    check(columns === 2, 'Desktop must have board and member columns');
    check(board.width > panel.width, 'Board must occupy the wide main column');
    check(panel.left >= board.right - 1, 'Member panel overlaps board');
  }
  check(document.documentElement.scrollWidth <= innerWidth + 1, `Horizontal overflow at ${innerWidth}px: ${[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.tagName + '.' + e.className).join(', ')}`);
  const boxes = [...document.querySelectorAll('.compact-party-row:first-child .compact-party-slot')].slice(0, 5).map(e => e.getBoundingClientRect());
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    check(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1, 'Party slots overlap');
  }
}
async function main() {
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
  await waitFor(() => document.querySelectorAll('.compact-party-row').length === 16);
  const classes = ['Priest', 'Knight', 'Wizard', 'Sage', 'Hunter', undefined];
  for (let round = 0; round < 3; round++) for (const [i, mode] of modes.entries()) {
    await select(mode[1]); inspect(mode[1], classes[i]);
  }
  // Leave Guild League with a removed member and a redoable edit.
  await select('Guild League');
  document.querySelector<HTMLButtonElement>('.member-remove-button')!.click(); await pause();
  check(!document.querySelector('.party-member-class'), 'Guild draft should remove member');
  await select('Overrun');
  inspect('Overrun', 'Knight');
  check(button('Undo').disabled, 'Guild history leaked to Overrun');
  document.querySelector<HTMLButtonElement>('.member-remove-button')!.click(); await pause();
  await select('Guild League');
  check(!document.querySelector('.party-member-class'), 'Guild draft was lost');
  button('Undo').click(); await pause(); inspect('Guild League', 'Priest');
  await select('Overrun');
  check(!document.querySelector('.party-member-class'), 'Overrun draft was lost');
  button('Undo').click(); await pause(); inspect('Overrun', 'Knight');
  await select('Guild League');
  button('Redo').click(); await pause();
  check(!document.querySelector('.party-member-class'), 'Guild redo was lost');
  check(issues.length === 0, `React errors: ${issues.join('\n')}`);
  check(!apiCalls.includes('saveParty'), 'Browser test must not save');
  return { ok: true, width: innerWidth, modeSwitches: 23, boards: document.querySelectorAll('.party-board').length, issues };
}
main().then(result => { (window as Window & { __partyTest?: unknown }).__partyTest = result; }).catch(error => { (window as Window & { __partyTest?: unknown }).__partyTest = { ok: false, error: error.stack }; });
