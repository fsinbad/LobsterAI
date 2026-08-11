import { describe, expect, test } from 'vitest';

import { resolveOpenClawThinkingLevelForModel } from './openclawModelThinkingLevels';

describe('resolveOpenClawThinkingLevelForModel', () => {
  test('returns the product level unchanged when no server metadata is configured', () => {
    expect(resolveOpenClawThinkingLevelForModel('openai/gpt-5', 'max')).toBe('max');
    expect(resolveOpenClawThinkingLevelForModel(
      'lobsterai-server/deepseek-v4-flash',
      'high',
    )).toBe('high');
  });

  test('passes through recognized levels unchanged', () => {
    expect(resolveOpenClawThinkingLevelForModel('openai/gpt-5', 'off')).toBe('off');
    expect(resolveOpenClawThinkingLevelForModel('openai/gpt-5', 'medium')).toBe('medium');
  });
});