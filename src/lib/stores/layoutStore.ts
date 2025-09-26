import { writable, get, type Writable } from 'svelte/store';
import type { LayoutState } from '../models/entities';
import layoutContract from '../../../specs/003-ui-fix-i/contracts/layout-contract.json' assert { type: 'json' };

// Default theme values for dark sci-fi (cosmic blues/purples)
const DEFAULT_THEME = {
  bg: '#0a0a0a' as string, // Deep space black
  accentBlue: '#00f5ff' as string, // Cyan glow
  accentPurple: '#8b00ff' as string, // Deep purple
  glow: '0 0 20px #00f5ff' as string // Glowing effect
};

// Simple schema validation based on layout-contract.json
function validateLayoutState(state: Partial<LayoutState>): state is LayoutState {
  // Required: breakpoint enum
  if (!state.breakpoint || !['mobile', 'tablet', 'desktop'].includes(state.breakpoint)) {
    console.warn('Invalid breakpoint:', state.breakpoint);
    return false;
  }

  // Required: theme object
  if (!state.theme || typeof state.theme !== 'object') {
    console.warn('Invalid theme object');
    return false;
  }

  // Theme color validation (hex pattern)
  const requiredThemeProps = ['bg', 'accentBlue', 'accentPurple', 'glow'] as const;
  for (const prop of requiredThemeProps) {
    if (!state.theme[prop] || typeof state.theme[prop] !== 'string') {
      console.warn(`Missing theme property: ${prop}`);
      return false;
    }
    // Basic hex validation for colors (bg, accentBlue, accentPurple)
    if (prop !== 'glow' && !/^#[0-9a-fA-F]{6}$/.test(state.theme[prop])) {
      console.warn(`Invalid hex color for ${prop}:`, state.theme[prop]);
      return false;
    }
  }

  // Optional: orientation enum
  if (state.orientation && !['portrait', 'landscape'].includes(state.orientation)) {
    console.warn('Invalid orientation:', state.orientation);
    return false;
  }

  // Optional: isOverflowing boolean
  if (state.isOverflowing !== undefined && typeof state.isOverflowing !== 'boolean') {
    console.warn('Invalid isOverflowing:', state.isOverflowing);
    return false;
  }

  return true;
}

// Determine breakpoint from window width
function getBreakpoint(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

// Determine orientation from dimensions
function getOrientation(width: number, height: number): 'portrait' | 'landscape' {
  return width < height ? 'portrait' : 'landscape';
}

// Check for overflow
function hasOverflow(): boolean {
  if (typeof window === 'undefined') return false;
  return document.body.scrollHeight > window.innerHeight || 
         document.body.scrollWidth > window.innerWidth;
}

// Apply theme CSS variables to document
function applyTheme(theme: typeof DEFAULT_THEME) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  root.style.setProperty('--primary-bg', theme.bg);
  root.style.setProperty('--accent-blue', theme.accentBlue);
  root.style.setProperty('--accent-purple', theme.accentPurple);
  root.style.setProperty('--glow-effect', theme.glow);
  
  // Additional sci-fi theme variables
  root.style.setProperty('--text-primary', '#ffffff');
  root.style.setProperty('--text-secondary', '#b0b0b0');
  root.style.setProperty('--border-glow', '0 0 5px #00f5ff');
  root.style.setProperty('--shadow-nebula', '0 0 30px rgba(0, 245, 255, 0.3)');
}

// Resize event handler with debouncing
let resizeTimeout: NodeJS.Timeout | null = null;
function handleResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  
  resizeTimeout = setTimeout(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const newState: LayoutState = {
      breakpoint: getBreakpoint(width),
      orientation: getOrientation(width, height),
      isOverflowing: hasOverflow(),
      theme: DEFAULT_THEME
    };

    // Validate before updating store
    if (validateLayoutState(newState)) {
      layoutStore.set(newState);
      
      // Emit resize event (for contract compliance)
      window.dispatchEvent(new CustomEvent('layout:resize', {
        detail: {
          breakpoint: newState.breakpoint,
          orientation: newState.orientation
        }
      }));
      
      // Emit overflow change if changed
      const previousState = get(layoutStore);
      if (previousState.isOverflowing !== newState.isOverflowing) {
        window.dispatchEvent(new CustomEvent('layout:overflowChange', {
          detail: { isOverflowing: newState.isOverflowing }
        }));
      }
      
      // Apply theme CSS variables
      applyTheme(newState.theme);
    }
  }, 150); // 150ms debounce for performance
}

// Initialize layout store
const initialState: LayoutState = {
  breakpoint: typeof window !== 'undefined' ? getBreakpoint(window.innerWidth) : 'mobile',
  orientation: typeof window !== 'undefined' ? getOrientation(window.innerWidth, window.innerHeight) : 'portrait',
  isOverflowing: false,
  theme: DEFAULT_THEME
};

// Validate initial state
if (!validateLayoutState(initialState)) {
  console.error('Initial layout state validation failed, using fallback');
}

// Create writable store
export const layoutStore: Writable<LayoutState> = writable(initialState);

// Initialize on mount (client-side only)
if (typeof window !== 'undefined') {
  // Set up resize listener
  window.addEventListener('resize', handleResize);
  
  // Initial theme application
  applyTheme(initialState.theme);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('resize', handleResize);
  });
}

// Export store methods for contract compliance
export function updateLayoutState(partial: Partial<LayoutState>) {
  const current = get(layoutStore);
  const newState = { ...current, ...partial };
  
  if (validateLayoutState(newState)) {
    layoutStore.set(newState);
    applyTheme(newState.theme);
  } else {
    console.warn('Invalid layout state update rejected:', partial);
  }
}

export function getCurrentBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  return get(layoutStore).breakpoint;
}

export function isMobile(): boolean {
  return get(layoutStore).breakpoint === 'mobile';
}

export function isOverflowing(): boolean {
  return get(layoutStore).isOverflowing;
}

// Contract events (for testing)
export function emitResizeEvent(breakpoint: string, orientation: string) {
  window.dispatchEvent(new CustomEvent('layout:resize', {
    detail: { breakpoint, orientation }
  }));
}

export function emitOverflowChange(isOverflowing: boolean) {
  window.dispatchEvent(new CustomEvent('layout:overflowChange', {
    detail: { isOverflowing }
  }));
}

// TypeScript types for better IDE support
export interface LayoutStore extends Writable<LayoutState> {
  updateLayoutState: typeof updateLayoutState;
  getCurrentBreakpoint: typeof getCurrentBreakpoint;
  isMobile: typeof isMobile;
  isOverflowing: typeof isOverflowing;
  emitResizeEvent: typeof emitResizeEvent;
  emitOverflowChange: typeof emitOverflowChange;
}

// Export as typed store
export const layoutStoreTyped: LayoutStore = layoutStore as any;