import { visibleCategories } from '../CategoryFilter';

describe('visibleCategories', () => {
  const all = ['coding', 'career', 'exams', 'fitness', 'health'] as const;

  it('shows the first three by default', () => {
    expect(visibleCategories(all, 'all')).toEqual(['coding', 'career', 'exams']);
  });

  it('leaves the row alone when the choice is already on it', () => {
    expect(visibleCategories(all, 'career')).toEqual(['coding', 'career', 'exams']);
  });

  it('keeps a choice from the sheet visible in the last slot', () => {
    expect(visibleCategories(all, 'health')).toEqual(['coding', 'career', 'health']);
  });

  it('ignores a choice that is not on offer', () => {
    expect(visibleCategories(all, 'finance')).toEqual(['coding', 'career', 'exams']);
  });
});
