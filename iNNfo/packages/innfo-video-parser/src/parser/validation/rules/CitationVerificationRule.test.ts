/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { describe, it, expect } from 'vitest';
import { CitationVerificationRule } from './CitationVerificationRule.js';
import { Project, Scene, Layer } from '../../../domain/types.js';
import { ValidationIssue } from '../types.js';

describe('CitationVerificationRule', () => {
    const rule = new CitationVerificationRule();

    it('should not report issues when citekeys exist in video_sources', () => {
        const project = {
            config: {},
            templates: {},
            sections: [],
            video_sources: {
                'ref:paper_2026': { citekey: 'ref:paper_2026', title: 'Paper', author: 'Author', year: 2026, url: 'http://example.com' }
            }
        } as unknown as Project;

        const scene = {
            scene_name: 'Scene 1',
            scene_sources: ['ref:paper_2026', 'http://external.com'],
            layers: []
        } as unknown as Scene;

        const issues: ValidationIssue[] = [];
        rule.validateScene(scene, project, 0, 0, issues);
        expect(issues).toHaveLength(0);
    });

    it('should report error for orphaned citation in scene_sources', () => {
        const project = {
            config: {},
            templates: {},
            sections: [],
            video_sources: {}
        } as unknown as Project;

        const scene = {
            scene_name: 'Scene 1',
            scene_sources: ['ref:missing_paper'],
            layers: []
        } as unknown as Scene;

        const issues: ValidationIssue[] = [];
        rule.validateScene(scene, project, 0, 0, issues);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe('ORPHANED_CITATION');
        expect(issues[0].message).toContain("Citation key 'ref:missing_paper' is not defined in global video_sources repository.");
    });

    it('should report error for orphaned citation in layer_asset_citation_key', () => {
        const project = {
            config: {},
            templates: {},
            sections: [],
            video_sources: {}
        } as unknown as Project;

        const scene = {
            scene_name: 'Scene 1',
            layers: []
        } as unknown as Scene;

        const layer = {
            layer_name: 'bg',
            layer_level: 10,
            layer_asset_citation_key: 'ref:missing_asset'
        } as unknown as Layer;

        const issues: ValidationIssue[] = [];
        rule.validateLayer(layer, scene, project, 0, 0, 0, issues);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe('ORPHANED_CITATION');
        expect(issues[0].message).toContain("Citation key 'ref:missing_asset' is not defined in global video_sources repository.");
    });
});
