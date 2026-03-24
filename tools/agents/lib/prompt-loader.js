/**
 * prompt-loader.js — Load prompt templates and interpolate context variables.
 *
 * Usage:
 *   import { loadPrompt } from './prompt-loader.js';
 *   const prompt = loadPrompt('prompts/housing.md', { AGENT_LABEL: 'Housing', ... });
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AGENTS_ROOT = resolve(__dirname, '..');

/**
 * Load a prompt .md file and replace {{VARIABLE_NAME}} placeholders with
 * values from contextObject.
 *
 * @param {string} promptFilePath — Path relative to tools/agents/ (e.g. "prompts/housing.md")
 * @param {Record<string, string>} contextObject — Key/value pairs for interpolation
 * @returns {string} Assembled prompt string
 */
export function loadPrompt(promptFilePath, contextObject = {}) {
  const absPath = resolve(AGENTS_ROOT, promptFilePath);
  let template;
  try {
    template = readFileSync(absPath, 'utf-8');
  } catch (err) {
    throw new Error(`prompt-loader: Could not read prompt file "${absPath}": ${err.message}`);
  }

  const result = template.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, varName) => {
    if (varName in contextObject) {
      return String(contextObject[varName]);
    }
    console.error(`[prompt-loader] WARNING: Variable {{${varName}}} not found in context — replaced with [NOT PROVIDED]`);
    return '[NOT PROVIDED]';
  });

  return result;
}
