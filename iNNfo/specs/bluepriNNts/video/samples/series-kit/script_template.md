//ANYDEO_SPEC: V_0-3-3
# Video
- video_anydeo_specification: V_0-3-3
- video_title: {{video_title}}<!-- One-line title of the video, matching the Video Element title -->

# Templates
@template base
- scene_voice: English_Male_Bold

# Scenes

## Scene 1: Hook
@base Hook Scene
{{hook_line}}<!-- One sentence, present tense, hooking the audience with the core subject/problem -->

@@ Background
- layer_type: image
- layer_level: 10
- layer_asset_source: ../../shared/intro_background.png

@@ Title Overlay
- layer_type: text
- layer_level: 50
- layer_generation_text: "{{headline_text}}"<!-- Short 2-4 word uppercase headline for the opening card -->
- layer_effects: ["fade_in"]

## Scene 2: Core Breakdown
@base Breakdown Scene
{{core_explanation}}<!-- Two to three sentences explaining the subject breakthrough or mechanism -->

@@ Illustration
- layer_type: image
- layer_level: 30
- layer_asset_source: ./diagram.png

## Scene 3: Conclusion & Call to Action
@base Outro Scene
{{call_to_action}}<!-- One sentence closing thought or call to action -->

@@ Outro Card
- layer_type: text
- layer_level: 50
- layer_generation_text: "{{outro_cta_text}}"<!-- 2-5 word call to action text -->
