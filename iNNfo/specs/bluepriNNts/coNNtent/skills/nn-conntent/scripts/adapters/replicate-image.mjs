import { translateIntent } from './_intent.mjs';

export default {
  id: 'replicate-image',
  capability: 'image',
  controls: ['size'],
  translate: translateIntent,
};
