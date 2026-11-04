import { translateIntent } from './_intent.mjs';

export default {
  id: 'wavespeed-image',
  capability: 'image',
  controls: ['size'],
  translate: translateIntent,
};
