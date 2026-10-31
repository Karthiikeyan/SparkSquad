import { clearPrefs, getPref, removePref, setPref } from '../prefs';

describe('prefs', () => {
  afterEach(() => clearPrefs());

  it('round-trips typed values', () => {
    setPref('pendingInvite', 'ABC234');
    setPref('aiDailyLimit', 20);
    setPref('recentSearches', ['dsa', 'sql']);
    expect(getPref('pendingInvite')).toBe('ABC234');
    expect(getPref('aiDailyLimit')).toBe(20);
    expect(getPref('recentSearches')).toEqual(['dsa', 'sql']);
  });

  it('removes values and returns undefined when missing', () => {
    setPref('onboardedUserId', 'U1');
    removePref('onboardedUserId');
    expect(getPref('onboardedUserId')).toBeUndefined();
  });
});
