type TagColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

export const availableTagColors: TagColor[] = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

const colorMap: Record<TagColor, string> = {
  red: 'bg-red-500 dark:bg-red-400',
  orange: 'bg-orange-500 dark:bg-orange-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  yellow: 'bg-yellow-500 dark:bg-yellow-400',
  lime: 'bg-lime-500 dark:bg-lime-400',
  green: 'bg-green-500 dark:bg-green-400',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  teal: 'bg-teal-500 dark:bg-teal-400',
  cyan: 'bg-cyan-500 dark:bg-cyan-400',
  sky: 'bg-sky-500 dark:bg-sky-400',
  blue: 'bg-blue-500 dark:bg-blue-400',
  indigo: 'bg-indigo-500 dark:bg-indigo-400',
  violet: 'bg-violet-500 dark:bg-violet-400',
  purple: 'bg-purple-500 dark:bg-purple-400',
  fuchsia: 'bg-fuchsia-500 dark:bg-fuchsia-400',
  pink: 'bg-pink-500 dark:bg-pink-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
};

/** Get background color classes for tag color dots */
export function getTagDotColor(color: TagColor | null): string {
  if (!color) {
    return 'bg-slate-400 dark:bg-slate-500';
  }
  return colorMap[color];
}

/** Get text color classes for tag icons (sidebar, etc) */
export function getTagIconColor(color: TagColor | null): string {
  if (!color) {
    return 'text-slate-400 dark:text-slate-500';
  }
  return colorMap[color].replace(/bg-/g, 'text-');
}
