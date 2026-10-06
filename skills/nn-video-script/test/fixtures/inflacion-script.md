//ANYDEO_SPEC: V_0-3-3

# templates

@template marca
  @@ Marca
- layer_level: 90
- layer_type: text
- layer_text_content: generado con IA utilizando cognnitive.com
- layer_text_align_horizontal: center
- layer_text_align_vertical: bottom
- layer_text_size: 40
- layer_text_color: #ffffff
- layer_text_box: true
- layer_text_box_color: #0b0f19
- layer_text_box_opacity: 0.6

@template celedonio_full
- scene_templates: marca
- scene_tts_model: replicate/minimax/speech-2.8-hd
- replicate/minimax/speech-2.8-hd/voice_id: dcrR2vs2jKo
- replicate/minimax/speech-2.8-hd/emotion: happy
- replicate/minimax/speech-2.8-hd/speed: 1.1
- replicate/minimax/speech-2.8-hd/pitch: -2
- replicate/minimax/speech-2.8-hd/intensity: 15
- scene_background_audio_volume: 0.08
  @@ Avatar Celedonio
- layer_level: 50
- layer_type: talking_avatar
- layer_avatar_model: wavespeed-ai/infinitetalk-fast
- layer_avatar_resolution: 720p

@template seccion_full
- scene_templates: marca
- scene_tts_model: replicate/minimax/speech-2.8-hd
- replicate/minimax/speech-2.8-hd/voice_id: dcrR2vs2jKo
- replicate/minimax/speech-2.8-hd/emotion: neutral
- replicate/minimax/speech-2.8-hd/speed: 1.1
- replicate/minimax/speech-2.8-hd/pitch: -2
- replicate/minimax/speech-2.8-hd/intensity: 15
- scene_background_audio_volume: 0.08
  @@ Avatar Celedonio
- layer_level: 50
- layer_type: talking_avatar
- layer_avatar_model: wavespeed-ai/infinitetalk-fast
- layer_avatar_resolution: 720p

@template seccion_avatar_sobre_fondo
- scene_templates: marca
- scene_tts_model: replicate/minimax/speech-2.8-hd
- replicate/minimax/speech-2.8-hd/voice_id: dcrR2vs2jKo
- replicate/minimax/speech-2.8-hd/emotion: neutral
- replicate/minimax/speech-2.8-hd/speed: 1.1
- replicate/minimax/speech-2.8-hd/pitch: -2
- replicate/minimax/speech-2.8-hd/intensity: 15
- scene_background_audio_volume: 0.10
  @@ Fondo
- layer_level: 0
- layer_type: image
- layer_fit_mode: fill
- layer_effects: ken_burns
- layer_effect_speed: 0.5
  @@ Avatar Celedonio
- layer_level: 50
- layer_type: talking_avatar
- layer_avatar_model: wavespeed-ai/infinitetalk-fast
- layer_avatar_resolution: 720p

@template bumper
- scene_templates: marca
- scene_duration_mode: auto_media

# video

- video_anydeo_specification: V_0-3-3
- video_author: Lucas Cervera
- video_title: "La inflación"

## Scenes

@celedonio_full 00 Gancho

<!-- overlay: kineticTitle { "heading": "Cosicah", "subheading": "explicás por un señor de Villabotijos", "theme": "dark", "position": "bottom", "from_frame_offset": 0, "duration_seconds": 3 } -->

- scene_background_audio: ../../shared/music/pasodoble-loop.m4a
- scene_transition: fade

¿Sabes quéh e lo queh la inflación?

@@ Avatar Celedonio
  ![media](../../shared/avatar/celedonio_24_mercado_semanal.jpeg)

@bumper 01 Intro

- scene_background_audio: ../../shared/music/pasodoble-loop.m4a
- scene_background_audio_volume: 0.20
- scene_duration: 10

@@ Intro
- layer_level: 0
- layer_type: video
- layer_fit_mode: fill
  ![media](../../shared/intro.mp4)

@seccion_full 02 Explicación fácil

<!-- overlay: kineticTitle { "heading": "La inflación", "subheading": "vamos a lo sencillo", "theme": "accent", "position": "bottom", "from_frame_offset": 6, "duration_seconds": 3 } -->
<!-- overlay: lowerThird { "title": "Celedonio", "subtitle": "el señor de Villabotijos", "accentColor": "#e8b04b", "position": "bottom-left", "from_frame_offset": 0, "duration_seconds": 5 } -->

- scene_background_audio: ../../shared/music/pasodoble-loop.m4a
- scene_transition: slide-left

Mira, majo, que no te engañen con el cuento. La inflación no es que suba el aceite, eso es solo el resultao. Como decía don Ludwig von Mises, inflación es que imprimen dinero sin respaldo, chiquillo. Más papeles pa lo mesmo, pos cada papel vale menos. ¿Me entiendes? Es como echarle agua al vino.

@@ Avatar Celedonio
  ![media](../../shared/avatar/celedonio_13_despensa_troje.jpeg)

@seccion_avatar_sobre_fondo 03 Ejemplos

<!-- overlay: kineticTitle { "heading": "Un ejemplo de andar por casa", "subheading": "La inflación", "theme": "dark", "position": "bottom", "from_frame_offset": 6, "duration_seconds": 3 } -->

- scene_background_audio: ../../shared/music/pasodoble-loop.m4a
- scene_transition: slide-left

¡Ojú, mi arma! Fíjate en el mercado, ho. Enantes el aceite estaba a tres euros, y agora te piden seis por la mesma garrafa. La oliva es la mesma, la almazara es la mesma. Lo que cambió es que hay más billetes corriendo por ahí. Los primeros que los pillan se forran, y a ti te llega to más caro. Don Federico Hayek ya avisaba que eso acaba en ruina, ¿verdá? ¡Vaya tela!

@@ Fondo
  ![media](media/bg_03_ejemplos.jpeg)

@@ Avatar Celedonio
  ![media](../../shared/avatar/celedonio_07_bar_plaza.jpeg)

@seccion_full 04 Conclusión

<!-- overlay: kineticTitle { "heading": "Y aquí lo gordo", "subheading": "La inflación", "theme": "dark", "position": "bottom", "from_frame_offset": 6, "duration_seconds": 3 } -->

- scene_background_audio: ../../shared/music/pasodoble-loop.m4a
- scene_transition: wipe

Y aquí lo gordo, nano. No suben los precios porque el tendero sea malo, che. Suben porque el dinero se encoge cuando le dan a la maquinilla. Como dice el del bar, que ese sabe de to: si quieren acabar con la inflación, que dejen de imprimir. Menos máquina y más ahorro, chiquillo. Esa es la cuenta clara.

@@ Avatar Celedonio
  ![media](../../shared/avatar/celedonio_08_cocina_pueblo.jpeg)

@bumper 05 Cierre

- scene_duration: 10

@@ Cierre
- layer_level: 0
- layer_type: video
- layer_fit_mode: fill
  ![media](../../shared/intro.mp4)
