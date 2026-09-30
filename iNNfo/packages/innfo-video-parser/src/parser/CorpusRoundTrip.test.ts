
/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { describe, it, expect } from 'vitest';
import { ScriptParser } from './Parser.js';
import { ScriptSerializer } from './Serializer.js';

describe('Corpus Round-Trip', () => {
    const scripts = [
        {
            name: 'Simple Project',
            content: `# Video\nanydeo_specification: V_0-2-3\n- video_name: Simple Test\n- (video_author): Hidden Author\n\n## Section 1\n@ Scene 1\n- scene_voice: Friendly_Person\nHello world.\n\n@@10 background\n![media](https://example.com/bg.jpg)\n`
        },
        {
            name: 'Multiline Property',
            content: `# Video\n- video_name: Multiline Test\n- video_text2script_instructions: \`\`\`\nTransform the source text into a logical sequence of approximately 5 scenes.\n\nSTRUCTURE RULES:\n1. SCENE 1 (Hook): Use template "@ta1".\n\`\`\`\n\n## Section 1\n@ Scene 2\nContent.\n`
        },
        {
            name: 'Templates and Layers',
            content: `# Templates\n\n@template host_scene\n- scene_voice: Impressive\n@@10 Host\n- layer_type: talking_avatar\n- layer_avatar_model: lucas-ai\n\n# Sections\n\n## Main\n@host_scene Welcome\nThis is a test of template inheritance.\n\n@@30 overlay\n- layer_type: image\n![media](overlay.png)\n`
        }
    ];

    it('should round-trip corpus scripts preserving core structural data', () => {
        scripts.forEach(script => {
            const { project } = ScriptParser.parse(script.content);
            // 2. Serialize back
            const serialized = ScriptSerializer.serialize(project);
            console.log(`[Corpus Test] Serialized output for ${script.name}:\n${serialized}`);
            
            // 3. Re-parse
            const { project: project2 } = ScriptParser.parse(serialized);

            // Compare top-level config (ignoring automatic defaults)
            Object.keys(project.config).forEach(key => {
                if (project.config[key] !== undefined && project.config[key] !== '') {
                    expect(project2.config[key]).toEqual(project.config[key]);
                }
            });

            expect(project2.sections.length).toEqual(project.sections.length);
            
            for (let i = 0; i < project.sections.length; i++) {
                const s1 = project.sections[i];
                const s2 = project2.sections[i];
                expect(s2.title).toEqual(s1.title);
                expect(s2.scenes.length).toEqual(s1.scenes.length);

                for (let j = 0; j < s1.scenes.length; j++) {
                    const sc1 = s1.scenes[j] as any;
                    const sc2 = s2.scenes[j] as any;
                    expect(sc2.scene_name).toEqual(sc1.scene_name);
                    expect(sc2.scene_content?.trim()).toEqual(sc1.scene_content?.trim());
                    expect(sc2.layers.length).toEqual(sc1.layers.length);
                }
            }
        });
    });
});
