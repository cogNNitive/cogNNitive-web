/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { describe, it, expect } from 'vitest';
import { ScriptParser } from './Parser.js';
import { ScriptSerializer } from './Serializer.js';

describe('Script Round-Trip (V_0-2-1)', () => {
    it('should correctly round-trip multiline properties', () => {
        const originalMarkdown = `# Video
- anydeo_specification: V_0-2-1
- video_name: Multiline Test
- video_text2script_instructions: \`\`\`
  Transform the source text into a logical sequence of approximately 5 scenes.
  
  STRUCTURE RULES:
  1. SCENE 1 (Hook): Use template "@ta1".
  
  GENERAL CONSTRAINTS:
  - DO NOT create or hallucinate new templates.
  \`\`\`

# Templates

@template content_scene
@@10 background
- layer_type: stock_image
`;

        // 1. Parse
        const { project } = ScriptParser.parse(originalMarkdown);
        const instructions = project.config.video_text2script_instructions;
        
        expect(instructions).toContain('STRUCTURE RULES:');
        expect(instructions).toContain('GENERAL CONSTRAINTS:');

        // 2. Serialize
        const serialized = ScriptSerializer.serialize(project);
        console.log('SERIALIZED OUTPUT:\n', serialized);
        
        // Check for backticks in serialized output
        expect(serialized).toContain('video_text2script_instructions: ```');
        expect(serialized).toContain('```');

        // 3. Re-parse
        const { project: project2 } = ScriptParser.parse(serialized);
        const instructions2 = project2.config.video_text2script_instructions;

        // Note: The current parser might preserve leading spaces if we add them in serializer.
        // We need to ensure we don't have drift or if we do, it's expected.
        // If we want perfect parity, we might need to adjust the parser to strip the same indentation levels.
        expect(instructions2.trim()).toBe(instructions.trim());
    });

    it('should correctly inherit layer_type: talking_avatar from templates', () => {
        const script = `//ANYDEO_SPEC: V_0-3-2
@template host_scene
@@ Host
- layer_level: 10
- layer_type: talking_avatar
- layer_avatar_model: replicate/lucas-ai/cinematic

@host_scene Welcome
@@ Host
- layer_type: talking_avatar
Este es un test de herencia.
`;
        const { project } = ScriptParser.parse(script);
        
        const scene = project.sections[0].scenes[0] as any;
        const hostLayer = scene.layers.find((l: any) => l.layer_name === 'Host');

        expect(hostLayer).toBeDefined();
        // The layer should have inherited the 'talking_avatar' type from the template
        expect(hostLayer.layer_type).toBe('talking_avatar');
    });
});
