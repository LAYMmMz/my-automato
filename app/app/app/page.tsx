'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect, cloneElement, memo } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

// Ensure you have this component in your project, otherwise comment out the FloatingActionMenuDemo usage at the bottom!
import FloatingActionMenu from "@/components/ui/floating-action-menu";
import { 
  Home, Database, Plus, Settings, X, 
  Cpu, Activity, AlertTriangle, Image as ImageIcon, 
  UploadCloud, ArrowRight, ChevronLeft, ChevronRight, Grid, ZoomIn, Eye, EyeOff,
  FileText, FileSpreadsheet, AppWindow, Network, Lock, CheckCircle2,
  Play, Square as StopCircle, Video, Rocket, Mic, ChevronDown, Send, Bot, User, LogOut,
  Monitor, RefreshCcw, Wifi, WifiOff, Trash2, PlusCircle, Check
} from 'lucide-react';

/* =========================================================================
   TYPES & INTERFACES
   ========================================================================= */

type AppId = 'docs' | 'excel' | 'web' | 'sap' | 'dynamic';

interface TemplateStep {
  id: string;
  rule: string;
  imagePreview?: string | null;
  file?: File | null;
  imageBase64?: string;
}

interface AppDefinition {
  id: AppId;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  working: boolean;
  description?: string;
}

interface Template {
  id: number;
  name: string;
  apps: AppId[];
  steps?: TemplateStep[];
  created_at?: string;
  version?: number;
}

type ChatRole = 'user' | 'ai' | 'system' | 'error';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

type EngineState = 'idle' | 'thinking' | 'executing' | 'paused' | 'error';

export type LimelightNavItem = {
  id: string | number;
  icon: React.ReactElement;
  label?: string;
  onClick?: () => void;
};

export interface LimelightNavProps {
  items?: LimelightNavItem[];
  defaultActiveIndex?: number;
  onTabChange?: (index: number) => void;
  className?: string;
  limelightClassName?: string;
  iconContainerClassName?: string;
  iconClassName?: string;
}

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'success';
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'activeApp' | 'locked' | 'danger';
  size?: 'default' | 'sm' | 'icon' | 'lg';
  children: React.ReactNode;
  className?: string;
}

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  role?: 'button' | 'article' | 'region';
  ariaLabel?: string;
  tabIndex?: number;
}

interface Testimonial {
  name: string;
  handle: string;
  avatarSrc: string;
  text: string;
}

interface SignInPageProps {
  onLogin: () => void;
}

interface AutomatoDashboardProps {
  onLogout: () => void;
}

interface TeachModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSubmitCorrection: (correction: string) => void;
}

interface SmokeBackgroundProps {
  smokeColor?: string;
  logoSrc?: string;
  showLogo?: boolean;
}

/* =========================================================================
   UTILITIES & HOOKS
   ========================================================================= */

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const throttle = <Args extends unknown[]>(fn: (...args: Args) => void, limit: number) => {
  let inThrottle = false;
  let lastArgs: Args | null = null;
  return function (this: unknown, ...args: Args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return reduced;
};

const useDemoMode = () => {
  const [demo, setDemo] = useState(() => 
    typeof window !== 'undefined' ? localStorage.getItem('automato_demo') === 'true' : false
  );
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('automato_demo', String(demo));
      if (demo) console.log('🎭 Demo Mode: All actions are simulated');
    }
  }, [demo]);
  return { demo, toggle: () => setDemo(d => !d) };
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : null;
};

/* =========================================================================
   3D SHADER COMPONENTS (REACT THREE FIBER)
   ========================================================================= */

import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";

const vertexShader = `
  uniform float time;
  uniform float intensity;
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    
    vec3 pos = position;
    pos.y += sin(pos.x * 10.0 + time) * 0.1 * intensity;
    pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * intensity;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  uniform float intensity;
  uniform vec3 color1;
  uniform vec3 color2;
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vec2 uv = vUv;
    
    // Create animated noise pattern
    float noise = sin(uv.x * 20.0 + time) * cos(uv.y * 15.0 + time * 0.8);
    noise += sin(uv.x * 35.0 - time * 2.0) * cos(uv.y * 25.0 + time * 1.2) * 0.5;
    
    // Mix colors based on noise and position
    vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
    color = mix(color, vec3(1.0), pow(abs(noise), 2.0) * intensity);
    
    // Add glow effect
    float glow = 1.0 - length(uv - 0.5) * 2.0;
    glow = pow(glow, 2.0);
    
    gl_FragColor = vec4(color * glow, glow * 0.8);
  }
`;

export function ShaderPlane({
  position,
  color1 = "#ff5722",
  color2 = "#ffffff",
}: {
  position: [number, number, number]
  color1?: string
  color2?: string
}) {
  const mesh = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      intensity: { value: 1.0 },
      color1: { value: new THREE.Color(color1) },
      color2: { value: new THREE.Color(color2) },
    }),
    [color1, color2],
  );

  useFrame((state) => {
    if (mesh.current) {
      uniforms.time.value = state.clock.elapsedTime;
      uniforms.intensity.value = 1.0 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
    }
  });

  return (
    <mesh ref={mesh} position={position} scale={[15, 15, 1]}>
      <planeGeometry args={[2, 2, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function EnergyRing({
  radius = 1,
  position = [0, 0, 0],
}: {
  radius?: number
  position?: [number, number, number]
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.z = state.clock.elapsedTime * 0.5;
      if (mesh.current.material) {
          (mesh.current.material as THREE.Material).opacity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
      }
    }
  });

  return (
    <mesh ref={mesh} position={position} scale={[4, 4, 1]}>
      <ringGeometry args={[radius * 0.8, radius, 64]} />
      <meshBasicMaterial color="#ff5722" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

const R3FDashboardBackground = () => {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <ShaderPlane position={[0, 0, -2]} color1="#ff1e1e" color2="#3a0000" />
        <EnergyRing radius={1.5} position={[0, 0, -1]} />
        <EnergyRing radius={2.5} position={[0, 0, -1]} />
      </Canvas>
    </div>
  );
};

/* =========================================================================
   SHARED UI COMPONENTS
   ========================================================================= */

const Badge: React.FC<BadgeProps> = ({ children, className = "", variant = "primary" }) => {
  const variants = {
    primary: "bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/30",
    secondary: "bg-black/50 text-gray-300 border border-white/10 backdrop-blur-md",
    success: "bg-green-500/20 text-green-400 border border-green-500/30"
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Button: React.FC<ButtonProps> = ({ 
  children, variant = "default", size = "default", className = "", ...props 
}) => {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";
  const variants = {
    default: "bg-[#007AFF] text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(0,122,255,0.4)] hover:shadow-[0_0_30px_rgba(0,122,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed",
    outline: "border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/20 text-white disabled:opacity-50",
    ghost: "hover:bg-white/10 text-gray-400 disabled:opacity-50",
    activeApp: "border-2 border-[#007AFF] bg-[#007AFF]/10 text-white shadow-[0_0_20px_rgba(0,122,255,0.3)]",
    locked: "border border-white/5 bg-black/50 text-gray-600 cursor-not-allowed",
    danger: "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
  };
  const sizes = { 
    default: "h-12 px-6 py-3 text-sm", 
    sm: "h-9 px-4 text-xs", 
    icon: "h-10 w-10", 
    lg: "h-16 px-8 text-lg" 
  };
  return (
    <button className={`${base} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const GoogleIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const DefaultHomeIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
const DefaultCompassIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" /></svg>;
const DefaultBellIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;

const defaultLimelightNavItems: LimelightNavItem[] = [
  { id: 'default-home', icon: <DefaultHomeIcon />, label: 'Home' },
  { id: 'default-explore', icon: <DefaultCompassIcon />, label: 'Explore' },
  { id: 'default-notifications', icon: <DefaultBellIcon />, label: 'Notifications' },
];

export const LimelightNav: React.FC<LimelightNavProps> = ({
  items = defaultLimelightNavItems,
  defaultActiveIndex = 0,
  onTabChange,
  className,
  limelightClassName,
  iconContainerClassName,
  iconClassName,
}) => {
  const [activeIndex, setActiveIndex] = useState(defaultActiveIndex);
  const [isReady, setIsReady] = useState(false);
  const navItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (items.length === 0) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];
    
    if (limelight && activeItem) {
      const newLeft = activeItem.offsetLeft + activeItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [activeIndex, isReady, items]);

  if (items.length === 0) {
    return null;
  }

  const handleItemClick = (index: number, itemOnClick?: () => void) => {
    setActiveIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  return (
    <nav className={`relative inline-flex items-center h-16 rounded-lg bg-card text-foreground border px-2 ${className ?? ''}`}>
      {items.map((item: LimelightNavItem, index: number) => {
        const { id, icon, label, onClick } = item;
        const iconElement = icon as React.ReactElement<{ className?: string }>;
        return (
          <button
            key={id}
            ref={(el) => {
              navItemRefs.current[index] = el;
            }}
            type="button"
            className={`relative z-20 flex h-full cursor-pointer items-center justify-center p-5 ${iconContainerClassName ?? ''}`}
            onClick={() => handleItemClick(index, onClick)}
            aria-label={label}
          >
            {cloneElement(iconElement, {
              className: `w-6 h-6 transition-opacity duration-100 ease-in-out ${
                activeIndex === index ? 'opacity-100' : 'opacity-40'
              } ${iconElement.props.className ?? ''} ${iconClassName ?? ''}`,
            })}
            {label && (
              <span className={`ml-2 text-sm font-semibold transition-opacity duration-100 ${activeIndex === index ? 'opacity-100' : 'opacity-60'}`}>
                {label}
              </span>
            )}
          </button>
        );
      })}

      <div
        ref={limelightRef}
        className={`absolute top-0 z-10 w-11 h-[5px] rounded-full bg-primary shadow-[0_50px_15px_var(--primary)] ${
          isReady ? 'transition-[left] duration-400 ease-in-out' : ''
        } ${limelightClassName ?? ''}`}
        style={{ left: '-999px' }}
      >
        <div className="absolute left-[-30%] top-[5px] w-[160%] h-14 [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)] bg-gradient-to-b from-primary/30 to-transparent pointer-events-none" />
      </div>
    </nav>
  );
};

export function FloatingActionMenuDemo() {
  return (
    <FloatingActionMenu
      className="relative"
      options={[
        { label: "Account", Icon: <User className="w-4 h-4" />, onClick: () => console.log("Account clicked") },
        { label: "Settings", Icon: <Settings className="w-4 h-4" />, onClick: () => console.log("Settings clicked") },
        { label: "Logout", Icon: <LogOut className="w-4 h-4" />, onClick: () => console.log("Logout clicked") },
      ]}
    />
  );
}

export const WordsPullUp: React.FC<{ 
  text: string; 
  className?: string; 
  showAsterisk?: boolean; 
  delayStart?: number;
}> = ({ text, className = "", showAsterisk = false, delayStart = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const reducedMotion = useReducedMotion();
  const words = text.split(" ");
  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span 
            key={i} 
            initial={reducedMotion ? {} : { y: 20, opacity: 0 }} 
            animate={isInView ? (reducedMotion ? {} : { y: 0, opacity: 1 }) : {}} 
            transition={reducedMotion ? { duration: 0 } : { duration: 0.6, delay: delayStart + (i * 0.08), ease: [0.16, 1, 0.3, 1] }} 
            className="inline-block relative" 
            style={{ marginRight: isLast ? 0 : "0.25em" }}
          >
            {word}
            {showAsterisk && isLast && <span className="absolute top-[0.4em] -right-[0.4em] text-[0.4em] text-[#007AFF]">*</span>}
          </motion.span>
        );
      })}
    </div>
  );
};

const GlowCard: React.FC<GlowCardProps> = ({ 
  children, className = '', onClick, active = false, 
  role = 'button', ariaLabel, tabIndex = 0, ...props 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = throttle(((e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;
      if (cardRef.current) {
        cardRef.current.style.setProperty('--x', x.toFixed(2));
        cardRef.current.style.setProperty('--xp', (x / window.innerWidth).toFixed(2));
        cardRef.current.style.setProperty('--y', y.toFixed(2));
        cardRef.current.style.setProperty('--yp', (y / window.innerHeight).toFixed(2));
      }
    }), 16);
    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  const baseStyles: React.CSSProperties = {
    '--base': 220, '--spread': 200, '--radius': '16', '--border': active ? '3' : '2',
    '--backdrop': 'rgba(20, 20, 20, 0.7)', '--backup-border': active ? 'rgba(0, 122, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)',
    '--size': '250', '--outer': '1', '--border-size': 'calc(var(--border, 2) * 1px)',
    '--spotlight-size': 'calc(var(--size, 150) * 1px)',
    '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
    backgroundImage: `radial-gradient(var(--spotlight-size) var(--spotlight-size) at calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px), hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.15)), transparent)`,
    backgroundColor: active ? 'rgba(0, 122, 255, 0.05)' : 'var(--backdrop, transparent)',
    backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
    backgroundPosition: '50% 50%', backgroundAttachment: 'fixed',
    border: 'var(--border-size) solid var(--backup-border)',
    position: 'relative', touchAction: 'none',
  } as React.CSSProperties;

  const beforeAfterStyles = `
    [data-glow]::before, [data-glow]::after {
      pointer-events: none; content: ""; position: absolute; inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent; border-radius: calc(var(--radius) * 1px);
      background-attachment: fixed; background-size: calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));
      background-repeat: no-repeat; background-position: 50% 50%;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white); mask-clip: padding-box, border-box; mask-composite: intersect;
    }
    [data-glow]::before { background-image: radial-gradient(calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px), hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 50) * 1%) / var(--border-spot-opacity, 1)), transparent 100%); filter: brightness(2); }
    [data-glow]::after { background-image: radial-gradient(calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px), hsl(0 100% 100% / var(--border-light-opacity, 1)), transparent 100%); }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: beforeAfterStyles }} />
      <div 
        ref={cardRef} 
        data-glow 
        style={baseStyles} 
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={role}
        tabIndex={onClick ? tabIndex : -1}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={`rounded-2xl relative flex flex-col shadow-2xl p-0 backdrop-blur-xl overflow-hidden ${
          onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]' : 'cursor-default'
        } ${className} ${active ? 'shadow-[0_0_30px_rgba(0,122,255,0.2)]' : ''}`}
        {...props}
      >
        <div ref={innerRef} data-glow aria-hidden="true" />
        {children}
      </div>
    </>
  );
};

const GlassInputWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors focus-within:border-[#007AFF] focus-within:bg-[#007AFF]/10 focus-within:shadow-[0_0_20px_rgba(0,122,255,0.15)]">
    {children}
  </div>
);

/* =========================================================================
   ERROR BOUNDARY
   ========================================================================= */

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Automato Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div role="alert" className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="text-red-400" aria-hidden="true" />
            <h2 className="font-bold">Something went wrong</h2>
          </div>
          <p className="text-sm opacity-90">The interface encountered an error. Try refreshing or contact support.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Reload Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =========================================================================
   SMOKE BACKGROUND WITH WEBGL + LOGO
   ========================================================================= */

const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color;
#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)
float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}
void main(){
  vec2 uv=(FC-.5*R)/R.y;
  vec3 col=vec3(1);
  uv.x+=.25;
  uv*=vec2(2,1);
  float n=fbm(uv*.28-vec2(T*.01,0));
  n=noise(uv*3.+n*2.);
  col.r-=fbm(uv+vec2(0,T*.015)+n);
  col.g-=fbm(uv*1.003+vec2(0,T*.015)+n+.003);
  col.b-=fbm(uv*1.006+vec2(0,T*.015)+n+.006);
  col=mix(col, u_color, dot(col,vec3(.21,.71,.07)));
  col=mix(vec3(.08),col,min(time*.1,1.));
  col=clamp(col,.08,1.);
  O=vec4(col,1);
}`;

class Renderer {
  private readonly vertexSrc = "#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}";
  private readonly vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;
  private buffer: WebGLBuffer | null = null;
  private color: [number, number, number] = [0.5, 0.5, 0.5];

  constructor(canvas: HTMLCanvasElement, fragmentSource: string) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    this.setup(fragmentSource);
    this.init();
  }
  updateColor(newColor: [number, number, number]) { this.color = newColor; }
  updateScale() {
    const dpr = Math.max(1, window.devicePixelRatio);
    const { innerWidth: width, innerHeight: height } = window;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  private compile(shader: WebGLShader, source: string) {
    const gl = this.gl;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`Shader compilation error: ${gl.getShaderInfoLog(shader)}`);
    }
  }
  reset() {
    const { gl, program, vs, fs } = this;
    if (!program) return;
    if (vs) { gl.detachShader(program, vs); gl.deleteShader(vs); }
    if (fs) { gl.detachShader(program, fs); gl.deleteShader(fs); }
    gl.deleteProgram(program);
    this.program = null;
  }
  private setup(fragmentSource: string) {
    const gl = this.gl;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!this.vs || !this.fs || !program) return;
    this.compile(this.vs, this.vertexSrc);
    this.compile(this.fs, fragmentSource);
    this.program = program;
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error(`Program linking error: ${gl.getProgramInfoLog(this.program)}`);
    }
  }
  private init() {
    const { gl, program } = this;
    if (!program) return;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    Object.assign(program as any, {
      resolution: gl.getUniformLocation(program, "resolution"),
      time: gl.getUniformLocation(program, "time"),
      u_color: gl.getUniformLocation(program, "u_color"),
    });
  }
  render(now = 0) {
    const { gl, program, buffer, canvas } = this;
    if (!program || !gl.isProgram(program)) return;
    const uniformProgram = program as any;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(uniformProgram.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniformProgram.time, now * 1e-3);
    gl.uniform3fv(uniformProgram.u_color, this.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

type ProgramUniforms = {
  resolution: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  u_color: WebGLUniformLocation | null;
};

type ProgramWithUniforms = WebGLProgram & ProgramUniforms;

export const SmokeBackground: React.FC<SmokeBackgroundProps> = ({ 
  smokeColor = "#DC143C", logoSrc, showLogo = true
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<Renderer | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const renderer = new Renderer(canvas, fragmentShaderSource);
        rendererRef.current = renderer;
        const handleResize = () => renderer.updateScale();
        handleResize();
        window.addEventListener('resize', handleResize);
        let animationFrameId: number;
        const loop = (now: number) => {
            renderer.render(now);
            animationFrameId = requestAnimationFrame(loop);
        };
        loop(0);
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            renderer.reset(); 
        };
    }, []);
    
    useEffect(() => {
        const renderer = rendererRef.current;
        if (renderer) {
            const rgbColor = hexToRgb(smokeColor);
            if (rgbColor) renderer.updateColor(rgbColor);
        }
    }, [smokeColor]);

    return (
        <div className="relative w-full h-full">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
            {/* Logo is now handled inside the components instead of the background */}
        </div>
    );
};

/* =========================================================================
   AUTHENTICATION COMPONENT
   ========================================================================= */

const TestimonialCard: React.FC<{ testimonial: Testimonial; delay: number }> = memo(({ testimonial, delay }) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div 
      initial={reducedMotion ? {} : { opacity: 0, y: 20 }} 
      animate={reducedMotion ? {} : { opacity: 1, y: 0 }} 
      transition={reducedMotion ? { duration: 0 } : { delay, duration: 0.6 }} 
      className="flex-1 flex flex-col rounded-3xl bg-black/60 border border-white/10 p-6 shadow-2xl relative z-10"
    >
      <div className="flex items-center gap-4 mb-4">
        <img src={testimonial.avatarSrc} className="h-12 w-12 object-cover rounded-xl" alt={`${testimonial.name}'s avatar`} />
        <div className="leading-tight">
          <p className="font-bold text-white text-lg">{testimonial.name}</p>
          <p className="text-[#007AFF] text-xs font-mono">{testimonial.handle}</p>
        </div>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed">{testimonial.text}</p>
    </motion.div>
  );
});
TestimonialCard.displayName = 'TestimonialCard';

const SignInPage: React.FC<SignInPageProps> = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const hackathonTestimonials: Testimonial[] = [
    { name: "Serge", handle: "AI Integrator", avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", text: "The VLM endpoints are flawlessly executing JSON arrays. This is game-changing." },
    { name: "Backend Arch.", handle: "Memory Engine", avatarSrc: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150", text: "Pinecone RAG integration was seamless. Automato remembers everything." }
  ];

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) onLogin();
  };

  return (
    <div className="h-screen flex flex-col md:flex-row w-full bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#007AFF] focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50">
        Skip to main content
      </a>
      
      {/* Left Section - Form */}
      <section className="flex-1 flex items-center justify-center p-8 z-10 relative overflow-y-auto">
        <div className="w-full max-w-md z-10">
          <div className="flex flex-col gap-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-xs font-black uppercase text-[#007AFF] tracking-widest mb-4">AUTOMATO PLATFORM</div>
              <h1 className="text-5xl font-bold leading-tight text-white tracking-tight"><WordsPullUp text="Welcome Back" /></h1>
              <p className="text-gray-400 mt-2">Initialize the Universal Interpreter to begin.</p>
            </motion.div>
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="sr-only">Email address</label>
                <GlassInputWrapper>
                  <input id="email" name="email" type="email" autoComplete="email" required aria-describedby={errors.email ? "email-error" : undefined} aria-invalid={!!errors.email} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@automato.ai" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-white placeholder:text-gray-500" />
                </GlassInputWrapper>
                {errors.email && <p id="email-error" role="alert" className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" /> {errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="sr-only">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required aria-describedby={errors.password ? "password-error" : undefined} aria-invalid={!!errors.password} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-white font-mono placeholder:text-gray-500" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] rounded" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </div>
                </GlassInputWrapper>
                {errors.password && <p id="password-error" role="alert" className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" /> {errors.password}</p>}
              </div>
              <Button type="submit" className="w-full h-14 text-lg rounded-2xl">Initialize Engine</Button>
            </form>
            <Button onClick={onLogin} variant="outline" className="w-full h-14 rounded-2xl"><GoogleIcon /> <span className="ml-3">Continue with Google</span></Button>
          </div>
        </div>
      </section>

      {/* Right Section - New Solid Design */}
      <section className="hidden md:flex flex-1 relative p-6">
        <div className="w-full h-full flex flex-col bg-[#111111] border border-white/5 rounded-[2rem] p-6 shadow-2xl">
          
          {/* Top Red Logo Area */}
          <div className="flex-1 bg-[#FF1E1E] rounded-[1.5rem] flex items-center justify-center mb-6 relative overflow-hidden shadow-inner">
             <motion.img 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                src="/LOGO (2).png" 
                alt="Automato Logo" 
                className="w-2/3 md:w-3/4 max-w-lg object-contain" 
             />
          </div>

          {/* Bottom Testimonials */}
          <div className="flex gap-6 w-full">
            <TestimonialCard testimonial={hackathonTestimonials[0]} delay={0.8} />
            <TestimonialCard testimonial={hackathonTestimonials[1]} delay={1.0} />
          </div>

        </div>
      </section>
    </div>
  );
};

/* =========================================================================
   TEACH MODE MODAL (DAY 3 REQUIREMENT)
   ========================================================================= */

const TeachModeModal: React.FC<TeachModeModalProps> = ({ isOpen, onClose, imageUrl, onSubmitCorrection }) => {
  const [correction, setCorrection] = useState("");
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }} 
      animate={reducedMotion ? {} : { opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-labelledby="teach-title"
    >
      <div className="bg-[#121212] border border-white/10 rounded-2xl max-w-3xl w-full grid md:grid-cols-2 gap-6 p-6 shadow-2xl">
        <div className="space-y-2">
          <h3 id="teach-title" className="text-xl font-bold text-red-400 flex items-center gap-2"><AlertTriangle size={20} /> AI Confidence Low</h3>
          <p className="text-gray-300 text-sm">Human intervention required. The AI is unsure about this layout.</p>
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/50 mt-4">
            <img src={imageUrl} alt="Document section requiring correction" className="w-full h-auto object-contain max-h-[300px]" />
          </div>
        </div>
        <div className="space-y-4 flex flex-col justify-center">
          <label htmlFor="correction-input" className="text-sm font-bold text-[#007AFF] uppercase tracking-widest">Semantic Rule Correction</label>
          <input id="correction-input" ref={inputRef} value={correction} onChange={e => setCorrection(e.target.value)} placeholder="e.g., 'Click the blue submit button at bottom right'" className="w-full bg-black/60 border border-white/20 rounded-xl p-4 text-white outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/50 transition-all" onKeyDown={e => e.key === 'Enter' && onSubmitCorrection(correction)} />
          <div className="flex gap-3 mt-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={() => onSubmitCorrection(correction)} disabled={!correction.trim()} className="flex-1 bg-green-600 hover:bg-green-700"><CheckCircle2 size={16} className="mr-2" /> Submit & Retry</Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* =========================================================================
   MAIN DASHBOARD COMPONENT
   ========================================================================= */

function AutomatoDashboard({ onLogout }: AutomatoDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => [{ id: generateId(), role: 'system', text: "Automato Universal Interpreter initialized. How can I assist you with this template?", timestamp: Date.now() }]);
  
  // Sample data
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([
    { 
      id: 1, 
      name: "Invoice Extraction", 
      apps: ['docs', 'excel'],
      steps: [
        { id: '1a', rule: "Find the total amount on the invoice." },
        { id: '1b', rule: "Copy that amount into the corresponding cell in Excel." }
      ]
    }, 
    { 
      id: 2, 
      name: "Master Ledger Writer", 
      apps: ['excel'],
      steps: [
        { id: '2a', rule: "Format the data in column A as currency." }
      ]
    }
  ]);
  
  // Connection States
  const [connectApp1, setConnectApp1] = useState<string | null>(null);
  const [connectApp2, setConnectApp2] = useState<string | null>(null);

  // === NEW TEMPLATE WIZARD STATES ===
  const [templateName, setTemplateName] = useState("");
  const [wizardSteps, setWizardSteps] = useState<TemplateStep[]>([
    { id: generateId(), file: null, imagePreview: null, rule: "", imageBase64: "" }
  ]);
  
  // App Environment Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [detectedDesktopApps, setDetectedDesktopApps] = useState<AppId[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const [teachModeOpen, setTeachModeOpen] = useState(false);
  const [teachImageUrl, setTeachImageUrl] = useState("");
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);

  const { demo } = useDemoMode();
  const reducedMotion = useReducedMotion();

  // ALL APPS UNLOCKED AND WORKING
  const availableApps: AppDefinition[] = useMemo(() => [
    { id: 'docs', name: 'Docs / PDF Viewer', icon: FileText, working: true, description: 'Extract from PDFs and documents' },
    { id: 'excel', name: 'Excel Sheet', icon: FileSpreadsheet, working: true, description: 'Read/write spreadsheet data' },
    { id: 'web', name: 'Web Browser', icon: AppWindow, working: true, description: 'Automate web interactions' },
    { id: 'sap', name: 'ERP System', icon: Database, working: true, description: 'Enterprise resource planning' },
  ], []);

  const navItems = useMemo(() => [
    { id: 'dashboard', title: "Dashboard" }, 
    { id: 'create', title: "New Template" }, 
    { id: 'connect', title: "Connect Templates" }
  ], []);

  const apiBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") : "http://localhost:8000";

  // ACTUAL REAL LOCAL DESKTOP SCANNER WITH FALLBACK
  const scanDesktopApps = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    
    try {
      const response = await fetch("http://localhost:8080/api/active-apps");
      if (!response.ok) throw new Error("Local agent responded with error");
      const data = await response.json();
      
      setDetectedDesktopApps(data.active_apps || []); 
      setHasScanned(true);
      console.log("Successfully connected to Local RPA Agent. Detected:", data.active_apps);
      
    } catch (error) {
      console.warn("Local RPA agent not detected on port 8080. Falling back to simulation.");
      // FALLBACK: Detect ALL apps so they are fully available
      setTimeout(() => {
        setDetectedDesktopApps(['docs', 'excel', 'web', 'sap']); 
        setHasScanned(true);
        console.log("Local agent offline. Using simulated MVP data. All apps unlocked.");
      }, 2000);
      
    } finally {
      setIsScanning(false);
    }
  }, []);

  const executeAutomation = async () => {
    if (!selectedTemplate || !selectedTemplate.steps) return;
    
    setEngineState('executing');
    setChatHistory(prev => [...prev, { id: generateId(), role: 'system', text: `Initiating workflow execution for: ${selectedTemplate.name}...`, timestamp: Date.now() }]);

    const payload = {
        workflow_name: selectedTemplate.name,
        steps: selectedTemplate.steps.map((s, index) => ({
            step_number: index + 1,
            image_base64: s.imageBase64 || "", 
            instruction: s.rule
        }))
    };

    try {
        const res = await fetch(`${apiBase}/run-agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if(res.ok) {
            setChatHistory(prev => [...prev, { id: generateId(), role: 'system', text: `✅ Execution successful. Workflow: ${data.workflow}`, timestamp: Date.now() }]);
        } else {
            setChatHistory(prev => [...prev, { id: generateId(), role: 'error', text: `❌ Execution Failed: ${data.detail || 'Server error'}`, timestamp: Date.now() }]);
        }
    } catch (error) {
        setChatHistory(prev => [...prev, { id: generateId(), role: 'error', text: `❌ Failed to connect to Python backend on port 8000.`, timestamp: Date.now() }]);
    } finally {
        setEngineState('idle');
    }
  };

  const submitTeachCorrection = async (executionId: string, correction: string) => {
    setTeachModeOpen(false);
  };

  const abortExecution = useCallback(async () => {
    try { await fetch(`${apiBase}/api/abort`, { method: "POST" }).catch(() => {}); } catch(e) {}
    setEngineState('idle');
  }, [apiBase]);

  useEffect(() => {
    const announcer = document.getElementById('status-announcer');
    if (announcer && chatHistory.length > 0) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      announcer.textContent = `${lastMsg.role === 'ai' ? 'Automato' : 'You'}: ${lastMsg.text}`;
    }
  }, [chatHistory]);

  const handleSendMessage = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || engineState === 'executing') return;
    setChatHistory(prev => [...prev, { id: generateId(), role: 'user', text: chatInput, timestamp: Date.now() }]);
    setChatInput("");
    if (!demo) {
      setEngineState('thinking');
      setTimeout(() => {
        setEngineState('idle');
        setChatHistory(prev => [...prev, { id: generateId(), role: 'ai', text: `Executing contextual command within ${selectedTemplate?.name || 'current template'}. Generating universal coordinates...`, timestamp: Date.now() }]);
      }, 1500);
    }
  }, [chatInput, chatHistory, engineState, selectedTemplate, demo]);

  const handleQuickAction = useCallback((action: string) => {
    setChatInput(action);
    handleSendMessage();
  }, [handleSendMessage]);

  const handleAddStep = () => {
    setWizardSteps(prev => [...prev, { id: generateId(), file: null, imagePreview: null, rule: "", imageBase64: "" }]);
  };

  const handleUpdateStepRule = (id: string, rule: string) => {
    setWizardSteps(prev => prev.map(s => s.id === id ? { ...s, rule } : s));
  };

  const handleImageUpload = (id: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setWizardSteps(prev => prev.map(s => s.id === id ? { ...s, file, imagePreview: previewUrl } : s));
  };

  const handleRemoveStep = (id: string) => {
    setWizardSteps(prev => prev.filter(s => s.id !== id));
  };

  // --- OPTIMISTIC UI UPDATE: Always add to Dashboard even if fetch fails ---
  const handleFinishWizard = async () => {
    if (!templateName.trim() || wizardSteps.length === 0) return;

    const processedSteps = await Promise.all(wizardSteps.map(async (s, index) => {
        let b64 = "";
        if (s.file) b64 = await fileToBase64(s.file);
        return {
            step_number: index + 1,
            instruction: s.rule,
            image_base64: b64,
            originalId: s.id 
        };
    }));

    const payload = {
      workflow_name: templateName,
      steps: processedSteps.map(s => ({
          step_number: s.step_number,
          image_base64: s.image_base64,
          instruction: s.instruction
      }))
    };
    
    // 1. Save locally IMMEDIATELY so it appears in the Dashboard
    const newT: Template = { 
      id: Date.now(), 
      name: templateName, 
      apps: wizardSteps.map(() => 'dynamic'), 
      steps: wizardSteps.map((s, idx) => ({ 
          id: s.id, 
          rule: s.rule, 
          imageBase64: processedSteps[idx].image_base64 
      })),
      created_at: new Date().toISOString(), 
      version: 1 
    };
    
    setSavedTemplates(prev => [newT, ...prev]);
    setTemplateName("");
    setWizardSteps([{ id: generateId(), file: null, imagePreview: null, rule: "" }]);
    setSelectedTemplate(newT);
    setActiveTab('dashboard');

    // 2. Try to hit the API, but don't break the UI if it fails
    try {
        const res = await fetch(`${apiBase}/create-workflow`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) console.warn("Backend API returned an error, but template was saved locally for demo.");
    } catch(err) {
        console.warn("Could not reach Python API on port 8000 to save workflow. Using local UI state for demo purposes.");
    }
  };

  const handleMergeTemplates = useCallback(() => {
    if(!connectApp1 || !connectApp2) return;
    const t1 = savedTemplates.find(t => t.id === parseInt(connectApp1));
    const t2 = savedTemplates.find(t => t.id === parseInt(connectApp2));
    if (!t1 || !t2) return;
    
    const combinedSteps = [...(t1.steps || []), ...(t2.steps || [])];
    const combinedApps = [...t1.apps, ...t2.apps];

    const newT: Template = { 
      id: Date.now(), 
      name: `${t1.name} + ${t2.name}`, 
      apps: combinedApps,
      steps: combinedSteps,
      created_at: new Date().toISOString(), 
      version: 1 
    };
    
    setSavedTemplates(prev => [newT, ...prev]);
    setSelectedTemplate(newT);
    setActiveTab('dashboard');
    setConnectApp1(null); setConnectApp2(null);
  }, [connectApp1, connectApp2, savedTemplates]);

  const TemplateCard = memo(({ template, onClick }: { template: Template; onClick: (t: Template) => void }) => (
    <GlowCard onClick={() => onClick(template)} className="p-8 text-left hover:-translate-y-2 transition-transform h-full" ariaLabel={`Select ${template.name} template`}>
      <h3 className="font-bold text-2xl text-white mb-6 leading-tight">{template.name}</h3>
      <div className="flex -space-x-3 mb-4" aria-label={`Workflow steps: ${template.steps?.length || 0}`}>
        {(template.steps || template.apps).map((_, idx) => (
          <div key={idx} className="w-12 h-12 rounded-full bg-black border-2 border-white/20 flex items-center justify-center shadow-lg relative z-10">
            <AppWindow size={20} className="text-[#007AFF]" aria-hidden="true" />
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400 mt-auto pt-4 border-t border-white/10">Contains {template.steps?.length || template.apps.length} sequential step{((template.steps?.length || template.apps.length) !== 1) ? 's' : ''}</p>
    </GlowCard>
  ));
  TemplateCard.displayName = 'TemplateCard';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (!selectedTemplate) {
          return (
            <motion.div key="selection" initial={reducedMotion ? {} : { opacity: 0 }} animate={reducedMotion ? {} : { opacity: 1 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.4 }} className="flex flex-col items-center justify-center h-full px-10 pt-20 pb-10">
              <WordsPullUp text="What template will you use?" className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-12 text-center" showAsterisk />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full" role="list">
                {savedTemplates.map(template => (<TemplateCard key={template.id} template={template} onClick={setSelectedTemplate} />))}
                <GlowCard onClick={() => { setActiveTab('create'); setHasScanned(false); setScanError(null); }} className="p-8 flex flex-col items-center justify-center min-h-[250px] border border-dashed border-white/20 hover:border-[#007AFF] group" ariaLabel="Create new template">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#007AFF]/20 transition-colors" aria-hidden="true"><Plus size={32} className="text-gray-400 group-hover:text-[#007AFF]" /></div>
                  <h3 className="font-bold text-xl text-gray-300 group-hover:text-white transition-colors">Add New Template</h3>
                </GlowCard>
              </div>
            </motion.div>
          );
        }
        return (
          <motion.div key="workspace" initial={reducedMotion ? {} : { opacity: 0, y: 20 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.4 }} className="flex flex-col lg:flex-row gap-6 h-full px-8 pt-32 pb-8 max-w-[1600px] mx-auto w-full">
            
            {/* CLEANED UP EXECUTION PANEL */}
            <div className="w-full lg:w-[300px] shrink-0 bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/10 p-6 flex flex-col shadow-2xl overflow-y-auto">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="font-bold text-white tracking-wide">Execution <span className="text-gray-600">Control</span></h2>
                <button onClick={() => setSelectedTemplate(null)} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]">Change</button>
              </div>
              <div className="space-y-4 pt-2 mt-auto">
                <Button 
                    onClick={executeAutomation} 
                    variant="outline" 
                    className="w-full h-16 justify-start gap-3 rounded-2xl border-[#00D084]/40 bg-gradient-to-r from-[#00D084]/20 to-[#007AFF]/10 text-white shadow-[0_8px_24px_rgba(0,208,132,0.22)] hover:from-[#00D084]/30 hover:to-[#007AFF]/15 hover:border-[#00D084]" 
                    disabled={engineState === 'executing'}
                >
                  <span className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center" aria-hidden="true"><Play size={16} fill="currentColor" /></span>
                  <span className="font-bold text-base">Start Automation</span>
                </Button>
                <Button 
                    onClick={abortExecution} 
                    variant="danger" 
                    className="w-full h-14 justify-start gap-3 rounded-2xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-red-500/10 text-red-200 shadow-[0_8px_24px_rgba(239,68,68,0.22)] hover:from-red-500/30 hover:to-red-500/20"
                    aria-label="Emergency stop - press ESC to halt all automation"
                >
                  <span className="w-7 h-7 rounded-full bg-red-400/25 border border-red-300/40 flex items-center justify-center" aria-hidden="true"><span className="w-2.5 h-0.5 bg-red-100" /></span>
                  Emergency Stop (ESC)
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative">
              <div className="px-8 py-5 border-b border-white/10 bg-black/50 flex justify-between items-center z-10">
                <div className="flex items-center gap-3"><Bot size={24} className="text-[#007AFF]" aria-hidden="true" /><span className="font-bold text-white tracking-wide">Automato AI Command Center</span></div>
                <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full animate-pulse ${engineState === 'thinking' || engineState === 'executing' ? 'bg-yellow-500' : 'bg-green-500'}`} aria-hidden="true" /><span className="text-xs text-gray-400 font-mono" role="status">{engineState === 'thinking' || engineState === 'executing' ? 'Executing OS Commands...' : 'Ready'}</span></div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6" role="log" aria-live="polite" aria-relevant="additions">
                {chatHistory.map((msg) => (
                  <motion.article key={msg.id} initial={reducedMotion ? {} : { opacity: 0, y: 10 }} animate={reducedMotion ? {} : { opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`} aria-label={`${msg.role === 'user' ? 'Your message' : 'Automato response'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-white/10 text-white' : msg.role === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-[#007AFF]/20 text-[#007AFF]'}`} aria-hidden="true">
                        {msg.role === 'user' ? <User size={16} /> : msg.role === 'error' ? <AlertTriangle size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#007AFF] text-white rounded-tr-sm' : msg.role === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-sm' : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'}`}>{msg.text}</div>
                  </motion.article>
                ))}
                {(engineState === 'thinking' || engineState === 'executing') && (<div className="flex gap-4"><div className="w-8 h-8 rounded-full bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center shrink-0" aria-hidden="true"><Bot size={16} /></div><div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 flex items-center gap-2" role="status" aria-live="polite"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} aria-hidden="true" /><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} aria-hidden="true" /><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} aria-hidden="true" /></div></div>)}
              </div>
              <div className="p-6 bg-black/50 border-t border-white/10 z-10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#007AFF]"><Mic size={14} aria-hidden="true"/> Voice / Chat Prompt</div>
                <form onSubmit={(e) => { e.preventDefault(); handleQuickAction(chatInput); }} className="relative flex items-center bg-transparent border border-white/10 rounded-2xl focus-within:border-[#007AFF] transition-colors shadow-inner">
                  <label htmlFor="chat-input" className="sr-only">Type your command</label>
                  <input id="chat-input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={engineState === 'executing'} className="w-full bg-transparent p-4 pr-14 outline-none text-white placeholder:text-gray-600 text-sm disabled:opacity-50" placeholder={engineState === 'executing' ? 'Automation in progress...' : 'Describe what you want to automate based on this template...'} aria-busy={engineState === 'thinking' || engineState === 'executing'} />
                  <button type="submit" disabled={!chatInput.trim() || engineState === 'executing'} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#007AFF] rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:bg-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]" aria-label="Send message">{(engineState === 'thinking' || engineState === 'executing') ? (<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />) : (<Send size={18} className="ml-0.5" aria-hidden="true" />)}</button>
                </form>
              </div>
            </div>

            <div className="w-full lg:w-[300px] shrink-0 bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/10 p-6 flex flex-col shadow-2xl overflow-y-auto">
              <Badge variant="primary" className="w-fit mb-4">Active Template</Badge>
              <h2 className="text-xl font-bold text-white leading-tight mb-8">{selectedTemplate.name}</h2>
              <div className="space-y-4 relative flex-1">
                {selectedTemplate.steps && selectedTemplate.steps.length > 0 ? (
                  <>
                    {selectedTemplate.steps.length > 1 && (<div className="absolute left-6 top-10 bottom-10 w-0.5 bg-gradient-to-b from-[#007AFF] to-green-500 opacity-30 z-0" aria-hidden="true" />)}
                    {selectedTemplate.steps.map((step, index) => (
                      <div key={`${step.id}-${index}`} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-4 relative z-10 shadow-lg">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner bg-[#007AFF]/20 text-[#007AFF] font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm line-clamp-2">{step.rule || "Execute learned rule"}</h4>
                          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{index === 0 ? "Trigger Step" : "Sequential Step"}</p>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">No sequential steps defined. Operating dynamically via prompt.</p>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'create':
        return (
          <motion.div key="create" initial={reducedMotion ? {} : { opacity: 0 }} animate={reducedMotion ? {} : { opacity: 1 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.4 }} className="w-full h-full overflow-y-auto pt-32 pb-20">
            <div className="max-w-4xl mx-auto px-8">
              <div className="mb-10 text-center">
                <WordsPullUp text="New Template" className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg" />
                <p className="text-gray-400 mt-3 text-lg max-w-xl mx-auto">Break free from hardcoded apps. Upload screenshots and write sequential steps to teach Automato.</p>
              </div>
              
              <div className="bg-black/40 backdrop-blur-xl p-8 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl space-y-10">
                
                <div className={`bg-black/60 rounded-2xl border ${scanError ? 'border-red-500/50' : 'border-white/10'} p-6 flex flex-col md:flex-row items-center justify-between shadow-inner gap-4 transition-colors`}>
                  <div className="flex items-center gap-4 w-full">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${scanError ? 'bg-red-500/20 text-red-500' : isScanning ? 'bg-yellow-500/20 text-yellow-500' : hasScanned ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                      {scanError ? <WifiOff size={24} /> : isScanning ? <RefreshCcw className="animate-spin" size={24} /> : hasScanned ? <Wifi size={24} /> : <Monitor size={24} />}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Local Agent Connection</h3>
                      <p className={`text-xs font-mono mt-1 ${scanError ? 'text-red-400' : 'text-gray-400'}`}>
                        {scanError ? scanError : isScanning ? 'Pinging localhost:8080...' : hasScanned ? 'Connected to local execution agent.' : 'Awaiting local connection'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={scanDesktopApps} 
                    disabled={isScanning}
                    className={`h-10 px-6 text-xs font-bold rounded-lg shrink-0 ${hasScanned && !scanError ? 'bg-white/10 text-white' : scanError ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#007AFF] text-white'}`}
                  >
                    {isScanning ? 'Scanning...' : scanError ? 'Retry Scan' : hasScanned ? 'Rescan System' : 'Scan Local Desktop'}
                  </Button>
                </div>

                <div className="space-y-3">
                  <label htmlFor="template-name" className="text-xs font-bold uppercase text-gray-400 tracking-widest">Template Name</label>
                  <div className="rounded-xl border border-white/10 bg-black/50 transition-colors focus-within:border-[#007AFF]">
                    <input id="template-name" value={templateName} onChange={(e)=>setTemplateName(e.target.value)} className="w-full p-5 bg-transparent text-white outline-none placeholder:text-gray-600 text-lg" placeholder="e.g. Daily Invoice Extractor" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Detected Local Applications</label>
                    <span className="text-[10px] text-[#007AFF] font-bold uppercase tracking-widest bg-[#007AFF]/10 px-3 py-1 rounded-full border border-[#007AFF]/20">Required</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="group" aria-label="Detected applications">
                    {availableApps.map((app) => {
                      const isWorking = app.working;
                      const isDetected = hasScanned && detectedDesktopApps.includes(app.id);
                      const isSelectable = isWorking && isDetected;

                      return (
                        <div key={app.id} className={`h-28 flex flex-col items-center justify-center gap-2 relative overflow-hidden rounded-xl border ${isSelectable ? 'border-[#007AFF]/30 bg-[#007AFF]/5 text-white' : 'border-white/5 bg-black/40 text-gray-600'}`}>
                          <app.icon size={28} className={isSelectable ? 'text-[#007AFF]' : 'text-gray-600'} aria-hidden="true" />
                          <span className="text-xs font-bold whitespace-nowrap">{app.name}</span>
                          {!isSelectable && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-[2px]" aria-hidden="true">
                              <Lock size={16} className="text-gray-500 mb-2" />
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest text-center px-2 leading-tight">
                                {!isWorking ? 'Coming Soon' : !hasScanned ? 'Requires\nScan' : 'Not Detected\nOn Desktop'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="h-[1px] bg-white/10 w-full" />

                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold uppercase text-white tracking-widest flex items-center gap-2">
                      <Grid size={18} className="text-[#007AFF]" /> Sequential Steps
                    </label>
                    <Badge variant="primary">{wizardSteps.length} Step{wizardSteps.length > 1 ? 's' : ''}</Badge>
                  </div>

                  <AnimatePresence>
                    {wizardSteps.map((step, index) => (
                      <motion.div 
                        key={step.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-black/60 border border-white/10 rounded-2xl p-6 relative group focus-within:border-[#007AFF]/50 transition-all"
                      >
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-[#007AFF] font-bold uppercase tracking-widest text-xs">Step {index + 1}</h4>
                          {wizardSteps.length > 1 && (
                            <button onClick={() => handleRemoveStep(step.id)} className="text-gray-600 hover:text-red-500 transition-colors" aria-label="Remove step">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="w-full md:w-1/3 shrink-0">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Screenshot (Optional)</label>
                            <div className="relative h-32 rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-[#007AFF]/50 transition-all flex items-center justify-center overflow-hidden cursor-pointer">
                              <input 
                                type="file" accept="image/*" 
                                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                onChange={(e) => handleImageUpload(step.id, e.target.files?.[0] || null)}
                              />
                              {step.imagePreview ? (
                                <img src={step.imagePreview} alt={`Step ${index + 1} preview`} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                              ) : (
                                <div className="text-center p-4">
                                  <ImageIcon size={24} className="mx-auto text-gray-500 mb-2" />
                                  <span className="text-[10px] text-gray-400">Click to upload target UI</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Sequential Steps</label>
                            <textarea 
                              value={step.rule}
                              onChange={(e) => handleUpdateStepRule(step.id, e.target.value)}
                              className="w-full flex-1 min-h-[100px] bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-[#007AFF] resize-none placeholder:text-gray-600"
                              placeholder="e.g. Find the 'Total Amount' in the Doc and type it into Excel cell C5..."
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <Button onClick={handleAddStep} variant="outline" className="w-full py-8 border-dashed border-white/20 hover:border-[#007AFF] text-gray-400 hover:text-white bg-transparent">
                    <PlusCircle size={20} className="mr-2 text-[#007AFF]" /> Add Next Step
                  </Button>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <Button 
                    onClick={handleFinishWizard} 
                    className="w-full h-16 text-lg rounded-2xl shadow-[0_0_30px_rgba(0,122,255,0.3)] hover:shadow-[0_0_40px_rgba(0,122,255,0.5)]" 
                    disabled={!templateName.trim() || wizardSteps.some(s => !s.rule.trim())}
                  >
                    <Check size={24} className="mr-2" /> Done
                  </Button>
                  <p className="text-center text-xs text-gray-500 mt-4">
                    This will POST your template to the Cloud Vault for execution.
                  </p>
                </div>

              </div>
            </div>
          </motion.div>
        );

      case 'connect':
        return (
          <motion.div key="connect" initial={reducedMotion ? {} : { opacity: 0 }} animate={reducedMotion ? {} : { opacity: 1 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.4 }} className="w-full h-full flex flex-col">
            <section className="relative h-[55vh] w-full overflow-hidden border-b border-white/10 shrink-0">
              <div className="absolute bottom-0 left-0 right-0 px-8 pb-12 sm:px-12 md:px-16 max-w-7xl mx-auto">
                <div className="grid grid-cols-12 items-end gap-6">
                  <div className="col-span-12 lg:col-span-8">
                    <Badge variant="secondary" className="mb-6"><Network size={12} className="mr-2" aria-hidden="true"/> Logic Linker</Badge>
                    <h1 className="font-bold leading-[0.85] tracking-tighter text-[10vw] sm:text-[8vw] md:text-[6vw] text-white shadow-black drop-shadow-2xl"><WordsPullUp text="Connect Templates" showAsterisk delayStart={0.2} /></h1>
                  </div>
                  <div className="col-span-12 flex flex-col gap-6 pb-2 lg:col-span-4 lg:pb-6">
                    <motion.p initial={reducedMotion ? {} : { y: 20, opacity: 0 }} animate={reducedMotion ? {} : { y: 0, opacity: 1 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.6 }} className="text-base text-gray-300 leading-relaxed font-medium">Link sequential atomic templates into a massive cross-platform workflow.</motion.p>
                  </div>
                </div>
              </div>
            </section>
            <div className="pt-16 pb-24 px-10 flex-1 flex flex-col items-center">
              <motion.div initial={reducedMotion ? {} : { y: 20, opacity: 0 }} animate={reducedMotion ? {} : { y: 0, opacity: 1 }} transition={reducedMotion ? { duration: 0 } : { delay: 0.8, duration: 0.4 }} className="flex flex-col md:flex-row gap-8 w-full max-w-5xl items-center">
                <div className="flex-1 w-full space-y-3">
                  <label htmlFor="template-set-1" className="text-xs font-bold uppercase tracking-widest text-[#007AFF]">Template Set 1</label>
                  <select id="template-set-1" value={connectApp1 || ""} onChange={e => setConnectApp1(e.target.value)} className="w-full bg-black/60 border border-white/10 text-white p-5 rounded-2xl outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/50">
                    <option value="" disabled>Select first template...</option>
                    {savedTemplates.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                <div className="pt-6" aria-hidden="true"><Plus size={32} className="text-gray-500" /></div>
                <div className="flex-1 w-full space-y-3">
                  <label htmlFor="template-set-2" className="text-xs font-bold uppercase tracking-widest text-green-500">Template Set 2</label>
                  <select id="template-set-2" value={connectApp2 || ""} onChange={e => setConnectApp2(e.target.value)} className="w-full bg-black/60 border border-white/10 text-white p-5 rounded-2xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/50">
                    <option value="" disabled>Select second template...</option>
                    {savedTemplates.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              </motion.div>
              <motion.div initial={reducedMotion ? {} : { y: 20, opacity: 0 }} animate={reducedMotion ? {} : { y: 0, opacity: 1 }} transition={reducedMotion ? { duration: 0 } : { delay: 1, duration: 0.4 }} className="mt-16">
                 <Button size="lg" onClick={handleMergeTemplates} className="rounded-full shadow-[0_0_30px_rgba(0,122,255,0.4)] px-12" disabled={!connectApp1 || !connectApp2}>Link & Open Workspace</Button>
              </motion.div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        abortExecution();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [engineState, abortExecution]);

  return (
    <div className="h-screen w-full bg-black text-gray-100 font-sans overflow-hidden flex flex-col relative">
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcer" />
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <SmokeBackground smokeColor="#DC143C" logoSrc="/logo.png" showLogo={true} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/60 to-[#0a0a0a]" />
      </div>
      <nav className="absolute left-1/2 top-0 z-[60] -translate-x-1/2" aria-label="Main navigation">
        <div className="flex items-center gap-2 md:gap-8 rounded-b-3xl bg-black/80 backdrop-blur-xl px-8 py-4 border-x border-b border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id as string); if(item.id === 'dashboard') setSelectedTemplate(null); }} className="text-sm font-bold tracking-wide transition-colors relative px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:rounded" style={{ color: activeTab === item.id ? "#FFFFFF" : "rgba(156, 163, 175, 0.8)" }}>
              {item.title}
              {activeTab === item.id && (<motion.div layoutId="nav-indicator" className="absolute -bottom-4 left-0 right-0 h-[2px] bg-[#007AFF] shadow-[0_0_15px_rgba(0,122,255,1)]" aria-hidden="true" />)}
            </button>
          ))}
          <div className="w-[1px] h-5 bg-gray-700 mx-2" aria-hidden="true" />
          <button onClick={onLogout} className="text-sm font-bold tracking-wide text-red-500/80 hover:text-red-500 transition-colors focus:outline-none">Exit</button>
        </div>
      </nav>
      <main id="main-content" className="flex-1 overflow-hidden w-full relative z-10" tabIndex={-1}>
        <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
      </main>
    </div>
  );
}

/* =========================================================================
   ROOT COMPONENT
   ========================================================================= */

export default function RootApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }} transition={{ duration: 0.4 }} className="h-full w-full relative z-50">
              <SignInPage onLogin={() => setIsAuthenticated(true)} />
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="h-full w-full relative">
              <AutomatoDashboard onLogout={() => setIsAuthenticated(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </ErrorBoundary>
    </div>
  );
}