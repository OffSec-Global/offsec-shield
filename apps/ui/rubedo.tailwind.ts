import type { Config } from 'tailwindcss';

/**
 * OffSec Shield Rubedo Edition - Tailwind Configuration
 *
 * Extends Tailwind with the complete Rubedo design system tokens.
 * Drop into your tailwind.config.ts and add to the `presets` array.
 */

const rubedoConfig: Partial<Config> = {
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════════
      // COLORS
      // ═══════════════════════════════════════════════════════════════════
      colors: {
        // Base - Onyx Shadow
        bg: '#050507',
        surface: {
          DEFAULT: '#0E0F12',
          2: '#14161A',
          3: '#1A1C21',
          4: '#22242A',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.07)',
          subtle: 'rgba(255, 255, 255, 0.04)',
          strong: 'rgba(255, 255, 255, 0.12)',
        },

        // Text - Platinum Veil
        platinum: {
          DEFAULT: '#EDEDF2',
          muted: '#8A8B94',
          dim: '#5A5B64',
          faint: '#3A3B44',
        },

        // Emerald - Healthy / Success
        emerald: {
          DEFAULT: '#00E79E',
          bright: '#00FFA8',
          dim: 'rgba(0, 231, 158, 0.15)',
          glow: 'rgba(0, 231, 158, 0.4)',
          faint: 'rgba(0, 231, 158, 0.08)',
        },

        // Ruby - Critical / Active Defense
        ruby: {
          DEFAULT: '#FF005D',
          bright: '#FF3377',
          dim: 'rgba(255, 0, 93, 0.15)',
          glow: 'rgba(255, 0, 93, 0.4)',
          faint: 'rgba(255, 0, 93, 0.08)',
        },

        // Amber - Warning / Degraded
        amber: {
          DEFAULT: '#FFC93C',
          dim: 'rgba(255, 201, 60, 0.15)',
          glow: 'rgba(255, 201, 60, 0.4)',
          faint: 'rgba(255, 201, 60, 0.08)',
        },

        // Cyan - Info / Network
        cyan: {
          DEFAULT: '#00D4FF',
          dim: 'rgba(0, 212, 255, 0.15)',
          glow: 'rgba(0, 212, 255, 0.4)',
        },

        // Gold - Accent
        gold: '#D4AF37',
      },

      // ═══════════════════════════════════════════════════════════════════
      // TYPOGRAPHY
      // ═══════════════════════════════════════════════════════════════════
      fontFamily: {
        display: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },

      // ═══════════════════════════════════════════════════════════════════
      // SPACING (8px rhythm grid)
      // ═══════════════════════════════════════════════════════════════════
      spacing: {
        rhythm: '8px',
        'rhythm-2': '16px',
        'rhythm-3': '24px',
        'rhythm-4': '32px',
        'rhythm-5': '40px',
        'rhythm-6': '48px',
      },

      // ═══════════════════════════════════════════════════════════════════
      // BORDER RADIUS
      // ═══════════════════════════════════════════════════════════════════
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '12px',
        xl: '16px',
      },

      // ═══════════════════════════════════════════════════════════════════
      // BOX SHADOWS
      // ═══════════════════════════════════════════════════════════════════
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.4)',
        lg: '0 4px 16px rgba(0, 0, 0, 0.5)',
        emerald: '0 0 12px rgba(0, 231, 158, 0.3)',
        'emerald-glow': '0 0 20px rgba(0, 231, 158, 0.5)',
        ruby: '0 0 12px rgba(255, 0, 93, 0.3)',
        'ruby-glow': '0 0 20px rgba(255, 0, 93, 0.5)',
        amber: '0 0 12px rgba(255, 201, 60, 0.3)',
        'amber-glow': '0 0 20px rgba(255, 201, 60, 0.5)',
      },

      // ═══════════════════════════════════════════════════════════════════
      // ANIMATIONS
      // ═══════════════════════════════════════════════════════════════════
      animation: {
        'pulse-healthy': 'pulse-healthy 1.5s ease-in-out infinite',
        'pulse-critical': 'pulse-critical 0.5s ease-in-out infinite',
        'rubedo-pulse': 'rubedo-pulse 1.3s ease-in-out infinite',
        ambient: 'ambient-pulse 4s ease-in-out infinite alternate',
        scanlines: 'scanlines 0.1s linear infinite',
        loading: 'loading-pulse 1.5s ease-in-out infinite',
        'card-critical': 'card-critical 2s ease-in-out infinite',
        'sweep-emerald': 'sweep-emerald 0.4s ease-out',
        'threat-enter': 'threat-enter 0.3s ease-out',
      },

      keyframes: {
        'pulse-healthy': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.1)' },
        },
        'pulse-critical': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'rubedo-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 4px rgba(255, 0, 93, 0.4), 0 0 8px rgba(255, 0, 93, 0.2)'
          },
          '50%': {
            boxShadow: '0 0 8px rgba(255, 0, 93, 0.6), 0 0 16px rgba(255, 0, 93, 0.3)'
          },
        },
        'ambient-pulse': {
          '0%': { opacity: '0.3', transform: 'scale(1)' },
          '100%': { opacity: '0.6', transform: 'scale(1.02)' },
        },
        scanlines: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(4px)' },
        },
        'loading-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'card-critical': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(255, 0, 93, 0.15)' },
          '50%': { boxShadow: '0 0 0 1px rgba(255, 0, 93, 0.4), 0 0 12px rgba(255, 0, 93, 0.2)' },
        },
        'sweep-emerald': {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
        'threat-enter': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // TRANSITIONS
      // ═══════════════════════════════════════════════════════════════════
      transitionDuration: {
        fast: '100ms',
        base: '200ms',
        slow: '400ms',
      },
    },
  },
};

export default rubedoConfig;
