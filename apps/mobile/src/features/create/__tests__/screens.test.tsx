import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ToastProvider } from '../../../components/ui';
import sql30 from '../../../../../../templates/sql-30.sparksquad.json';
import { CreateFlowProvider } from '../flow';
import { ImportScreen } from '../screens/ImportScreen';
import { PlanSourceScreen } from '../screens/PlanSourceScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../auth/SessionProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't close over imports
  useMe: () => require('../../../test/fixtures').me(),
}));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(), setStringAsync: jest.fn() }));
const mockClipboard = jest.requireMock<{ getStringAsync: jest.Mock; setStringAsync: jest.Mock }>(
  'expo-clipboard',
);
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const wrap = (ui: ReactElement) => (
  <ToastProvider>
    <CreateFlowProvider>{ui}</CreateFlowProvider>
  </ToastProvider>
);

beforeEach(() => jest.clearAllMocks());

describe('Import plan (D5/D6)', () => {
  it('previews a pasted AI reply and imports it', async () => {
    mockClipboard.getStringAsync.mockResolvedValue(
      `Here is your plan:\n\`\`\`json\n${JSON.stringify(sql30)}\n\`\`\`\nGood luck!`,
    );
    await render(wrap(<ImportScreen />));
    await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));
    expect(await screen.findByText(sql30.title)).toBeTruthy();
    expect(screen.getByLabelText('30 days')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Import plan' }));
    // No squad basics yet (opened from Discover), so basics come next.
    expect(mockPush).toHaveBeenCalledWith('/create/basics');
  });

  it('explains why text is not a plan and offers the prompt again', async () => {
    mockClipboard.getStringAsync.mockResolvedValue('Sorry, I cannot help with that.');
    await render(wrap(<ImportScreen />));
    await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));
    expect(await screen.findByText('This isn’t a SparkSquad plan')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Import plan' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy the prompt again' }));
    expect(mockClipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('SparkSquad'),
    );
  });
});

describe('Plan source (D2)', () => {
  it('lists the five ways to start with free/Plus tags', async () => {
    await render(wrap(<PlanSourceScreen />));
    expect(screen.getByRole('button', { name: 'Build it with your AI, Free' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Generate in the app, Plus' }));
    expect(mockPush).toHaveBeenCalledWith('/create/ai-build');
    await fireEvent.press(screen.getByRole('button', { name: 'Start blank' }));
    expect(mockPush).toHaveBeenCalledWith('/create/blank');
  });
});
