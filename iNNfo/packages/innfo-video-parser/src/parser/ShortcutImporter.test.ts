/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { describe, it, expect } from 'vitest';
import { ShortcutImporter } from './ShortcutImporter.js';

describe('ShortcutImporter', () => {
    it('transpiles shorthand logic with implicit formatting constraints', () => {
        const raw = `// Plantilla1\nFirst paragraph.\n\n// Plantilla2\nSecond paragraph.`;
        
        const output = ShortcutImporter.transpile(raw);
        console.log("DEBUG OUTPUT:\n", output);
        
        expect(output).toContain('## Default Section');
        expect(output).toContain('- import: Plantilla1');
        expect(output).toContain('First paragraph.');
        expect(output).toContain('- import: Plantilla2');
        expect(output).toContain('Second paragraph.');
    });

    it('passes multi-line content strictly without omitting breaks', () => {
        const raw = `// Template_JSON\n{\n  "test": 123,\n  "text": "Multi\\nline"\n}`;
        
        const output = ShortcutImporter.transpile(raw);
        
        expect(output).toContain('{\n  "test": 123,\n  "text": "Multi\\nline"\n}');
        expect(output).toContain('- import: Template_JSON');
    });

    it('bypasses transpilation for natively defined AST logic but creates default sections', () => {
        const raw = `# Intro\n@ Scene Native\n- layer_text_color: "red"`;
        const output = ShortcutImporter.transpile(raw);
        
        expect(output).not.toContain('## Default Section'); // Custom header skips
        expect(output).toContain('@ Scene Native');
    });

    it('does not inject implicit scene markers into multiline properties', () => {
        const raw = `# Video\n- video_text2script_instructions: \`\`\`\nTransform this.\n\nKeep it as is.\n\`\`\``;
        const output = ShortcutImporter.transpile(raw);
        
        console.log("DEBUG OUTPUT (Multiline):\n", output);
        
        expect(output).not.toContain('@ ');
        expect(output).toContain('Transform this.\n\nKeep it as is.');
    });
});
