/**
 * @spec-source:V_0-3-3 | role: quality_check
 * Property sets are part of the canonical VUS cascade (spec default → sets →
 * template → scene). This suite guards the canonical, unambiguous syntax:
 *   - `@set name` declares a set
 *   - a template includes it with `- includes: [name]`
 *   - template chains use `- scene_templates: parent`
 *   - templates expose `includes`/`scene_templates` at the root for the engine
 *
 * A bare `@name` line is NOT a set include; that ambiguous form is unsupported.
 */
import { describe, it, expect } from 'vitest';
import { ScriptParser } from './Parser.js';

const HEADER = '//ANYDEO_SPEC: V_0-3-3\n';
const scenesOf = (project: any) => (project.sections || []).flatMap((s: any) => s.scenes || []);

describe('Property sets & template refs', () => {
    it('defines a property set from `@set name`', () => {
        const script = `${HEADER}# Sets
@set branding
- scene_voice: Wise_Woman
# video
- video_name: probe
## Main
@ Scene A
Hello.
`;
        const { project } = ScriptParser.parse(script, 'probe');
        expect(project.property_sets?.['branding']?.properties?.scene_voice).toBe('Wise_Woman');
    });

    it('resolves `includes: [set]` into scenes using the template', () => {
        const script = `${HEADER}# Sets
@set branding
- scene_voice: Wise_Woman
# Templates
@template branded
- includes: [branding]
# video
- video_name: probe
## Main
@branded Scene A
Hello.
`;
        const { project } = ScriptParser.parse(script, 'probe');
        const scene: any = scenesOf(project)[0];
        expect(scene.scene_name).toBe('Scene A');
        expect(scene.inheritedProperties?.scene_voice ?? scene.finalProperties?.scene_voice).toBe('Wise_Woman');
    });

    it('exposes `includes` at the template root (engine resolver contract)', () => {
        const script = `${HEADER}# Sets
@set branding
- scene_voice: Wise_Woman
# Templates
@template branded
- includes: [branding]
# video
- video_name: probe
## Main
@branded Scene A
Hello.
`;
        const { project } = ScriptParser.parse(script, 'probe');
        expect((project.templates['branded'] as any).includes).toContain('branding');
    });

    it('resolves a template chain declared with `- scene_templates: base`', () => {
        const script = `${HEADER}# Templates
@template base
- scene_voice: Wise_Woman
@template branded
- scene_templates: base
# video
- video_name: probe
## Main
@branded Scene A
Hello.
`;
        const { project } = ScriptParser.parse(script, 'probe');
        expect((project.templates['branded'] as any).scene_templates).toContain('base');
        const scene: any = scenesOf(project)[0];
        expect(scene.inheritedProperties?.scene_voice).toBe('Wise_Woman');
    });

    it('resolves `includes` on the line-based fallback path (# Sets first)', () => {
        const script = `# Sets
@set branding
- scene_voice: Wise_Woman
# Templates
@template branded
- includes: [branding]
# video
- video_name: probe
## Main
@branded Scene A
Hello.
`;
        const { project } = ScriptParser.parse(script, 'probe');
        const scene: any = scenesOf(project)[0];
        expect(scene.scene_name).toBe('Scene A');
        expect(scene.inheritedProperties?.scene_voice).toBe('Wise_Woman');
    });
});
