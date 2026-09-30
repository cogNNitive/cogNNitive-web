# Series Rules: Ghostbusters Tech Spotlight

Series-wide production standards and editorial constraints for all video episodes in this series.

## Editorial Tone & Voice

- **Voice**: Crisp, technical yet accessible, professional and engaging.
- **Tense**: Present tense narration for current facts and demonstrations.
- **Pacing**: Target 120-140 words per minute; keep scenes concise (between 5 and 15 seconds per scene).

## Visual & Asset Conventions

- **Aspect Ratio**: Standard 16:9 widescreen (1920x1080).
- **Shared Assets**: Common assets (intro cards, brand bumpers, shared backgrounds) must be stored in `shared/` under the series root.
- **Episode Assets**: Custom diagrams and episode-specific clips must be stored inside the video's own `assets/<video-slug>/` folder.
- **Escape Constraint**: Never reference assets outside the series folder tree.

## Sound & Pacing Rules

- **Voiceover**: Consistent voice profile declared in `@template base`.
- **Music**: Background audio should duck to 20% volume during narration beats.
