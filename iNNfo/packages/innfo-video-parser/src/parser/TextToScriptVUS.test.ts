import { describe, it, expect } from 'vitest';
import { SemanticValidator } from './SemanticValidator.js';
import { Project } from '../domain/types.js';

describe('Text-to-Script V_0-2-3 VUS Compliance', () => {
    const uiSchema: any = { 
        video: { t: 1 }, 
        scene: { t: 1 }, 
        layer: { t: 1 } 
    };

    it('should recognize video_script_source and video_script_source_type as canonical', () => {
        const project: any = {
            config: {
                video_script_source: "assets/instructions.md",
                video_script_source_type: "podcast"
            },
            uiSchema,
            templates: {},
            sections: []
        };
        const issues: any[] = [];
        const hasErrors = SemanticValidator.validate(project as Project, issues);
        
        const errors = issues.filter(i => i.severity === 'error');
        expect(errors.length).toBe(0);
        expect(hasErrors).toBe(false);
    });


});
