import { deleteConfirmed } from '../DeleteAccountScreen';
import { looksLikeHandle, normaliseHandle } from '../IntegrationsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../../../lib/api/endpoints', () => ({ endpoints: {} }));

describe('delete confirmation', () => {
  it('needs the exact word, ignoring case and spaces', () => {
    expect(deleteConfirmed('DELETE')).toBe(true);
    expect(deleteConfirmed(' delete ')).toBe(true);
    expect(deleteConfirmed('DELET')).toBe(false);
    expect(deleteConfirmed('')).toBe(false);
  });
});

describe('integration handles', () => {
  it('strips a leading @ and spaces', () => {
    expect(normaliseHandle('  @kiran-raj ')).toBe('kiran-raj');
  });

  it('accepts public usernames only (same rule as the server)', () => {
    expect(looksLikeHandle('kiran_raj.dev')).toBe(true);
    expect(looksLikeHandle('kiran raj')).toBe(false);
    expect(looksLikeHandle('https://github.com/kiran')).toBe(false);
    expect(looksLikeHandle('x'.repeat(41))).toBe(false);
  });
});
