import { parseModelThinkingLevel } from '../../shared/providers';

/**
 * Resolve the effective thinking level for a model reference.
 *
 * Upstream resolves server-provided thinking config for lobsterai-server
 * models; the NukemAI fork removed the server provider, so the
 * product-selected level is used as-is (still normalized).
 */
export const resolveOpenClawThinkingLevelForModel = (
  _modelRef: string,
  productLevel: string,
): string => {
  return parseModelThinkingLevel(productLevel) || productLevel;
};