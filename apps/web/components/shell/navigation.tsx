import {
  BarChart3,
  BookOpenText,
  CircleDot,
  GitPullRequestArrow,
  RadioTower,
  Settings,
  Siren,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

type Item = { label: string; icon: LucideIcon; supported: boolean };
const sections: { label: string; items: Item[] }[] = [
  {
    label: 'Review',
    items: [
      { label: 'Overview', icon: CircleDot, supported: true },
      { label: 'Attention', icon: Siren, supported: false },
    ],
  },
  {
    label: 'Signals',
    items: [
      { label: 'Reach & acquisition', icon: BarChart3, supported: false },
      { label: 'Support', icon: Wrench, supported: false },
      { label: 'Contributions', icon: GitPullRequestArrow, supported: false },
      { label: 'Delivery', icon: Truck, supported: false },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Briefings', icon: BookOpenText, supported: false },
      { label: 'Sources', icon: RadioTower, supported: false },
      { label: 'Settings', icon: Settings, supported: false },
    ],
  },
];
export function PrimaryNavigation({
  projectKey,
  onNavigate,
  ariaLabel = 'Primary',
}: {
  projectKey: string;
  onNavigate?: () => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="primary-nav">
      {sections.map((section) => (
        <div className="nav-section" key={section.label}>
          <h2>{section.label}</h2>
          <ul>
            {section.items.map(({ label, icon: Icon, supported }) => (
              <li key={label}>
                {supported ? (
                  <a href={`/projects/${projectKey}`} aria-current="page" onClick={onNavigate}>
                    <Icon aria-hidden="true" />
                    {label}
                  </a>
                ) : (
                  <span aria-disabled="true" title="Not available in this release">
                    <Icon aria-hidden="true" />
                    {label}
                    <span className="nav-unavailable">Not available</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
