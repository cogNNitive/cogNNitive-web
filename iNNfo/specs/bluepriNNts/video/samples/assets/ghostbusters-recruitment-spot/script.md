//ANYDEO_SPEC: V_0-3-3
# Video
- video_anydeo_specification: V_0-3-3
- video_title: Ghostbusters 30-Second Recruitment Spot

# Templates
@template base
- scene_voice: English_Male_Bold

# Scenes

## Intro
@base Welcome Scene
Are you troubled by strange noises in the middle of the night? Join the team that always answers the call.

@@ Background
- layer_type: video
- layer_level: 10
- layer_asset_source: ./background_loop.mp4

@@ Callout Text
- layer_type: text
- layer_level: 50
- layer_generation_text: "NOW HIRING: FIELD TECHNICIANS"
- layer_effects: ["zoom_in"]
- layer_effect_speed: 1.5
