// Design tokens (Section 8 of the build doc). Screens must use these - never hard-coded hex values.
export const lightColors = {
  primary: '#FF7A45',
  primaryDark: '#E8622E',
  primarySoft: '#FFF1EA',
  success: '#3BB54A',
  successDark: '#2E9A3C',
  successSoft: '#EAF7EC',
  danger: '#F2564B',
  dangerSoft: '#FDECEB',
  // TEXT in brand colours: the fills above are too light for small text on white (orange 2.6:1).
  // These keep the hue and reach WCAG AA 4.5:1 on background, *Soft and surfaceAlt.
  primaryText: '#AE5330',
  successText: '#287C33',
  dangerText: '#BD433A',
  warning: '#F5A623',
  text: '#222831',
  subtext: '#676D7B', // 4.5:1 also on the tinted *Soft / surfaceAlt backgrounds
  disabled: '#B8BCC4',
  divider: '#E5E7EB',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F2',
  overlay: 'rgba(0,0,0,0.45)',
  white: '#FFFFFF',
  black: '#000000',
  onPrimary: '#FFFFFF',
  placeholderAvatar: '#D6D9DE',
  inCallBgTop: '#ECEBF3',
  inCallBgBottom: '#D9D7EE',
  inCallShape: '#C9C5E8',
  skeleton: '#ECEEF1',
  transparent: 'transparent',
  // Avatar initials + confetti accents
  palette: ['#FF7A45', '#3BB54A', '#5B8DEF', '#A66CFF', '#F5A623', '#14B8A6', '#EC4899'],
};

export const darkColors = {
  ...lightColors,
  primarySoft: '#3A2A22',
  successSoft: '#1F3324',
  dangerSoft: '#3A2221',
  // On dark backgrounds the bright brand colours already pass AA (orange 7.1:1); red needs a lighter shade.
  primaryText: '#FF7A45',
  successText: '#3BB54A',
  dangerText: '#F46A61',
  text: '#F3F4F6',
  subtext: '#9CA3AF',
  disabled: '#4B5563',
  divider: '#2D3139',
  background: '#121417',
  surface: '#1A1D21',
  surfaceAlt: '#22262B',
  placeholderAvatar: '#3A3F47',
  inCallBgTop: '#1D1C26',
  inCallBgBottom: '#2A2840',
  inCallShape: '#3B3760',
  skeleton: '#262A30',
};

export default lightColors;
