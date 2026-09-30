import { describe, it, expect } from 'vitest';
import { ScriptParser } from './Parser.js';

describe('VUS Parser Integrity', () => {
    it('should NOT treat text with colons as properties unless prefixed with hyphen', () => {
        const content = `//ANYDEO_SPEC: V_0-2-5
# Intro
@ Scene
Narration: This is a test with a colon.
- scene_tts_model: alloy
`;
        const { project } = ScriptParser.parse(content);
        const scene = project.sections[0].scenes[0] as any;
        
        expect(scene.scene_content).toContain('Narration: This is a test with a colon.');
        expect(scene.properties.Narration).toBeUndefined();
        expect(scene.properties.scene_tts_model).toBe('alloy');
    });

    it('should correctly replace the dot placeholder with real content', () => {
        const content = `//ANYDEO_SPEC: V_0-2-5
@template test
- scene_content: "."

@test
Actual narration text
`;
        const { project } = ScriptParser.parse(content);
        const scene = project.sections[0].scenes[0] as any;
        
        // The formal parser should handle the dot placeholder replacement
        expect(scene.scene_content).toBe('Actual narration text');
        expect(scene.scene_content).not.toContain('.');
    });

    it('should synchronize properties between flat object and properties map', () => {
        const content = `//ANYDEO_SPEC: V_0-2-5
# Intro
@ Scene
@@ Overlay
- layer_type: text
This is overlay text
`;
        const { project } = ScriptParser.parse(content);
        const layer = (project.sections[0].scenes[0] as any).layers[0];
        
        expect(layer.layer_text_content).toBe('This is overlay text');
        expect(layer.properties.layer_text_content).toBe('This is overlay text');
    });

    it('should format scene_sources_text correctly from video_sources and URLs', () => {
        const content = `//ANYDEO_SPEC: V_0-3-3
# video
- video_sources: \`\`\`
    key1:
      title: Research Paper
      author: Jane Doe
      url: https://arxiv.org/abs/1234.5678
    key2:
      title: Documentation
      url: https://example.com/docs
    key3:
      author: John Smith
  \`\`\`

# Intro
@ Scene
- scene_sources: ["key1", "key2", "key3", "https://unregistered.com/some-asset"]
- scene_tts_model: alloy
`;
        const { project } = ScriptParser.parse(content);
        const scene = project.sections[0].scenes[0] as any;
        
        expect(scene.scene_sources_text).toBe(
            "Research Paper by Jane Doe (https://arxiv.org/abs/1234.5678), Documentation (https://example.com/docs), John Smith, https://unregistered.com/some-asset"
        );
    });

    it('should interpolate scene_sources_text inside text layers', () => {
        const content = `//ANYDEO_SPEC: V_0-3-3
# video
- video_sources: \`\`\`
    key1:
      title: Research Paper
      author: Jane Doe
      url: https://arxiv.org/abs/1234.5678
  \`\`\`

# Intro
@ Scene
- scene_sources: ["key1"]
@@ overlay
- layer_type: text
- layer_text_content: "Sources: {scene_sources_text}"
`;
        const { project } = ScriptParser.parse(content);
        const layer = (project.sections[0].scenes[0] as any).layers[0];
        
        expect(layer.layer_text_content).toBe("Sources: Research Paper by Jane Doe (https://arxiv.org/abs/1234.5678)");
        expect(layer.properties.layer_text_content).toBe("Sources: Research Paper by Jane Doe (https://arxiv.org/abs/1234.5678)");
    });
});

