import { flattenSections } from '../SectionedList';

describe('flattenSections', () => {
  it('emits a title then rows with first/last flags, skipping empty sections', () => {
    const items = flattenSections(
      [
        { key: 'a', title: 'Today', data: ['x', 'y'] },
        { key: 'b', title: 'Earlier', data: [] },
        { key: 'c', data: ['z'] },
      ],
      (s) => s,
    );
    const label = (i: (typeof items)[number]) =>
      i.kind === 'title' ? i.title : [i.item, i.first, i.last].join(':');
    expect(items.map(label)).toEqual(['Today', 'x:true:false', 'y:false:true', 'z:true:true']);
  });
});
