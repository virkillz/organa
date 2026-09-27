/** Design tokens sampled from the Organa mockups (light theme only for the demo). */
export const colors = {
  primary: '#0A752B',
  primaryDark: '#087028',
  primaryLight: '#148F39',
  primaryTint: '#8CC49B',
  surfaceTint: '#F2FAF0',
  successBg: '#B5F3BD',
  suggestionBg: '#E6F0E6',
  warning: '#E37435',
  danger: '#D93838',
  dangerBg: '#FAD5D5',
  ink: '#111111',
  navy: '#2B2D4F',
  muted: '#8A8A8E',
  line: '#D5D5D8',
  chip: '#EFEFF1',
  white: '#FFFFFF',
  background: '#FFFFFF',
  backgroundAlt: '#EFF5EE',
} as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
