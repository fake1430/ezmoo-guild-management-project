export interface MemberStatTemplate {
  className: string;
  coreStats: string[];
}

export const MEMBER_STAT_TEMPLATES: Record<
  string,
  MemberStatTemplate
> = {
  Assassin: {
    className: 'Assassin',
    coreStats: [
      'ATK',
      'Raw DEF',
      'P.DMG',
      'Crit DMG',
      'Crit Rate',
      'Ignore DEF',
    ],
  },

  Biochemist: {
    className: 'Biochemist',
    coreStats: [
      'HP',
      'Raw DEF',
      'M.DEF',
      'P.DMG Reduc',
      'M.DMG Reduc',
      'Demihuman Reduc',
    ],
  },

  'Bard/Dancer': {
    className: 'Bard/Dancer',
    coreStats: [
      'HP',
      'Raw DEF',
      'M.DEF',
      'P.DMG Reduc',
      'M.DMG Reduc',
      'Demihuman Reduc',
    ],
  },

  Blacksmith: {
    className: 'Blacksmith',
    coreStats: [
      'ATK',
      'Raw DEF',
      'M.DEF',
      'P.DMG',
      'ATK %',
      'Ignore DEF',
    ],
  },

  Crusader: {
    className: 'Crusader',
    coreStats: [
      'HP',
      'Raw DEF',
      'Crit DMG',
      'Crit Rate',
      'P.DMG',
      'Ignore DEF',
    ],
  },

  Hunter: {
    className: 'Hunter',
    coreStats: [
      'ATK',
      'Raw DEF',
      'P.DMG',
      'Crit DMG',
      'Crit Rate',
      'Ignore DEF',
    ],
  },

  Knight: {
    className: 'Knight',
    coreStats: [
      'ATK',
      'Raw DEF',
      'M.DEF',
      'P.DMG',
      'ATK %',
      'Ignore DEF',
    ],
  },

  Monk: {
    className: 'Monk',
    coreStats: [
      'ATK',
      'Raw DEF',
      'M.DEF',
      'P.DMG',
      'ATK %',
      'Ignore DEF',
    ],
  },

  Priest: {
    className: 'Priest',
    coreStats: [
      'HP',
      'Raw DEF',
      'M.DEF',
      'P.DMG Reduc',
      'M.DMG Reduc',
      'Demihuman Reduc',
    ],
  },

  Sage: {
    className: 'Sage',
    coreStats: [
      'MATK',
      'Raw DEF',
      'M.DEF',
      'M.DMG',
      'P.DMG Reduc',
      'Ignore M.DEF',
    ],
  },

  Wizard: {
    className: 'Wizard',
    coreStats: [
      'MATK',
      'Raw DEF',
      'M.DEF',
      'M.DMG',
      'P.DMG Reduc',
      'Ignore M.DEF',
    ],
  },
};

export const DEFAULT_MEMBER_STAT_TEMPLATE: MemberStatTemplate = {
  className: 'Unknown',
  coreStats: [
    'Stat 1',
    'Stat 2',
    'Stat 3',
    'Stat 4',
    'Stat 5',
    'Stat 6',
  ],
};