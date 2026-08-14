'use client';

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionProps,
  type Transition,
  type UseInViewOptions,
  type Variants,
} from 'motion/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { cn } from './primitives.js';

export interface BorderBeamProps extends ComponentPropsWithoutRef<'div'> {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  transition?: Transition;
  reverse?: boolean;
  initialOffset?: number;
  borderWidth?: number;
}

export function BorderBeam({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = 'var(--signal, #43c6d9)',
  colorTo = 'var(--info, #75a7ff)',
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
  ...props
}: BorderBeamProps) {
  const reducedMotion = useReducedMotion();
  const beamStyle = {
    position: 'absolute',
    width: size,
    aspectRatio: '1',
    background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
    offsetPath: `rect(0 auto auto 0 round ${size}px)`,
  } satisfies CSSProperties;

  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn('magic-border-beam', className)}
      style={{
        ...style,
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        border: `${borderWidth}px solid transparent`,
        borderRadius: 'inherit',
        mask: 'linear-gradient(transparent, transparent) padding-box, linear-gradient(#000, #000) border-box',
        maskComposite: 'intersect',
      }}
    >
      <motion.div
        style={beamStyle}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={
          reducedMotion
            ? { offsetDistance: `${initialOffset}%` }
            : {
                offsetDistance: reverse
                  ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
                  : [`${initialOffset}%`, `${100 + initialOffset}%`],
              }
        }
        transition={
          reducedMotion
            ? { duration: 0 }
            : { repeat: Infinity, ease: 'linear', duration, delay: -delay, ...transition }
        }
      />
    </div>
  );
}

export interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number;
  startValue?: number;
  direction?: 'up' | 'down';
  delay?: number;
  decimalPlaces?: number;
  locale?: Intl.LocalesArgument;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  decimalPlaces = 0,
  locale = 'en-US',
  className,
  style,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const initialValue = direction === 'down' ? value : startValue;
  const motionValue = useMotionValue(initialValue);
  const springValue = useSpring(motionValue, { damping: 42, stiffness: 180 });
  const isInView = useInView(ref, { once: true, margin: '0px' });
  const format = useCallback(
    (current: number) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(Number(current.toFixed(decimalPlaces))),
    [decimalPlaces, locale],
  );

  useEffect(() => {
    if (reducedMotion) {
      motionValue.jump(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    if (!isInView) return;
    const timer = window.setTimeout(
      () => motionValue.set(direction === 'down' ? startValue : value),
      delay * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [delay, direction, format, isInView, motionValue, reducedMotion, startValue, value]);

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    [format, springValue],
  );

  return (
    <span
      ref={ref}
      className={cn('magic-number-ticker', className)}
      style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums', ...style }}
      {...props}
    >
      {format(reducedMotion ? value : initialValue)}
    </span>
  );
}

type BlurFadeMargin = UseInViewOptions['margin'];

export interface BlurFadeProps extends MotionProps {
  children: ReactNode;
  className?: string;
  variant?: Variants;
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  inView?: boolean;
  inViewMargin?: BlurFadeMargin;
  blur?: string;
}

export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = 'down',
  inView = false,
  inViewMargin = '-50px',
  blur = '6px',
  ...props
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isVisible = !inView || inViewResult;
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const distance = direction === 'right' || direction === 'down' ? -offset : offset;
  const variants: Variants = variant ?? {
    hidden: { [axis]: distance, opacity: 0, filter: `blur(${blur})` },
    visible: { [axis]: 0, opacity: 1, filter: 'blur(0px)' },
  };

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? false : 'hidden'}
      animate={reducedMotion || isVisible ? 'visible' : 'hidden'}
      variants={variants}
      transition={
        reducedMotion ? { duration: 0 } : { delay: 0.04 + delay, duration, ease: 'easeOut' }
      }
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface AnimatedGridPatternProps extends ComponentPropsWithoutRef<'svg'> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: number;
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
}

type GridSquare = { id: number; x: number; y: number; iteration: number };

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  maxOpacity = 0.5,
  duration = 4,
  repeatDelay = 0.5,
  className,
  style,
  ...props
}: AnimatedGridPatternProps) {
  const patternId = useId().replaceAll(':', '');
  const containerRef = useRef<SVGSVGElement>(null);
  const reducedMotion = useReducedMotion();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const randomPosition = useCallback(
    () => ({
      x: Math.floor(Math.random() * Math.max(1, dimensions.width / width)),
      y: Math.floor(Math.random() * Math.max(1, dimensions.height / height)),
    }),
    [dimensions.height, dimensions.width, height, width],
  );
  const [squares, setSquares] = useState<GridSquare[]>([]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    setSquares(
      Array.from({ length: numSquares }, (_, id) => ({ id, ...randomPosition(), iteration: 0 })),
    );
  }, [dimensions.height, dimensions.width, numSquares, randomPosition]);

  const moveSquare = useCallback(
    (squareId: number) => {
      if (reducedMotion) return;
      setSquares((current) =>
        current.map((square) =>
          square.id === squareId
            ? { ...square, ...randomPosition(), iteration: square.iteration + 1 }
            : square,
        ),
      );
    },
    [randomPosition, reducedMotion],
  );

  return (
    <svg
      ref={containerRef}
      {...props}
      aria-hidden="true"
      focusable="false"
      className={cn('magic-animated-grid-pattern', className)}
      style={{
        ...style,
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        color: 'var(--signal, #43c6d9)',
        fill: 'color-mix(in srgb, currentColor 18%, transparent)',
        stroke: 'color-mix(in srgb, currentColor 24%, transparent)',
      }}
    >
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      <g transform={`translate(${x} ${y})`}>
        {squares.map((square, index) => (
          <motion.rect
            key={`${square.id}-${square.iteration}`}
            width={width - 1}
            height={height - 1}
            x={square.x * width + 1}
            y={square.y * height + 1}
            fill="currentColor"
            strokeWidth="0"
            initial={{ opacity: reducedMotion ? maxOpacity : 0 }}
            animate={{ opacity: maxOpacity }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration, repeat: 1, delay: index * 0.1, repeatType: 'reverse', repeatDelay }
            }
            onAnimationComplete={() => moveSquare(square.id)}
          />
        ))}
      </g>
    </svg>
  );
}

export interface ParticlesProps extends ComponentPropsWithoutRef<'div'> {
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

type Particle = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

export function Particles({
  className,
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  refresh = false,
  color = '#9aaaba',
  vx = 0,
  vy = 0,
  style,
  ...props
}: ParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const frame = useRef<number | undefined>(undefined);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!container || !canvas || !context) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const createParticle = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      tx: 0,
      ty: 0,
      size: Math.random() * 2 + size,
      alpha: reducedMotion ? Math.random() * 0.6 + 0.1 : 0,
      targetAlpha: Math.random() * 0.6 + 0.1,
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetism: 0.1 + Math.random() * 4,
    });
    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles.current = Array.from({ length: quantity }, createParticle);
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = color;
      for (const particle of particles.current) {
        const edge = Math.min(
          particle.x + particle.tx - particle.size,
          width - particle.x - particle.tx - particle.size,
          particle.y + particle.ty - particle.size,
          height - particle.y - particle.ty - particle.size,
        );
        const edgeOpacity = Math.max(0, Math.min(1, edge / 20));
        if (!reducedMotion) {
          particle.alpha = Math.min(particle.targetAlpha, particle.alpha + 0.02) * edgeOpacity;
          particle.x += particle.dx + vx;
          particle.y += particle.dy + vy;
          particle.tx += (mouse.current.x / (staticity / particle.magnetism) - particle.tx) / ease;
          particle.ty += (mouse.current.y / (staticity / particle.magnetism) - particle.ty) / ease;
        }
        context.globalAlpha = particle.alpha * edgeOpacity;
        context.beginPath();
        context.arc(
          particle.x + particle.tx,
          particle.y + particle.ty,
          particle.size,
          0,
          Math.PI * 2,
        );
        context.fill();
        if (particle.x < 0 || particle.x > width || particle.y < 0 || particle.y > height) {
          Object.assign(particle, createParticle());
        }
      }
      context.globalAlpha = 1;
      if (!reducedMotion) frame.current = window.requestAnimationFrame(draw);
    };
    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = {
        x: event.clientX - rect.left - width / 2,
        y: event.clientY - rect.top - height / 2,
      };
    };

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            resize();
            draw();
          });
    observer?.observe(container);
    resize();
    draw();
    if (!reducedMotion) window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      observer?.disconnect();
      if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [color, ease, quantity, reducedMotion, refresh, size, staticity, vx, vy]);

  return (
    <div
      ref={containerRef}
      {...props}
      aria-hidden="true"
      className={cn('magic-particles', className)}
      style={{ ...style, pointerEvents: 'none' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = 'var(--focus, #9de7f0)',
      shimmerSize = '0.08em',
      shimmerDuration = '3s',
      borderRadius = 'var(--radius-sm, 6px)',
      background = 'var(--surface-raised, #131a24)',
      className,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const reducedMotion = useReducedMotion();
    const duration = Number.parseFloat(shimmerDuration) || 3;
    return (
      <button
        ref={ref}
        className={cn('magic-shimmer-button', className)}
        style={{
          position: 'relative',
          isolation: 'isolate',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          border: '1px solid var(--border-strong, #34475b)',
          borderRadius,
          padding: '0.75rem 1.5rem',
          color: 'var(--text-primary, #edf4f8)',
          background,
          ...style,
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: `-${shimmerSize}`,
            zIndex: -1,
            overflow: 'hidden',
          }}
        >
          <motion.span
            style={{
              position: 'absolute',
              inset: '-100%',
              background: `conic-gradient(from 270deg, transparent 0deg, ${shimmerColor} 45deg, transparent 90deg)`,
            }}
            animate={reducedMotion ? { rotate: 0 } : { rotate: 360 }}
            transition={
              reducedMotion ? { duration: 0 } : { duration, ease: 'linear', repeat: Infinity }
            }
          />
        </span>
        <span
          aria-hidden="true"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: shimmerSize,
            zIndex: -1,
            borderRadius,
            background,
            boxShadow:
              'inset 0 -8px 10px color-mix(in srgb, var(--text-primary, #edf4f8) 12%, transparent)',
          }}
        />
        {children}
      </button>
    );
  },
);
ShimmerButton.displayName = 'ShimmerButton';
