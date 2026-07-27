import { describe, expect, test } from 'vitest';

import { SkinAssetSlot, SkinWorkflowKind } from '../../../shared/skin/constants';
import { buildMediaGenerationTurnInstruction } from './mediaGenerationTurnInstruction';

describe('buildMediaGenerationTurnInstruction', () => {
  test('guides a two-slot serial skin flow on the native image_generate route', () => {
    const instruction = buildMediaGenerationTurnInstruction(false, SkinWorkflowKind.SkinPack);

    const backdropIndex = instruction.indexOf(`1. ${SkinAssetSlot.WorkspaceBackdrop}`);
    const emblemIndex = instruction.indexOf(`2. ${SkinAssetSlot.HomeEmblem}`);

    expect(backdropIndex).toBeGreaterThan(-1);
    expect(emblemIndex).toBeGreaterThan(backdropIndex);
    expect(instruction).toContain('[AI skin pack workflow: two-asset serial flow]');
    expect(instruction).toContain('locked to the OpenClaw-native image_generate tool');
    expect(instruction).toContain('soft budget of about two serial image_generate calls');
    expect(instruction).toContain('guidance, not a hard quota');
    expect(instruction).toContain('(count=1)');
    expect(instruction).toContain('Extra serial attempts are allowed');
    expect(instruction).toContain('wait for that call or its completion event to reach terminal success');
    expect(instruction).toContain('action="register_asset" succeeds');
    expect(instruction).toContain('action="apply" with the same skinId');
    expect(instruction).toContain('Never start parallel generations');
    expect(instruction).toContain('lobsterai_skin_manage');
    expect(instruction).not.toContain('lobsterai_image_generate');
    expect(instruction).not.toContain('lobsterai_video_generate');
    expect(instruction).not.toContain('LobsterAI media generation tools - NOT AVAILABLE');
  });

  test('preserves the media-skill fallback when server-side media generation is unavailable', () => {
    const instruction = buildMediaGenerationTurnInstruction(true);

    expect(instruction).toContain('LobsterAI media generation tools - NOT AVAILABLE');
    expect(instruction).toContain('You may use it');
  });

  test('returns no instruction without an active media skill', () => {
    expect(buildMediaGenerationTurnInstruction(false)).toBe('');
    expect(buildMediaGenerationTurnInstruction()).toBe('');
  });
});
