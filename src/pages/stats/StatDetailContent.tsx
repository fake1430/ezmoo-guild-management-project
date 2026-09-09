import type {
  CharacterStatKey,
  CharacterStats,
} from '../../types/characterStats';
import { formatStatValue } from './statDisplay';

const STAT_SECTIONS: ReadonlyArray<{
  title: string;
  stats: ReadonlyArray<readonly [CharacterStatKey, string]>;
}> = [
  { title: 'Basic', stats: [['hp', 'HP'], ['patk', 'PATK'], ['matk', 'MATK'], ['pdef', 'PDEF'], ['mdef', 'MDEF']] },
  { title: 'Critical', stats: [['crit', 'CRIT'], ['critDmg', 'CRIT DMG'], ['critRes', 'CRIT RES'], ['critDmgRes', 'CRIT DMG RES']] },
  { title: 'Damage', stats: [['pdmg', 'PDMG'], ['mdmg', 'MDMG'], ['pdmgReduction', 'PDMG.R'], ['mdmgReduction', 'MDMG.R'], ['ignorePdef', 'Ignore PDEF'], ['ignoreMdef', 'Ignore MDEF'], ['pvpDmgBonus', 'PvP DMG Bonus'], ['pvpDmgReduction', 'PvP DMG Red']] },
  { title: 'Healing', stats: [['healingDone', 'Healing Done'], ['healingTaken', 'Healing Taken']] },
  { title: 'Equipment', stats: [['maxHpPercent', 'Max HP'], ['equipmentPatkPercent', 'Equipment PATK'], ['equipmentMatkPercent', 'Equipment MATK'], ['equipmentPdefPercent', 'Equipment PDEF'], ['equipmentMdefPercent', 'Equipment MDEF']] },
  { title: 'Race / Size', stats: [['dmgVsDemiHuman', 'DMG vs Demi-Human'], ['dmgReductionVsDemiHuman', 'DMG Reduction vs Demi-Human'], ['dmgVsMedium', 'DMG vs Medium'], ['dmgReductionVsMedium', 'DMG Reduction vs Medium']] },
];

export function StatDetailContent({ stats }: { stats: CharacterStats }) {
  return (
    <div className="latest-stat-sections">
      {STAT_SECTIONS.map((section) => (
        <section key={section.title} className="latest-stat-section">
          <h4>{section.title}</h4>
          <div className="latest-stat-grid">
            {section.stats.map(([key, label]) => (
              <div key={key} className="latest-stat-cell">
                <span>{label}</span>
                <strong>{formatStatValue(key, stats[key])}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
