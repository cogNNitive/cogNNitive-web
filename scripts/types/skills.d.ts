/**
 * scripts/types/skills.d.ts
 *
 * Ambient declarations for skill manager state, installation operations, and lockfile structures.
 */

interface SkillStateEntry {
  commit: string;
  version: string;
  updated_at: string;
}

interface TemplateStateEntry {
  commit: string;
  version: string;
  path?: string;
  updated_at: string;
}

interface SkillManagerState {
  manifest: string;
  skills: Record<string, SkillStateEntry>;
  templates: Record<string, TemplateStateEntry>;
}

type BootstrapState = SkillManagerState;

interface SkillManagerArgs {
  positional: string[];
  skillsDir: string | null;
  blueprintsDir: string | null;
  state: string | null;
  stateFile?: string;
  yes: boolean;
  direction: string;
}

interface StatusTableRow {
  type: string;
  name: string;
  pinned: string;
  installed: string;
  status: string;
}
