'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { Slot } from '@radix-ui/react-slot';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  Info,
  Menu,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      primary: 'ui-button--primary',
      secondary: 'ui-button--secondary',
      ghost: 'ui-button--ghost',
    },
    size: { default: '', compact: 'ui-button--compact', icon: 'ui-button--icon' },
  },
  defaultVariants: { variant: 'secondary', size: 'default' },
});
export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button({ asChild = false, className, variant, size, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

const badgeVariants = cva('ui-badge', {
  variants: {
    variant: {
      neutral: 'ui-badge--neutral',
      positive: 'ui-badge--positive',
      attention: 'ui-badge--attention',
      critical: 'ui-badge--critical',
      info: 'ui-badge--info',
    },
  },
  defaultVariants: { variant: 'neutral' },
});
export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('ui-card', className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<'header'>) {
  return <header className={cn('ui-card__header', className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('ui-card__content', className)} {...props} />;
}

export function Alert({ className, ...props }: ComponentProps<'div'>) {
  return <div role="status" className={cn('ui-alert', className)} {...props} />;
}
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('ui-skeleton', className)} {...props} />;
}
export function Separator({ className, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root className={cn('ui-separator', className)} {...props} />;
}
export function Table(props: ComponentProps<'table'>) {
  return (
    <div className="ui-table-wrap">
      <table {...props} />
    </div>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;
export function Tooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="ui-tooltip" sideOffset={6}>
          {content}
          <TooltipPrimitive.Arrow className="ui-tooltip__arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const ToggleGroup = ToggleGroupPrimitive.Root;
export function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item className={cn('ui-toggle-item', className)} {...props} />;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = 'Close navigation',
  trigger,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const rootProps = {
    ...(open === undefined ? {} : { open }),
    ...(onOpenChange === undefined ? {} : { onOpenChange }),
  };
  return (
    <Dialog.Root {...rootProps}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-sheet__overlay" />
        <Dialog.Content className="ui-sheet__content">
          <div className="ui-sheet__heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description ? <Dialog.Description>{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={closeLabel}>
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MobileMenuButton(props: Omit<ButtonProps, 'children'>) {
  return (
    <Button size="icon" variant="ghost" {...props}>
      <Menu aria-hidden="true" />
    </Button>
  );
}

type Availability = 'available' | 'partial' | 'stale' | 'unavailable' | 'error';
const statusConfig = {
  available: { label: 'Available', variant: 'positive', Icon: CheckCircle2 },
  partial: { label: 'Partial', variant: 'attention', Icon: TriangleAlert },
  stale: { label: 'Stale', variant: 'attention', Icon: Clock3 },
  unavailable: { label: 'Unavailable', variant: 'neutral', Icon: CircleDashed },
  error: { label: 'Failed', variant: 'critical', Icon: AlertCircle },
} as const;
export function StatusBadge({ status, detail }: { status: Availability; detail?: string }) {
  const { label, variant, Icon } = statusConfig[status];
  return (
    <Badge variant={variant} aria-label={detail ? `${label}: ${detail}` : label}>
      <Icon aria-hidden="true" />
      {label}
      {detail ? <span className="ui-badge__detail">· {detail}</span> : null}
    </Badge>
  );
}

export function EvidenceLink({ children, ...props }: ComponentProps<'a'>) {
  return (
    <a className="ui-evidence-link" {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

type PanelStateName = 'partial' | 'stale' | 'error';
const panelIcons = { partial: TriangleAlert, stale: Clock3, error: AlertCircle };
export function PanelState({
  state,
  title,
  children,
}: {
  state: PanelStateName;
  title: string;
  children: ReactNode;
}) {
  const Icon = panelIcons[state];
  return (
    <Alert className={`ui-panel-state ui-panel-state--${state}`}>
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </Alert>
  );
}

export function EmptyState({
  kind,
  children,
}: {
  kind: 'not-configured' | 'awaiting' | 'no-records' | 'no-exceptions';
  children: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <Info aria-hidden="true" />
      <div>
        <strong>
          {kind === 'not-configured'
            ? 'Not configured'
            : kind === 'awaiting'
              ? 'Awaiting first collection'
              : kind === 'no-records'
                ? 'No records in this period'
                : 'No current exceptions'}
        </strong>
        <div>{children}</div>
      </div>
    </div>
  );
}
export function ErrorState({
  title,
  available,
  retry,
  children,
}: {
  title: string;
  available: string;
  retry: string;
  children?: ReactNode;
}) {
  return (
    <PanelState state="error" title={title}>
      <p>{children}</p>
      <dl>
        <div>
          <dt>Still available</dt>
          <dd>{available}</dd>
        </div>
        <div>
          <dt>Retry</dt>
          <dd>{retry}</dd>
        </div>
      </dl>
    </PanelState>
  );
}
export function PanelSkeleton({ label = 'Loading panel' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="ui-panel-skeleton">
      <span className="sr-only">{label}</span>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}
