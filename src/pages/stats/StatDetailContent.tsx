import type { CharacterStats } from '../../types/characterStats';
import { formatStatValue, STAT_SECTIONS } from './statDisplay';

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
