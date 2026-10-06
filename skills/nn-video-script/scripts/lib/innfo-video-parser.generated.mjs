/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: iNNfo/packages/innfo-video-parser (via scripts/mirror/video-parser-entry.ts)
 * Regenerate: node scripts/build-video-parser-mirror.mjs
 * Drift-guarded by scripts/verify.js (build-video-parser-mirror --check).
 */
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// iNNfo/packages/innfo-video-parser/specs/V_0-3-3.json
var V_0_3_3_default = {
  info: {
    id: "vus",
    name: "Anydeo Universal Specification",
    version: "V_0-3-3",
    label: "Syntactic Sugar Isolation",
    description: "Enforces strict canonical properties by requiring the parser to fully translate Syntactic Sugar and introduces video_original_script for traceability."
  },
  categories: [
    {
      id: "identity",
      label: "Identity",
      icon: "Fingerprint",
      color: "#71717a",
      description: "Project naming and global setup.",
      ui: { defaultExpanded: true, priority: 0 }
    },
    {
      id: "layer_core",
      label: "Layer Configuration",
      icon: "Layers",
      color: "#ec4899",
      description: "Essential layer settings (Source, Type, Level).",
      ui: { defaultExpanded: true, priority: 1 }
    },
    {
      id: "audio",
      label: "Audio",
      icon: "Volume2",
      color: "#8b5cf6",
      description: "Voice narration, background music, and audio mixing."
    },
    {
      id: "asset_metadata",
      label: "Asset Metadata",
      icon: "Info",
      color: "#64748b",
      description: "Authorship, licensing and AI generation flags."
    },
    {
      id: "avatar",
      label: "Avatar Controls",
      icon: "User",
      color: "#f43f5e",
      description: "Digital avatar settings."
    },
    {
      id: "style_effects",
      label: "Style & Effects",
      icon: "Sparkles",
      color: "#f59e0b",
      description: "Cinematic motion, transitions, text branding and effects."
    },
    {
      id: "config",
      label: "Configuration",
      icon: "Settings2",
      color: "#6366f1",
      description: "Technical settings and timing logic."
    },
    {
      id: "publish",
      label: "Publication & SEO",
      icon: "Share2",
      color: "#3b82f6",
      description: "Publication metadata and settings."
    }
  ],
  api_options: {
    resolutions: [
      { value: "1920x1080", label: "1920x1080 (16:9) - Horizontal" },
      { value: "1080x1920", label: "1080x1920 (9:16) - Vertical" },
      { value: "1080x1080", label: "1080x1080 (1:1) - Square" }
    ],
    fps_options: [
      { value: "24", label: "24" },
      { value: "30", label: "30" },
      { value: "60", label: "60" }
    ],
    asset_types: [
      { value: "image", label: "Image", icon: "Image", description: "Standard static image layer. Best for backgrounds or overlays using local or uploaded files." },
      { value: "stock_image", label: "Stock Image", icon: "Library", description: "Intelligent search for professional photography. Describe what you need and we will find the perfect match." },
      { value: "ai_image", label: "AI Image", icon: "Sparkles", description: "Generative visual creation. Turn your text prompts into unique, high-quality images for your video." },
      { value: "video", label: "Video", icon: "Video", description: "Standard video layer. Supports local files, recordings, and direct uploads." },
      { value: "stock_video", label: "Stock Video", icon: "Clapperboard", description: "Search for high-quality professional video clips to enhance your project's visual variety." },
      { value: "ai_video", label: "AI Video", icon: "Zap", description: "Generative cinematic clips. Create moving visuals from simple text descriptions." },
      { value: "text", label: "Text Layer", icon: "Type", description: "High-quality typography with full control over style, positioning and animations. Supports standard, animated and AI-enhanced text." },
      { value: "text_static", label: "Static Text", icon: "Type", description: "Standard static text layer." },
      { value: "text_dynamic", label: "Dynamic Text", icon: "Type", description: "Animated or dynamic text layer." },
      { value: "text_ai_embedded", label: "AI Embedded Text", icon: "Type", description: "AI generated embedded text layer." },
      { value: "talking_avatar", label: "Talking Avatar", icon: "UserCircle", description: "AI-driven character that speaks your narration with realistic lip-sync and expressions." },
      { value: "audio", label: "Audio / Sound", icon: "Volume2", description: "Background tracks and sound effects to set the mood of your scene." }
    ],
    tts_models: [
      {
        value: "replicate/minimax/speech-2.8-hd",
        label: "MiniMax Speech 2.8 HD",
        provider: "replicate",
        version: "minimax/speech-2.8-hd:bb4b16034cd66abe0d3147d50a63890e0144328136ca082f3f141f42ed0d4be9",
        description: "State-of-the-art TTS with human-like prosody.",
        tier: "cinematic",
        default: true,
        metrics: { speed: 8, quality: 10 },
        inputs_mapping: { text: "text", voice: "voice_id" },
        parameters: [
          { key: "voice_id", label: "Voice ID", type: "select", options_key: "voices", default: "Friendly_Person" },
          { key: "speed", label: "Speed", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.1 },
          { key: "language", label: "Language", type: "select", options_key: "voices", default: "Spanish" }
        ]
      },
      {
        value: "wavespeed/minimax/speech-2.5-hd-preview",
        label: "MiniMax Speech 2.5 HD (WaveSpeed)",
        provider: "minimax",
        description: "State-of-the-art TTS with high-definition emotional range. Supports multiple languages and expressive styles.",
        docs_url: "https://www.minimaxir.com/",
        tier: "premium",
        metrics: { speed: 10, quality: 10 },
        inputs_mapping: { text: "text", voice: "voice" },
        parameters: [
          { key: "voice_id", label: "Voice ID", type: "select", options_key: "voices", default: "Friendly_Person" },
          { key: "speed", label: "Speed", type: "number", min: 0.5, max: 2, step: 0.1, default: 1 },
          { key: "language", label: "Language", type: "select", options_key: "languages", default: "Spanish" },
          { key: "emotion", label: "Emotion", type: "select", options_key: "emotions", default: "neutral" }
        ]
      }
    ],
    voices: [
      { value: "Deep_Voice_Man", label: "Deep Voice Man" },
      { value: "Imposing_Manner", label: "Imposing Manner" },
      { value: "Elegant_Man", label: "Elegant Man" },
      { value: "Casual_Guy", label: "Casual Guy" },
      { value: "Friendly_Person", label: "Friendly Person" },
      { value: "Decent_Boy", label: "Decent Boy" },
      { value: "Lively_Girl", label: "Lively Girl" },
      { value: "Exuberant_Girl", label: "Exuberant Girl" },
      { value: "Inspirational_girl", label: "Inspirational Girl" },
      { value: "Young_Knight", label: "Young Knight" },
      { value: "Abbess", label: "Abbess" },
      { value: "Wise_Woman", label: "Wise Woman" },
      { value: "Aussie_Bloke", label: "Aussie Bloke" },
      { value: "Professional_Woman", label: "Professional Woman" },
      { value: "Friendly_Lady", label: "Friendly Lady" },
      { value: "Gentle_Man", label: "Gentle Man" },
      { value: "Calm_Lady", label: "Calm Lady" },
      { value: "English_expressive_narrator", label: "English expressive narrator" },
      { value: "English_radiant_girl", label: "English radiant girl" },
      { value: "English_magnetic_voiced_man", label: "English magnetic voiced man" },
      { value: "English_compelling_lady1", label: "English compelling lady1" },
      { value: "English_Aussie_Bloke", label: "English Aussie Bloke" },
      { value: "English_captivating_female1", label: "English captivating female1" },
      { value: "English_Upbeat_Woman", label: "English Upbeat Woman" },
      { value: "English_Trustworth_Man", label: "English Trustworth Man" },
      { value: "English_CalmWoman", label: "English Calm Woman" },
      { value: "English_UpsetGirl", label: "English Upset Girl" },
      { value: "English_Gentle-voiced_man", label: "English Gentle-voiced man" },
      { value: "English_Whispering_girl_v3", label: "English Whispering girl v3" },
      { value: "English_Diligent_Man", label: "English Diligent Man" },
      { value: "English_Graceful_Lady", label: "English Graceful Lady" },
      { value: "English_Husky_MetalHead", label: "English Husky Metal Head" },
      { value: "English_ReservedYoungMan", label: "English Reserved Young Man" },
      { value: "English_PlayfulGirl", label: "English Playful Girl" },
      { value: "English_ManWithDeepVoice", label: "English Man With Deep Voice" },
      { value: "English_GentleTeacher", label: "English Gentle Teacher" },
      { value: "English_MaturePartner", label: "English Mature Partner" },
      { value: "English_FriendlyPerson", label: "English Friendly Person" },
      { value: "English_MatureBoss", label: "English Mature Boss" },
      { value: "English_Debator", label: "English Debator" },
      { value: "English_Abbess", label: "English Abbess" },
      { value: "English_LovelyGirl", label: "English Lovely Girl" },
      { value: "English_Steadymentor", label: "English Steadymentor" },
      { value: "English_Deep-VoicedGentleman", label: "English Deep-Voiced Gentleman" },
      { value: "English_DeterminedMan", label: "English Determined Man" },
      { value: "English_Wiselady", label: "English Wiselady" },
      { value: "English_CaptivatingStoryteller", label: "English Captivating Storyteller" },
      { value: "English_AttractiveGirl", label: "English Attractive Girl" },
      { value: "English_DecentYoungMan", label: "English Decent Young Man" },
      { value: "English_SentimentalLady", label: "English Sentimental Lady" },
      { value: "English_ImposingManner", label: "English Imposing Manner" },
      { value: "English_SadTeen", label: "English Sad Teen" },
      { value: "English_ThoughtfulMan", label: "English Thoughtful Man" },
      { value: "English_PassionateWarrior", label: "English Passionate Warrior" },
      { value: "English_DecentBoy", label: "English Decent Boy" },
      { value: "English_WiseScholar", label: "English Wise Scholar" },
      { value: "English_Soft-spokenGirl", label: "English Soft-spoken Girl" },
      { value: "English_SereneWoman", label: "English Serene Woman" },
      { value: "English_ConfidentWoman", label: "English Confident Woman" },
      { value: "English_PatientMan", label: "English Patient Man" },
      { value: "English_Comedian", label: "English Comedian" },
      { value: "English_GorgeousLady", label: "English Gorgeous Lady" },
      { value: "English_BossyLeader", label: "English Bossy Leader" },
      { value: "English_LovelyLady", label: "English Lovely Lady" },
      { value: "English_Strong-WilledBoy", label: "English Strong-Willed Boy" },
      { value: "English_Deep-tonedMan", label: "English Deep-toned Man" },
      { value: "English_StressedLady", label: "English Stressed Lady" },
      { value: "English_AssertiveQueen", label: "English Assertive Queen" },
      { value: "English_AnimeCharacter", label: "English Anime Character" },
      { value: "English_Jovialman", label: "English Jovialman" },
      { value: "English_WhimsicalGirl", label: "English Whimsical Girl" },
      { value: "English_CharmingQueen", label: "English Charming Queen" },
      { value: "English_Kind-heartedGirl", label: "English Kind-hearted Girl" },
      { value: "English_FriendlyNeighbor", label: "English Friendly Neighbor" },
      { value: "English_Sweet_Female_4", label: "English Sweet Female 4" },
      { value: "English_Magnetic_Male_2", label: "English Magnetic Male 2" },
      { value: "English_Lively_Male_11", label: "English Lively Male 11" },
      { value: "English_Friendly_Female_3", label: "English Friendly Female 3" },
      { value: "English_Steady_Female_1", label: "English Steady Female 1" },
      { value: "English_Lively_Male_10", label: "English Lively Male 10" },
      { value: "English_Magnetic_Male_12", label: "English Magnetic Male 12" },
      { value: "English_Steady_Female_5", label: "English Steady Female 5" },
      { value: "English_Insightful_Speaker", label: "English Insightful Speaker" },
      { value: "English_patient_man_v1", label: "English patient man v1" },
      { value: "English_Persuasive_Man", label: "English Persuasive Man" },
      { value: "English_Explanatory_Man", label: "English Explanatory Man" },
      { value: "English_intellect_female_1", label: "English intellect female 1" },
      { value: "English_energetic_male_1", label: "English energetic male 1" },
      { value: "English_witty_female_1", label: "English witty female 1" },
      { value: "English_Lucky_Robot", label: "English Lucky Robot" },
      { value: "English_Cute_Girl", label: "English Cute Girl" },
      { value: "English_Sharp_Commentator", label: "English Sharp Commentator" },
      { value: "English_Honest_Man", label: "English Honest Man" }
    ],
    languages: [
      { value: "Spanish", label: "Spanish" },
      { value: "English", label: "English" },
      { value: "French", label: "French" },
      { value: "German", label: "German" },
      { value: "Italian", label: "Italian" },
      { value: "Portuguese", label: "Portuguese" }
    ],
    emotions: [
      { value: "auto", label: "Auto" },
      { value: "neutral", label: "Neutral" },
      { value: "happy", label: "Happy" },
      { value: "sad", label: "Sad" },
      { value: "angry", label: "Angry" },
      { value: "fearful", label: "Fearful" },
      { value: "disgusted", label: "Disgusted" },
      { value: "surprised", label: "Surprised" }
    ],
    avatar_models: [
      {
        value: "replicate/wan-2.1-s2v",
        label: "Wan 2.1 S2V (Standard)",
        provider: "replicate",
        version: "wan-video/wan-2.1-s2v:09607e6e761d2f015b0d740f938ec59199f54aa623384465a5054b230405acf4",
        description: "Best for static images tailored to narration.",
        tier: "balanced",
        default: true,
        metrics: { speed: 6, quality: 8 },
        inputs_mapping: { visual: "image", audio: "audio", prompt: "prompt" },
        parameters: [
          { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p", "1080p"], default: "720p" },
          { key: "interpolate", label: "Interpolate", type: "boolean", default: true }
        ]
      },
      {
        value: "wavespeed/infinitetalk",
        label: "WaveSpeed InfiniteTalk (Ultra-Fast)",
        provider: "wavespeed",
        version: "wavespeed-ai/infinitetalk-fast",
        description: "High-performance digital avatar engine with extremely low latency. Powered by WaveSpeed Fast Inference.",
        docs_url: "https://wavespeed.ai/",
        tier: "performance",
        metrics: { speed: 10, quality: 9 },
        inputs_mapping: { visual: "image", audio: "audio" },
        parameters: [
          { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p", "1080p"], default: "720p" },
          { key: "face_scaling", label: "Face Scaling", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.2 },
          { key: "interpolate", label: "Interpolate", type: "boolean", default: true }
        ]
      }
    ],
    forge_models: [
      {
        value: "replicate/flux-schnell",
        label: "Flux Schnell",
        provider: "replicate",
        version: "black-forest-labs/flux-schnell",
        description: "Ultra-fast high quality image generation.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "replicate/flux-pro",
        label: "Flux Pro",
        provider: "replicate",
        version: "black-forest-labs/flux-pro",
        description: "Elite quality professional image generation.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "replicate/recraft-v3",
        label: "Recraft V3",
        provider: "replicate",
        version: "recraft-ai/recraft-v3",
        description: "Professional Typography & Vector Design.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "wavespeed/qwen-image-edit",
        label: "WaveSpeed Qwen Edit",
        provider: "wavespeed",
        description: "Precise AI Image Editing powered by WaveSpeed.",
        inputs_mapping: { visual: "image", prompt: "prompt" }
      },
      {
        value: "replicate/wan-t2v",
        label: "Wan 2.1 Video",
        provider: "replicate",
        version: "wan-video/wan-2.1-t2v-1.3b",
        description: "Fast video generation from text.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "wavespeed/wan-i2v",
        label: "Wan 2.1 I2V (WaveSpeed)",
        provider: "wavespeed",
        description: "Fast & Economic Image to Video.",
        inputs_mapping: { visual: "image", prompt: "prompt" }
      },
      {
        value: "wavespeed/wan-27-t2i",
        label: "Wan 2.7 T2I (WaveSpeed)",
        provider: "wavespeed",
        version: "alibaba/wan-2.7/text-to-image-pro",
        description: "High-quality text-to-image generation powered by Alibaba Wan 2.7.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "wavespeed/nano-banana-edit",
        label: "Nano Banana 2 Edit (WaveSpeed)",
        provider: "wavespeed",
        version: "google/nano-banana-2/edit-fast",
        description: "Ultra-fast high quality image editing.",
        inputs_mapping: { visual: "image", prompt: "prompt" }
      }
    ],
    speeds: [
      { value: 0.25, label: "Extremely slow" },
      { value: 0.5, label: "Very slow" },
      { value: 0.75, label: "Slow" },
      { value: 1, label: "Medium" },
      { value: 1.5, label: "Fast" },
      { value: 2, label: "Very fast" },
      { value: 4, label: "Extremely fast" },
      { value: -1, label: "Full Scene Duration" }
    ],
    render: {
      output_directory: "exports",
      filename_template: "{title} ({timestamp}) [{resolution}]",
      timestamp_format: "YYYY-MM-DD_HH-mm-ss"
    }
  },
  properties: {
    video_anydeo_specification: {
      type: "string",
      label: "Specification Version",
      category: "identity",
      scope: "video",
      required: true,
      default: "V_0-3-3",
      description: "The exact version of the specification used in this script. V_0-3-3 requires strict syntactic sugar translation and adds video_original_script.",
      immutable: true
    },
    video_name: {
      type: "string",
      label: "Video Name",
      category: "identity",
      scope: "video",
      required: true,
      default: "Untitled Video",
      description: "The main name used for the exported video and metadata."
    },
    video_resolution: {
      type: "select",
      label: "Resolution",
      category: "identity",
      scope: "video",
      options_key: "resolutions",
      default: "1920x1080",
      description: "Determines aspect ratio and pixel dimensions."
    },
    video_status: {
      type: "select",
      label: "Project Status",
      category: "identity",
      scope: "video",
      required: false,
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "preprocessed", label: "Preprocessed" },
        { value: "review", label: "Under Review" },
        { value: "approved", label: "Approved" },
        { value: "archived", label: "Archived" }
      ],
      description: "The current lifecycle state of the project."
    },
    video_fps: {
      type: "select",
      label: "FPS",
      category: "identity",
      scope: "video",
      options_key: "fps_options",
      default: "30",
      description: "Frames Per Second."
    },
    video_author: {
      type: "string",
      label: "Author",
      category: "identity",
      scope: "video",
      default: "Anydeo User",
      description: "Creator of the video."
    },
    video_tags: {
      type: "string",
      label: "Video Tags",
      category: "publish",
      scope: "video",
      default: "anydeo, ai-video",
      description: "Keywords for discovery and SEO."
    },
    video_script_source: {
      type: "string",
      label: "Script Source File",
      category: "identity",
      scope: "video",
      description: "Path to the instructions or source file used to generate the script (e.g., assets/instructions.md)."
    },
    video_original_script: {
      type: "string",
      label: "Original Script Copy",
      category: "identity",
      scope: "video",
      description: "Path to the unmodified copy of the original .anydeo script, saved with an _original_{timestamp} suffix before any syntactic sugar was processed."
    },
    video_sources: {
      type: "object",
      label: "Video Sources / Bibliography",
      category: "asset_metadata",
      scope: "video",
      description: "Centralized project repository of bibliographic references and media sources."
    },
    video_publish: {
      type: "boolean",
      label: "Publication Integration",
      category: "publish",
      scope: "video",
      default: false,
      description: "Enables the assisted publication portal and SEO tracking."
    },
    video_publish_description: {
      type: "textarea",
      label: "Publication Description",
      category: "publish",
      scope: "video",
      description: "The full description to be used when publishing. Supports metadata interpolation."
    },
    video_render_quality: {
      type: "select",
      label: "Render Quality",
      category: "config",
      scope: "video",
      default: "ultrafast_preview",
      options: [
        { value: "ultrafast_preview", label: "UltraFast (Preview)" },
        { value: "fast_draft", label: "Fast (Draft)" },
        { value: "balanced", label: "Balanced" },
        { value: "quality_final", label: "High Quality (Final)" },
        { value: "high_quality", label: "Elite (Pro Res)" }
      ],
      description: "Determines the speed vs. quality tradeoff. Changing this will invalidate the scene cache."
    },
    section_title: {
      type: "string",
      label: "Section Title",
      category: "identity",
      scope: "section",
      required: true,
      default: "Untitled Section",
      description: "The heading title or identifier for this section."
    },
    scene_name: {
      type: "string",
      label: "Scene Name",
      category: "identity",
      scope: "scene",
      required: true,
      description: "Unique identifier for this specific scene."
    },
    scene_templates: {
      type: "multiselect",
      label: "Scene Templates",
      category: "identity",
      scope: "scene",
      options_key: "templates",
      description: "List of templates to inherit from.",
      default: []
    },
    scene_content: {
      type: "textarea",
      label: "Content",
      category: "identity",
      scope: "scene",
      required: true,
      description: "The text to be narrated by the AI voice. MUST be plain text. Markdown headers are strictly prohibited."
    },
    scene_sources: {
      type: "array",
      label: "Scene Sources / Citations",
      category: "asset_metadata",
      scope: "scene",
      description: "List of citekeys or URLs providing bibliographic backing for the scene content without polluting the narration text."
    },
    scene_status: {
      type: "select",
      label: "Scene Status",
      category: "identity",
      scope: "scene",
      required: false,
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "review", label: "Under Review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" }
      ],
      description: "The current lifecycle state of the scene."
    },
    scene_tts_model: {
      type: "select",
      label: "TTS Model",
      category: "audio",
      scope: "scene",
      options_key: "tts_models",
      default: "replicate/minimax/speech-2.8-hd",
      description: "The AI model used for text-to-speech generation.",
      showIf: { scene_voice_source: "tts" }
    },
    scene_voice: {
      type: "select",
      label: "Voice ID",
      category: "audio",
      scope: "scene",
      options_key: "voices",
      default: "Friendly_Person",
      description: "The specific AI voice to use for narration in this scene.",
      ui: { hiddenInInspector: true },
      showIf: { scene_voice_source: "tts" }
    },
    scene_voice_source: {
      type: "select",
      label: "Voice Source",
      category: "audio",
      scope: "scene",
      default: "tts",
      options: [
        { value: "tts", label: "AI TTS" },
        { value: "recording", label: "User Recording" }
      ],
      description: "Determines if the narration is generated via AI TTS or recorded by the user."
    },
    scene_voice_recording: {
      type: "asset",
      label: "Voice Recording",
      category: "audio",
      scope: "scene",
      description: "Path to the user-recorded audio file.",
      showIf: { scene_voice_source: "recording" }
    },
    scene_image_model: {
      type: "select",
      label: "Scene Image Model",
      category: "layer_core",
      scope: "scene",
      options_key: "forge_models",
      default: "replicate/flux-schnell",
      description: "Default AI model for image generation in this scene.",
      showIf: { scene_video_source: "ai" }
    },
    scene_video_model: {
      type: "select",
      label: "Scene Video Model",
      category: "layer_core",
      scope: "scene",
      options_key: "forge_models",
      default: "replicate/wan-t2v",
      description: "Default AI model for video generation in this scene.",
      showIf: { scene_video_source: "ai" }
    },
    scene_video_source: {
      type: "select",
      label: "Video Source",
      category: "visual",
      scope: "scene",
      default: "ai",
      options: [
        { value: "ai", label: "AI Generated" },
        { value: "recording", label: "User Recording" }
      ],
      description: "Determines if the scene visual is generated via AI or recorded by the user."
    },
    scene_video_recording: {
      type: "asset",
      label: "Video Recording",
      category: "visual",
      scope: "scene",
      description: "Path to the user-recorded video file.",
      showIf: { scene_video_source: "recording" }
    },
    scene_voice_volume: {
      type: "number",
      label: "Voice Volume",
      category: "audio",
      scope: "scene",
      default: 1,
      ui: { min: 0, max: 1, step: 0.1 }
    },
    scene_background_audio: {
      type: "asset",
      label: "Background Music",
      category: "audio",
      scope: "scene",
      description: "Path or URL to background music."
    },
    scene_background_audio_volume: {
      type: "number",
      label: "BG Music Volume",
      category: "audio",
      scope: "scene",
      default: 0.3,
      ui: { min: 0, max: 1, step: 0.1 }
    },
    scene_duration_mode: {
      type: "select",
      label: "Duration Mode",
      category: "config",
      scope: "scene",
      default: "auto_voice",
      options: [
        { value: "auto_voice", label: "Automatic (Voice Based)" },
        { value: "auto_media", label: "Automatic (Media Based)" },
        { value: "custom", label: "Manual / Custom" }
      ],
      description: "How the scene duration is calculated."
    },
    scene_video_recording: {
      type: "asset",
      label: "Video Recording",
      category: "visual",
      scope: "scene",
      description: "Path to the user-recorded video file.",
      showIf: { scene_video_source: "recording" }
    },
    scene_duration: {
      type: "number",
      label: "Scene Duration",
      category: "timing",
      scope: "scene",
      default: 10,
      description: "The length of the scene in seconds.",
      showIf: { scene_video_source: "ai" }
    },
    scene_background_color: {
      type: "color",
      label: "Background Color",
      category: "config",
      scope: "scene",
      default: "#000000",
      description: "Solid background color rendered behind all layers."
    },
    scene_effects: {
      type: "multiselect",
      label: "Scene Visual Effects",
      category: "style_effects",
      scope: "scene",
      options: [
        { value: "none", label: "None" },
        { value: "zoom_in", label: "Zoom In" },
        { value: "zoom_out", label: "Zoom Out" },
        { value: "pan_left", label: "Pan Left" },
        { value: "pan_right", label: "Pan Right" },
        { value: "tilt_up", label: "Tilt Up" },
        { value: "tilt_down", label: "Tilt Down" },
        { value: "ken_burns", label: "Ken Burns" },
        { value: "handheld", label: "Handheld" },
        { value: "breathing", label: "Breathing" },
        { value: "grayscale", label: "Grayscale" }
      ],
      description: "Cinematic effects applied to the entire scene or its primary background."
    },
    scene_effect_speed: {
      type: "select",
      label: "Scene Effect Speed",
      category: "style_effects",
      scope: "scene",
      default: 1,
      options_key: "speeds",
      description: "Multiplier for the animation speed of the scene effects."
    },
    scene_visual_style: {
      type: "string",
      label: "Scene Visual Style",
      category: "style_effects",
      scope: "scene",
      ui: { widget: "select", options_key: "visual_styles" },
      description: "Style key (e.g., 'photo', 'doodle') referencing a visual style defined in assets/_instructions.md."
    },
    scene_narrative_style: {
      type: "string",
      label: "Scene Narrative Style",
      category: "style_effects",
      scope: "scene",
      ui: { widget: "select", options_key: "narrative_styles" },
      description: "Style key (e.g., 'energetic', 'calm') referencing a narrative style defined in assets/_instructions.md."
    },
    scene_sources: {
      type: "array",
      label: "Scene Sources / Citations",
      category: "asset_metadata",
      scope: "scene",
      description: "List of citekeys or URLs corresponding to entries in the global repository or external links backing the scene narration."
    },
    layer_name: {
      type: "string",
      label: "Layer Name",
      category: "layer_core",
      scope: "layer",
      default: "New Layer",
      description: "Friendly name for identifying this layer."
    },
    layer_active: {
      type: "boolean",
      label: "Active",
      category: "layer_core",
      scope: "layer",
      default: true,
      description: "If false, the layer is completely ignored by the engine and UI. Use to suppress template-provided layers.",
      ui: { hiddenInInspector: true }
    },
    layer_level: {
      type: "number",
      label: "Level",
      category: "layer_core",
      scope: "layer",
      default: 10,
      description: "Determines stacking order."
    },
    layer_type: {
      type: "select",
      label: "Asset Type",
      category: "layer_core",
      scope: "layer",
      options_key: "asset_types",
      default: "image",
      description: "Computational type of the asset in this layer.",
      ui: { hiddenInInspector: true }
    },
    layer_fit_mode: {
      type: "select",
      label: "Fit Mode / Layout",
      category: "layer_core",
      scope: "layer",
      default: "smart_blur",
      options: [
        { value: "fill", label: "Fill" },
        { value: "cover", label: "Cover" },
        { value: "fit", label: "Fit" },
        { value: "contain", label: "Contain" },
        { value: "smart_blur", label: "Smart Blur" },
        { value: "stretch", label: "Stretch" }
      ],
      description: "How the asset fills its layer container.",
      depends_on: { layer_type: { op: "not_in", value: ["audio", "text"] } }
    },
    layer_avatar_model: {
      type: "select",
      label: "Avatar Model",
      category: "avatar",
      scope: "layer",
      options_key: "avatar_models",
      default: "replicate/wan-2.1-s2v",
      depends_on: { layer_type: "talking_avatar" }
    },
    layer_text_content: {
      type: "string",
      label: "Text Content",
      category: "layer_core",
      scope: "layer",
      description: "The text to be displayed.",
      depends_on: { layer_type: "text" }
    },
    layer_text_style: {
      type: "string",
      label: "Text Style / Prompt",
      category: "style_effects",
      scope: "layer",
      description: "Visual style for the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_rendering_method: {
      type: "select",
      label: "Text Rendering Method",
      category: "style_effects",
      scope: "layer",
      default: "static",
      options: [
        { value: "static", label: "Static / Burn-in" },
        { value: "dynamic", label: "Dynamic / Overlay" },
        { value: "ai_embedded", label: "AI Embedded (Forge)" }
      ],
      description: "The technology used to render text on this layer.",
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: "text" }
    },
    layer_text_align_horizontal: {
      type: "select",
      label: "Horizontal Alignment",
      category: "style_effects",
      scope: "layer",
      default: "center",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" }
      ],
      description: "Horizontal alignment of the text within its container.",
      depends_on: { layer_type: "text" }
    },
    layer_text_align_vertical: {
      type: "select",
      label: "Vertical Alignment",
      category: "style_effects",
      scope: "layer",
      default: "middle",
      options: [
        { value: "top", label: "Top" },
        { value: "middle", label: "Middle" },
        { value: "bottom", label: "Bottom" }
      ],
      description: "Vertical alignment of the text within its container.",
      depends_on: { layer_type: "text" }
    },
    layer_text_font: {
      type: "string",
      label: "Font Family",
      category: "style_effects",
      scope: "layer",
      default: "Inter",
      description: "The font family to use for the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_size: {
      type: "number",
      label: "Font Size",
      category: "style_effects",
      scope: "layer",
      default: 40,
      ui: { min: 8, max: 200, step: 1 },
      description: "The size of the text in pixels (or relative units).",
      depends_on: { layer_type: "text" }
    },
    layer_text_color: {
      type: "string",
      label: "Text Color",
      category: "style_effects",
      scope: "layer",
      default: "#ffffff",
      ui: { widget: "color" },
      description: "The color of the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_box: {
      type: "boolean",
      label: "Show Background Box",
      category: "style_effects",
      scope: "layer",
      default: false,
      description: "Whether to show a background box behind the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_box_color: {
      type: "string",
      label: "Box Color",
      category: "style_effects",
      scope: "layer",
      default: "#000000",
      ui: { widget: "color" },
      description: "The color of the background box.",
      depends_on: { layer_text_box: true }
    },
    layer_text_box_opacity: {
      type: "number",
      label: "Box Opacity",
      category: "style_effects",
      scope: "layer",
      default: 0.7,
      ui: { min: 0, max: 1, step: 0.1 },
      description: "The opacity of the background box.",
      depends_on: { layer_text_box: true }
    },
    layer_asset_source: {
      type: "asset",
      label: "Asset Source",
      category: "layer_core",
      scope: "layer",
      description: "URL or local path to the image/video asset.",
      ui: { widget: "asset_picker" },
      depends_on: { layer_type: { op: "not_in", value: ["text", "ai_image", "ai_video"] } }
    },
    layer_visual_style: {
      type: "string",
      label: "Generation / Style Preset",
      category: "layer_core",
      scope: "layer",
      ui: { widget: "select", options_key: "visual_styles" },
      description: "Style key (e.g., 'photo', 'doodle') referencing a visual style defined in assets/_instructions.md.",
      depends_on: { layer_type: "ai_image" }
    },
    layer_narrative_style: {
      type: "string",
      label: "Layer Narrative Style",
      category: "style_effects",
      scope: "layer",
      ui: { widget: "select", options_key: "narrative_styles" },
      description: "Style key referencing a narrative style defined in assets/_instructions.md.",
      depends_on: { layer_type: { op: "in", value: ["talking_avatar", "audio"] } }
    },
    layer_crop: {
      type: "string",
      label: "Crop / Mask",
      category: "style_effects",
      scope: "layer",
      default: "none",
      description: "Applies a visual crop or mask to the layer (e.g., 'circle', 'rounded').",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_top: {
      type: "number",
      label: "Crop Top",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the top of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_right: {
      type: "number",
      label: "Crop Right",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the right of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_bottom: {
      type: "number",
      label: "Crop Bottom",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the bottom of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_left: {
      type: "number",
      label: "Crop Left",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the left of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_generation_subject: {
      type: "string",
      label: "Generation / Search Context",
      category: "layer_core",
      scope: "layer",
      ui: { widget: "textarea" },
      depends_on: { layer_type: "ai_image" }
    },
    layer_generation_strength: {
      type: "number",
      label: "Transformation Strength",
      category: "layer_core",
      scope: "layer",
      default: 5,
      ui: { min: 1, max: 10, step: 1 },
      description: "Intensity of the AI transformation (1-10). Higher values deviate more from the source."
    },
    layer_generation_embedded_text: {
      type: "string",
      label: "Embedded Text Prompt",
      category: "layer_core",
      scope: "layer",
      description: "Text to be visually embedded into AI-generated media (e.g. signs, shirts).",
      depends_on: { layer_type: { op: "in", value: ["text_in_image", "ai_image"] } }
    },
    layer_generation_embedded_text_style: {
      type: "string",
      label: "Embedded Text Style",
      category: "layer_core",
      scope: "layer",
      description: "Visual style prompt for the embedded text (e.g. 'neon green script').",
      depends_on: { layer_type: { op: "in", value: ["text_in_image", "ai_image"] } }
    },
    layer_generation_model: {
      type: "select",
      label: "Generation Model",
      category: "layer_core",
      scope: "layer",
      options_key: "forge_models",
      ui: { widget: "model_picker" },
      depends_on: { layer_type: { op: "in", value: ["ai_image", "ai_video", "text_in_image"] } }
    },
    layer_opacity: {
      type: "number",
      label: "Opacity",
      category: "style_effects",
      scope: "layer",
      default: 1,
      ui: { min: 0, max: 1, step: 0.1, hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_scale: {
      type: "number",
      label: "Scale",
      category: "layer_core",
      scope: "layer",
      default: 1,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_rotation: {
      type: "number",
      label: "Rotation (Degrees)",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 360, step: 1, hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_volume: {
      type: "number",
      label: "Audio Volume",
      category: "audio",
      scope: "layer",
      default: 1,
      ui: { min: 0, max: 1, step: 0.1 },
      depends_on: { layer_type: { op: "in", value: ["audio", "video"] } }
    },
    layer_effects: {
      type: "multiselect",
      label: "Visual Effects",
      category: "style_effects",
      scope: "layer",
      options: [
        { value: "none", label: "None" },
        { value: "zoom_in", label: "Zoom In" },
        { value: "zoom_out", label: "Zoom Out" },
        { value: "pan_left", label: "Pan Left" },
        { value: "pan_right", label: "Pan Right" },
        { value: "tilt_up", label: "Tilt Up" },
        { value: "tilt_down", label: "Tilt Down" },
        { value: "ken_burns", label: "Ken Burns" },
        { value: "handheld", label: "Handheld" },
        { value: "breathing", label: "Breathing" },
        { value: "grayscale", label: "Grayscale" }
      ],
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_effect_speed: {
      type: "select",
      label: "Effect Speed",
      category: "style_effects",
      scope: "layer",
      default: 1,
      options_key: "speeds",
      description: "Multiplier for the animation speed of the layer effects.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_x: {
      type: "number",
      label: "X Position",
      category: "layer_core",
      scope: "layer",
      default: 0,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_y: {
      type: "number",
      label: "Y Position",
      category: "layer_core",
      scope: "layer",
      default: 0,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_width: {
      type: "number",
      label: "Width",
      category: "layer_core",
      scope: "layer",
      default: 100,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_height: {
      type: "number",
      label: "Height",
      category: "layer_core",
      scope: "layer",
      default: 100,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_asset_is_ai: {
      type: "boolean",
      label: "AI Generated",
      category: "asset_metadata",
      scope: "layer",
      default: false,
      description: "Flag indicating if the asset was generated using AI.",
      hidden: true,
      ui: { hiddenInInspector: true }
    },
    layer_asset_raw_url: {
      type: "string",
      label: "Raw URL",
      category: "asset_metadata",
      scope: "layer",
      description: "The original source URL before processing or local storage.",
      ui: { hiddenInInspector: true }
    },
    layer_asset_author: {
      type: "string",
      label: "Asset Author",
      category: "asset_metadata",
      scope: "layer",
      description: "The creator or owner of the asset."
    },
    layer_asset_license: {
      type: "string",
      label: "Asset License",
      category: "asset_metadata",
      scope: "layer",
      description: "Licensing information for the asset."
    },
    layer_asset_source_service: {
      type: "string",
      label: "Source Service",
      category: "asset_metadata",
      scope: "layer",
      description: "The service or platform where the asset was obtained (e.g., Replicate, Pexels)."
    },
    layer_asset_citation_key: {
      type: "string",
      label: "Citation Key",
      category: "asset_metadata",
      scope: "layer",
      description: "Reference key (citekey) pointing to an entry in the project's global video_sources repository."
    },
    layer_asset_access_date: {
      type: "string",
      label: "Access Date",
      category: "asset_metadata",
      scope: "layer",
      description: "The date and timestamp when the asset was accessed or downloaded."
    }
  },
  model_manifest_schema: {
    description: "Required shape for model manifest files in model_registry/. Each JSON file defines one AI model.",
    required: ["id", "type", "display_name", "provider"],
    properties: {
      id: { type: "string", description: "Unique model identifier, e.g. heygen_v2" },
      type: { type: "string", enum: ["tts", "avatar", "image", "video", "lipsync"], description: "Model category" },
      display_name: { type: "string", description: "Human-readable name shown in the UI" },
      provider: { type: "string", description: "API provider name, e.g. heygen, elevenlabs" },
      api_model_id: { type: "string", description: "The exact model ID string sent to the API" },
      description: { type: "string" },
      parameters: {
        type: "array",
        description: "Property definitions for this model's parameters, following the VUS property schema shape",
        items: {
          required: ["key", "type", "label"],
          properties: {
            key: { type: "string" },
            type: { type: "string" },
            label: { type: "string" },
            default: {},
            description: { type: "string" },
            options: { type: "array" },
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number" },
            required: { type: "boolean" }
          }
        }
      }
    }
  },
  property_set_schema: {
    description: "Shape of a named property set in the project data. Sets are reusable bundles of property values that templates can include.",
    required: ["name", "properties"],
    properties: {
      name: { type: "string", description: "Unique name for this set within the project" },
      description: { type: "string" },
      properties: { type: "object", description: "Key-value property values in this set" }
    }
  }
};

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// iNNfo/packages/innfo-video-parser/src/domain/types.ts
var NoteSchema = external_exports.object({
  block_type: external_exports.literal("note"),
  scene_content: external_exports.string(),
  startLine: external_exports.number().optional().default(1)
});
var SourceEntrySchema = external_exports.object({
  citekey: external_exports.string(),
  title: external_exports.string().optional(),
  author: external_exports.string().optional(),
  url: external_exports.string().optional(),
  doi: external_exports.string().optional(),
  date: external_exports.string().optional(),
  accessed_date: external_exports.string().optional(),
  license: external_exports.string().optional()
}).passthrough();
var LayerSchema = external_exports.object({
  layer_level: external_exports.number().int().optional(),
  layer_name: external_exports.string().default("Untitled Layer"),
  layer_type: external_exports.string().optional(),
  layer_asset_source: external_exports.string().optional().default(""),
  layer_audio_volume: external_exports.number().optional(),
  layer_avatar_model: external_exports.string().optional(),
  layer_generation_model: external_exports.string().optional(),
  layer_asset_citation_key: external_exports.string().optional(),
  layer_asset_access_date: external_exports.string().optional(),
  properties: external_exports.record(external_exports.string(), external_exports.any()).default({}),
  propertyMetadata: external_exports.record(external_exports.string(), external_exports.any()).optional().default({}),
  startLine: external_exports.number().optional().default(1),
  finalProperties: external_exports.record(external_exports.string(), external_exports.any()).optional(),
  inheritedProperties: external_exports.record(external_exports.string(), external_exports.any()).optional()
}).passthrough();
var SceneSchema = external_exports.object({
  sIdx: external_exports.number().optional().default(0),
  idx: external_exports.number().optional().default(0),
  scene_name: external_exports.string().default("Untitled Scene"),
  scene_content: external_exports.string().optional().default(""),
  scene_sources: external_exports.array(external_exports.string()).optional().default([]),
  scene_sources_text: external_exports.string().optional(),
  properties: external_exports.record(external_exports.string(), external_exports.any()).default({}),
  scene_templates: external_exports.union([external_exports.string(), external_exports.array(external_exports.string())]).optional().default([]).transform((val) => Array.isArray(val) ? val : val ? [val] : []),
  scene_background_audio_volume: external_exports.number().optional().default(0.2),
  scene_tts_model: external_exports.string().optional(),
  scene_voice: external_exports.string().optional(),
  scene_voice_volume: external_exports.number().optional().default(1),
  scene_image_model: external_exports.string().optional(),
  scene_video_model: external_exports.string().optional(),
  layers: external_exports.array(LayerSchema).optional().default([]),
  propertyMetadata: external_exports.record(external_exports.string(), external_exports.any()).optional().default({}),
  startLine: external_exports.number().optional().default(1),
  finalProperties: external_exports.record(external_exports.string(), external_exports.any()).optional(),
  inheritedProperties: external_exports.record(external_exports.string(), external_exports.any()).optional()
}).passthrough();
var SectionSchema = external_exports.object({
  title: external_exports.string().min(1, "Section title is required"),
  properties: external_exports.record(external_exports.string(), external_exports.any()).default({}),
  background: external_exports.string().optional(),
  scenes: external_exports.array(external_exports.union([SceneSchema, NoteSchema]))
}).passthrough();
var UISchemaSchema = external_exports.object({
  video: external_exports.record(external_exports.string(), external_exports.any()).optional().default({}),
  scene: external_exports.record(external_exports.string(), external_exports.any()).optional().default({}),
  layer: external_exports.record(external_exports.string(), external_exports.any()).optional().default({})
}).passthrough();
var PropertySetSchema = external_exports.object({
  name: external_exports.string(),
  description: external_exports.string().optional(),
  properties: external_exports.record(external_exports.string(), external_exports.any()).default({})
});
var ProjectSchema = external_exports.object({
  config: external_exports.record(external_exports.string(), external_exports.any()).default({}),
  video_sources: external_exports.record(external_exports.string(), SourceEntrySchema).optional().default({}),
  templates: external_exports.record(external_exports.string(), external_exports.any()).default({}),
  property_sets: external_exports.record(external_exports.string(), PropertySetSchema).optional().default({}),
  sections: external_exports.array(SectionSchema),
  flattenScenes: external_exports.array(external_exports.any()).optional().default([]),
  uiSchema: UISchemaSchema.optional().default({}),
  propertyMetadata: external_exports.record(external_exports.string(), external_exports.any()).optional().default({})
}).passthrough();
var AppSettingsSchema = external_exports.object({
  replicate_key: external_exports.string().optional().nullable(),
  pexels_key: external_exports.string().optional().nullable(),
  work_dir: external_exports.string(),
  config_dir: external_exports.string(),
  enabled_plugins: external_exports.array(external_exports.string()).default(["advanced-ai", "lottie-animations", "stock-media"]),
  disabled_models: external_exports.array(external_exports.string()).default([]),
  max_cache_size_mb: external_exports.number().default(1024),
  preferred_encoder: external_exports.string().default("auto"),
  default_image_model: external_exports.string().optional().nullable(),
  default_video_model: external_exports.string().optional().nullable(),
  default_llm_model: external_exports.string().optional().nullable(),
  default_avatar_model: external_exports.string().optional().nullable(),
  default_tts_model: external_exports.string().optional().nullable()
});
var ModelDefinitionSchema = external_exports.object({
  id: external_exports.string().optional(),
  value: external_exports.string().optional(),
  name: external_exports.string().optional(),
  label: external_exports.string().optional(),
  version: external_exports.string().optional(),
  desc: external_exports.string().optional(),
  description: external_exports.string().optional(),
  provider: external_exports.string().optional(),
  tier: external_exports.string().optional(),
  metrics: external_exports.record(external_exports.any()).optional(),
  parameters: external_exports.array(external_exports.any()).optional(),
  inputs_mapping: external_exports.record(external_exports.string()).optional(),
  max_outputs: external_exports.number().optional()
}).passthrough();
var ForgeModelDefinitionSchema = external_exports.object({
  id: external_exports.string().optional(),
  value: external_exports.string().optional(),
  name: external_exports.string().optional(),
  label: external_exports.string().optional(),
  type: external_exports.string().optional(),
  provider: external_exports.string().optional().default("replicate"),
  description: external_exports.string().optional(),
  parameters: external_exports.array(external_exports.any()).optional().default([])
}).passthrough();
var ModelsConfigSchema = external_exports.object({
  image: external_exports.array(ModelDefinitionSchema).default([]),
  video: external_exports.array(ModelDefinitionSchema).default([]),
  lipsync: external_exports.array(ModelDefinitionSchema).default([]),
  tts: external_exports.array(ModelDefinitionSchema).default([]),
  forge_models: external_exports.array(ForgeModelDefinitionSchema).default([]),
  system_options: external_exports.object({
    voices: external_exports.array(external_exports.string()).default([]),
    tts_emotions: external_exports.array(external_exports.string()).default([]),
    transitions: external_exports.array(external_exports.object({ value: external_exports.string(), label: external_exports.string() })).default([]),
    effects: external_exports.array(external_exports.object({ value: external_exports.string(), label: external_exports.string() })).default([])
  }).optional().default({})
});
var HardwareStatusSchema = external_exports.object({
  has_nvenc: external_exports.boolean(),
  has_qsv: external_exports.boolean(),
  has_vulkan: external_exports.boolean(),
  using: external_exports.string()
});
var RecentScriptSchema = external_exports.object({
  name: external_exports.string(),
  path: external_exports.string(),
  date: external_exports.string()
});

// iNNfo/packages/innfo-video-parser/src/config/propertyMappings.ts
var slugify = (value) => String(value).toLowerCase().trim().replace(/[\s-]/g, "_");
var VALUE_NORMALIZERS = {
  scene_duration_mode: slugify,
  scene_voice_emotion: slugify,
  layer_type: (value) => {
    const slug = slugify(value);
    if (slug === "text") return "text_static";
    return slug;
  },
  layer_active: (value) => {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return true;
  },
  scene_voice_volume: (value) => {
    const n = parseFloat(value);
    return isNaN(n) ? 1 : Math.max(0, Math.min(2, n));
  },
  scene_voice_speed: (value) => {
    const n = parseFloat(value);
    return isNaN(n) ? 1 : Math.max(0.5, Math.min(2, n));
  },
  scene_background_audio_volume: (value) => {
    const n = parseFloat(value);
    return isNaN(n) ? 0.2 : Math.max(0, Math.min(1, n));
  },
  scene_tts_model: (value) => {
    return String(value).trim();
  },
  scene_templates: (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return trimmed.substring(1, trimmed.length - 1).split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
    return [String(value)];
  },
  video_sources: (value) => {
    let parsed = {};
    if (typeof value === "object" && value !== null) {
      parsed = value;
    } else if (typeof value === "string") {
      try {
        parsed = JSON.parse(value.trim());
      } catch (e) {
        parsed = parseSimpleYaml(value);
      }
    }
    if (parsed && typeof parsed === "object") {
      const finalSources = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === "object") {
          finalSources[k] = {
            citekey: k,
            ...v
          };
        }
      }
      return finalSources;
    }
    return {};
  },
  scene_sources: (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          return trimmed.substring(1, trimmed.length - 1).split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [String(value)];
  }
};
var normalizePropertyKey = (key) => {
  let k = key.trim().toLowerCase();
  if (k.startsWith("(") && k.endsWith(")")) {
    k = k.substring(1, k.length - 1).trim();
  }
  if (k === "anydeo_specification" || k === "anydeo-specification")
    return "video_anydeo_specification";
  if (k === "scene_effect") return "scene_effects";
  if (k === "layer_audio_volume") return "layer_volume";
  if (k === "scene_citations") return "scene_sources";
  if (k === "video_citations" || k === "bibliography") return "video_sources";
  return k;
};
var normalizePropertyValue = (key, value) => {
  const normalizer = VALUE_NORMALIZERS[key];
  return normalizer ? normalizer(value) : value;
};
function parseSimpleYaml(yamlStr) {
  const lines = yamlStr.split("\n");
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0 || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    if (indent < minIndent) {
      minIndent = indent;
    }
  }
  const dedentedLines = minIndent !== Infinity && minIndent > 0 ? lines.map((line) => {
    if (line.trim().length === 0) return "";
    const indent = line.length - line.trimStart().length;
    return line.substring(Math.min(indent, minIndent));
  }) : lines;
  const result = {};
  let currentKey = null;
  let currentObject = null;
  for (const line of dedentedLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.substring(0, colonIdx).trim();
    let val = trimmed.substring(colonIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1).trim();
    }
    if (indent === 0) {
      if (val) {
        if (val.startsWith("[") && val.endsWith("]")) {
          try {
            result[key] = JSON.parse(val);
          } catch {
            result[key] = val.substring(1, val.length - 1).split(",").map((s) => s.trim()).filter(Boolean);
          }
        } else {
          result[key] = val;
        }
        currentObject = null;
        currentKey = null;
      } else {
        currentKey = key;
        currentObject = {};
        result[key] = currentObject;
      }
    } else {
      if (currentObject) {
        if (val.startsWith("[") && val.endsWith("]")) {
          try {
            currentObject[key] = JSON.parse(val);
          } catch {
            currentObject[key] = val.substring(1, val.length - 1).split(",").map((s) => s.trim()).filter(Boolean);
          }
        } else {
          currentObject[key] = val;
        }
      }
    }
  }
  return result;
}

// iNNfo/packages/innfo-video-parser/src/parser/PropertyUtils.ts
function normalizeValue(value) {
  if (typeof value !== "string") return value;
  let trimmed = value;
  if (value.includes("\n")) {
    trimmed = value.replace(/^[\r\n]+|[\r\n\s]+$/g, "");
  } else {
    trimmed = value.trim();
  }
  if (trimmed === "" && value.length > 0) return value;
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim();
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && !isNaN(Number(trimmed)) && !trimmed.includes(" ") && !trimmed.includes("\n")) {
    const num = Number(trimmed);
    if (!trimmed.includes("x") && !trimmed.includes(":") && !trimmed.startsWith("#")) {
      return num;
    }
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const content = trimmed.substring(1, trimmed.length - 1).trim();
    if (!content) return [];
    return content.split(",").map((s) => normalizeValue(s.trim()));
  }
  return trimmed;
}
function parsePropertyPair(pair) {
  let workingLine = pair.trim();
  if (!workingLine.startsWith("- ")) return null;
  workingLine = workingLine.substring(2).trim();
  const colonIndex = workingLine.indexOf(":");
  if (colonIndex === -1) return null;
  let rawKey = workingLine.substring(0, colonIndex).trim();
  let isHidden = false;
  if (rawKey.startsWith("(") && rawKey.endsWith(")")) {
    isHidden = true;
    rawKey = rawKey.substring(1, rawKey.length - 1).trim();
  }
  const key = normalizePropertyKey(rawKey);
  const rawValue = workingLine.substring(colonIndex + 1).trim();
  const value = normalizeValue(rawValue);
  return { key, value, isHidden };
}
function extractInlineProperties(fields) {
  const properties = {};
  const propertyMetadata = {};
  if (!fields) return { properties, propertyMetadata };
  const fieldPairs = fields.split(/,\s*/);
  fieldPairs.forEach((pair) => {
    const result = parsePropertyPair(pair);
    if (result) {
      properties[result.key] = result.value;
      if (result.isHidden) {
        if (!propertyMetadata[result.key]) propertyMetadata[result.key] = {};
        propertyMetadata[result.key].isHidden = true;
      }
    }
  });
  return { properties, propertyMetadata };
}
function extractMediaShortcuts(content = "") {
  const REGEX_SHORTCUT_MEDIA2 = /!\[(.*?)\]\((.*?)\)/;
  let media = "";
  let cleanContent = content;
  const mediaMatch = content.match(REGEX_SHORTCUT_MEDIA2);
  if (mediaMatch) {
    media = mediaMatch[2];
    cleanContent = content.replace(mediaMatch[0], "").trim();
  }
  return { media, cleanContent };
}
function processProperties(rawProps) {
  const processed = {};
  const normalizedRaw = {};
  for (const [key, value] of Object.entries(rawProps)) {
    normalizedRaw[normalizePropertyKey(key)] = value;
  }
  for (const [mappedKey, value] of Object.entries(normalizedRaw)) {
    let finalValue = value;
    if (mappedKey === "scene_templates" && typeof value === "string") {
      finalValue = value.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
    } else if (VALUE_NORMALIZERS[mappedKey]) {
      finalValue = VALUE_NORMALIZERS[mappedKey](value);
    }
    processed[mappedKey] = finalValue;
  }
  return processed;
}

// iNNfo/packages/innfo-video-parser/src/parser/LineParseStrategies.ts
var LineParseStrategy = class {
  placeBlock(block, context) {
    if (!context.root) {
      context.root = {
        type: "root",
        title: "Root",
        properties: {},
        propertyMetadata: {},
        children: [],
        parsingState: "properties",
        level: 0,
        content: "",
        startLine: 1
      };
      context.stack = [context.root];
    }
    while (context.stack.length > 1 && block.level <= context.stack[context.stack.length - 1].level) {
      context.stack.pop();
    }
    const parent = context.stack[context.stack.length - 1];
    if (!parent.children) parent.children = [];
    parent.children.push(block);
    context.stack.push(block);
    context.currentBlock = block;
  }
};
var REGEX_MULTI_TEMPLATE = /^((?:@[\p{L}\p{N}_-]+\s*)+)/u;
var REGEX_LAYER_SHORTCUT = /^@@(?:\s*\(((?:[^()]*|\([^()]*\))*)\))?(?:\s+(.*))?$/u;
var REGEX_TEMPLATE_IDENTIFIER = /^@template\s+([\p{L}\p{N}_-]+)(?:\s+(.*))?$/u;
var REGEX_UI_RESERVED = /^@\s*(video|scene|layer)(?:\s+(video|scene|layer))?\s*$/u;
var REGEX_HEADER_MATCH = /^#+\s/;
var REGEX_HEADER_LEVEL = /^(#+)/;
var REGEX_SHORTCUT_MEDIA = /!\[(.*?)\]\((.*?)\)/;
var REGEX_FIELDS_PAREN = /^\s*\(((?:[^()]*|\([^()]*\))*)\)/;
var REGEX_SPEC_HEADER = /^\/\/\s*(?:ANYDEO_SPEC|VUS-COMPLIANT)\s*:\s*([\w.-]+)/;
var ShortcutSceneStrategy = class extends LineParseStrategy {
  matches(line) {
    const trimmed = line.trim();
    if (REGEX_UI_RESERVED.test(trimmed)) return true;
    if (trimmed.startsWith("@@")) return false;
    if (trimmed.startsWith("@layer ")) return false;
    if (trimmed.startsWith("@@template ")) return false;
    return trimmed.startsWith("@");
  }
  parse(line, context, lineNumber) {
    const trimmed = line.trim();
    const uiSchemaMatch = trimmed.match(REGEX_UI_RESERVED);
    if (uiSchemaMatch) {
      const block2 = {
        type: "template",
        title: uiSchemaMatch[1],
        // "video", "scene", "layer"
        properties: {
          block_type: "ui_schema"
        },
        propertyMetadata: {},
        content: "",
        children: [],
        level: 2,
        parsingState: "properties",
        startLine: lineNumber
      };
      this.placeBlock(block2, context);
      return true;
    }
    const setDefMatch = trimmed.match(/^@\s*set\s+([\p{L}\p{N}_-]+)(?:\s+(.*))?$/u);
    if (setDefMatch) {
      const block2 = {
        type: "set",
        title: setDefMatch[1],
        properties: {},
        propertyMetadata: {},
        content: setDefMatch[2] ? setDefMatch[2].trim() : "",
        children: [],
        level: 2,
        parsingState: "properties",
        startLine: lineNumber
      };
      this.placeBlock(block2, context);
      return true;
    }
    const templateDefMatch = trimmed.match(REGEX_TEMPLATE_IDENTIFIER);
    if (templateDefMatch) {
      const block2 = {
        type: "template",
        title: templateDefMatch[1],
        properties: {},
        propertyMetadata: {},
        content: "",
        children: [],
        level: 2,
        parsingState: "properties",
        startLine: lineNumber
      };
      this.placeBlock(block2, context);
      return true;
    }
    let workingLine = trimmed;
    const templates = [];
    if (workingLine.startsWith("@ ")) {
      workingLine = workingLine.substring(1).trim();
    } else if (workingLine.startsWith("@")) {
      const tplMatch = workingLine.match(REGEX_MULTI_TEMPLATE);
      if (tplMatch) {
        const tplPart = tplMatch[1];
        const found = tplPart.match(/@([\p{L}\p{N}_-]+)/gu);
        if (found) {
          found.forEach((t) => templates.push(t.replace(/^@/, "")));
        }
        workingLine = workingLine.replace(tplMatch[0], "").trim();
      } else {
        workingLine = workingLine.substring(1).trim();
      }
    }
    let props = {};
    let propertyMetadata = {};
    const fieldMatch = workingLine.match(REGEX_FIELDS_PAREN);
    if (fieldMatch) {
      const extracted = extractInlineProperties(fieldMatch[1]);
      props = extracted.properties;
      propertyMetadata = extracted.propertyMetadata;
      workingLine = workingLine.replace(fieldMatch[0], "").trim();
    }
    const { media: inlineMedia, cleanContent: finalLine } = extractMediaShortcuts(workingLine);
    workingLine = finalLine;
    const title = workingLine || "Untitled Scene";
    const scProps = {
      ...props,
      scene_templates: templates
    };
    if (!scProps.block_type) scProps.block_type = "scene";
    const block = {
      type: "scene",
      title,
      properties: scProps,
      propertyMetadata,
      inline_media: inlineMedia,
      content: "",
      children: [],
      level: 3,
      parsingState: "content",
      startLine: lineNumber
    };
    this.placeBlock(block, context);
    return true;
  }
};
var TemplateApplicationStrategy = class extends LineParseStrategy {
  matches(line) {
    const trimmed = line.trim();
    return /^@[\p{L}\p{N}_-]+$/u.test(trimmed);
  }
  parse(line, context, _lineNumber) {
    if (!context.currentBlock) return false;
    const type = context.currentBlock.type;
    if (!["scene", "layer", "template"].includes(type)) return false;
    const name = line.trim().substring(1);
    if (type === "scene" || type === "template") {
      const current = context.currentBlock.properties.scene_templates || [];
      const templates = Array.isArray(current) ? [...current] : current ? [current] : [];
      if (!templates.includes(name)) templates.push(name);
      context.currentBlock.properties.scene_templates = templates;
    } else if (type === "layer") {
      const current = context.currentBlock.properties.import || [];
      const templates = Array.isArray(current) ? [...current] : current ? [current] : [];
      if (!templates.includes(name)) templates.push(name);
      context.currentBlock.properties.import = templates;
    }
    return true;
  }
};
var SpecVersionStrategy = class extends LineParseStrategy {
  matches(line) {
    return REGEX_SPEC_HEADER.test(line.trim());
  }
  parse(line, context, _lineNumber) {
    const match = line.trim().match(REGEX_SPEC_HEADER);
    if (match) {
      context.specVersion = match[1];
      return true;
    }
    return false;
  }
};
var HeaderStrategy = class extends LineParseStrategy {
  matches(line) {
    return REGEX_HEADER_MATCH.test(line.trim());
  }
  parse(line, context, lineNumber) {
    const trimmed = line.trim();
    const levelMatch = trimmed.match(REGEX_HEADER_LEVEL);
    const level = levelMatch ? levelMatch[1].length : 1;
    const title = trimmed.replace(REGEX_HEADER_MATCH, "").trim();
    const lowerTitle = title.toLowerCase();
    const isVideo = lowerTitle === "video" || lowerTitle === "v\xEDdeo";
    const isTemplates = lowerTitle === "templates";
    const isSections = lowerTitle === "sections";
    const isSets = lowerTitle === "sets";
    const isTemplate = lowerTitle === "template";
    const isScene = lowerTitle === "scene";
    const isLayer = lowerTitle === "layer";
    let type = "section";
    if (isVideo) {
      type = "video";
    } else if (isTemplates) {
      type = "templates";
    } else if (isSections) {
      type = "sections";
    } else if (isSets) {
      type = "sets";
    } else if (isTemplate || isScene || isLayer) {
      type = "template";
    } else if (level === 1) {
      type = "section";
    }
    const block = {
      type,
      title,
      properties: {},
      propertyMetadata: {},
      content: "",
      children: [],
      level,
      parsingState: "properties",
      startLine: lineNumber
    };
    this.placeBlock(block, context);
    return true;
  }
};
var ShortcutLayerStrategy = class extends LineParseStrategy {
  matches(line) {
    return REGEX_LAYER_SHORTCUT.test(line.trim());
  }
  parse(line, context, lineNumber) {
    const trimmed = line.trim();
    const match = trimmed.match(REGEX_LAYER_SHORTCUT);
    if (!match) return false;
    const index = 10;
    const labelPart = match[1] || "";
    const content = match[2] || "";
    const props = {
      layer_level: index
    };
    const propertyMetadata = {};
    let labelTitle = "";
    if (labelPart) {
      const extracted = extractInlineProperties(labelPart);
      if (Object.keys(extracted.properties).length > 0) {
        Object.assign(props, extracted.properties);
        Object.assign(propertyMetadata, extracted.propertyMetadata);
      } else {
        labelTitle = labelPart;
      }
    }
    const { media: inlineMedia, cleanContent } = extractMediaShortcuts(content);
    const layerProps = { ...props };
    if (inlineMedia) layerProps.layer_asset_source = inlineMedia;
    const rawTitle = labelTitle.trim() || cleanContent.trim() || (index === 10 ? "background" : "");
    const finalTitle = rawTitle.toLowerCase() === "background" ? "background" : rawTitle;
    const block = {
      type: "layer",
      title: finalTitle,
      properties: layerProps,
      propertyMetadata,
      inline_media: inlineMedia,
      content: labelTitle.trim() ? cleanContent : "",
      children: [],
      level: 4,
      parsingState: "content",
      startLine: lineNumber
    };
    this.placeBlock(block, context);
    return true;
  }
};
var PropertyStrategy = class extends LineParseStrategy {
  matches(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) return false;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) return false;
    const key = trimmed.substring(2, colonIndex).trim();
    if (key.includes(" ")) return false;
    if (/^[A-Z]/.test(key) && !key.startsWith("(")) return false;
    return /^\(?[a-zA-Z0-9_./-]+\)?$/.test(key);
  }
  parse(line, context, lineNumber) {
    const parsed = parsePropertyPair(line);
    if (!parsed || !context.currentBlock) return false;
    const key = parsed.key;
    const value = parsed.value;
    if (typeof value === "string" && value.trim() === "```") {
      context.isParsingMultilineProperty = true;
      context.lastPropertyKey = key;
      context.currentBlock.properties[key] = "";
      return true;
    }
    context.currentBlock.properties[key] = value;
    if (key === "video_anydeo_specification" || key === "anydeo_specification") {
      context.specVersion = value;
    }
    if (parsed.isHidden) {
      if (!context.currentBlock.propertyMetadata) context.currentBlock.propertyMetadata = {};
      if (!context.currentBlock.propertyMetadata[parsed.key])
        context.currentBlock.propertyMetadata[parsed.key] = {};
      context.currentBlock.propertyMetadata[parsed.key].isHidden = true;
    }
    context.lastPropertyKey = parsed.key;
    return true;
  }
};
var MultilinePropertyContinuationStrategy = class extends LineParseStrategy {
  matches(_line) {
    return false;
  }
  // Since LineParser uses .matches(), we need a different approach or make matches() check context
  static matchesMultiline(context) {
    return !!context.isParsingMultilineProperty;
  }
  parse(line, context, _lineNumber) {
    if (!context.isParsingMultilineProperty || !context.currentBlock || !context.lastPropertyKey)
      return false;
    const trimmed = line.trim();
    if (trimmed === "```") {
      context.isParsingMultilineProperty = false;
      const val = context.currentBlock.properties[context.lastPropertyKey];
      if (typeof val === "string" && val.endsWith("\n")) {
        context.currentBlock.properties[context.lastPropertyKey] = val.slice(0, -1);
      }
      return true;
    }
    const currentValue = context.currentBlock.properties[context.lastPropertyKey] || "";
    context.currentBlock.properties[context.lastPropertyKey] = currentValue + line + "\n";
    return true;
  }
};
var ContentStrategy = class extends LineParseStrategy {
  matches(line) {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("@");
  }
  parse(line, context, _lineNumber) {
    if (!context.currentBlock) return false;
    const trimmed = line.trim();
    if (context.currentBlock.parsingState === "content") {
      context.currentBlock.content = context.currentBlock.content ? context.currentBlock.content + "\n" + trimmed : trimmed;
      return true;
    }
    return false;
  }
};
var MediaInclusionStrategy = class extends LineParseStrategy {
  matches(line) {
    return REGEX_SHORTCUT_MEDIA.test(line.trim());
  }
  parse(line, context, _lineNumber) {
    if (!context.currentBlock) return false;
    const match = line.trim().match(REGEX_SHORTCUT_MEDIA);
    if (match) {
      const url = match[2];
      const type = context.currentBlock.type;
      if (type === "layer" || type === "template") {
        context.currentBlock.properties.layer_asset_source = url;
        const currentType = context.currentBlock.properties.layer_type;
        if (!currentType || currentType === "image" || currentType === "video" || currentType === "audio") {
          const ext = url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";
          const isVideo = ["mp4", "webm", "mov", "m4v"].includes(ext);
          const isAudio = ["mp3", "wav", "ogg", "m4a"].includes(ext);
          if (isVideo) context.currentBlock.properties.layer_type = "video";
          else if (isAudio) context.currentBlock.properties.layer_type = "audio";
          else if (!currentType) context.currentBlock.properties.layer_type = "image";
        }
      }
      if (!context.currentBlock.propertyMetadata) context.currentBlock.propertyMetadata = {};
      if (!context.currentBlock.propertyMetadata.layer_asset_source)
        context.currentBlock.propertyMetadata.layer_asset_source = {};
      context.currentBlock.propertyMetadata.layer_asset_source.isPrimigenia = true;
      context.currentBlock.inline_media = url;
      return true;
    }
    return false;
  }
};
var LineParser = class {
  multilineStrategy = new MultilinePropertyContinuationStrategy();
  strategies = [
    new SpecVersionStrategy(),
    new HeaderStrategy(),
    new TemplateApplicationStrategy(),
    new ShortcutSceneStrategy(),
    new ShortcutLayerStrategy(),
    new PropertyStrategy(),
    new MediaInclusionStrategy(),
    new ContentStrategy()
  ];
  parseLine(line, context, lineNumber) {
    if (context.isParsingMultilineProperty) {
      if (this.multilineStrategy.parse(line, context, lineNumber)) return;
    }
    for (const strategy of this.strategies) {
      if (strategy.matches(line)) {
        if (strategy.parse(line, context, lineNumber)) return;
      }
    }
  }
};

// iNNfo/packages/innfo-video-parser/specs/V_0-3-3.json with { type: 'json' }
var V_0_3_3_default2 = {
  info: {
    id: "vus",
    name: "Anydeo Universal Specification",
    version: "V_0-3-3",
    label: "Syntactic Sugar Isolation",
    description: "Enforces strict canonical properties by requiring the parser to fully translate Syntactic Sugar and introduces video_original_script for traceability."
  },
  categories: [
    {
      id: "identity",
      label: "Identity",
      icon: "Fingerprint",
      color: "#71717a",
      description: "Project naming and global setup.",
      ui: { defaultExpanded: true, priority: 0 }
    },
    {
      id: "layer_core",
      label: "Layer Configuration",
      icon: "Layers",
      color: "#ec4899",
      description: "Essential layer settings (Source, Type, Level).",
      ui: { defaultExpanded: true, priority: 1 }
    },
    {
      id: "audio",
      label: "Audio",
      icon: "Volume2",
      color: "#8b5cf6",
      description: "Voice narration, background music, and audio mixing."
    },
    {
      id: "asset_metadata",
      label: "Asset Metadata",
      icon: "Info",
      color: "#64748b",
      description: "Authorship, licensing and AI generation flags."
    },
    {
      id: "avatar",
      label: "Avatar Controls",
      icon: "User",
      color: "#f43f5e",
      description: "Digital avatar settings."
    },
    {
      id: "style_effects",
      label: "Style & Effects",
      icon: "Sparkles",
      color: "#f59e0b",
      description: "Cinematic motion, transitions, text branding and effects."
    },
    {
      id: "config",
      label: "Configuration",
      icon: "Settings2",
      color: "#6366f1",
      description: "Technical settings and timing logic."
    },
    {
      id: "publish",
      label: "Publication & SEO",
      icon: "Share2",
      color: "#3b82f6",
      description: "Publication metadata and settings."
    }
  ],
  api_options: {
    resolutions: [
      { value: "1920x1080", label: "1920x1080 (16:9) - Horizontal" },
      { value: "1080x1920", label: "1080x1920 (9:16) - Vertical" },
      { value: "1080x1080", label: "1080x1080 (1:1) - Square" }
    ],
    fps_options: [
      { value: "24", label: "24" },
      { value: "30", label: "30" },
      { value: "60", label: "60" }
    ],
    asset_types: [
      { value: "image", label: "Image", icon: "Image", description: "Standard static image layer. Best for backgrounds or overlays using local or uploaded files." },
      { value: "stock_image", label: "Stock Image", icon: "Library", description: "Intelligent search for professional photography. Describe what you need and we will find the perfect match." },
      { value: "ai_image", label: "AI Image", icon: "Sparkles", description: "Generative visual creation. Turn your text prompts into unique, high-quality images for your video." },
      { value: "video", label: "Video", icon: "Video", description: "Standard video layer. Supports local files, recordings, and direct uploads." },
      { value: "stock_video", label: "Stock Video", icon: "Clapperboard", description: "Search for high-quality professional video clips to enhance your project's visual variety." },
      { value: "ai_video", label: "AI Video", icon: "Zap", description: "Generative cinematic clips. Create moving visuals from simple text descriptions." },
      { value: "text", label: "Text Layer", icon: "Type", description: "High-quality typography with full control over style, positioning and animations. Supports standard, animated and AI-enhanced text." },
      { value: "text_static", label: "Static Text", icon: "Type", description: "Standard static text layer." },
      { value: "text_dynamic", label: "Dynamic Text", icon: "Type", description: "Animated or dynamic text layer." },
      { value: "text_ai_embedded", label: "AI Embedded Text", icon: "Type", description: "AI generated embedded text layer." },
      { value: "talking_avatar", label: "Talking Avatar", icon: "UserCircle", description: "AI-driven character that speaks your narration with realistic lip-sync and expressions." },
      { value: "audio", label: "Audio / Sound", icon: "Volume2", description: "Background tracks and sound effects to set the mood of your scene." }
    ],
    tts_models: [
      {
        value: "replicate/minimax/speech-2.8-hd",
        label: "MiniMax Speech 2.8 HD",
        provider: "replicate",
        version: "minimax/speech-2.8-hd:bb4b16034cd66abe0d3147d50a63890e0144328136ca082f3f141f42ed0d4be9",
        description: "State-of-the-art TTS with human-like prosody.",
        tier: "cinematic",
        default: true,
        metrics: { speed: 8, quality: 10 },
        inputs_mapping: { text: "text", voice: "voice_id" },
        parameters: [
          { key: "voice_id", label: "Voice ID", type: "select", options_key: "voices", default: "Friendly_Person" },
          { key: "speed", label: "Speed", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.1 },
          { key: "language", label: "Language", type: "select", options_key: "voices", default: "Spanish" }
        ]
      },
      {
        value: "wavespeed/minimax/speech-2.5-hd-preview",
        label: "MiniMax Speech 2.5 HD (WaveSpeed)",
        provider: "minimax",
        description: "State-of-the-art TTS with high-definition emotional range. Supports multiple languages and expressive styles.",
        docs_url: "https://www.minimaxir.com/",
        tier: "premium",
        metrics: { speed: 10, quality: 10 },
        inputs_mapping: { text: "text", voice: "voice" },
        parameters: [
          { key: "voice_id", label: "Voice ID", type: "select", options_key: "voices", default: "Friendly_Person" },
          { key: "speed", label: "Speed", type: "number", min: 0.5, max: 2, step: 0.1, default: 1 },
          { key: "language", label: "Language", type: "select", options_key: "languages", default: "Spanish" },
          { key: "emotion", label: "Emotion", type: "select", options_key: "emotions", default: "neutral" }
        ]
      }
    ],
    voices: [
      { value: "Deep_Voice_Man", label: "Deep Voice Man" },
      { value: "Imposing_Manner", label: "Imposing Manner" },
      { value: "Elegant_Man", label: "Elegant Man" },
      { value: "Casual_Guy", label: "Casual Guy" },
      { value: "Friendly_Person", label: "Friendly Person" },
      { value: "Decent_Boy", label: "Decent Boy" },
      { value: "Lively_Girl", label: "Lively Girl" },
      { value: "Exuberant_Girl", label: "Exuberant Girl" },
      { value: "Inspirational_girl", label: "Inspirational Girl" },
      { value: "Young_Knight", label: "Young Knight" },
      { value: "Abbess", label: "Abbess" },
      { value: "Wise_Woman", label: "Wise Woman" },
      { value: "Aussie_Bloke", label: "Aussie Bloke" },
      { value: "Professional_Woman", label: "Professional Woman" },
      { value: "Friendly_Lady", label: "Friendly Lady" },
      { value: "Gentle_Man", label: "Gentle Man" },
      { value: "Calm_Lady", label: "Calm Lady" },
      { value: "English_expressive_narrator", label: "English expressive narrator" },
      { value: "English_radiant_girl", label: "English radiant girl" },
      { value: "English_magnetic_voiced_man", label: "English magnetic voiced man" },
      { value: "English_compelling_lady1", label: "English compelling lady1" },
      { value: "English_Aussie_Bloke", label: "English Aussie Bloke" },
      { value: "English_captivating_female1", label: "English captivating female1" },
      { value: "English_Upbeat_Woman", label: "English Upbeat Woman" },
      { value: "English_Trustworth_Man", label: "English Trustworth Man" },
      { value: "English_CalmWoman", label: "English Calm Woman" },
      { value: "English_UpsetGirl", label: "English Upset Girl" },
      { value: "English_Gentle-voiced_man", label: "English Gentle-voiced man" },
      { value: "English_Whispering_girl_v3", label: "English Whispering girl v3" },
      { value: "English_Diligent_Man", label: "English Diligent Man" },
      { value: "English_Graceful_Lady", label: "English Graceful Lady" },
      { value: "English_Husky_MetalHead", label: "English Husky Metal Head" },
      { value: "English_ReservedYoungMan", label: "English Reserved Young Man" },
      { value: "English_PlayfulGirl", label: "English Playful Girl" },
      { value: "English_ManWithDeepVoice", label: "English Man With Deep Voice" },
      { value: "English_GentleTeacher", label: "English Gentle Teacher" },
      { value: "English_MaturePartner", label: "English Mature Partner" },
      { value: "English_FriendlyPerson", label: "English Friendly Person" },
      { value: "English_MatureBoss", label: "English Mature Boss" },
      { value: "English_Debator", label: "English Debator" },
      { value: "English_Abbess", label: "English Abbess" },
      { value: "English_LovelyGirl", label: "English Lovely Girl" },
      { value: "English_Steadymentor", label: "English Steadymentor" },
      { value: "English_Deep-VoicedGentleman", label: "English Deep-Voiced Gentleman" },
      { value: "English_DeterminedMan", label: "English Determined Man" },
      { value: "English_Wiselady", label: "English Wiselady" },
      { value: "English_CaptivatingStoryteller", label: "English Captivating Storyteller" },
      { value: "English_AttractiveGirl", label: "English Attractive Girl" },
      { value: "English_DecentYoungMan", label: "English Decent Young Man" },
      { value: "English_SentimentalLady", label: "English Sentimental Lady" },
      { value: "English_ImposingManner", label: "English Imposing Manner" },
      { value: "English_SadTeen", label: "English Sad Teen" },
      { value: "English_ThoughtfulMan", label: "English Thoughtful Man" },
      { value: "English_PassionateWarrior", label: "English Passionate Warrior" },
      { value: "English_DecentBoy", label: "English Decent Boy" },
      { value: "English_WiseScholar", label: "English Wise Scholar" },
      { value: "English_Soft-spokenGirl", label: "English Soft-spoken Girl" },
      { value: "English_SereneWoman", label: "English Serene Woman" },
      { value: "English_ConfidentWoman", label: "English Confident Woman" },
      { value: "English_PatientMan", label: "English Patient Man" },
      { value: "English_Comedian", label: "English Comedian" },
      { value: "English_GorgeousLady", label: "English Gorgeous Lady" },
      { value: "English_BossyLeader", label: "English Bossy Leader" },
      { value: "English_LovelyLady", label: "English Lovely Lady" },
      { value: "English_Strong-WilledBoy", label: "English Strong-Willed Boy" },
      { value: "English_Deep-tonedMan", label: "English Deep-toned Man" },
      { value: "English_StressedLady", label: "English Stressed Lady" },
      { value: "English_AssertiveQueen", label: "English Assertive Queen" },
      { value: "English_AnimeCharacter", label: "English Anime Character" },
      { value: "English_Jovialman", label: "English Jovialman" },
      { value: "English_WhimsicalGirl", label: "English Whimsical Girl" },
      { value: "English_CharmingQueen", label: "English Charming Queen" },
      { value: "English_Kind-heartedGirl", label: "English Kind-hearted Girl" },
      { value: "English_FriendlyNeighbor", label: "English Friendly Neighbor" },
      { value: "English_Sweet_Female_4", label: "English Sweet Female 4" },
      { value: "English_Magnetic_Male_2", label: "English Magnetic Male 2" },
      { value: "English_Lively_Male_11", label: "English Lively Male 11" },
      { value: "English_Friendly_Female_3", label: "English Friendly Female 3" },
      { value: "English_Steady_Female_1", label: "English Steady Female 1" },
      { value: "English_Lively_Male_10", label: "English Lively Male 10" },
      { value: "English_Magnetic_Male_12", label: "English Magnetic Male 12" },
      { value: "English_Steady_Female_5", label: "English Steady Female 5" },
      { value: "English_Insightful_Speaker", label: "English Insightful Speaker" },
      { value: "English_patient_man_v1", label: "English patient man v1" },
      { value: "English_Persuasive_Man", label: "English Persuasive Man" },
      { value: "English_Explanatory_Man", label: "English Explanatory Man" },
      { value: "English_intellect_female_1", label: "English intellect female 1" },
      { value: "English_energetic_male_1", label: "English energetic male 1" },
      { value: "English_witty_female_1", label: "English witty female 1" },
      { value: "English_Lucky_Robot", label: "English Lucky Robot" },
      { value: "English_Cute_Girl", label: "English Cute Girl" },
      { value: "English_Sharp_Commentator", label: "English Sharp Commentator" },
      { value: "English_Honest_Man", label: "English Honest Man" }
    ],
    languages: [
      { value: "Spanish", label: "Spanish" },
      { value: "English", label: "English" },
      { value: "French", label: "French" },
      { value: "German", label: "German" },
      { value: "Italian", label: "Italian" },
      { value: "Portuguese", label: "Portuguese" }
    ],
    emotions: [
      { value: "auto", label: "Auto" },
      { value: "neutral", label: "Neutral" },
      { value: "happy", label: "Happy" },
      { value: "sad", label: "Sad" },
      { value: "angry", label: "Angry" },
      { value: "fearful", label: "Fearful" },
      { value: "disgusted", label: "Disgusted" },
      { value: "surprised", label: "Surprised" }
    ],
    avatar_models: [
      {
        value: "replicate/wan-2.1-s2v",
        label: "Wan 2.1 S2V (Standard)",
        provider: "replicate",
        version: "wan-video/wan-2.1-s2v:09607e6e761d2f015b0d740f938ec59199f54aa623384465a5054b230405acf4",
        description: "Best for static images tailored to narration.",
        tier: "balanced",
        default: true,
        metrics: { speed: 6, quality: 8 },
        inputs_mapping: { visual: "image", audio: "audio", prompt: "prompt" },
        parameters: [
          { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p", "1080p"], default: "720p" },
          { key: "interpolate", label: "Interpolate", type: "boolean", default: true }
        ]
      },
      {
        value: "wavespeed/infinitetalk",
        label: "WaveSpeed InfiniteTalk (Ultra-Fast)",
        provider: "wavespeed",
        version: "wavespeed-ai/infinitetalk-fast",
        description: "High-performance digital avatar engine with extremely low latency. Powered by WaveSpeed Fast Inference.",
        docs_url: "https://wavespeed.ai/",
        tier: "performance",
        metrics: { speed: 10, quality: 9 },
        inputs_mapping: { visual: "image", audio: "audio" },
        parameters: [
          { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p", "1080p"], default: "720p" },
          { key: "face_scaling", label: "Face Scaling", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.2 },
          { key: "interpolate", label: "Interpolate", type: "boolean", default: true }
        ]
      }
    ],
    forge_models: [
      {
        value: "replicate/flux-schnell",
        label: "Flux Schnell",
        provider: "replicate",
        version: "black-forest-labs/flux-schnell",
        description: "Ultra-fast high quality image generation.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "replicate/flux-pro",
        label: "Flux Pro",
        provider: "replicate",
        version: "black-forest-labs/flux-pro",
        description: "Elite quality professional image generation.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "replicate/recraft-v3",
        label: "Recraft V3",
        provider: "replicate",
        version: "recraft-ai/recraft-v3",
        description: "Professional Typography & Vector Design.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "wavespeed/qwen-image-edit",
        label: "WaveSpeed Qwen Edit",
        provider: "wavespeed",
        description: "Precise AI Image Editing powered by WaveSpeed.",
        inputs_mapping: { visual: "image", prompt: "prompt" }
      },
      {
        value: "replicate/wan-t2v",
        label: "Wan 2.1 Video",
        provider: "replicate",
        version: "wan-video/wan-2.1-t2v-1.3b",
        description: "Fast video generation from text.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "wavespeed/wan-i2v",
        label: "Wan 2.1 I2V (WaveSpeed)",
        provider: "wavespeed",
        description: "Fast & Economic Image to Video.",
        inputs_mapping: { visual: "image", prompt: "prompt" }
      },
      {
        value: "wavespeed/wan-27-t2i",
        label: "Wan 2.7 T2I (WaveSpeed)",
        provider: "wavespeed",
        version: "alibaba/wan-2.7/text-to-image-pro",
        description: "High-quality text-to-image generation powered by Alibaba Wan 2.7.",
        inputs_mapping: { prompt: "prompt" }
      },
      {
        value: "wavespeed/nano-banana-edit",
        label: "Nano Banana 2 Edit (WaveSpeed)",
        provider: "wavespeed",
        version: "google/nano-banana-2/edit-fast",
        description: "Ultra-fast high quality image editing.",
        inputs_mapping: { visual: "image", prompt: "prompt" }
      }
    ],
    speeds: [
      { value: 0.25, label: "Extremely slow" },
      { value: 0.5, label: "Very slow" },
      { value: 0.75, label: "Slow" },
      { value: 1, label: "Medium" },
      { value: 1.5, label: "Fast" },
      { value: 2, label: "Very fast" },
      { value: 4, label: "Extremely fast" },
      { value: -1, label: "Full Scene Duration" }
    ],
    render: {
      output_directory: "exports",
      filename_template: "{title} ({timestamp}) [{resolution}]",
      timestamp_format: "YYYY-MM-DD_HH-mm-ss"
    }
  },
  properties: {
    video_anydeo_specification: {
      type: "string",
      label: "Specification Version",
      category: "identity",
      scope: "video",
      required: true,
      default: "V_0-3-3",
      description: "The exact version of the specification used in this script. V_0-3-3 requires strict syntactic sugar translation and adds video_original_script.",
      immutable: true
    },
    video_name: {
      type: "string",
      label: "Video Name",
      category: "identity",
      scope: "video",
      required: true,
      default: "Untitled Video",
      description: "The main name used for the exported video and metadata."
    },
    video_resolution: {
      type: "select",
      label: "Resolution",
      category: "identity",
      scope: "video",
      options_key: "resolutions",
      default: "1920x1080",
      description: "Determines aspect ratio and pixel dimensions."
    },
    video_status: {
      type: "select",
      label: "Project Status",
      category: "identity",
      scope: "video",
      required: false,
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "preprocessed", label: "Preprocessed" },
        { value: "review", label: "Under Review" },
        { value: "approved", label: "Approved" },
        { value: "archived", label: "Archived" }
      ],
      description: "The current lifecycle state of the project."
    },
    video_fps: {
      type: "select",
      label: "FPS",
      category: "identity",
      scope: "video",
      options_key: "fps_options",
      default: "30",
      description: "Frames Per Second."
    },
    video_author: {
      type: "string",
      label: "Author",
      category: "identity",
      scope: "video",
      default: "Anydeo User",
      description: "Creator of the video."
    },
    video_tags: {
      type: "string",
      label: "Video Tags",
      category: "publish",
      scope: "video",
      default: "anydeo, ai-video",
      description: "Keywords for discovery and SEO."
    },
    video_script_source: {
      type: "string",
      label: "Script Source File",
      category: "identity",
      scope: "video",
      description: "Path to the instructions or source file used to generate the script (e.g., assets/instructions.md)."
    },
    video_original_script: {
      type: "string",
      label: "Original Script Copy",
      category: "identity",
      scope: "video",
      description: "Path to the unmodified copy of the original .anydeo script, saved with an _original_{timestamp} suffix before any syntactic sugar was processed."
    },
    video_sources: {
      type: "object",
      label: "Video Sources / Bibliography",
      category: "asset_metadata",
      scope: "video",
      description: "Centralized project repository of bibliographic references and media sources."
    },
    video_publish: {
      type: "boolean",
      label: "Publication Integration",
      category: "publish",
      scope: "video",
      default: false,
      description: "Enables the assisted publication portal and SEO tracking."
    },
    video_publish_description: {
      type: "textarea",
      label: "Publication Description",
      category: "publish",
      scope: "video",
      description: "The full description to be used when publishing. Supports metadata interpolation."
    },
    video_render_quality: {
      type: "select",
      label: "Render Quality",
      category: "config",
      scope: "video",
      default: "ultrafast_preview",
      options: [
        { value: "ultrafast_preview", label: "UltraFast (Preview)" },
        { value: "fast_draft", label: "Fast (Draft)" },
        { value: "balanced", label: "Balanced" },
        { value: "quality_final", label: "High Quality (Final)" },
        { value: "high_quality", label: "Elite (Pro Res)" }
      ],
      description: "Determines the speed vs. quality tradeoff. Changing this will invalidate the scene cache."
    },
    section_title: {
      type: "string",
      label: "Section Title",
      category: "identity",
      scope: "section",
      required: true,
      default: "Untitled Section",
      description: "The heading title or identifier for this section."
    },
    scene_name: {
      type: "string",
      label: "Scene Name",
      category: "identity",
      scope: "scene",
      required: true,
      description: "Unique identifier for this specific scene."
    },
    scene_templates: {
      type: "multiselect",
      label: "Scene Templates",
      category: "identity",
      scope: "scene",
      options_key: "templates",
      description: "List of templates to inherit from.",
      default: []
    },
    scene_content: {
      type: "textarea",
      label: "Content",
      category: "identity",
      scope: "scene",
      required: true,
      description: "The text to be narrated by the AI voice. MUST be plain text. Markdown headers are strictly prohibited."
    },
    scene_sources: {
      type: "array",
      label: "Scene Sources / Citations",
      category: "asset_metadata",
      scope: "scene",
      description: "List of citekeys or URLs providing bibliographic backing for the scene content without polluting the narration text."
    },
    scene_status: {
      type: "select",
      label: "Scene Status",
      category: "identity",
      scope: "scene",
      required: false,
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "review", label: "Under Review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" }
      ],
      description: "The current lifecycle state of the scene."
    },
    scene_tts_model: {
      type: "select",
      label: "TTS Model",
      category: "audio",
      scope: "scene",
      options_key: "tts_models",
      default: "replicate/minimax/speech-2.8-hd",
      description: "The AI model used for text-to-speech generation.",
      showIf: { scene_voice_source: "tts" }
    },
    scene_voice: {
      type: "select",
      label: "Voice ID",
      category: "audio",
      scope: "scene",
      options_key: "voices",
      default: "Friendly_Person",
      description: "The specific AI voice to use for narration in this scene.",
      ui: { hiddenInInspector: true },
      showIf: { scene_voice_source: "tts" }
    },
    scene_voice_source: {
      type: "select",
      label: "Voice Source",
      category: "audio",
      scope: "scene",
      default: "tts",
      options: [
        { value: "tts", label: "AI TTS" },
        { value: "recording", label: "User Recording" }
      ],
      description: "Determines if the narration is generated via AI TTS or recorded by the user."
    },
    scene_voice_recording: {
      type: "asset",
      label: "Voice Recording",
      category: "audio",
      scope: "scene",
      description: "Path to the user-recorded audio file.",
      showIf: { scene_voice_source: "recording" }
    },
    scene_image_model: {
      type: "select",
      label: "Scene Image Model",
      category: "layer_core",
      scope: "scene",
      options_key: "forge_models",
      default: "replicate/flux-schnell",
      description: "Default AI model for image generation in this scene.",
      showIf: { scene_video_source: "ai" }
    },
    scene_video_model: {
      type: "select",
      label: "Scene Video Model",
      category: "layer_core",
      scope: "scene",
      options_key: "forge_models",
      default: "replicate/wan-t2v",
      description: "Default AI model for video generation in this scene.",
      showIf: { scene_video_source: "ai" }
    },
    scene_video_source: {
      type: "select",
      label: "Video Source",
      category: "visual",
      scope: "scene",
      default: "ai",
      options: [
        { value: "ai", label: "AI Generated" },
        { value: "recording", label: "User Recording" }
      ],
      description: "Determines if the scene visual is generated via AI or recorded by the user."
    },
    scene_video_recording: {
      type: "asset",
      label: "Video Recording",
      category: "visual",
      scope: "scene",
      description: "Path to the user-recorded video file.",
      showIf: { scene_video_source: "recording" }
    },
    scene_voice_volume: {
      type: "number",
      label: "Voice Volume",
      category: "audio",
      scope: "scene",
      default: 1,
      ui: { min: 0, max: 1, step: 0.1 }
    },
    scene_background_audio: {
      type: "asset",
      label: "Background Music",
      category: "audio",
      scope: "scene",
      description: "Path or URL to background music."
    },
    scene_background_audio_volume: {
      type: "number",
      label: "BG Music Volume",
      category: "audio",
      scope: "scene",
      default: 0.3,
      ui: { min: 0, max: 1, step: 0.1 }
    },
    scene_duration_mode: {
      type: "select",
      label: "Duration Mode",
      category: "config",
      scope: "scene",
      default: "auto_voice",
      options: [
        { value: "auto_voice", label: "Automatic (Voice Based)" },
        { value: "auto_media", label: "Automatic (Media Based)" },
        { value: "custom", label: "Manual / Custom" }
      ],
      description: "How the scene duration is calculated."
    },
    scene_video_recording: {
      type: "asset",
      label: "Video Recording",
      category: "visual",
      scope: "scene",
      description: "Path to the user-recorded video file.",
      showIf: { scene_video_source: "recording" }
    },
    scene_duration: {
      type: "number",
      label: "Scene Duration",
      category: "timing",
      scope: "scene",
      default: 10,
      description: "The length of the scene in seconds.",
      showIf: { scene_video_source: "ai" }
    },
    scene_background_color: {
      type: "color",
      label: "Background Color",
      category: "config",
      scope: "scene",
      default: "#000000",
      description: "Solid background color rendered behind all layers."
    },
    scene_effects: {
      type: "multiselect",
      label: "Scene Visual Effects",
      category: "style_effects",
      scope: "scene",
      options: [
        { value: "none", label: "None" },
        { value: "zoom_in", label: "Zoom In" },
        { value: "zoom_out", label: "Zoom Out" },
        { value: "pan_left", label: "Pan Left" },
        { value: "pan_right", label: "Pan Right" },
        { value: "tilt_up", label: "Tilt Up" },
        { value: "tilt_down", label: "Tilt Down" },
        { value: "ken_burns", label: "Ken Burns" },
        { value: "handheld", label: "Handheld" },
        { value: "breathing", label: "Breathing" },
        { value: "grayscale", label: "Grayscale" }
      ],
      description: "Cinematic effects applied to the entire scene or its primary background."
    },
    scene_effect_speed: {
      type: "select",
      label: "Scene Effect Speed",
      category: "style_effects",
      scope: "scene",
      default: 1,
      options_key: "speeds",
      description: "Multiplier for the animation speed of the scene effects."
    },
    scene_visual_style: {
      type: "string",
      label: "Scene Visual Style",
      category: "style_effects",
      scope: "scene",
      ui: { widget: "select", options_key: "visual_styles" },
      description: "Style key (e.g., 'photo', 'doodle') referencing a visual style defined in assets/_instructions.md."
    },
    scene_narrative_style: {
      type: "string",
      label: "Scene Narrative Style",
      category: "style_effects",
      scope: "scene",
      ui: { widget: "select", options_key: "narrative_styles" },
      description: "Style key (e.g., 'energetic', 'calm') referencing a narrative style defined in assets/_instructions.md."
    },
    scene_sources: {
      type: "array",
      label: "Scene Sources / Citations",
      category: "asset_metadata",
      scope: "scene",
      description: "List of citekeys or URLs corresponding to entries in the global repository or external links backing the scene narration."
    },
    layer_name: {
      type: "string",
      label: "Layer Name",
      category: "layer_core",
      scope: "layer",
      default: "New Layer",
      description: "Friendly name for identifying this layer."
    },
    layer_active: {
      type: "boolean",
      label: "Active",
      category: "layer_core",
      scope: "layer",
      default: true,
      description: "If false, the layer is completely ignored by the engine and UI. Use to suppress template-provided layers.",
      ui: { hiddenInInspector: true }
    },
    layer_level: {
      type: "number",
      label: "Level",
      category: "layer_core",
      scope: "layer",
      default: 10,
      description: "Determines stacking order."
    },
    layer_type: {
      type: "select",
      label: "Asset Type",
      category: "layer_core",
      scope: "layer",
      options_key: "asset_types",
      default: "image",
      description: "Computational type of the asset in this layer.",
      ui: { hiddenInInspector: true }
    },
    layer_fit_mode: {
      type: "select",
      label: "Fit Mode / Layout",
      category: "layer_core",
      scope: "layer",
      default: "smart_blur",
      options: [
        { value: "fill", label: "Fill" },
        { value: "cover", label: "Cover" },
        { value: "fit", label: "Fit" },
        { value: "contain", label: "Contain" },
        { value: "smart_blur", label: "Smart Blur" },
        { value: "stretch", label: "Stretch" }
      ],
      description: "How the asset fills its layer container.",
      depends_on: { layer_type: { op: "not_in", value: ["audio", "text"] } }
    },
    layer_avatar_model: {
      type: "select",
      label: "Avatar Model",
      category: "avatar",
      scope: "layer",
      options_key: "avatar_models",
      default: "replicate/wan-2.1-s2v",
      depends_on: { layer_type: "talking_avatar" }
    },
    layer_text_content: {
      type: "string",
      label: "Text Content",
      category: "layer_core",
      scope: "layer",
      description: "The text to be displayed.",
      depends_on: { layer_type: "text" }
    },
    layer_text_style: {
      type: "string",
      label: "Text Style / Prompt",
      category: "style_effects",
      scope: "layer",
      description: "Visual style for the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_rendering_method: {
      type: "select",
      label: "Text Rendering Method",
      category: "style_effects",
      scope: "layer",
      default: "static",
      options: [
        { value: "static", label: "Static / Burn-in" },
        { value: "dynamic", label: "Dynamic / Overlay" },
        { value: "ai_embedded", label: "AI Embedded (Forge)" }
      ],
      description: "The technology used to render text on this layer.",
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: "text" }
    },
    layer_text_align_horizontal: {
      type: "select",
      label: "Horizontal Alignment",
      category: "style_effects",
      scope: "layer",
      default: "center",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" }
      ],
      description: "Horizontal alignment of the text within its container.",
      depends_on: { layer_type: "text" }
    },
    layer_text_align_vertical: {
      type: "select",
      label: "Vertical Alignment",
      category: "style_effects",
      scope: "layer",
      default: "middle",
      options: [
        { value: "top", label: "Top" },
        { value: "middle", label: "Middle" },
        { value: "bottom", label: "Bottom" }
      ],
      description: "Vertical alignment of the text within its container.",
      depends_on: { layer_type: "text" }
    },
    layer_text_font: {
      type: "string",
      label: "Font Family",
      category: "style_effects",
      scope: "layer",
      default: "Inter",
      description: "The font family to use for the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_size: {
      type: "number",
      label: "Font Size",
      category: "style_effects",
      scope: "layer",
      default: 40,
      ui: { min: 8, max: 200, step: 1 },
      description: "The size of the text in pixels (or relative units).",
      depends_on: { layer_type: "text" }
    },
    layer_text_color: {
      type: "string",
      label: "Text Color",
      category: "style_effects",
      scope: "layer",
      default: "#ffffff",
      ui: { widget: "color" },
      description: "The color of the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_box: {
      type: "boolean",
      label: "Show Background Box",
      category: "style_effects",
      scope: "layer",
      default: false,
      description: "Whether to show a background box behind the text.",
      depends_on: { layer_type: "text" }
    },
    layer_text_box_color: {
      type: "string",
      label: "Box Color",
      category: "style_effects",
      scope: "layer",
      default: "#000000",
      ui: { widget: "color" },
      description: "The color of the background box.",
      depends_on: { layer_text_box: true }
    },
    layer_text_box_opacity: {
      type: "number",
      label: "Box Opacity",
      category: "style_effects",
      scope: "layer",
      default: 0.7,
      ui: { min: 0, max: 1, step: 0.1 },
      description: "The opacity of the background box.",
      depends_on: { layer_text_box: true }
    },
    layer_asset_source: {
      type: "asset",
      label: "Asset Source",
      category: "layer_core",
      scope: "layer",
      description: "URL or local path to the image/video asset.",
      ui: { widget: "asset_picker" },
      depends_on: { layer_type: { op: "not_in", value: ["text", "ai_image", "ai_video"] } }
    },
    layer_visual_style: {
      type: "string",
      label: "Generation / Style Preset",
      category: "layer_core",
      scope: "layer",
      ui: { widget: "select", options_key: "visual_styles" },
      description: "Style key (e.g., 'photo', 'doodle') referencing a visual style defined in assets/_instructions.md.",
      depends_on: { layer_type: "ai_image" }
    },
    layer_narrative_style: {
      type: "string",
      label: "Layer Narrative Style",
      category: "style_effects",
      scope: "layer",
      ui: { widget: "select", options_key: "narrative_styles" },
      description: "Style key referencing a narrative style defined in assets/_instructions.md.",
      depends_on: { layer_type: { op: "in", value: ["talking_avatar", "audio"] } }
    },
    layer_crop: {
      type: "string",
      label: "Crop / Mask",
      category: "style_effects",
      scope: "layer",
      default: "none",
      description: "Applies a visual crop or mask to the layer (e.g., 'circle', 'rounded').",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_top: {
      type: "number",
      label: "Crop Top",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the top of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_right: {
      type: "number",
      label: "Crop Right",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the right of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_bottom: {
      type: "number",
      label: "Crop Bottom",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the bottom of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_crop_left: {
      type: "number",
      label: "Crop Left",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 100, step: 0.5, widget: "slider", unit: "%" },
      description: "Percentage to crop from the left of the layer asset.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_generation_subject: {
      type: "string",
      label: "Generation / Search Context",
      category: "layer_core",
      scope: "layer",
      ui: { widget: "textarea" },
      depends_on: { layer_type: "ai_image" }
    },
    layer_generation_strength: {
      type: "number",
      label: "Transformation Strength",
      category: "layer_core",
      scope: "layer",
      default: 5,
      ui: { min: 1, max: 10, step: 1 },
      description: "Intensity of the AI transformation (1-10). Higher values deviate more from the source."
    },
    layer_generation_embedded_text: {
      type: "string",
      label: "Embedded Text Prompt",
      category: "layer_core",
      scope: "layer",
      description: "Text to be visually embedded into AI-generated media (e.g. signs, shirts).",
      depends_on: { layer_type: { op: "in", value: ["text_in_image", "ai_image"] } }
    },
    layer_generation_embedded_text_style: {
      type: "string",
      label: "Embedded Text Style",
      category: "layer_core",
      scope: "layer",
      description: "Visual style prompt for the embedded text (e.g. 'neon green script').",
      depends_on: { layer_type: { op: "in", value: ["text_in_image", "ai_image"] } }
    },
    layer_generation_model: {
      type: "select",
      label: "Generation Model",
      category: "layer_core",
      scope: "layer",
      options_key: "forge_models",
      ui: { widget: "model_picker" },
      depends_on: { layer_type: { op: "in", value: ["ai_image", "ai_video", "text_in_image"] } }
    },
    layer_opacity: {
      type: "number",
      label: "Opacity",
      category: "style_effects",
      scope: "layer",
      default: 1,
      ui: { min: 0, max: 1, step: 0.1, hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_scale: {
      type: "number",
      label: "Scale",
      category: "layer_core",
      scope: "layer",
      default: 1,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_rotation: {
      type: "number",
      label: "Rotation (Degrees)",
      category: "style_effects",
      scope: "layer",
      default: 0,
      ui: { min: 0, max: 360, step: 1, hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_volume: {
      type: "number",
      label: "Audio Volume",
      category: "audio",
      scope: "layer",
      default: 1,
      ui: { min: 0, max: 1, step: 0.1 },
      depends_on: { layer_type: { op: "in", value: ["audio", "video"] } }
    },
    layer_effects: {
      type: "multiselect",
      label: "Visual Effects",
      category: "style_effects",
      scope: "layer",
      options: [
        { value: "none", label: "None" },
        { value: "zoom_in", label: "Zoom In" },
        { value: "zoom_out", label: "Zoom Out" },
        { value: "pan_left", label: "Pan Left" },
        { value: "pan_right", label: "Pan Right" },
        { value: "tilt_up", label: "Tilt Up" },
        { value: "tilt_down", label: "Tilt Down" },
        { value: "ken_burns", label: "Ken Burns" },
        { value: "handheld", label: "Handheld" },
        { value: "breathing", label: "Breathing" },
        { value: "grayscale", label: "Grayscale" }
      ],
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_effect_speed: {
      type: "select",
      label: "Effect Speed",
      category: "style_effects",
      scope: "layer",
      default: 1,
      options_key: "speeds",
      description: "Multiplier for the animation speed of the layer effects.",
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_x: {
      type: "number",
      label: "X Position",
      category: "layer_core",
      scope: "layer",
      default: 0,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_y: {
      type: "number",
      label: "Y Position",
      category: "layer_core",
      scope: "layer",
      default: 0,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_width: {
      type: "number",
      label: "Width",
      category: "layer_core",
      scope: "layer",
      default: 100,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_height: {
      type: "number",
      label: "Height",
      category: "layer_core",
      scope: "layer",
      default: 100,
      ui: { hiddenInInspector: true },
      depends_on: { layer_type: { op: "neq", value: "audio" } }
    },
    layer_asset_is_ai: {
      type: "boolean",
      label: "AI Generated",
      category: "asset_metadata",
      scope: "layer",
      default: false,
      description: "Flag indicating if the asset was generated using AI.",
      hidden: true,
      ui: { hiddenInInspector: true }
    },
    layer_asset_raw_url: {
      type: "string",
      label: "Raw URL",
      category: "asset_metadata",
      scope: "layer",
      description: "The original source URL before processing or local storage.",
      ui: { hiddenInInspector: true }
    },
    layer_asset_author: {
      type: "string",
      label: "Asset Author",
      category: "asset_metadata",
      scope: "layer",
      description: "The creator or owner of the asset."
    },
    layer_asset_license: {
      type: "string",
      label: "Asset License",
      category: "asset_metadata",
      scope: "layer",
      description: "Licensing information for the asset."
    },
    layer_asset_source_service: {
      type: "string",
      label: "Source Service",
      category: "asset_metadata",
      scope: "layer",
      description: "The service or platform where the asset was obtained (e.g., Replicate, Pexels)."
    },
    layer_asset_citation_key: {
      type: "string",
      label: "Citation Key",
      category: "asset_metadata",
      scope: "layer",
      description: "Reference key (citekey) pointing to an entry in the project's global video_sources repository."
    },
    layer_asset_access_date: {
      type: "string",
      label: "Access Date",
      category: "asset_metadata",
      scope: "layer",
      description: "The date and timestamp when the asset was accessed or downloaded."
    }
  },
  model_manifest_schema: {
    description: "Required shape for model manifest files in model_registry/. Each JSON file defines one AI model.",
    required: ["id", "type", "display_name", "provider"],
    properties: {
      id: { type: "string", description: "Unique model identifier, e.g. heygen_v2" },
      type: { type: "string", enum: ["tts", "avatar", "image", "video", "lipsync"], description: "Model category" },
      display_name: { type: "string", description: "Human-readable name shown in the UI" },
      provider: { type: "string", description: "API provider name, e.g. heygen, elevenlabs" },
      api_model_id: { type: "string", description: "The exact model ID string sent to the API" },
      description: { type: "string" },
      parameters: {
        type: "array",
        description: "Property definitions for this model's parameters, following the VUS property schema shape",
        items: {
          required: ["key", "type", "label"],
          properties: {
            key: { type: "string" },
            type: { type: "string" },
            label: { type: "string" },
            default: {},
            description: { type: "string" },
            options: { type: "array" },
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number" },
            required: { type: "boolean" }
          }
        }
      }
    }
  },
  property_set_schema: {
    description: "Shape of a named property set in the project data. Sets are reusable bundles of property values that templates can include.",
    required: ["name", "properties"],
    properties: {
      name: { type: "string", description: "Unique name for this set within the project" },
      description: { type: "string" },
      properties: { type: "object", description: "Key-value property values in this set" }
    }
  }
};

// iNNfo/packages/innfo-video-parser/src/rules/index.ts
var vusTyped = V_0_3_3_default2;
var rules = {
  title: "VUS Master Rules",
  description: vusTyped.info.description,
  type: "object",
  render: vusTyped.api_options.render,
  system: {
    version: vusTyped.info.version,
    name: vusTyped.info.name,
    description: vusTyped.info.description,
    hierarchy: ["video", "section", "template", "scene", "layer"],
    categories: vusTyped.categories,
    api_options: vusTyped.api_options,
    speeds: vusTyped.api_options.speeds
  },
  properties: vusTyped.properties
};
var rules_default = rules;

// iNNfo/packages/innfo-video-parser/src/parser/validation/utils.ts
function getFlatDefinitions(allProps) {
  return { ...allProps };
}

// iNNfo/packages/innfo-video-parser/src/version.ts
var version = "V_0-3-3";

// iNNfo/packages/innfo-video-parser/src/parser/validation/rules/UnknownPropertyRule.ts
var UnknownPropertyRule = class {
  name = "UnknownPropertyRule";
  description = "Checks for unknown, non-canonical, or out-of-scope properties (VUS compliant)";
  _flatDefMap;
  constructor() {
    const allProps = rules_default.properties;
    this._flatDefMap = getFlatDefinitions(allProps);
  }
  validate(_project, _issues) {
    return false;
  }
  /**
   * @spec-source:V_0-3-3 | logic: scene_scope_enforcement
   */
  validateScene(scene, _project, sIdx, idx, issues) {
    let hasErrors = false;
    const props = scene.properties || {};
    const pathStr = `section[${sIdx}].scene[${idx}]`;
    const content = scene.scene_content || scene.properties?.scene_content;
    if (content && /^\s*#+/m.test(content)) {
      issues.push({
        severity: "error",
        line: scene.startLine || 1,
        path: pathStr,
        context: `Scene: ${scene.scene_name || "Untitled"}`,
        message: `Invalid Content: Markdown headers (#) are prohibited in narration.`,
        details: `Narration must be plain text for TTS compatibility. Headers are reserved for structural markers (Sections, Scenes, Comments).`
      });
      hasErrors = true;
    }
    Object.keys(props).forEach((prop) => {
      if ([
        "block_type",
        "scene_templates",
        "scene_name",
        "id",
        "startLine",
        "scene_tts_model",
        "scene_content"
      ].includes(prop))
        return;
      if (prop.startsWith("var_") || prop.startsWith("vugen_")) return;
      if (prop.includes("/")) return;
      const def = this._flatDefMap[prop];
      if (!def) {
        console.error(
          `[UnknownPropertyRule] ERROR: Property '${prop}' not found in map for scene '${scene.scene_name}'.`
        );
        issues.push({
          severity: "error",
          line: scene.startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || "Untitled"}`,
          message: `Unknown or non-canonical property '${prop}'.`,
          details: `VUS ${version} (VUS) requires strictly scoped keys (e.g., 'scene_voice'). For custom variables, use the 'var_' prefix.`
        });
        hasErrors = true;
      } else if (def.scope && def.scope !== "scene" && def.scope !== "common") {
        const isInheritedDefault = def.scope === "layer" || def.scope === "video";
        issues.push({
          severity: isInheritedDefault ? "warning" : "error",
          line: scene.startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || "Untitled"}`,
          message: isInheritedDefault ? `Scope Hint: Property '${prop}' is ${def.scope}-scoped but set at scene level (valid as inherited default/global block).` : `Scope Mismatch: Property '${prop}' is scoped to '${def.scope}' but was used in a Scene.`,
          details: isInheritedDefault ? `This is valid: the HierarchyResolver will treat this as a default for this scope.` : `Ensure properties are used in their correct block (Scene vs Layer).`
        });
        if (!isInheritedDefault) hasErrors = true;
      }
    });
    return hasErrors;
  }
  /**
   * @spec-source:V_0-3-3 | logic: layer_scope_enforcement
   */
  validateLayer(layer, scene, _project, sIdx, idx, lIdx, issues) {
    let hasErrors = false;
    const props = layer.properties || {};
    const pathStr = `section[${sIdx}].scene[${idx}].layer[${lIdx}]`;
    Object.keys(props).forEach((prop) => {
      if (["block_type", "layer_name", "layer_level", "id", "startLine"].includes(prop)) return;
      if (prop.startsWith("var_") || prop.startsWith("layer_var_")) return;
      if (prop.includes("/")) return;
      const def = this._flatDefMap[prop];
      if (!def) {
        issues.push({
          severity: "error",
          line: layer.startLine || scene.startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || "Untitled"} > Layer: ${layer.layer_name || "Untitled"}`,
          message: `Unknown or non-canonical layer property '${prop}'.`,
          details: `VUS ${version} (VUS) requires strictly scoped keys (e.g., 'layer_type'). For custom variables, use the 'var_' prefix.`
        });
        hasErrors = true;
      } else if (def.scope && def.scope !== "layer" && def.scope !== "common") {
        issues.push({
          severity: "error",
          line: layer.startLine || scene.startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || "Untitled"} > Layer: ${layer.layer_name || "Untitled"}`,
          message: `Scope Mismatch: Property '${prop}' is scoped to '${def.scope}' but was used in a Layer.`,
          details: `Ensure properties are used in their correct block (Scene vs Layer).`
        });
        hasErrors = true;
      }
    });
    return hasErrors;
  }
};

// iNNfo/packages/innfo-video-parser/src/utils/PropertyResolution.ts
var PropertyResolution = class {
  /**
   * Resolves the effective value for a scene property, considering inheritance.
   */
  static getEffectiveSceneProperty(key, scene, project) {
    if (scene.finalProperties && scene.finalProperties[key] !== void 0 && scene.finalProperties[key] !== null && scene.finalProperties[key] !== "") {
      return scene.finalProperties[key];
    }
    return this.cascadeSceneProperty(key, scene, project);
  }
  /**
   * Raw cascade lookup without requiring prior resolution.
   * Used by validation rules that run before ConfigResolver.resolve().
   */
  static cascadeSceneProperty(key, scene, project) {
    if (scene.properties?.[key] !== void 0 && scene.properties[key] !== null && scene.properties[key] !== "") {
      return scene.properties[key];
    }
    const sceneRecord = scene;
    if (sceneRecord[key] !== void 0 && sceneRecord[key] !== null && sceneRecord[key] !== "" && key !== "properties") {
      return sceneRecord[key];
    }
    const templateList = scene.scene_templates || [];
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tpl = project.templates[templateList[i]];
        if (tpl) {
          const tplVal = tpl[key] !== void 0 ? tpl[key] : tpl.properties?.[key];
          if (tplVal !== void 0 && tplVal !== null && tplVal !== "") return tplVal;
        }
      }
    }
    if (project.config?.[key] !== void 0 && project.config[key] !== null && project.config[key] !== "") {
      return project.config[key];
    }
    return void 0;
  }
  /**
   * Resolves the effective value for a layer property, considering inheritance.
   */
  static getEffectiveLayerProperty(key, layer, scene, project) {
    const layerProps = layer.properties || {};
    if (layerProps[key] !== void 0 && layerProps[key] !== null && layerProps[key] !== "")
      return layerProps[key];
    const layerRecord = layer;
    if (layerRecord[key] !== void 0 && layerRecord[key] !== null && layerRecord[key] !== "" && key !== "properties")
      return layerRecord[key];
    const templateList = scene.scene_templates || [];
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tplName = templateList[i];
        const tpl = project.templates[tplName];
        if (tpl && tpl.layers) {
          const tplLayer = tpl.layers.find((l) => l.layer_name === layer.layer_name);
          if (tplLayer) {
            const tplLayerProps = tplLayer.properties || {};
            const tplLayerRecord = tplLayer;
            const val = tplLayerProps[key] !== void 0 ? tplLayerProps[key] : tplLayerRecord[key];
            if (val !== void 0 && val !== null && val !== "") return val;
          }
        }
      }
    }
    const sceneVal = this.getEffectiveSceneProperty(key, scene, project);
    if (sceneVal !== void 0) return sceneVal;
    return void 0;
  }
};

// iNNfo/packages/innfo-video-parser/src/parser/validation/rules/MandatorySchemaRule.ts
var MandatorySchemaRule = class {
  name = "MandatorySchemaRule";
  description = `Checks for mandatory project and property requirements as defined in VUS ${version}`;
  _allProps = null;
  _ensureRules() {
    if (!this._allProps) {
      this._allProps = rules_default.properties || rules_default;
    }
  }
  validate(project, issues) {
    return false;
  }
  validateScene(scene, project, sIdx, idx, issues) {
    let hasErrors = false;
    const pathStr = `section[${sIdx}].scene[${idx}]`;
    this._ensureRules();
    const props = this._allProps;
    const sceneWithBlockType = scene;
    Object.entries(props).forEach(([key, def]) => {
      if (def.required && def.scope === "scene") {
        if (sceneWithBlockType.block_type === "template") return;
        const val = PropertyResolution.getEffectiveSceneProperty(key, scene, project);
        const isEmpty = val === void 0 || val === null || val === "" || val === "none";
        if (isEmpty) {
          issues.push({
            severity: "warning",
            line: scene.startLine ?? 1,
            path: pathStr,
            context: `Scene: ${scene.scene_name || "Untitled"}`,
            message: `Required field '${def.label || key}' is missing.`,
            details: def.description || "This field is mandatory for the scene structure."
          });
          hasErrors = true;
        }
      }
    });
    const currentModel = PropertyResolution.getEffectiveSceneProperty(
      "scene_tts_model",
      scene,
      project
    );
    const layers = scene.layers || [];
    const hasTalkingAvatar = layers.some((l) => l.layer_type === "talking_avatar");
    if (hasTalkingAvatar && (!currentModel || currentModel === "none" || currentModel === "unset" || currentModel === "automatic")) {
    }
    return hasErrors;
  }
  validateLayer(layer, scene, project, sIdx, idx, lIdx, issues) {
    let hasErrors = false;
    const layerPath = `section[${sIdx}].scene[${idx}].layer[${lIdx}]`;
    this._ensureRules();
    const props = this._allProps;
    Object.entries(props).forEach(([key, def]) => {
      if (def.required && def.scope === "layer") {
        const depends_on = def.depends_on;
        let shouldCheck = true;
        if (depends_on && typeof depends_on === "object") {
          shouldCheck = Object.entries(depends_on).every(([k, v]) => {
            const currentVal = PropertyResolution.getEffectiveLayerProperty(
              k,
              layer,
              scene,
              project
            );
            return currentVal === v;
          });
        }
        if (shouldCheck) {
          const val = PropertyResolution.getEffectiveLayerProperty(key, layer, scene, project);
          const isEmpty = val === void 0 || val === null || val === "";
          if (isEmpty) {
            issues.push({
              severity: "error",
              line: layer.startLine ?? scene.startLine ?? 1,
              path: layerPath,
              context: `Scene: ${scene.scene_name || "Untitled"} > Layer: ${layer.layer_name || "Untitled"}`,
              message: `Required field '${def.label || key}' is missing.`,
              details: def.description || "Mandatory layer property is missing."
            });
            hasErrors = true;
          }
        }
      }
    });
    return hasErrors;
  }
};

// iNNfo/packages/innfo-video-parser/src/parser/validation/rules/EnumValidationRule.ts
var EnumValidationRule = class {
  name = "EnumValidationRule";
  description = "Checks for valid values in select/enum properties (v0.6.0 compliant)";
  _flatDefMap = null;
  _apiOptions = null;
  _ensureRules() {
    if (!this._flatDefMap) {
      const allProps = rules_default.properties || rules_default;
      this._flatDefMap = getFlatDefinitions(allProps);
      this._apiOptions = rules_default.system?.api_options || {};
    }
  }
  validate(_project, _issues) {
    return false;
  }
  validateScene(scene, _project, sIdx, idx, issues) {
    this._ensureRules();
    let hasErrors = false;
    const props = scene.properties || {};
    const pathStr = `section[${sIdx}].scene[${idx}]`;
    Object.entries(props).forEach(([propKey, propVal]) => {
      const isInvalid = this._checkEnum(
        propVal,
        propKey,
        issues,
        pathStr,
        `Scene: ${scene.scene_name || "Untitled"}`,
        scene.startLine || 1
      );
      if (isInvalid) hasErrors = true;
    });
    return hasErrors;
  }
  validateLayer(layer, scene, _project, sIdx, idx, lIdx, issues) {
    this._ensureRules();
    let hasErrors = false;
    const layerPath = `section[${sIdx}].scene[${idx}].layer[${lIdx}]`;
    const layerProps = layer.properties || {};
    Object.entries(layerProps).forEach(([propKey, propVal]) => {
      const isInvalid = this._checkEnum(
        propVal,
        propKey,
        issues,
        layerPath,
        `Scene: ${scene.scene_name || "Untitled"} > Layer: ${layer.layer_name || "Untitled"}`,
        layer.startLine || scene.startLine || 1
      );
      if (isInvalid) hasErrors = true;
    });
    return hasErrors;
  }
  _checkEnum(val, defKey, issues, pathStr, contextName, line) {
    if (val === void 0 || val === null || val === "none" || val === "auto" || val === "")
      return false;
    const def = this._flatDefMap[defKey];
    if (!def || def.type !== "select") return false;
    let knownOptions = [];
    if (def.options) knownOptions = [...def.options];
    if (def.options_key && this._apiOptions[def.options_key]) {
      const dynamic = this._apiOptions[def.options_key] || [];
      knownOptions = [...knownOptions, ...dynamic];
    }
    if (knownOptions.length > 0) {
      const strVal = String(val).trim().toLowerCase();
      const isValid2 = knownOptions.some((opt) => {
        if (typeof opt === "string") return opt.trim().toLowerCase() === strVal;
        const optVal = String(opt.value || opt.id || "").trim().toLowerCase();
        const optLabel = String(opt.label || "").trim().toLowerCase();
        if (optVal === strVal || optLabel === strVal) return true;
        const numVal = parseFloat(strVal);
        const optNumVal = parseFloat(optVal);
        if (!isNaN(numVal) && !isNaN(optNumVal) && numVal === optNumVal) return true;
        return false;
      });
      if (!isValid2) {
        const possibleMatches = knownOptions.map((opt) => typeof opt === "string" ? opt : opt.label || opt.value || opt.id).join(", ");
        issues.push({
          severity: "error",
          line,
          path: pathStr,
          context: contextName,
          message: `Invalid value '${val}' for property '${def.label || defKey}'.`,
          details: `Allowed options: ${possibleMatches}`
        });
        return true;
      }
    }
    return false;
  }
};

// iNNfo/packages/innfo-video-parser/src/parser/validation/rules/AssetSourceRule.ts
var AssetSourceRule = class {
  name = "AssetSourceRule";
  description = "Validates that visual layers have a primary asset source defined via Markdown syntax.";
  validate(_project, _issues) {
    return false;
  }
  validateLayer(layer, scene, project, sIdx, scIdx, lIdx, issues) {
    let hasErrors = false;
    const layerType = this._getEffectiveLayerProperty("layer_type", layer, scene, project);
    const isAudio = layerType === "audio";
    const isVideo = layerType === "video";
    const isImage = layerType === "image";
    const assetSource = this._getEffectiveLayerProperty("layer_asset_source", layer, scene, project);
    if ((isAudio || isVideo || isImage) && !assetSource) {
      issues.push({
        severity: "warning",
        line: layer.startLine || 1,
        path: `section[${sIdx}].scene[${scIdx}].layer[${lIdx}]`,
        context: `Scene: ${scene.scene_name || "Untitled"} > Layer: ${layer.layer_name || "Untitled"}`,
        message: `Layer type '${layerType || "image"}' requires an asset source.`,
        details: `Specify the asset using Markdown syntax: ![media](path/to/asset) in the layer block.`
      });
      hasErrors = true;
    }
    const metadata = layer.propertyMetadata?.layer_asset_source;
    if (layer.layer_asset_source && (!metadata || !metadata.isPrimigenia)) {
    }
    return hasErrors;
  }
  _getEffectiveLayerProperty(key, layer, scene, project) {
    const layerProps = layer.properties || {};
    if (layerProps[key] !== void 0 && layerProps[key] !== null && layerProps[key] !== "")
      return layerProps[key];
    if (layer[key] !== void 0 && layer[key] !== null && layer[key] !== "" && key !== "properties")
      return layer[key];
    const templateList = scene.scene_templates || [];
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tplName = templateList[i];
        const tpl = project.templates[tplName];
        if (tpl && tpl.layers) {
          const tplLayer = tpl.layers.find((l) => l.layer_name === layer.layer_name);
          if (tplLayer) {
            const tplLayerProps = tplLayer.properties || {};
            const val = tplLayerProps[key] !== void 0 ? tplLayerProps[key] : tplLayer[key];
            if (val !== void 0 && val !== null && val !== "") return val;
          }
        }
      }
    }
    const sceneProps = scene.properties || {};
    if (sceneProps[key] !== void 0 && sceneProps[key] !== null && sceneProps[key] !== "")
      return sceneProps[key];
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tplName = templateList[i];
        const tpl = project.templates[tplName];
        if (tpl) {
          const tplProps = tpl.properties || {};
          const val = tplProps[key] !== void 0 ? tplProps[key] : tpl[key];
          if (val !== void 0 && val !== null && val !== "") return val;
        }
      }
    }
    if (project.config && project.config[key] !== void 0 && project.config[key] !== null && project.config[key] !== "") {
      return project.config[key];
    }
    return void 0;
  }
};

// iNNfo/packages/innfo-video-parser/src/parser/validation/rules/CitationVerificationRule.ts
var CitationVerificationRule = class {
  name = "CitationVerificationRule";
  description = "Verifies that all referenced citekeys in scenes and layers resolve against video_sources.";
  validate(project, _issues) {
    return false;
  }
  validateScene(scene, project, sIdx, idx, issues) {
    let hasErrors = false;
    const sources = (scene.scene_sources || []).filter(Boolean);
    const globalSources = project.video_sources || {};
    sources.forEach((source) => {
      const isHttp = String(source).startsWith("http://") || String(source).startsWith("https://");
      if (!isHttp && !globalSources[source]) {
        issues.push({
          severity: "error",
          code: "ORPHANED_CITATION",
          line: scene.startLine || 1,
          path: `section[${sIdx}].scene[${idx}].scene_sources`,
          context: `Scene: ${scene.scene_name || "Untitled"}`,
          message: `Citation key '${source}' is not defined in global video_sources repository.`,
          details: `All non-URL citations must be registered in the project's 'video_sources' block.`
        });
        hasErrors = true;
      }
    });
    return hasErrors;
  }
  validateLayer(layer, scene, project, sIdx, idx, lIdx, issues) {
    let hasErrors = false;
    const citekey = layer.layer_asset_citation_key || layer.properties?.layer_asset_citation_key;
    const globalSources = project.video_sources || {};
    if (citekey && !globalSources[citekey]) {
      issues.push({
        severity: "error",
        code: "ORPHANED_CITATION",
        line: layer.startLine || scene.startLine || 1,
        path: `section[${sIdx}].scene[${idx}].layer[${lIdx}].layer_asset_citation_key`,
        context: `Layer: ${layer.layer_name || "Untitled"}`,
        message: `Citation key '${citekey}' is not defined in global video_sources repository.`,
        details: `All layer asset citation keys must be registered in the project's 'video_sources' block.`
      });
      hasErrors = true;
    }
    return hasErrors;
  }
};

// iNNfo/packages/innfo-video-parser/src/parser/SemanticValidator.ts
var SemanticValidator = class {
  static builtinRules = [
    new MandatorySchemaRule(),
    new UnknownPropertyRule(),
    new EnumValidationRule(),
    new AssetSourceRule(),
    new CitationVerificationRule()
  ];
  static pluginRules = [];
  /**
   * Registers a new validation rule (usually from a plugin).
   */
  static registerRule(rule) {
    this.pluginRules.push(rule);
  }
  /**
   * Clears all registered plugin rules.
   */
  static clearPluginRules() {
    this.pluginRules = [];
  }
  static get rules() {
    return [...this.builtinRules, ...this.pluginRules];
  }
  /**
   * Performs strict semantic validation on the project structure to catch logic mapping errors.
   * Compliant with VUS v0.6.0.
   *
   * @spec-impact V_0-1-1 | scope: scene,layer
   */
  static validate(project, issues, styleDictionary) {
    let hasErrors = false;
    this.rules.forEach((rule) => {
      if (rule.validate(project, issues)) hasErrors = true;
    });
    if (!project.sections) return hasErrors;
    project.sections.forEach((section, sIdx) => {
      section.scenes?.forEach((item, idx) => {
        if (item.block_type === "note") return;
        const scene = item;
        this.rules.forEach((rule) => {
          const sceneRule = rule;
          if (sceneRule.validateScene) {
            if (sceneRule.validateScene(scene, project, sIdx, idx, issues)) hasErrors = true;
          }
        });
        scene.layers?.forEach((layer, lIdx) => {
          this.rules.forEach((rule) => {
            const layerRule = rule;
            if (layerRule.validateLayer) {
              if (layerRule.validateLayer(layer, scene, project, sIdx, idx, lIdx, issues))
                hasErrors = true;
            }
          });
        });
      });
    });
    if (this._validateVisuals(project, issues)) hasErrors = true;
    if (this._validateStyles(project, issues, styleDictionary)) hasErrors = true;
    return hasErrors;
  }
  static _validateVisuals(project, issues) {
    const hasErrors = false;
    project.sections.forEach((section, sIdx) => {
      section.scenes?.forEach((item, idx) => {
        if (item.block_type === "note") return;
        const scene = item;
        const props = scene.finalProperties || scene.properties || {};
        const hasLayers = scene.layers && scene.layers.length > 0 || scene.scene_templates && scene.scene_templates.length > 0;
        if (!hasLayers) {
          issues.push({
            severity: "pending",
            line: scene.startLine || 1,
            path: `section[${sIdx}].scene[${idx}]`,
            context: `Scene: ${scene.scene_name || "Untitled"}`,
            message: `Scene '${scene.scene_name}' has no visual layers.`,
            details: `VUS V_0-1-1 requires all visual content to be defined at the layer level (@@ notation).`
          });
        }
      });
    });
    return hasErrors;
  }
  static _validateStyles(project, issues, styleDictionary) {
    if (!styleDictionary) return false;
    let hasErrors = false;
    project.sections.forEach((section, sIdx) => {
      section.scenes?.forEach((item, idx) => {
        if (item.block_type === "note") return;
        const scene = item;
        const sceneStyle = scene.properties?.scene_visual_style;
        if (sceneStyle && styleDictionary.visual_styles && !styleDictionary.visual_styles[sceneStyle]) {
          issues.push({
            severity: "error",
            line: scene.startLine || 1,
            path: `section[${sIdx}].scene[${idx}].scene_visual_style`,
            context: `Scene: ${scene.scene_name || "Untitled"}`,
            message: `Visual style '${sceneStyle}' not found in assets/_instructions.md.`,
            details: `Available visual styles: ${Object.keys(styleDictionary.visual_styles).join(", ")}`
          });
          hasErrors = true;
        }
        scene.layers?.forEach((layer, lIdx) => {
          const layerStyle = layer.properties?.layer_visual_style;
          if (layerStyle && styleDictionary.visual_styles && !styleDictionary.visual_styles[layerStyle]) {
            issues.push({
              severity: "error",
              line: layer.startLine || 1,
              path: `section[${sIdx}].scene[${idx}].layer[${lIdx}].layer_visual_style`,
              context: `Layer: ${layer.layer_name || "Untitled"}`,
              message: `Visual style '${layerStyle}' not found in assets/_instructions.md.`,
              details: `Available visual styles: ${Object.keys(styleDictionary.visual_styles).join(", ")}`
            });
            hasErrors = true;
          }
        });
      });
    });
    return hasErrors;
  }
};

// iNNfo/packages/innfo-video-parser/src/parser/vus_parser.js
var peg$SyntaxError = class extends SyntaxError {
  constructor(message, expected, found, location) {
    super(message);
    this.expected = expected;
    this.found = found;
    this.location = location;
    this.name = "SyntaxError";
  }
  format(sources) {
    let str = "Error: " + this.message;
    if (this.location) {
      let src = null;
      const st = sources.find((s2) => s2.source === this.location.source);
      if (st) {
        src = st.text.split(/\r\n|\n|\r/g);
      }
      const s = this.location.start;
      const offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
      const loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
      if (src) {
        const e = this.location.end;
        const filler = "".padEnd(offset_s.line.toString().length, " ");
        const line = src[s.line - 1];
        const last = s.line === e.line ? e.column : line.length + 1;
        const hatLen = last - s.column || 1;
        str += "\n --> " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + "".padEnd(s.column - 1, " ") + "".padEnd(hatLen, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  }
  static buildMessage(expected, found) {
    function hex(ch) {
      return ch.codePointAt(0).toString(16).toUpperCase();
    }
    const nonPrintable = Object.prototype.hasOwnProperty.call(RegExp.prototype, "unicode") ? new RegExp("[\\p{C}\\p{Mn}\\p{Mc}]", "gu") : null;
    function unicodeEscape(s) {
      if (nonPrintable) {
        return s.replace(nonPrintable, (ch) => "\\u{" + hex(ch) + "}");
      }
      return s;
    }
    function literalEscape(s) {
      return unicodeEscape(s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, (ch) => "\\x0" + hex(ch)).replace(/[\x10-\x1F\x7F-\x9F]/g, (ch) => "\\x" + hex(ch)));
    }
    function classEscape(s) {
      return unicodeEscape(s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, (ch) => "\\x0" + hex(ch)).replace(/[\x10-\x1F\x7F-\x9F]/g, (ch) => "\\x" + hex(ch)));
    }
    const DESCRIBE_EXPECTATION_FNS = {
      literal(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      class(expectation) {
        const escapedParts = expectation.parts.map(
          (part) => Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part)
        );
        return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]" + (expectation.unicode ? "u" : "");
      },
      any() {
        return "any character";
      },
      end() {
        return "end of input";
      },
      other(expectation) {
        return expectation.description;
      }
    };
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      const descriptions = expected2.map(describeExpectation);
      descriptions.sort();
      if (descriptions.length > 0) {
        let j = 1;
        for (let i = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
        case 1:
          return descriptions[0];
        case 2:
          return descriptions[0] + " or " + descriptions[1];
        default:
          return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  }
};
function peg$parse(input, options) {
  options = options !== void 0 ? options : {};
  const peg$FAILED = {};
  const peg$source = options.grammarSource;
  const peg$startRuleFunctions = {
    Start: peg$parseStart
  };
  let peg$startRuleFunction = peg$parseStart;
  const peg$c0 = "\uFEFF";
  const peg$c1 = "//";
  const peg$c2 = "ANYDEO_SPEC:";
  const peg$c3 = "@@";
  const peg$c4 = "###";
  const peg$c5 = "##";
  const peg$c6 = "#";
  const peg$c7 = "@set";
  const peg$c8 = "@";
  const peg$c9 = "-";
  const peg$c10 = " ";
  const peg$c11 = ":";
  const peg$c12 = "![";
  const peg$c13 = "]";
  const peg$c14 = "(";
  const peg$c15 = ")";
  const peg$c16 = "```";
  const peg$c17 = "\r\n";
  const peg$r0 = /^[0-9]/;
  const peg$r1 = /^[^\]\n\r]/;
  const peg$r2 = /^[^)\n\r]/;
  const peg$r3 = /^[^\n]/;
  const peg$r4 = /^[ #]/;
  const peg$r5 = /^[^\n\r]/;
  const peg$r6 = /^[@\xA7]/;
  const peg$r7 = /^[a-zA-Z0-9_().\-\/]/;
  const peg$r8 = /^[ \t]/;
  const peg$r9 = /^[\n\r]/;
  const peg$e0 = peg$literalExpectation("\uFEFF", false);
  const peg$e1 = peg$literalExpectation("//", false);
  const peg$e2 = peg$literalExpectation("ANYDEO_SPEC:", false);
  const peg$e3 = peg$literalExpectation("@@", false);
  const peg$e4 = peg$classExpectation([["0", "9"]], false, false, false);
  const peg$e5 = peg$literalExpectation("###", false);
  const peg$e6 = peg$literalExpectation("##", false);
  const peg$e7 = peg$literalExpectation("#", false);
  const peg$e8 = peg$literalExpectation("@set", false);
  const peg$e9 = peg$literalExpectation("@", false);
  const peg$e10 = peg$literalExpectation("-", false);
  const peg$e11 = peg$literalExpectation(" ", false);
  const peg$e12 = peg$literalExpectation(":", false);
  const peg$e13 = peg$literalExpectation("![", false);
  const peg$e14 = peg$classExpectation(["]", "\n", "\r"], true, false, false);
  const peg$e15 = peg$literalExpectation("]", false);
  const peg$e16 = peg$literalExpectation("(", false);
  const peg$e17 = peg$classExpectation([")", "\n", "\r"], true, false, false);
  const peg$e18 = peg$literalExpectation(")", false);
  const peg$e19 = peg$classExpectation(["\n"], true, false, false);
  const peg$e20 = peg$classExpectation([" ", "#"], false, false, false);
  const peg$e21 = peg$classExpectation(["\n", "\r"], true, false, false);
  const peg$e22 = peg$classExpectation(["@", "\xA7"], false, false, false);
  const peg$e23 = peg$literalExpectation("```", false);
  const peg$e24 = peg$anyExpectation();
  const peg$e25 = peg$classExpectation([["a", "z"], ["A", "Z"], ["0", "9"], "_", "(", ")", ".", "-", "/"], false, false, false);
  const peg$e26 = peg$classExpectation([" ", "	"], false, false, false);
  const peg$e27 = peg$literalExpectation("\r\n", false);
  const peg$e28 = peg$classExpectation(["\n", "\r"], false, false, false);
  function peg$f0(body) {
    return { type: "Script", body: body.filter((b) => b !== null) };
  }
  function peg$f1() {
    return null;
  }
  function peg$f2() {
    return null;
  }
  function peg$f3(version2) {
    return makeNode("GlobalProperty", { key: "video_anydeo_specification", value: version2 });
  }
  function peg$f4(index, name, props) {
    return makeNode("Layer", {
      name,
      marker: "@@",
      index: index ? parseInt(index.join("")) : void 0,
      properties: props || {}
    });
  }
  function peg$f5(marker, name, props) {
    return makeNode("Section", { name, marker, properties: props || {} });
  }
  function peg$f6(name, description, props) {
    return makeNode("Set", { name, description: description || "", properties: props || {} });
  }
  function peg$f7(ws, name, props) {
    const properties = props || {};
    const lowName = name.toLowerCase();
    const parts = name.split(/[ \t]+/);
    const isTemplateDef = lowName.startsWith("template ") || lowName.startsWith("layer ") || lowName.startsWith("video ");
    if (isTemplateDef) {
      properties.block_type = "template";
      return {
        type: "Scene",
        name: parts.slice(1).join(" ") || parts[0],
        marker: "@",
        properties,
        scene_templates: [],
        loc: location()
      };
    }
    if (ws.length === 0) {
      const templates = [];
      let i = 0;
      templates.push(parts[0]);
      i++;
      while (i < parts.length && parts[i].startsWith("@")) {
        templates.push(parts[i].substring(1));
        i++;
      }
      const finalName = parts.slice(i).join(" ") || templates.join(" ");
      return {
        type: "Scene",
        name: finalName,
        marker: "@",
        properties,
        scene_templates: templates,
        loc: location()
      };
    }
    return {
      type: "Scene",
      name,
      marker: "@",
      properties,
      scene_templates: [],
      loc: location()
    };
  }
  function peg$f8(key, value) {
    return makeNode("GlobalProperty", { key, value });
  }
  function peg$f9(items) {
    return items.reduce((acc, node) => {
      if (node && node.type === "Property") {
        acc[node.key] = node.value;
      }
      return acc;
    }, {});
  }
  function peg$f10(node) {
    return node;
  }
  function peg$f11() {
    return null;
  }
  function peg$f12(key, value) {
    return makeNode("Property", { key, value });
  }
  function peg$f13(label, path) {
    return makeNode("Property", { key: "layer_asset_source", value: path.trim() });
  }
  function peg$f14(label, path) {
    return makeNode("GlobalProperty", { key: "layer_asset_source", value: path.trim() });
  }
  function peg$f15(content) {
    return makeNode("Comment", { content: content.join("") });
  }
  function peg$f16(content) {
    return makeNode("Comment", { content: content.join("") });
  }
  function peg$f17(content) {
    return makeNode("Comment", { content: content.join("") });
  }
  function peg$f18(content) {
    return makeNode("Comment", { content: content.join("") });
  }
  function peg$f19() {
    const textStr = text().trim();
    if (textStr.length === 0) return null;
    return makeNode("Content", { text: textStr });
  }
  function peg$f20(content) {
    return content.replace(/^[\r\n]+|[\r\n\s]+$/g, "");
  }
  function peg$f21() {
    return text().trim();
  }
  function peg$f22() {
    return text().trim();
  }
  function peg$f23() {
    return null;
  }
  let peg$currPos = options.peg$currPos | 0;
  let peg$savedPos = peg$currPos;
  const peg$posDetailsCache = [{ line: 1, column: 1 }];
  let peg$maxFailPos = peg$currPos;
  let peg$maxFailExpected = options.peg$maxFailExpected || [];
  let peg$silentFails = options.peg$silentFails | 0;
  let peg$result;
  if (options.startRule) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
    }
    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }
  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }
  function offset() {
    return peg$savedPos;
  }
  function range() {
    return {
      source: peg$source,
      start: peg$savedPos,
      end: peg$currPos
    };
  }
  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }
  function expected(description, location2) {
    location2 = location2 !== void 0 ? location2 : peg$computeLocation(peg$savedPos, peg$currPos);
    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location2
    );
  }
  function error(message, location2) {
    location2 = location2 !== void 0 ? location2 : peg$computeLocation(peg$savedPos, peg$currPos);
    throw peg$buildSimpleError(message, location2);
  }
  function peg$getUnicode(pos = peg$currPos) {
    const cp = input.codePointAt(pos);
    if (cp === void 0) {
      return "";
    }
    return String.fromCodePoint(cp);
  }
  function peg$literalExpectation(text2, ignoreCase) {
    return { type: "literal", text: text2, ignoreCase };
  }
  function peg$classExpectation(parts, inverted, ignoreCase, unicode) {
    return { type: "class", parts, inverted, ignoreCase, unicode };
  }
  function peg$anyExpectation() {
    return { type: "any" };
  }
  function peg$endExpectation() {
    return { type: "end" };
  }
  function peg$otherExpectation(description) {
    return { type: "other", description };
  }
  function peg$computePosDetails(pos) {
    let details = peg$posDetailsCache[pos];
    let p;
    if (details) {
      return details;
    } else {
      if (pos >= peg$posDetailsCache.length) {
        p = peg$posDetailsCache.length - 1;
      } else {
        p = pos;
        while (!peg$posDetailsCache[--p]) {
        }
      }
      details = peg$posDetailsCache[p];
      details = {
        line: details.line,
        column: details.column
      };
      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }
        p++;
      }
      peg$posDetailsCache[pos] = details;
      return details;
    }
  }
  function peg$computeLocation(startPos, endPos, offset2) {
    const startPosDetails = peg$computePosDetails(startPos);
    const endPosDetails = peg$computePosDetails(endPos);
    const res = {
      source: peg$source,
      start: {
        offset: startPos,
        line: startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line: endPosDetails.line,
        column: endPosDetails.column
      }
    };
    if (offset2 && peg$source && typeof peg$source.offset === "function") {
      res.start = peg$source.offset(res.start);
      res.end = peg$source.offset(res.end);
    }
    return res;
  }
  function peg$fail(expected2) {
    if (peg$currPos < peg$maxFailPos) {
      return;
    }
    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }
    peg$maxFailExpected.push(expected2);
  }
  function peg$buildSimpleError(message, location2) {
    return new peg$SyntaxError(message, null, null, location2);
  }
  function peg$buildStructuredError(expected2, found, location2) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected2, found),
      expected2,
      found,
      location2
    );
  }
  function peg$parseStart() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseBOM();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    s2 = [];
    s3 = peg$parseBlock();
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      s3 = peg$parseBlock();
    }
    peg$savedPos = s0;
    s0 = peg$f0(s2);
    return s0;
  }
  function peg$parseBOM() {
    let s0;
    if (input.charCodeAt(peg$currPos) === 65279) {
      s0 = peg$c0;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e0);
      }
    }
    return s0;
  }
  function peg$parseBlock() {
    let s0, s1;
    s0 = peg$parseSection();
    if (s0 === peg$FAILED) {
      s0 = peg$parseVusHeader();
      if (s0 === peg$FAILED) {
        s0 = peg$parseLayer();
        if (s0 === peg$FAILED) {
          s0 = peg$parseSet();
          if (s0 === peg$FAILED) {
            s0 = peg$parseScene();
            if (s0 === peg$FAILED) {
              s0 = peg$parseGlobalProperty();
              if (s0 === peg$FAILED) {
                s0 = peg$parseComment();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseContent();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseTopLevelAssetShortcut();
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      s1 = peg$parseWhitespace();
                      if (s1 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$f1();
                      }
                      s0 = s1;
                      if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        s1 = peg$parseBlankLine();
                        if (s1 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$f2();
                        }
                        s0 = s1;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return s0;
  }
  function peg$parseVusHeader() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 2) === peg$c1) {
      s2 = peg$c1;
      peg$currPos += 2;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e1);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parse_();
      if (input.substr(peg$currPos, 13) === peg$c2) {
        s4 = peg$c2;
        peg$currPos += 13;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e2);
        }
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parse_();
        s6 = peg$parseValue();
        if (s6 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f3(s6);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseLayer() {
    let s0, s1, s2, s3, s4, s5, s6, s7;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 2) === peg$c3) {
      s2 = peg$c3;
      peg$currPos += 2;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e3);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = [];
      s4 = input.charAt(peg$currPos);
      if (peg$r0.test(s4)) {
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e4);
        }
      }
      if (s4 !== peg$FAILED) {
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r0.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e4);
            }
          }
        }
      } else {
        s3 = peg$FAILED;
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s4 = peg$parse_();
      s5 = peg$parseName();
      s6 = peg$parseEOL();
      if (s6 !== peg$FAILED) {
        s7 = peg$parsePropertyBlock();
        if (s7 === peg$FAILED) {
          s7 = null;
        }
        peg$savedPos = s0;
        s0 = peg$f4(s3, s5, s7);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseSection() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 3) === peg$c4) {
      s2 = peg$c4;
      peg$currPos += 3;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e5);
      }
    }
    if (s2 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c5) {
        s2 = peg$c5;
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e6);
        }
      }
      if (s2 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 35) {
          s2 = peg$c6;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e7);
          }
        }
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parse_();
      s4 = peg$parseName();
      s5 = peg$parseEOL();
      if (s5 !== peg$FAILED) {
        s6 = peg$parsePropertyBlock();
        if (s6 === peg$FAILED) {
          s6 = null;
        }
        peg$savedPos = s0;
        s0 = peg$f5(s2, s4, s6);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseSet() {
    let s0, s1, s2, s3, s4, s5, s6, s7, s8;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 4) === peg$c7) {
      s2 = peg$c7;
      peg$currPos += 4;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e8);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parse_();
      s4 = peg$parseKey();
      if (s4 !== peg$FAILED) {
        s5 = peg$parse_();
        s6 = peg$parseSimpleValue();
        s7 = peg$parseEOL();
        if (s7 !== peg$FAILED) {
          s8 = peg$parsePropertyBlock();
          if (s8 === peg$FAILED) {
            s8 = null;
          }
          peg$savedPos = s0;
          s0 = peg$f6(s4, s6, s8);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseScene() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.charCodeAt(peg$currPos) === 64) {
      s2 = peg$c8;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e9);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      s4 = peg$parse_();
      s3 = input.substring(s3, peg$currPos);
      s4 = peg$parseName();
      s5 = peg$parseEOL();
      if (s5 !== peg$FAILED) {
        s6 = peg$parsePropertyBlock();
        if (s6 === peg$FAILED) {
          s6 = null;
        }
        peg$savedPos = s0;
        s0 = peg$f7(s3, s4, s6);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseGlobalProperty() {
    let s0, s1, s2, s3, s4, s5, s6, s7;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.charCodeAt(peg$currPos) === 45) {
      s2 = peg$c9;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e10);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = [];
      if (input.charCodeAt(peg$currPos) === 32) {
        s4 = peg$c10;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e11);
        }
      }
      if (s4 !== peg$FAILED) {
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          if (input.charCodeAt(peg$currPos) === 32) {
            s4 = peg$c10;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e11);
            }
          }
        }
      } else {
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parseKey();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 58) {
            s5 = peg$c11;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e12);
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            s7 = peg$parseValue();
            if (s7 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f8(s4, s7);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsePropertyBlock() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsePropertyItem();
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsePropertyItem();
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f9(s1);
    }
    s0 = s1;
    return s0;
  }
  function peg$parsePropertyItem() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    s1 = peg$parse_();
    s2 = peg$currPos;
    peg$silentFails++;
    s3 = peg$parseBlockMarker();
    peg$silentFails--;
    if (s3 === peg$FAILED) {
      s2 = void 0;
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parseProperty();
      if (s3 === peg$FAILED) {
        s3 = peg$parseComment();
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parse_();
        s5 = peg$parseEOL();
        if (s5 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f10(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseBlankLine();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f11();
      }
      s0 = s1;
    }
    return s0;
  }
  function peg$parseProperty() {
    let s0, s1, s2, s3, s4, s5, s6, s7;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.charCodeAt(peg$currPos) === 45) {
      s2 = peg$c9;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e10);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = [];
      if (input.charCodeAt(peg$currPos) === 32) {
        s4 = peg$c10;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e11);
        }
      }
      if (s4 !== peg$FAILED) {
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          if (input.charCodeAt(peg$currPos) === 32) {
            s4 = peg$c10;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e11);
            }
          }
        }
      } else {
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parseKey();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 58) {
            s5 = peg$c11;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e12);
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            s7 = peg$parseValue();
            if (s7 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f12(s4, s7);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseAssetShortcut();
    }
    return s0;
  }
  function peg$parseAssetShortcut() {
    let s0, s1, s2, s3, s4, s5, s6, s7, s8;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 2) === peg$c12) {
      s2 = peg$c12;
      peg$currPos += 2;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e13);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r1.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e14);
        }
      }
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = input.charAt(peg$currPos);
        if (peg$r1.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e14);
          }
        }
      }
      s3 = input.substring(s3, peg$currPos);
      if (input.charCodeAt(peg$currPos) === 93) {
        s4 = peg$c13;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e15);
        }
      }
      if (s4 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 40) {
          s5 = peg$c14;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e16);
          }
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$currPos;
          s7 = [];
          s8 = input.charAt(peg$currPos);
          if (peg$r2.test(s8)) {
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e17);
            }
          }
          while (s8 !== peg$FAILED) {
            s7.push(s8);
            s8 = input.charAt(peg$currPos);
            if (peg$r2.test(s8)) {
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e17);
              }
            }
          }
          s6 = input.substring(s6, peg$currPos);
          if (input.charCodeAt(peg$currPos) === 41) {
            s7 = peg$c15;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e18);
            }
          }
          if (s7 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f13(s3, s6);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseTopLevelAssetShortcut() {
    let s0, s1, s2, s3, s4, s5, s6, s7, s8;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 2) === peg$c12) {
      s2 = peg$c12;
      peg$currPos += 2;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e13);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r1.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e14);
        }
      }
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = input.charAt(peg$currPos);
        if (peg$r1.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e14);
          }
        }
      }
      s3 = input.substring(s3, peg$currPos);
      if (input.charCodeAt(peg$currPos) === 93) {
        s4 = peg$c13;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e15);
        }
      }
      if (s4 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 40) {
          s5 = peg$c14;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e16);
          }
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$currPos;
          s7 = [];
          s8 = input.charAt(peg$currPos);
          if (peg$r2.test(s8)) {
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e17);
            }
          }
          while (s8 !== peg$FAILED) {
            s7.push(s8);
            s8 = input.charAt(peg$currPos);
            if (peg$r2.test(s8)) {
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e17);
              }
            }
          }
          s6 = input.substring(s6, peg$currPos);
          if (input.charCodeAt(peg$currPos) === 41) {
            s7 = peg$c15;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e18);
            }
          }
          if (s7 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f14(s3, s6);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseComment() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    s1 = peg$parse_();
    if (input.substr(peg$currPos, 3) === peg$c4) {
      s2 = peg$c4;
      peg$currPos += 3;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e5);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = [];
      s4 = input.charAt(peg$currPos);
      if (peg$r3.test(s4)) {
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = input.charAt(peg$currPos);
        if (peg$r3.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e19);
          }
        }
      }
      peg$savedPos = s0;
      s0 = peg$f15(s3);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (input.substr(peg$currPos, 2) === peg$c1) {
        s2 = peg$c1;
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e1);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r3.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e19);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r3.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e19);
            }
          }
        }
        peg$savedPos = s0;
        s0 = peg$f16(s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parse_();
        if (input.charCodeAt(peg$currPos) === 35) {
          s2 = peg$c6;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e7);
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$currPos;
          peg$silentFails++;
          s4 = input.charAt(peg$currPos);
          if (peg$r4.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e20);
            }
          }
          peg$silentFails--;
          if (s4 === peg$FAILED) {
            s3 = void 0;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
          if (s3 !== peg$FAILED) {
            s4 = [];
            s5 = input.charAt(peg$currPos);
            if (peg$r3.test(s5)) {
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e19);
              }
            }
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              s5 = input.charAt(peg$currPos);
              if (peg$r3.test(s5)) {
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e19);
                }
              }
            }
            peg$savedPos = s0;
            s0 = peg$f17(s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parse_();
          if (input.charCodeAt(peg$currPos) === 35) {
            s2 = peg$c6;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e7);
            }
          }
          if (s2 !== peg$FAILED) {
            s3 = [];
            s4 = input.charAt(peg$currPos);
            if (peg$r3.test(s4)) {
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e19);
              }
            }
            while (s4 !== peg$FAILED) {
              s3.push(s4);
              s4 = input.charAt(peg$currPos);
              if (peg$r3.test(s4)) {
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e19);
                }
              }
            }
            peg$savedPos = s0;
            s0 = peg$f18(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }
    return s0;
  }
  function peg$parseContent() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    s1 = [];
    s2 = peg$currPos;
    s3 = peg$currPos;
    peg$silentFails++;
    s4 = peg$parseMarkerLine();
    peg$silentFails--;
    if (s4 === peg$FAILED) {
      s3 = void 0;
    } else {
      peg$currPos = s3;
      s3 = peg$FAILED;
    }
    if (s3 !== peg$FAILED) {
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r5.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r5.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e21);
            }
          }
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseEOL();
        if (s5 !== peg$FAILED) {
          s3 = [s3, s4, s5];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$currPos;
        s3 = peg$currPos;
        peg$silentFails++;
        s4 = peg$parseMarkerLine();
        peg$silentFails--;
        if (s4 === peg$FAILED) {
          s3 = void 0;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = input.charAt(peg$currPos);
          if (peg$r5.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e21);
            }
          }
          if (s5 !== peg$FAILED) {
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              s5 = input.charAt(peg$currPos);
              if (peg$r5.test(s5)) {
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e21);
                }
              }
            }
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseEOL();
            if (s5 !== peg$FAILED) {
              s3 = [s3, s4, s5];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f19();
    }
    s0 = s1;
    return s0;
  }
  function peg$parseBlockMarker() {
    let s0;
    if (input.substr(peg$currPos, 4) === peg$c7) {
      s0 = peg$c7;
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e8);
      }
    }
    if (s0 === peg$FAILED) {
      s0 = input.charAt(peg$currPos);
      if (peg$r6.test(s0)) {
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c3) {
          s0 = peg$c3;
          peg$currPos += 2;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e3);
          }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c5) {
            s0 = peg$c5;
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e6);
            }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c4) {
              s0 = peg$c4;
              peg$currPos += 3;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e5);
              }
            }
            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 35) {
                s0 = peg$c6;
                peg$currPos++;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e7);
                }
              }
            }
          }
        }
      }
    }
    return s0;
  }
  function peg$parseMarkerLine() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = peg$parse_();
    s2 = peg$parseBlockMarker();
    if (s2 !== peg$FAILED) {
      s1 = [s1, s2];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c9;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e10);
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parse_();
        if (input.substr(peg$currPos, 2) === peg$c1) {
          s2 = peg$c1;
          peg$currPos += 2;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e1);
          }
        }
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parse_();
          if (input.substr(peg$currPos, 2) === peg$c12) {
            s2 = peg$c12;
            peg$currPos += 2;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e13);
            }
          }
          if (s2 !== peg$FAILED) {
            s1 = [s1, s2];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }
    return s0;
  }
  function peg$parseValue() {
    let s0;
    s0 = peg$parseMultilineValue();
    if (s0 === peg$FAILED) {
      s0 = peg$parseSimpleValue();
    }
    return s0;
  }
  function peg$parseMultilineValue() {
    let s0, s1, s2, s3, s4, s5, s6, s7, s8;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c16) {
      s1 = peg$c16;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e23);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      s3 = peg$parseNewLine();
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s4 = peg$currPos;
      s5 = [];
      s6 = peg$currPos;
      s7 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 3) === peg$c16) {
        s8 = peg$c16;
        peg$currPos += 3;
      } else {
        s8 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e23);
        }
      }
      peg$silentFails--;
      if (s8 === peg$FAILED) {
        s7 = void 0;
      } else {
        peg$currPos = s7;
        s7 = peg$FAILED;
      }
      if (s7 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s8 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s8 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
        if (s8 === peg$FAILED) {
          s8 = peg$parseNewLine();
        }
        if (s8 !== peg$FAILED) {
          s7 = [s7, s8];
          s6 = s7;
        } else {
          peg$currPos = s6;
          s6 = peg$FAILED;
        }
      } else {
        peg$currPos = s6;
        s6 = peg$FAILED;
      }
      while (s6 !== peg$FAILED) {
        s5.push(s6);
        s6 = peg$currPos;
        s7 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 3) === peg$c16) {
          s8 = peg$c16;
          peg$currPos += 3;
        } else {
          s8 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e23);
          }
        }
        peg$silentFails--;
        if (s8 === peg$FAILED) {
          s7 = void 0;
        } else {
          peg$currPos = s7;
          s7 = peg$FAILED;
        }
        if (s7 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s8 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e24);
            }
          }
          if (s8 === peg$FAILED) {
            s8 = peg$parseNewLine();
          }
          if (s8 !== peg$FAILED) {
            s7 = [s7, s8];
            s6 = s7;
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
        } else {
          peg$currPos = s6;
          s6 = peg$FAILED;
        }
      }
      s4 = input.substring(s4, peg$currPos);
      if (input.substr(peg$currPos, 3) === peg$c16) {
        s5 = peg$c16;
        peg$currPos += 3;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e23);
        }
      }
      if (s5 !== peg$FAILED) {
        peg$savedPos = s0;
        s0 = peg$f20(s4);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseSimpleValue() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = [];
    s3 = input.charAt(peg$currPos);
    if (peg$r5.test(s3)) {
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e21);
      }
    }
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      s3 = input.charAt(peg$currPos);
      if (peg$r5.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
    }
    s1 = input.substring(s1, peg$currPos);
    peg$savedPos = s0;
    s1 = peg$f21();
    s0 = s1;
    return s0;
  }
  function peg$parseKey() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r7.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e25);
      }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r7.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e25);
          }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s0 = input.substring(s0, peg$currPos);
    } else {
      s0 = s1;
    }
    return s0;
  }
  function peg$parseName() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = [];
    s3 = input.charAt(peg$currPos);
    if (peg$r5.test(s3)) {
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e21);
      }
    }
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      s3 = input.charAt(peg$currPos);
      if (peg$r5.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
    }
    s1 = input.substring(s1, peg$currPos);
    peg$savedPos = s0;
    s1 = peg$f22();
    s0 = s1;
    return s0;
  }
  function peg$parseWhitespace() {
    let s0, s1;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r8.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e26);
      }
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = input.charAt(peg$currPos);
        if (peg$r8.test(s1)) {
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e26);
          }
        }
      }
    } else {
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseBlankLine() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = peg$parse_();
    s2 = peg$parseNewLine();
    if (s2 !== peg$FAILED) {
      peg$savedPos = s0;
      s0 = peg$f23();
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseNewLine() {
    let s0;
    if (input.substr(peg$currPos, 2) === peg$c17) {
      s0 = peg$c17;
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e27);
      }
    }
    if (s0 === peg$FAILED) {
      s0 = input.charAt(peg$currPos);
      if (peg$r9.test(s0)) {
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e28);
        }
      }
    }
    return s0;
  }
  function peg$parseEOL() {
    let s0;
    s0 = peg$parseNewLine();
    if (s0 === peg$FAILED) {
      s0 = peg$parseEOF();
    }
    return s0;
  }
  function peg$parse_() {
    let s0, s1;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r8.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e26);
      }
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = input.charAt(peg$currPos);
      if (peg$r8.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e26);
        }
      }
    }
    return s0;
  }
  function peg$parseEOF() {
    let s0, s1;
    s0 = peg$currPos;
    peg$silentFails++;
    if (input.length > peg$currPos) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    peg$silentFails--;
    if (s1 === peg$FAILED) {
      s0 = void 0;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function makeNode(type, data) {
    return { type, ...data };
  }
  peg$result = peg$startRuleFunction();
  const peg$success = peg$result !== peg$FAILED && peg$currPos === input.length;
  function peg$throw() {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }
    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? peg$getUnicode(peg$maxFailPos) : null,
      peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
  if (options.peg$library) {
    return (
      /** @type {any} */
      {
        peg$result,
        peg$currPos,
        peg$FAILED,
        peg$maxFailExpected,
        peg$maxFailPos,
        peg$success,
        peg$throw: peg$success ? void 0 : peg$throw
      }
    );
  }
  if (peg$success) {
    return peg$result;
  } else {
    peg$throw();
  }
}

// iNNfo/packages/innfo-video-parser/src/parser/lowering.ts
function toNameList(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (!raw) return [];
  return String(raw).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}
function lowerAst(script, options = {}) {
  const project = {
    config: {},
    video_sources: {},
    templates: {},
    property_sets: {},
    sections: [],
    flattenScenes: [],
    uiSchema: { video: {}, scene: {}, layer: {} },
    propertyMetadata: {}
  };
  if (options.title && !project.config.video_name) {
    project.config.video_name = options.title;
  }
  let currentSection = null;
  let currentScene = null;
  let currentLayer = null;
  for (const node of script.body) {
    switch (node.type) {
      case "GlobalProperty":
        const normalizedVal = normalizeValue(node.value);
        const normKey = normalizePropertyKey(node.key);
        if (currentLayer && (normKey.startsWith("layer_") || normKey.startsWith("vugen_") || normKey.startsWith("var_"))) {
          currentLayer.properties[normKey] = normalizedVal;
          currentLayer[normKey] = normalizedVal;
        } else if (currentScene && (normKey.startsWith("scene_") || normKey.startsWith("layer_") || normKey.startsWith("vugen_") || normKey.startsWith("var_"))) {
          currentScene.properties[normKey] = normalizedVal;
          currentScene[normKey] = normalizedVal;
          if (currentScene.finalProperties) {
            currentScene.finalProperties[normKey] = normalizedVal;
          }
        } else {
          project.config[normKey] = normalizedVal;
        }
        break;
      case "Set":
        const setProps = {};
        if (node.properties) {
          Object.entries(node.properties).forEach(([k, v]) => {
            setProps[k] = normalizeValue(v);
          });
        }
        project.property_sets[node.name] = {
          name: node.name,
          description: node.description,
          properties: setProps
        };
        break;
      case "Section":
        const sectionLowName = node.name.toLowerCase();
        if ([
          "video",
          "v\xEDdeo",
          "sets",
          "templates",
          "template",
          "scene",
          "layer",
          "sections"
        ].includes(sectionLowName)) {
          if (node.properties) {
            Object.entries(node.properties).forEach(([k, v]) => {
              const nk = normalizePropertyKey(k);
              if (nk.startsWith("video_") || nk.startsWith("vugen_") || nk.startsWith("var_") || k.startsWith("(") && k.endsWith(")")) {
                project.config[nk] = normalizeValue(v);
              }
            });
          }
          continue;
        }
        const sectionProps = {};
        for (const [k, v] of Object.entries(node.properties)) {
          sectionProps[k] = normalizeValue(v);
        }
        currentSection = {
          title: node.name,
          properties: sectionProps,
          scenes: []
        };
        project.sections.push(currentSection);
        currentScene = null;
        currentLayer = null;
        break;
      case "Scene":
        const lowName = node.name.toLowerCase();
        const isContainer = ["video", "sets", "templates", "template", "scene", "layer"].includes(
          lowName
        );
        if (isContainer && (node.marker === "# " || node.marker === "#")) {
          if (node.properties) {
            Object.entries(node.properties).forEach(([k, v]) => {
              if (k.startsWith("video_") || k.startsWith("vugen_") || k.startsWith("var_")) {
                project.config[k] = v;
              }
            });
          }
          continue;
        }
        if (node.properties?.block_type === "template") {
          const templateName = node.name;
          currentScene = lowerScene(node, -1, 0);
          const tplProps = currentScene.properties || {};
          if (tplProps.includes !== void 0) {
            ;
            currentScene.includes = toNameList(tplProps.includes);
          }
          if (tplProps.scene_templates !== void 0) {
            ;
            currentScene.scene_templates = toNameList(tplProps.scene_templates);
          }
          project.templates[templateName] = currentScene;
          currentLayer = null;
          continue;
        }
        if (!currentSection) {
          currentSection = {
            title: "Default Section",
            properties: {},
            scenes: []
          };
          project.sections.push(currentSection);
        }
        currentScene = lowerScene(
          node,
          project.sections.length - 1,
          currentSection.scenes.length,
          currentSection.properties
        );
        currentSection.scenes.push(currentScene);
        currentLayer = null;
        break;
      case "Layer":
        if (currentScene) {
          currentLayer = lowerLayer(node, currentScene.properties);
          currentScene.layers.push(currentLayer);
        }
        break;
      case "Content":
        if (currentLayer) {
          const match = node.text.match(/!\[.*?\]\((.*?)\)/);
          if (match && !currentLayer.layer_asset_source) {
            currentLayer.layer_asset_source = match[1];
            currentLayer.properties.layer_asset_source = match[1];
          } else if (["text", "text_static", "text_dynamic", "text_ai_embedded"].includes(
            currentLayer.layer_type
          )) {
            const newText = (currentLayer.properties.layer_text_content ? currentLayer.properties.layer_text_content + "\n" : "") + node.text;
            currentLayer.properties.layer_text_content = newText;
            currentLayer.layer_text_content = newText;
          } else {
            const content = (currentScene.scene_content ? currentScene.scene_content + "\n" : "") + node.text;
            currentScene.scene_content = currentScene.scene_content === "." ? node.text : content;
            currentScene.properties.scene_content = currentScene.scene_content;
          }
        } else if (currentScene) {
          const content = (currentScene.scene_content ? currentScene.scene_content + "\n" : "") + node.text;
          currentScene.scene_content = currentScene.scene_content === "." ? node.text : content;
          currentScene.properties.scene_content = currentScene.scene_content;
        }
        break;
      case "Comment":
        break;
    }
  }
  const flattenScenes = [];
  project.sections.forEach((section, sIdx) => {
    let sceneIdx = 0;
    section.scenes.forEach((item) => {
      if (item.block_type === "note") return;
      const scene = item;
      scene.sIdx = sIdx;
      scene.idx = sceneIdx;
      flattenScenes.push({ sIdx, idx: sceneIdx, scene });
      sceneIdx++;
    });
  });
  project.flattenScenes = flattenScenes;
  return project;
}
function lowerScene(node, sIdx, idx, inheritedProps = {}) {
  const explicitProps = {};
  for (const [k, v] of Object.entries(node.properties)) {
    const nk = normalizePropertyKey(k);
    explicitProps[nk] = normalizeValue(v);
  }
  return {
    sIdx,
    idx,
    scene_name: node.name,
    scene_content: explicitProps.scene_content || "",
    scene_sources: explicitProps.scene_sources || [],
    scene_background_audio_volume: explicitProps.scene_background_audio_volume,
    scene_tts_model: explicitProps.scene_tts_model,
    scene_voice: explicitProps.scene_voice,
    scene_voice_volume: explicitProps.scene_voice_volume,
    scene_image_model: explicitProps.scene_image_model,
    scene_video_model: explicitProps.scene_video_model,
    properties: explicitProps,
    layers: (node.layers || []).map((l) => lowerLayer(l)),
    scene_templates: node.scene_templates || [],
    startLine: node.loc?.start.line || 1,
    propertyMetadata: {},
    finalProperties: {},
    inheritedProperties: {}
  };
}
function lowerLayer(node, sceneProps = {}) {
  const name = node.name.toLowerCase() === "background" ? "background" : node.name;
  const explicitProps = {};
  for (const [k, v] of Object.entries(node.properties)) {
    const nk = normalizePropertyKey(k);
    explicitProps[nk] = normalizeValue(v);
  }
  const properties = explicitProps;
  let assetSource = properties.layer_asset_source || "";
  if (!assetSource && typeof properties.layer_text_content === "string") {
    const match = properties.layer_text_content.match(/!\[.*?\]\((.*?)\)/);
    if (match) {
      assetSource = match[1];
      const cleaned = properties.layer_text_content.replace(match[0], "").trim();
      properties.layer_text_content = cleaned;
      properties.layer_asset_source = assetSource;
    }
  }
  if (!assetSource && node.content) {
    const match = node.content.match(/!\[.*?\]\((.*?)\)/);
    if (match) assetSource = match[1];
  }
  const resolvedLayerType = properties.layer_type || (assetSource ? "image" : void 0);
  const zIndex = node.index;
  if (zIndex !== void 0 && properties.layer_level === void 0) {
    properties.layer_level = zIndex;
  }
  const resolvedLevel = properties.layer_level !== void 0 ? properties.layer_level : zIndex;
  return {
    ...properties,
    layer_name: name,
    layer_level: resolvedLevel,
    layer_type: resolvedLayerType,
    layer_asset_source: assetSource,
    properties,
    finalProperties: {},
    startLine: node.loc?.start.line || 1,
    propertyMetadata: {}
  };
}

// iNNfo/packages/innfo-video-parser/src/parser/Parser.ts
var ScriptParser = class {
  /**
   * Parses a script content into a project structure
   * @param {string} content - Script file content
   * @param {string} title - Optional title for the video
   * @param {any} styleDictionary - Optional dictionary of styles for validation
   * @returns {ParseResult} Parsed project and list of issues
   */
  static parse(content, title = "Untitled Video", styleDictionary) {
    const issues = [];
    if (!content || content.trim().length === 0) {
      issues.push({ severity: "warning", line: 1, message: "Script content is empty." });
      return {
        project: {
          config: {},
          video_sources: {},
          templates: {},
          property_sets: {},
          sections: [],
          flattenScenes: [],
          uiSchema: { video: {}, scene: {}, layer: {} },
          propertyMetadata: {}
        },
        issues
      };
    }
    const lines = content.split("\n");
    const trimmed = content.trim();
    const isFormalInput = trimmed.startsWith("# video") || trimmed.startsWith("- ") || trimmed.startsWith("@") || trimmed.startsWith("//ANYDEO_SPEC");
    let formalProject = null;
    const formalIssues = [];
    if (isFormalInput) {
      try {
        const ast = peg$parse(content);
        formalProject = lowerAst(ast, { title });
        if (formalProject.config && formalProject.config.video_sources !== void 0) {
          const normalizedSources = normalizePropertyValue(
            "video_sources",
            formalProject.config.video_sources
          );
          formalProject.video_sources = normalizedSources;
          delete formalProject.config.video_sources;
        }
        const validationResult2 = ProjectSchema.safeParse(formalProject);
        if (!validationResult2.success) {
          this._handleValidationErrors(validationResult2.error, formalIssues);
        } else {
          formalProject = validationResult2.data;
          this._postProcessProject(formalProject);
          SemanticValidator.validate(formalProject, formalIssues, styleDictionary);
        }
      } catch (e) {
        console.error(
          `[Parser] Formal parsing error: ${e.message} at line ${e.location?.start?.line}`
        );
        formalIssues.push({
          severity: "warning",
          line: e.location?.start?.line || 1,
          message: `Formal parsing failed: ${e.message}`
        });
      }
    }
    const context = {
      root: null,
      stack: [],
      currentBlock: null,
      lastPropertyKey: null
    };
    const lineParser = new LineParser();
    lines.forEach((line, index) => {
      try {
        lineParser.parseLine(line, context, index + 1);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        const details = "Check for correct indentation (2 spaces) and property syntax (Key: Value).";
        issues.push({
          severity: "error",
          line: index + 1,
          message: `Error parsing line: ${msg}`,
          details
        });
      }
    });
    const project = {
      config: {},
      video_sources: {},
      templates: {},
      property_sets: {},
      sections: [],
      flattenScenes: [],
      uiSchema: { video: {}, scene: {}, layer: {} },
      propertyMetadata: {}
    };
    if (context.root) {
      project.config = processProperties(context.root.properties);
      if (project.config.video_sources) {
        project.video_sources = project.config.video_sources;
        delete project.config.video_sources;
      }
      project.propertyMetadata = context.root.propertyMetadata || {};
      if (!project.config.video_name) {
        project.config.video_name = title;
      }
      this._extractUISchema(context.root, project);
      if (project.uiSchema?.video) {
        Object.entries(project.uiSchema.video).forEach(([key, val]) => {
          const value = val && typeof val === "object" && "value" in val ? val.value : val;
          if (project.config[key] === void 0 || project.config[key] === "") {
            project.config[key] = value;
          }
        });
      }
      const cascadableGlobalProps = {};
      Object.entries(project.config).forEach(([k, v]) => {
        if (k.startsWith("scene_") || k.startsWith("layer_") || k.startsWith("var_") || k.startsWith("vugen_") || k === "import" || k === "scene_templates") {
          cascadableGlobalProps[k] = v;
        }
      });
      this._walk(context.root, project, null, null, cascadableGlobalProps);
      const flattenScenes = [];
      project.sections.forEach((section, sIdx) => {
        let sceneIdx = 0;
        section.scenes?.forEach((item) => {
          if (item.block_type === "note") return;
          const scene = item;
          scene.sIdx = sIdx;
          scene.idx = sceneIdx;
          this._resolveLayerInheritance(
            scene,
            project.templates,
            project.config,
            project.video_sources,
            project.property_sets
          );
          flattenScenes.push({ sIdx, idx: sceneIdx, scene });
          sceneIdx++;
        });
      });
      project.flattenScenes = flattenScenes;
    }
    const validationResult = ProjectSchema.safeParse(project);
    if (!validationResult.success) {
      this._handleValidationErrors(validationResult.error, issues);
      return { project, issues };
    }
    this._validateTemplateReferences(validationResult.data, issues);
    SemanticValidator.validate(validationResult.data, issues, styleDictionary);
    if (isFormalInput && formalProject && !formalIssues.some((i) => i.severity === "error")) {
      return { project: formalProject, issues: formalIssues };
    }
    return { project: validationResult.data, issues };
  }
  static _resolveLayerInheritance(scene, templates, projectConfig, videoSources, propertySets) {
    const formattedSources = [];
    const sourcesList = scene.scene_sources || [];
    const sourcesMap = videoSources || {};
    sourcesList.forEach((source) => {
      if (!source) return;
      const isUrl = source.startsWith("http://") || source.startsWith("https://");
      if (isUrl) {
        formattedSources.push(source);
      } else if (sourcesMap[source]) {
        const src = sourcesMap[source];
        const title = src.title || "";
        const author = src.author || "";
        const url = src.url || src.doi || "";
        let citation = "";
        if (title && author) {
          citation = `${title} by ${author}`;
        } else if (title) {
          citation = title;
        } else if (author) {
          citation = author;
        } else {
          citation = source;
        }
        if (url) {
          citation += ` (${url})`;
        }
        formattedSources.push(citation);
      } else {
        formattedSources.push(source);
      }
    });
    const sceneSourcesText = formattedSources.join(", ");
    scene.scene_sources_text = sceneSourcesText;
    if (templates["scene"] && (!scene.scene_templates || !scene.scene_templates.includes("scene"))) {
      scene.scene_templates = ["scene", ...scene.scene_templates || []];
    }
    if (!scene.scene_templates || !Array.isArray(scene.scene_templates)) return;
    const resolvedLayers = [];
    const layerMap = /* @__PURE__ */ new Map();
    const sets = propertySets || {};
    const toNameList2 = (raw) => {
      if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
      if (!raw) return [];
      return String(raw).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    };
    const resolveRef = (refName) => {
      if (refName && templates && templates[refName]) return templates[refName];
      if (refName && sets[refName])
        return { properties: sets[refName].properties || {}, layers: [] };
      return null;
    };
    const mergeTemplateLayer = (tplLayer) => {
      const lowerName = String(tplLayer.layer_name).toLowerCase();
      if (layerMap.has(lowerName)) {
        const existing = layerMap.get(lowerName);
        existing.properties = { ...existing.properties, ...tplLayer.properties };
        existing.inheritedProperties = {
          ...existing.inheritedProperties || {},
          ...tplLayer.properties
        };
        existing.layer_type = tplLayer.layer_type || existing.layer_type;
        existing.layer_level = tplLayer.layer_level !== void 0 ? tplLayer.layer_level : existing.layer_level;
        existing.layer_asset_source = tplLayer.layer_asset_source || existing.layer_asset_source;
      } else {
        const clonedLayer = JSON.parse(JSON.stringify(tplLayer));
        clonedLayer.inheritedProperties = { ...tplLayer.properties };
        layerMap.set(lowerName, clonedLayer);
        resolvedLayers.push(clonedLayer);
      }
    };
    const sceneInheritedProps = { ...projectConfig };
    const collectTemplate = (refName, seen) => {
      const key = String(refName);
      if (!key || seen.has(key)) return;
      const ref = resolveRef(key);
      if (!ref) return;
      seen.add(key);
      const refProps = ref.properties || ref;
      toNameList2(ref.scene_templates ?? refProps.scene_templates).forEach(
        (parent) => collectTemplate(parent, seen)
      );
      toNameList2(ref.includes ?? refProps.includes).forEach((setName) => {
        const set = sets[setName];
        if (set) Object.assign(sceneInheritedProps, set.properties || {});
      });
      Object.assign(sceneInheritedProps, refProps);
      (ref.layers || []).forEach(mergeTemplateLayer);
    };
    scene.scene_templates.forEach(
      (tplName) => collectTemplate(tplName, /* @__PURE__ */ new Set())
    );
    scene.inheritedProperties = {
      ...scene.inheritedProperties || {},
      ...sceneInheritedProps
    };
    scene.layers.forEach((sceneLayer) => {
      const name = sceneLayer.layer_name;
      const lowerName = name.toLowerCase();
      const importsRaw = sceneLayer.properties?.import || [];
      const imports = Array.isArray(importsRaw) ? importsRaw : [importsRaw];
      imports.filter(Boolean).forEach((tplName) => {
        const ref = resolveRef(tplName);
        if (ref) {
          const tplProps = ref.properties || ref;
          sceneLayer.properties = { ...tplProps, ...sceneLayer.properties };
          sceneLayer.layer_type = sceneLayer.layer_type || ref.layer_type;
          sceneLayer.layer_asset_source = sceneLayer.layer_asset_source || ref.layer_asset_source;
        }
      });
      if (sceneLayer.properties && "import" in sceneLayer.properties)
        delete sceneLayer.properties.import;
      if (layerMap.has(lowerName)) {
        const existing = layerMap.get(lowerName);
        existing.properties = { ...existing.properties, ...sceneLayer.properties };
        if (sceneLayer.layer_type !== void 0) {
          existing.layer_type = sceneLayer.layer_type;
        }
        if (sceneLayer.layer_level !== void 0) {
          existing.layer_level = sceneLayer.layer_level;
        }
        existing.layer_asset_source = sceneLayer.layer_asset_source || existing.layer_asset_source;
      } else {
        resolvedLayers.push(sceneLayer);
      }
    });
    scene.layers = resolvedLayers.filter((l) => {
      const lp = l.properties || {};
      const active = lp.layer_active !== false && lp["(hidden)"] !== true && l.layer_active !== false;
      return active;
    }).sort((a, b) => (a.layer_level ?? 0) - (b.layer_level ?? 0));
    scene.layers.forEach((layer) => {
      if (layer.layer_level === void 0) {
        layer.layer_level = rules_default.properties.layer_level?.default ?? 10;
      }
      if (!layer.layer_type) {
        layer.layer_type = rules_default.properties.layer_type?.default || "image";
      }
      if (layer.properties) {
        const resolutionContext = {
          ...projectConfig || {},
          ...scene || {},
          ...scene.properties || {},
          scene_name: (scene.properties?.scene_name || scene.scene_name || scene.title || "").trim(),
          scene_sources_text: sceneSourcesText
        };
        for (const [key, value] of Object.entries(layer.properties)) {
          let resolvedValue = value;
          if (typeof value === "string" && value.includes("{")) {
            resolvedValue = value.replace(/\{([^}]+)\}/g, (_, propName) => {
              const trimmedProp = propName.trim();
              if (layer.properties[trimmedProp] !== void 0) return layer.properties[trimmedProp];
              return resolutionContext[trimmedProp] ?? `{${trimmedProp}}`;
            });
            layer.properties[key] = resolvedValue;
          }
          if (typeof resolvedValue === "string" && resolvedValue.includes("![")) {
            const mediaMatch = resolvedValue.match(/!\[.*?\]\((.*?)\)/);
            if (mediaMatch) {
              const extractedPath = mediaMatch[1];
              if (key === "layer_text_content" && !layer.properties.layer_asset_source) {
                layer.layer_asset_source = extractedPath;
                const cleaned = resolvedValue.replace(mediaMatch[0], "").trim();
                layer.properties[key] = cleaned;
                layer.layer_text_content = cleaned;
              } else if (key === "layer_asset_source" || key === "layer_asset_raw_url") {
                layer.layer_asset_source = extractedPath;
                layer.properties[key] = extractedPath;
              }
            }
          }
          if (key === "layer_generation_embedded_text")
            layer.layer_generation_embedded_text = layer.properties[key];
          if (key === "layer_text_content") layer.layer_text_content = layer.properties[key];
          if (key === "layer_generation_subject")
            layer.layer_generation_subject = layer.properties[key];
          if (key === "layer_type") layer.layer_type = layer.properties[key];
          if (key === "layer_level")
            layer.layer_level = typeof layer.properties[key] === "number" ? layer.properties[key] : parseInt(layer.properties[key]);
          if (key === "layer_asset_source") layer.layer_asset_source = layer.properties[key];
          if (key === "layer_asset_citation_key")
            layer.layer_asset_citation_key = layer.properties[key];
          if (key === "layer_asset_access_date")
            layer.layer_asset_access_date = layer.properties[key];
        }
      }
    });
  }
  static _handleValidationErrors(error, issues) {
    console.error("\u274C Validation Error in ScriptParser:", error);
    error.issues.forEach((e) => {
      let details = "Ensure all required fields are present and have correct data types.";
      const pathStr = e.path.join(".");
      if (pathStr.includes("fps"))
        details = "FPS must be a positive number (usually 24, 30, or 60).";
      if (pathStr.includes("duration")) details = "Duration must be a positive number.";
      if (pathStr.includes("asset_type"))
        details = "Supported types: image, video, ai_image, ai_video, talking_avatar.";
      issues.push({
        severity: "error",
        line: 1,
        path: pathStr,
        message: `${pathStr}: ${e.message}`,
        details
      });
    });
  }
  static _validateTemplateReferences(project, issues) {
    const targetProject = project;
    targetProject.sections.forEach((section, sIdx) => {
      section.scenes.forEach((scene, idx) => {
        const templateNamesRaw = scene.properties?.scene_templates || scene.scene_templates || [];
        const templateNames = Array.isArray(templateNamesRaw) ? templateNamesRaw : typeof templateNamesRaw === "string" ? templateNamesRaw.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean) : templateNamesRaw ? [templateNamesRaw] : [];
        templateNames.forEach((templateName) => {
          const isSet = !!project.property_sets?.[templateName];
          if (templateName && !project.templates[templateName] && !isSet) {
            issues.push({
              severity: "error",
              line: scene.startLine || 1,
              path: `section[${sIdx}].scene[${idx}]`,
              context: `Scene: ${scene.scene_name || "Untitled"}`,
              message: `Template '${templateName}' is used but not defined.`,
              details: `All templates must be explicitly defined in the script header under '# Templates' (e.g., '@template ${templateName}').`
            });
          }
        });
      });
    });
  }
  /**
   * Extracts UI Schema definitions from the block tree
   */
  static _extractUISchema(root, project) {
    const findAndProcess = (block) => {
      block.children?.forEach((child) => {
        if (child.type === "template" && child.properties.block_type === "ui_schema") {
          const type = child.title;
          if (["video", "scene", "layer"].includes(type) && project.uiSchema) {
            const props = processProperties(child.properties);
            delete props.block_type;
            const mergedProps = {};
            for (const [key, val] of Object.entries(props)) {
              const meta = child.propertyMetadata?.[key];
              mergedProps[key] = meta ? { value: val, ...meta } : val;
            }
            project.uiSchema[type] = mergedProps;
          }
        }
        findAndProcess(child);
      });
    };
    findAndProcess(root);
  }
  /**
   * Recursively walks the block tree to build project structure
   */
  static _walk(block, project, currentSection = null, currentScene = null, inheritedProps = {}) {
    block.children?.forEach((child) => {
      const childInheritedProps = { ...inheritedProps };
      if (child.type === "video" || child.type === "section") {
        const props = processProperties(child.properties);
        for (const [k, v] of Object.entries(props)) {
          if (k.startsWith("scene_") || k.startsWith("layer_") || k.startsWith("var_") || k.startsWith("vugen_") || k === "import" || k === "scene_templates") {
            childInheritedProps[k] = v;
          }
        }
      }
      switch (child.type) {
        case "template":
          const templateProps = processProperties(child.properties);
          const templateMediaPath = templateProps.layer_asset_source || child.inline_media || "";
          templateProps.block_type = "template";
          if (templateMediaPath) {
            templateProps.layer_asset_source = templateMediaPath;
          }
          const template = {
            ...templateProps,
            properties: templateProps,
            layer_asset_source: templateMediaPath,
            layers: [],
            propertyMetadata: child.propertyMetadata || {}
          };
          project.templates[child.title] = template;
          this._walk(child, project, null, template, childInheritedProps);
          break;
        case "video":
          const videoProps = processProperties(child.properties);
          if (videoProps.video_sources) {
            project.video_sources = {
              ...project.video_sources || {},
              ...videoProps.video_sources
            };
            delete videoProps.video_sources;
          }
          project.config = { ...project.config, ...videoProps };
          project.propertyMetadata = {
            ...project.propertyMetadata || {},
            ...child.propertyMetadata || {}
          };
          this._walk(child, project, currentSection, currentScene, childInheritedProps);
          break;
        case "templates":
          this._walk(child, project, currentSection, currentScene, childInheritedProps);
          break;
        case "sets":
          this._walk(child, project, currentSection, currentScene, childInheritedProps);
          break;
        case "set": {
          const setProps = processProperties(child.properties);
          delete setProps.block_type;
          if (!project.property_sets) project.property_sets = {};
          project.property_sets[child.title] = {
            name: child.title,
            description: child.content || void 0,
            properties: setProps
          };
          break;
        }
        case "section":
          const explicitSectionProps = processProperties(child.properties);
          const section = {
            title: child.title,
            properties: { ...inheritedProps, ...explicitSectionProps },
            background: explicitSectionProps.background,
            scenes: []
          };
          project.sections.push(section);
          this._walk(child, project, section, null, childInheritedProps);
          break;
        case "scene":
          const scene = this._processScene(child, project, currentSection, childInheritedProps);
          this._walk(child, project, currentSection, scene, childInheritedProps);
          break;
        case "layer":
          if (currentScene) {
            this._processLayer(child, currentScene);
          }
          break;
        case "note":
          break;
        default:
          this._walk(child, project, currentSection, currentScene);
          break;
      }
      if (!currentSection && project.sections.length > 0) {
        const lastSection = project.sections[project.sections.length - 1];
        if (lastSection.title === "Default Section") {
          currentSection = lastSection;
        }
      }
    });
  }
  static _processScene(child, project, currentSection, inheritedProps) {
    const explicitProps = processProperties(child.properties);
    const sceneProps = { ...inheritedProps, ...explicitProps };
    const rawTemplates = sceneProps.scene_templates || [];
    const explicitTemplates = Array.isArray(rawTemplates) ? rawTemplates : typeof rawTemplates === "string" ? rawTemplates.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean) : rawTemplates ? [String(rawTemplates)] : [];
    const sceneTemplates = [...explicitTemplates];
    const scene = {
      sIdx: currentSection ? project.sections.indexOf(currentSection) : 0,
      idx: currentSection ? currentSection.scenes.length : 0,
      scene_name: child.title,
      // Header title
      scene_content: child.content || sceneProps.scene_content || "",
      scene_templates: sceneTemplates,
      scene_sources: sceneProps.scene_sources || [],
      inheritedProperties: { ...inheritedProps },
      properties: {
        ...explicitProps
      },
      layers: [],
      scene_background_audio_volume: sceneProps.scene_background_audio_volume ?? 0.3,
      scene_voice_volume: sceneProps.scene_voice_volume ?? 1,
      startLine: child.startLine || 1,
      propertyMetadata: child.propertyMetadata || {},
      finalProperties: {}
    };
    if (child.inline_media) {
      const inlineMediaMatch = child.inline_media.match(/^(.+?)(?:\s+(.+))?$/);
      scene.layers.push({
        layer_name: "background",
        layer_level: 0,
        layer_type: inlineMediaMatch ? rules_default.properties.layer_type?.default || "image" : void 0,
        layer_asset_source: inlineMediaMatch ? inlineMediaMatch[1] : "",
        properties: {
          layer_level: 0,
          layer_type: rules_default.properties.layer_type?.default || "image",
          layer_asset_source: child.inline_media,
          layer_width: rules_default.properties.layer_width?.default || 100,
          layer_height: rules_default.properties.layer_height?.default || 100
        },
        startLine: child.startLine
      });
    }
    if (!currentSection) {
      const defaultSection = {
        title: "Default Section",
        properties: { ...inheritedProps },
        background: inheritedProps.background,
        scenes: []
      };
      project.sections.push(defaultSection);
      currentSection = defaultSection;
    }
    currentSection.scenes.push(scene);
    return scene;
  }
  static _processLayer(child, currentScene) {
    const explicitProps = processProperties(child.properties);
    const inheritedProps = {};
    const cascadeProps = (sourceProps) => {
      for (const [k, v] of Object.entries(sourceProps)) {
        if (k.startsWith("layer_") || k.startsWith("var_") || k.startsWith("vugen_") || k === "import") {
          inheritedProps[k] = v;
        }
      }
    };
    cascadeProps(currentScene.properties || {});
    const layerProps = { ...inheritedProps, ...explicitProps };
    if (child.inline_media && !layerProps.layer_asset_source) {
      layerProps.layer_asset_source = child.inline_media;
    }
    if (["text", "text_static", "text_dynamic", "text_ai_embedded"].includes(layerProps.layer_type) && child.content && !layerProps.layer_text_content) {
      layerProps.layer_text_content = child.content;
    }
    if (!currentScene.layers) currentScene.layers = [];
    const normalizedTitle = child.title.toLowerCase() === "background" ? "background" : child.title;
    const existingLayer = currentScene.layers.find(
      (l) => l.layer_name.toLowerCase() === normalizedTitle.toLowerCase()
    );
    if (existingLayer) {
      if (layerProps.layer_type) existingLayer.layer_type = layerProps.layer_type;
      if (layerProps.layer_asset_source)
        existingLayer.layer_asset_source = layerProps.layer_asset_source;
      if (layerProps.layer_asset_citation_key)
        existingLayer.layer_asset_citation_key = layerProps.layer_asset_citation_key;
      if (layerProps.layer_asset_access_date)
        existingLayer.layer_asset_access_date = layerProps.layer_asset_access_date;
      existingLayer.properties = { ...existingLayer.properties, ...layerProps };
      existingLayer.finalProperties = {
        ...existingLayer.finalProperties || {},
        ...layerProps
      };
    } else {
      const layer = {
        layer_name: normalizedTitle,
        layer_level: layerProps.layer_level,
        layer_type: layerProps.layer_type,
        layer_asset_source: layerProps.layer_asset_source || "",
        layer_asset_citation_key: layerProps.layer_asset_citation_key,
        layer_asset_access_date: layerProps.layer_asset_access_date,
        properties: { ...layerProps },
        finalProperties: { ...layerProps },
        startLine: child.startLine,
        propertyMetadata: child.propertyMetadata || {}
      };
      currentScene.layers.push(layer);
    }
  }
  static _postProcessProject(project, templates = {}) {
    project.sections.forEach((section, sIdx) => {
      let sceneIdx = 0;
      section.scenes?.forEach((scene) => {
        if (scene.block_type === "note") return;
        scene.sIdx = sIdx;
        scene.idx = sceneIdx;
        this._resolveLayerInheritance(
          scene,
          project.templates || templates,
          project.config,
          project.video_sources,
          project.property_sets
        );
        sceneIdx++;
      });
    });
    const flattenScenes = [];
    project.sections.forEach((section, sIdx) => {
      let sceneIdx = 0;
      section.scenes.forEach((item) => {
        if (item.block_type === "note") return;
        const scene = item;
        flattenScenes.push({ sIdx, idx: sceneIdx, scene });
        sceneIdx++;
      });
    });
    project.flattenScenes = flattenScenes;
  }
};

// iNNfo/packages/innfo-video-parser/src/utils/schema_utils.ts
var getDefaultsFromSchema = (scope) => {
  const defaults = {};
  const properties = rules_default.properties;
  for (const key in properties) {
    const property = properties[key];
    const scopes = property.scopes || (property.scope ? [property.scope] : []);
    if (scopes.includes(scope)) {
      if ("default" in property) {
        defaults[key] = property.default;
      }
    }
  }
  return defaults;
};
var getPropertyMetadata = (key) => {
  const properties = rules_default.properties;
  const prop = properties[key];
  return prop;
};
var getPropertyOrder = () => {
  const properties = rules_default.properties;
  return Object.keys(properties);
};

// iNNfo/packages/innfo-video-parser/src/parser/Serializer.ts
var ScriptSerializer = class {
  /**
   * Serializes a project back into markdown
   * @param {Project | Scene | Section} input - Project or part to serialize
   * @returns {string} Serialized markdown
   */
  static serialize(input) {
    const isV0x = true;
    const isProject = !!(input.config && input.sections);
    if (isProject) {
      return this._serializeProject(input, isV0x);
    } else if (input.scenes) {
      return this.serializeSection(input, isV0x, input.config || {});
    } else if (input.properties && (input.scene_name || input.scene_content)) {
      return this.serializeScene(input, isV0x, {}, input.config || {});
    }
    return "";
  }
  static _serializeProject(project, isV0x = false) {
    const config = project.config;
    const specVersion = config.video_anydeo_specification || "V_0-3-2";
    let md = `//ANYDEO_SPEC: ${specVersion}

`;
    const propertySets = project.property_sets || {};
    const setNames = Object.keys(propertySets);
    if (setNames.length > 0) {
      md += `# sets
`;
      setNames.forEach((name) => {
        const set = propertySets[name];
        md += `
@set ${name}`;
        if (set.description) md += `  ${set.description}`;
        md += `
`;
        md += this._serializeProperties(set.properties || {}, "set", isV0x, {}, {});
      });
      md += `
`;
    }
    const templates = project.templates || {};
    const templateNames = Object.keys(templates);
    if (templateNames.length > 0) {
      md += `# templates
`;
      templateNames.forEach((name) => {
        md += `
` + this.serializeTemplate(name, templates[name], isV0x, templates, specVersion);
      });
      md += `
`;
    }
    md += `# video
`;
    md += `- video_anydeo_specification: ${specVersion}
`;
    const videoProps = { ...project.config };
    delete videoProps.anydeo_specification;
    delete videoProps.video_anydeo_specification;
    const videoDefaults = {};
    const systemRules = this.rules || rules_default;
    if (systemRules && systemRules.properties) {
      Object.entries(systemRules.properties).forEach(([key, rule]) => {
        if (rule.scope === "video" && rule.default !== void 0) {
          videoDefaults[key] = rule.default;
        }
      });
    }
    md += this._serializeProperties(
      videoProps,
      "video",
      isV0x,
      { video_anydeo_specification: specVersion },
      videoDefaults
    );
    (project.sections || []).forEach((section) => {
      md += this.serializeSection(section, isV0x, project.config, templates);
    });
    return md;
  }
  static serializeSection(section, isV0x = false, videoConfig = {}, templates = {}) {
    const sectionTitle = section.name || section.title || "Untitled Section";
    const sectionMarker = "##";
    const isDefaultSection = sectionTitle === "Default Section";
    let md = isDefaultSection ? "" : `
${sectionMarker} ${sectionTitle}
`;
    md += this._serializeProperties(section.properties || {}, "section", isV0x, videoConfig, {});
    (section.scenes || []).forEach((scene) => {
      if (scene.block_type === "note") {
        md += `
> ${scene.scene_content}
`;
      } else {
        md += this.serializeScene(scene, isV0x, templates, {
          ...videoConfig,
          ...section.properties
        });
      }
    });
    return md;
  }
  static serializeScene(scene, isV0x = false, templates = {}, parentProps = {}) {
    if (scene.block_type === "note") {
      return `
> ${scene.scene_content}
`;
    }
    const activeTemplates = scene.scene_templates || [];
    const filtered = activeTemplates.filter((t) => t !== "scene");
    const tplPrefix = filtered.length > 0 ? filtered.map((t) => `@${t}`).join(" ") + " " : "";
    const namePart = scene.scene_name || "Untitled Scene";
    let md = "";
    let cleanName = namePart.replace(/^(?:@scene\s+|@\s+)/, "").trim();
    if (filtered.length > 0) {
      filtered.forEach((t) => {
        const atRegex = new RegExp(`^@${t}\\s+`);
        while (atRegex.test(cleanName)) cleanName = cleanName.replace(atRegex, "").trim();
        const noAtRegex = new RegExp(`^${t}\\s+`);
        while (noAtRegex.test(cleanName) && cleanName !== t) {
          cleanName = cleanName.replace(noAtRegex, "").trim();
        }
      });
      if (!cleanName) cleanName = filtered[0];
    }
    if (tplPrefix) {
      md = `
${tplPrefix}${cleanName}
`;
    } else {
      const hasPrefix = cleanName.startsWith("@");
      md = hasPrefix ? `
${cleanName}
` : `
@ ${cleanName}
`;
    }
    let inheritedFromTemplates = {};
    let templateLayers = [];
    activeTemplates.forEach((tName) => {
      const tpl = templates[tName];
      if (tpl) {
        const tplProps = tpl.properties || tpl;
        inheritedFromTemplates = { ...inheritedFromTemplates, ...tplProps };
        if (tpl.layers) templateLayers = [...templateLayers, ...tpl.layers];
      }
    });
    const sceneContext = { ...parentProps, ...inheritedFromTemplates };
    md += this._serializeProperties(
      scene.properties || {},
      "scene",
      isV0x,
      sceneContext,
      getDefaultsFromSchema("scene")
    );
    const content = scene.scene_content || scene.properties?.scene_content || scene.properties?.content;
    if (content) {
      md += `
${content.trim()}
`;
    } else {
      console.log(
        "DEBUG: No content found for scene:",
        scene.scene_name,
        "Properties keys:",
        Object.keys(scene.properties || {})
      );
    }
    const layers = scene.layers || [];
    templateLayers.forEach((tl) => {
      const tlName = tl.layer_name;
      const tlLevel = tl.layer_level;
      const stillExists = layers.some((l) => {
        const lName = l.layer_name;
        const lLevel = l.layer_level ?? l.properties?.layer_level;
        if (tlName && lName) {
          return tlName.toLowerCase() === lName.toLowerCase();
        }
        if (tlLevel !== void 0 && lLevel !== void 0) {
          return tlLevel === lLevel;
        }
        return false;
      });
      if (!stillExists) {
        const rawTlName = tl.layer_name || "";
        const normalizedTlName = rawTlName.toLowerCase() === "background" ? "background" : rawTlName;
        const namePart2 = normalizedTlName ? ` ${normalizedTlName}` : "";
        md += `
@@${namePart2}
- layer_active: false
`;
      }
    });
    layers.forEach((layer) => {
      const lName = layer.layer_name;
      const lLevel = layer.layer_level ?? layer.properties?.layer_level;
      const matchingTplLayer = templateLayers.find((tl) => {
        const tlName = tl.layer_name;
        const tlLevel = tl.layer_level;
        if (tlName && lName) {
          return tlName.toLowerCase() === lName.toLowerCase();
        }
        if (tlLevel !== void 0 && lLevel !== void 0) {
          return tlLevel === lLevel;
        }
        return false;
      });
      const layerInheritedContext = { ...sceneContext };
      Object.entries(sceneContext).forEach(([k, v]) => {
        const isNativePrefix = k.startsWith("video_") || k.startsWith("scene_") || k.startsWith("layer_") || k.startsWith("var_") || k.startsWith("vugen_") || k.startsWith("(");
        if (!isNativePrefix && k !== "import") delete layerInheritedContext[k];
      });
      if (matchingTplLayer) {
        const tplLayerProps = matchingTplLayer.properties || matchingTplLayer;
        const layerOverrides = this._serializeProperties(
          layer.properties || {},
          "layer",
          isV0x,
          { ...layerInheritedContext, ...tplLayerProps },
          getDefaultsFromSchema("layer")
        );
        const layerSource = layer.layer_asset_source || layer.properties?.layer_asset_source;
        const tplSource = matchingTplLayer.layer_asset_source || tplLayerProps?.layer_asset_source;
        if (!layerOverrides.trim() && layerSource === tplSource) {
          return;
        }
        md += `
` + this.serializeLayer(layer, isV0x, { ...layerInheritedContext, ...tplLayerProps });
      } else {
        md += `
` + this.serializeLayer(layer, isV0x, layerInheritedContext);
      }
    });
    return md;
  }
  static serializeLayer(layer, isV0x = false, inheritedProperties = {}) {
    const rawName = layer.layer_name || "";
    const normalizedName = rawName.toLowerCase() === "background" ? "background" : rawName;
    const name = normalizedName ? ` ${normalizedName}` : "";
    const propsMd = this._serializeProperties(
      layer.properties || {},
      "layer",
      isV0x,
      inheritedProperties,
      getDefaultsFromSchema("layer")
    );
    const source = layer.layer_asset_source || layer.properties?.layer_asset_source;
    const inheritedSource = inheritedProperties.layer_asset_source;
    const layerHeader = `@@${name}
`;
    let md = layerHeader;
    md += propsMd;
    if (source && source !== inheritedSource) {
      md += `![media](${source})
`;
    }
    const textContent = layer.layer_text_content || layer.properties?.layer_text_content;
    const inheritedText = inheritedProperties.layer_text_content;
    const type = layer.layer_type || layer.properties?.layer_type || inheritedProperties.layer_type;
    if (textContent && textContent !== inheritedText && (type === "text" || type === "text_static" || type === "text_dynamic" || type === "text_ai_embedded")) {
      md += `
${textContent.trim()}
`;
    }
    return md;
  }
  static _serializeProperties(properties, scope, allowCascading = false, inheritedProperties = {}, systemDefaults = {}) {
    if (!properties) return "";
    let md = "";
    const isSetScope = scope === "set";
    const SKIP_KEYS = [
      "sIdx",
      "idx",
      "usage",
      "block_type",
      "templates_resolved",
      "_key",
      "layer_name",
      "scene_name",
      "section_title",
      "scene_content",
      "propertyMetadata",
      "startLine",
      "finalProperties",
      "inheritedProperties",
      "layers",
      "sections",
      "templates",
      ...isSetScope ? [] : ["layer_asset_source", "layer_meta_source", "layer_text_content"],
      "video_anydeo_specification",
      "anydeo_specification"
    ];
    const canonicalOrder = getPropertyOrder();
    const keys = Object.keys(properties).filter((key) => !SKIP_KEYS.includes(key) && !key.startsWith("_")).sort((a, b) => {
      const normA = normalizePropertyKey(a.startsWith("(") ? a.substring(1, a.length - 1) : a);
      const normB = normalizePropertyKey(b.startsWith("(") ? b.substring(1, b.length - 1) : b);
      let idxA = canonicalOrder.indexOf(normA);
      let idxB = canonicalOrder.indexOf(normB);
      if (idxA === -1 && a.includes("/")) {
        const parentKey = Object.keys(properties).find((pk) => {
          const val = properties[pk];
          return typeof val === "string" && a.startsWith(val + "/");
        });
        if (parentKey) {
          const parentIdx = canonicalOrder.indexOf(normalizePropertyKey(parentKey));
          if (parentIdx !== -1) idxA = parentIdx + 1e-3;
        }
      }
      if (idxB === -1 && b.includes("/")) {
        const parentKey = Object.keys(properties).find((pk) => {
          const val = properties[pk];
          return typeof val === "string" && b.startsWith(val + "/");
        });
        if (parentKey) {
          const parentIdx = canonicalOrder.indexOf(normalizePropertyKey(parentKey));
          if (parentIdx !== -1) idxB = parentIdx + 1e-3;
        }
      }
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      if (idxA === idxB) return a.localeCompare(b);
      return idxA - idxB;
    });
    keys.forEach((key) => {
      const value = properties[key];
      if (value === void 0 || value === null) return;
      const canonicalKey = normalizePropertyKey(key);
      const metadata = getPropertyMetadata(canonicalKey);
      if (scope && scope !== "template" && scope !== "set" && metadata && metadata.scope && metadata.scope !== scope) {
        const isCascadable = allowCascading && (scope === "video" || scope === "section") && (metadata.scope === "scene" || metadata.scope === "layer");
        if (!isCascadable) return;
      }
      if (key in inheritedProperties && inheritedProperties[key] === value) {
        return;
      }
      if (key in systemDefaults && systemDefaults[key] === value && !(key in inheritedProperties)) {
        return;
      }
      if (key === "layer_asset_raw_url" && properties["layer_asset_source"]) {
        const source = properties["layer_asset_source"];
        const isLocal = typeof source === "string" && !source.startsWith("http");
        if (isLocal) return;
      }
      let valStr = String(value).trim();
      if (Array.isArray(value)) {
        valStr = value.join(", ").trim();
      } else if (typeof value === "boolean") {
        valStr = value ? "true" : "false";
      } else if (typeof value === "object") {
        return;
      }
      const isMultiline = valStr.includes("\n");
      const cleanKey = key.startsWith("(") && key.endsWith(")") ? key.substring(1, key.length - 1) : key;
      const displayKey = metadata && metadata.hidden ? `(${cleanKey})` : key;
      const prefix = "- ";
      if (isMultiline) {
        md += `${prefix}${displayKey}: \`\`\`
${valStr}
\`\`\`
`;
      } else {
        md += `${prefix}${displayKey}: ${valStr}
`;
      }
    });
    return md;
  }
  /**
   * Serializes a single template.
   */
  static serializeTemplate(name, props, isV0x, allTemplates, specVersion) {
    let md = `@template ${name}
`;
    const dataToSerialize = props && props.properties ? props.properties : props;
    const inheritedContext = { video_anydeo_specification: specVersion };
    md += this._serializeProperties(
      dataToSerialize,
      "template",
      true,
      inheritedContext,
      getDefaultsFromSchema("template")
    );
    const source = dataToSerialize.layer_asset_source || props.layer_asset_source;
    if (source) {
      md += `![media](${source})
`;
    }
    const textContent = dataToSerialize.layer_text_content || props.layer_text_content;
    const type = dataToSerialize.layer_type || props.layer_type;
    if (textContent && (type === "text" || type === "text_static" || type === "text_dynamic" || type === "text_ai_embedded")) {
      md += `
${textContent.trim()}
`;
    }
    if (props && props.layers && Array.isArray(props.layers)) {
      props.layers.forEach((l) => {
        md += this.serializeLayer(l, isV0x, inheritedContext);
      });
    }
    return md;
  }
};

// scripts/mirror/video-parser-entry.ts
var VUS_SPEC = {
  version: "V_0-3-3",
  sha256: "d617aadcc85ad5816ca0b447e28032b14c1fc64bac65f550fa4149bd4f7cedda",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: V_0_3_3_default
};
function parse(text, title) {
  return ScriptParser.parse(text, title);
}
function validate(project) {
  const issues = [];
  SemanticValidator.validate(project, issues);
  return issues;
}
export {
  AppSettingsSchema,
  ForgeModelDefinitionSchema,
  HardwareStatusSchema,
  LayerSchema,
  ModelDefinitionSchema,
  ModelsConfigSchema,
  NoteSchema,
  ProjectSchema,
  PropertySetSchema,
  RecentScriptSchema,
  SceneSchema,
  ScriptParser,
  ScriptSerializer,
  SectionSchema,
  SemanticValidator,
  SourceEntrySchema,
  UISchemaSchema,
  VUS_SPEC,
  parse,
  validate
};
