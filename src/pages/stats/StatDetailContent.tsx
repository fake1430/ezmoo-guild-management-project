import type { CharacterStats } from '../../types/characterStats';
import {
  formatRawDef,
  formatRawMdef,
  formatStatValue,
  STAT_SECTIONS,
} from './statDisplay';

export function StatDetailContent({ stats }: { stats: CharacterStats }) {
  return (
    <div className="latest-stat-sections">
      {STAT_SECTIONS.map((section) => (
        <section key={section.title} className="latest-stat-section">
          <h4>{section.title}</h4>
          <div className="latest-stat-grid">
            {section.stats.flatMap(([key, label]) => {
              const statCard = (
                <div key={key} className="latest-stat-cell">
                  <span>{label}</span>
                  <strong>{formatStatValue(key, stats[key])}</strong>
                </div>
              );

              if (key !== 'pdef' && key !== 'mdef') return [statCard];

              return [
                statCard,
                <div key={key === 'pdef' ? 'rawDef' : 'rawMdef'} className="latest-stat-cell">
                  <span>{key === 'pdef' ? 'Raw DEF' : 'Raw MDEF'}</span>
                  <strong>
                    {key === 'pdef'
                      ? formatRawDef(stats.pdef, stats.equipmentPdefPercent)
                      : formatRawMdef(stats.mdef, stats.equipmentMdefPercent)}
                  </strong>
                </div>,
              ];
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
