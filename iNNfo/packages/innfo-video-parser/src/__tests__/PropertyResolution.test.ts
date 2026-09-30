import { describe, it, expect } from 'vitest';
import { PropertyResolution } from '../utils/PropertyResolution.js';
import { Project, Scene } from '../domain/types.js';

/**
 * @spec-source:V_0-3-3 | role: unit_test
 *
 * Tests for PropertyResolution — single-property cascade lookups.
 * Verifies the same hierarchy as ConfigResolver but for individual property queries.
 */

function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
        scene_name: 'Test Scene',
        scene_content: 'Content',
        scene_templates: [],
        properties: {},
        layers: [],
        ...overrides,
    } as Scene;
}

function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        config: {},
        templates: {},
        sections: [],
        ...overrides,
    } as Project;
}

describe('PropertyResolution.getEffectiveSceneProperty', () => {
    it('should return scene direct property first', () => {
        const scene = makeScene({ properties: { scene_tts_model: 'DirectVoice' } });
        const project = makeProject({ config: { scene_tts_model: 'ConfigVoice' } });

        const result = PropertyResolution.getEffectiveSceneProperty('scene_tts_model', scene, project);
        expect(result).toBe('DirectVoice');
    });

    it('should fall back to video config when scene has no value', () => {
        const scene = makeScene();
        const project = makeProject({ config: { scene_tts_model: 'ConfigVoice' } });

        const result = PropertyResolution.getEffectiveSceneProperty('scene_tts_model', scene, project);
        expect(result).toBe('ConfigVoice');
    });

    it('should return template property when scene has no value', () => {
        const scene = makeScene({ scene_templates: ['my_tpl'] });
        const project = makeProject({
            templates: { my_tpl: { properties: { scene_tts_model: 'TplVoice' } } } as any,
        });

        const result = PropertyResolution.getEffectiveSceneProperty('scene_tts_model', scene, project);
        expect(result).toBe('TplVoice');
    });

    it('should prefer last template in list (highest priority)', () => {
        const scene = makeScene({ scene_templates: ['base_tpl', 'override_tpl'] });
        const project = makeProject({
            templates: {
                base_tpl: { properties: { scene_tts_model: 'BaseVoice' } },
                override_tpl: { properties: { scene_tts_model: 'OverrideVoice' } },
            } as any,
        });

        const result = PropertyResolution.getEffectiveSceneProperty('scene_tts_model', scene, project);
        expect(result).toBe('OverrideVoice');
    });

    it('should return undefined for non-existent property', () => {
        const scene = makeScene();
        const project = makeProject();

        const result = PropertyResolution.getEffectiveSceneProperty('nonexistent', scene, project);
        expect(result).toBeUndefined();
    });

    it('should skip empty string values', () => {
        const scene = makeScene({ properties: { scene_tts_model: '' } });
        const project = makeProject({ config: { scene_tts_model: 'FallbackVoice' } });

        const result = PropertyResolution.getEffectiveSceneProperty('scene_tts_model', scene, project);
        expect(result).toBe('FallbackVoice');
    });

    it('should use finalProperties fast path when available', () => {
        const scene = makeScene({
            properties: { scene_tts_model: 'DirectVoice' },
        });
        // Simulate ConfigResolver having already resolved this scene
        (scene as any).finalProperties = { scene_tts_model: 'ResolvedVoice' };

        const project = makeProject();
        const result = PropertyResolution.getEffectiveSceneProperty('scene_tts_model', scene, project);
        expect(result).toBe('ResolvedVoice');
    });
});

describe('PropertyResolution.getEffectiveLayerProperty', () => {
    it('should return layer direct property first', () => {
        const scene = makeScene();
        const project = makeProject();
        const layer = { layer_name: 'bg', properties: { layer_type: 'ai_image' } } as any;

        const result = PropertyResolution.getEffectiveLayerProperty('layer_type', layer, scene, project);
        expect(result).toBe('ai_image');
    });

    it('should fall back to scene property for layer_ prefixed keys', () => {
        const scene = makeScene({ properties: { layer_type: 'stock_image' } });
        const project = makeProject();
        const layer = { layer_name: 'bg', properties: {} } as any;

        const result = PropertyResolution.getEffectiveLayerProperty('layer_type', layer, scene, project);
        expect(result).toBe('stock_image');
    });

    it('should check template layers by matching layer_name', () => {
        const scene = makeScene({ scene_templates: ['my_tpl'] });
        const project = makeProject({
            templates: {
                my_tpl: {
                    layers: [
                        { layer_name: 'bg', properties: { layer_type: 'template_image' } },
                    ],
                },
            } as any,
        });
        const layer = { layer_name: 'bg', properties: {} } as any;

        const result = PropertyResolution.getEffectiveLayerProperty('layer_type', layer, scene, project);
        expect(result).toBe('template_image');
    });
});
