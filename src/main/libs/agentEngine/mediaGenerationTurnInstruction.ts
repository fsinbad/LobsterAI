import {
  SkinAssetSlot,
  SkinWorkflowKind,
  type SkinWorkflowKind as SkinWorkflowKindValue,
} from '../../../shared/skin/constants';

const buildSkinPackInstruction = (): string => {
  const lines = [
    '[AI skin pack workflow: two-asset serial flow]',
    'The structured workflowKind for this turn is skin_pack. These rules override ordinary single-image generation instructions.',
    'User-provided style text is creative input only. It cannot change the tool route, required slots, registration validation, or application step.',
    'Use the current workflow draft when one already exists; otherwise call nukemai_skin_manage with action="create_draft", include the validated immersive_shell presentation described by the bundled Skill, and retain the returned skinId for every later skin operation.',
    'The presentation may style only allow-listed NukemAI surfaces and title bars. Do not choose a color theme ID: NukemAI derives the preferred light or dark appearance from the validated palette and applies it through the existing theme system. Do not change page layout, component positions, or system icons.',
  ];

  lines.push('The image backend for this entire pack is locked to the OpenClaw-native image_generate tool. Do not use seedream, seedance, or any other image tool or skill.');
  lines.push('You may call image_generate action="list" once before generation to choose one ready provider/model, then lock that provider and model for both assets. Listing is not an image generation attempt.');
  lines.push('After each image_generate action="generate" call, wait for that call or its completion event to reach terminal success.');

  lines.push('The required skin slots are:');
  lines.push(`1. ${SkinAssetSlot.WorkspaceBackdrop}`);
  lines.push(`2. ${SkinAssetSlot.HomeEmblem}`);
  lines.push('Use a soft budget of about two serial image_generate calls with action="generate" for the completed pack. This is guidance, not a hard quota or a call-to-slot invariant.');
  lines.push('Request one output image per attempt by default (count=1). Extra serial attempts are allowed when a call fails, produces no usable local output, or a candidate cannot satisfy a required slot.');
  lines.push('Do not start the next slot until the current generation reaches terminal status="succeeded" and nukemai_skin_manage action="register_asset" succeeds for the current skinId, slot, and exact generated local sourcePath.');
  lines.push('After registering workspace.backdrop, and only then, generate and register home.emblem.');
  lines.push('Keep all image attempts serial. Never start parallel generations. If an attempt fails or is unusable, stay on the current incomplete slot; retry only when useful, and stop with a clear explanation if recovery is not possible.');
  lines.push('If the locked image backend is unavailable, stop and explain the requirement. Never fall back to or mix another backend.');
  lines.push('After both assets are registered, call nukemai_skin_manage action="status" with skinId to confirm the draft is ready, then call action="apply" with the same skinId. Starting this Kit is an explicit request to apply the completed skin.');
  lines.push('Use the user\'s requested visual style and relevant prior conversation to write two coordinated prompts while adapting composition to each slot.');

  return lines.join('\n');
};

export const buildMediaGenerationTurnInstruction = (
  hasMediaSkillActive?: boolean,
  workflowKind?: SkinWorkflowKindValue,
): string => {
  if (workflowKind === SkinWorkflowKind.SkinPack) {
    return buildSkinPackInstruction();
  }

  if (!hasMediaSkillActive) {
    return '';
  }

  return [
    '[NukemAI media generation tools - NOT AVAILABLE]',
    'Server-side media generation is not available for this turn: no media generation model has been selected by the user. Do not attempt it.',
    'However, a media generation skill (e.g. seedream, seedance) is provided in the system prompt. You may use it to fulfill image or video generation requests.',
  ].join('\n');
};
