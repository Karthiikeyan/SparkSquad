import type * as AppleAiModule from '@react-native-ai/apple';
import { Platform } from 'react-native';

type AppleAi = typeof AppleAiModule;

function appleAi(): AppleAi | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module loads lazily
    return require('@react-native-ai/apple') as AppleAi;
  } catch {
    return null;
  }
}

/** iOS Foundation Models (Apple Intelligence) on this phone; false everywhere else. */
export function onDeviceAvailable(): boolean {
  try {
    return appleAi()?.AppleFoundationModels.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/** One prompt to the on-device model; free and private, nothing leaves the phone. */
export async function onDeviceText(prompt: string): Promise<string> {
  const ai = appleAi();
  if (!ai) throw new Error('On-device AI unavailable');
  const parts = await ai.AppleFoundationModels.generateText([{ role: 'user', content: prompt }], {
    maxTokens: 300,
    temperature: 0.7,
  });
  const text = parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .trim();
  if (!text) throw new Error('Empty reply');
  return text;
}
