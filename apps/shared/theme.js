/**
 * The same palette the case study and the admin use, expressed as React Native
 * styles. Backgrounds stay pure white so the food photography and the status
 * colour are the only things competing for attention.
 */
export const colors = {
  paper: '#ffffff',
  ink: '#0b0b0c',
  muted: '#63636a',
  faint: '#9a9aa2',
  line: '#e8e8ec',
  tint: '#f6f6f8',
  accent: '#c1121f',
  accentInk: '#8c0d18',
  accentTint: '#fdecec',
  green: '#0f7b3f',
  greenTint: '#e9f6ee',
  amber: '#a8620a',
  amberTint: '#fdf3e4',
  blue: '#12467f',
  blueTint: '#eaf1f9'
};

export const type = {
  eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '600' },
  h1: { fontSize: 28, lineHeight: 32, fontWeight: '700', color: colors.ink, letterSpacing: -0.6 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontSize: 13, lineHeight: 19, color: colors.muted },
  mono: { fontFamily: 'Menlo', fontSize: 12, color: colors.muted }
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const card = {
  backgroundColor: colors.paper,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: radius.lg,
  padding: space.lg
};

/** Status → colour, so a status chip reads the same in both apps. */
export const statusColor = (status) => {
  if (status === 'COMPLETED' || status === 'DELIVERED') return { fg: colors.green, bg: colors.greenTint };
  if (status === 'REJECTED' || status === 'CANCELLED') return { fg: colors.accentInk, bg: colors.accentTint };
  if (status === 'PLACED' || status === 'PAID') return { fg: colors.blue, bg: colors.blueTint };
  if (status === 'READY') return { fg: colors.amber, bg: colors.amberTint };
  return { fg: colors.accentInk, bg: colors.accentTint };
};
