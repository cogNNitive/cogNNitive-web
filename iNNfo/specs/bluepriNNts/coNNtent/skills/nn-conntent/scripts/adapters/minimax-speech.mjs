import { translateIntent } from './_intent.mjs';

export default {
  id: 'minimax-speech',
  capability: 'tts',
  controls: ['speed', 'emotion'],
  translate: translateIntent,
};
