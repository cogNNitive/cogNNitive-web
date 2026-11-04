import { translateIntent } from './_intent.mjs';

export default {
  id: 'infinitetalk',
  capability: 'avatar',
  controls: ['resolution'],
  translate: translateIntent,
};
