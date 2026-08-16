import { Activity, BarChart3, BookOpenText, Settings, Truck, type LucideIcon } from 'lucide-react';

type Item = {
  label: string;
  icon: LucideIcon;
  href?: (projectKey: string) => string;
};
const sections: { label: string; items: Item[] }[] = [
  {
    label: 'Overview',
    items: [{ label: 'Executive pulse', icon: Activity, href: (key) => `/projects/${key}` }],
  },
  {
    label: 'Signals',
    items: [
      {
        label: 'Reach & acquisition',
        icon: BarChart3,
        href: (key) => `/projects/${key}/reach-acquisition`,
      },
      {
        label: 'Delivery & sources',
        icon: Truck,
        href: (key) => `/projects/${key}/delivery-sources`,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Briefings', icon: BookOpenText },
      { label: 'Settings', icon: Settings, href: (key) => `/projects/${key}/settings` },
    ],
  },
];
export function PrimaryNavigation({
  projectKey,
  currentPath,
  onNavigate,
  ariaLabel = 'Primary',
}: {
  projectKey: string;
  currentPath: string;
  onNavigate?: () => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="primary-nav">
      {sections.map((section) => (
        <div className="nav-section" key={section.label}>
          <h2>{section.label}</h2>
          <ul>
            {section.items.map(({ label, icon: Icon, href }) => (
              <li key={label}>
                {href ? (
                  <a
                    href={href(projectKey)}
                    aria-current={currentPath === href(projectKey) ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </a>
                ) : (
                  <span aria-disabled="true" title="Not available in this release">
                    <Icon aria-hidden="true" />
                    {label}
                    <span className="nav-unavailable">Soon</span>
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
