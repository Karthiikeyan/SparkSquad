import { CATEGORIES, type Category } from '@sparksquad/shared';
import {
  BookOpen,
  Briefcase,
  Code,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Languages,
  Leaf,
  Lightbulb,
  Palette,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  career: Briefcase,
  coding: Code,
  exams: GraduationCap,
  fitness: Dumbbell,
  health: HeartPulse,
  mindfulness: Leaf,
  reading: BookOpen,
  learning: Lightbulb,
  languages: Languages,
  productivity: Target,
  finance: Wallet,
  creative: Palette,
  other: Sparkles,
};

/** Categories with the user's interests first, then the rest in catalogue order. */
export function categoriesFor(interests: readonly string[]): Category[] {
  const mine = CATEGORIES.filter((c) => interests.includes(c));
  return [...mine, ...CATEGORIES.filter((c) => !mine.includes(c))];
}
