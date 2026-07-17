export const CLASS_COLORS: Record<string, string> = {
  Knight: '#ef4444',
  Paladin: '#f97316',
  Priest: '#22c55e',
  Monk: '#14b8a6',
  Wizard: '#0ea5e9',
  Sage: '#1d4ed8',
  Assassin: '#a855f7',
  Rogue: '#c026d3',
  Merchant: '#f59e0b',
  Blacksmith: '#f59e0b',
  Biochemist: '#ea580c',
  Alchemist: '#ea580c',
  Sniper: '#eab308',
  'Bard/Dancer': '#d4a800',
  Doram: '#ec4899',
  Gunslinger: '#64748b',
  Crusader: '#dc2626',
};

export function getClassColor(className: string): string {
  return CLASS_COLORS[className] ?? '#64748b';
}