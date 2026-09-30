/**
 * @spec-source: V_0-2-3 | role: implementation_test
 */
import { describe, it, expect } from 'vitest';
import { ScriptParser } from './Parser.js';
import { ScriptSerializer } from './Serializer.js';
import { parse as peggyParse } from './vus_parser.js';

describe('VUS Formal Round-Trip', () => {
    it('should correctly round-trip a simple formal script', () => {
        const input = `## Intro
- scene_content: Welcome to the future.
@ Scene 1
- scene_voice: Deep_Voice_Man
@@ Background
- layer_level: 10
- layer_type: image
- layer_asset_source: bg.jpg
`;
        
        const ast = (peggyParse as any)(input);
        console.log('AST:', JSON.stringify(ast, null, 2));
        const { project, issues } = ScriptParser.parse(input);
        if (issues.length > 0) console.log('Issues:', JSON.stringify(issues, null, 2));
        expect(issues.filter(i => i.severity === 'error').length).toBe(0);
        
        // Ensure it's marked as V_0-2-3 for the formal serializer
        project.config.anydeo_specification = 'V_0-2-3';
        
        // 2. Serialize back
        const serialized = ScriptSerializer.serialize(project);
        console.log('FORMAL SERIALIZED:\n', serialized);
        
        // 3. Re-parse
        const { project: project2, issues: issues2 } = ScriptParser.parse(serialized);
        expect(issues2.filter(i => i.severity === 'error').length).toBe(0);
        
        // Compare essential structural data
        expect(project2.sections[0].title).toBe('Intro');
        expect((project2.sections[0].scenes[0] as any).scene_name).toBe('Scene 1');
        expect((project2.sections[0].scenes[0] as any).layers[0].layer_asset_source).toBe('bg.jpg');
    });

    it('should preserve multiline properties in round-trip', () => {
        const input = `@ Scene 1
- scene_content: \`\`\`
Line 1
Line 2
\`\`\`
`;
        const { project } = ScriptParser.parse(input);
        project.config.anydeo_specification = 'V_0-2-3';
        
        const output = ScriptSerializer.serialize(project);
        expect(output).toContain('Line 1');
        expect(output).toContain('Line 2');
        
        const { project: project2 } = ScriptParser.parse(output);
        expect((project2.sections[0].scenes[0] as any).scene_content).toContain('Line 1');
        expect((project2.sections[0].scenes[0] as any).scene_content).toContain('Line 2');
    });
});
