/**
 * scripts/types/manifest.d.ts
 *
 * Ambient declarations for manifest schemas, tool metadata, refs, and channel policies.
 */

interface ManifestMcp {
  name: string;
  repo: string;
  path: string;
  version: string;
  commit: string;
  ref: string;
  url?: string;
  description?: string;
}

interface ManifestSkill {
  name: string;
  repo: string;
  path: string;
  version: string;
  commit: string;
  ref: string;
  requires?: string[];
  templates?: string[];
  mcp?: ManifestMcp[];
  description?: string;
}

interface ManifestBlueprint {
  name: string;
  repo: string;
  path: string;
  version: string;
  commit: string;
  ref: string;
  spec_version?: string;
  description?: string;
  metadata?: {
    version?: string;
    [key: string]: any;
  };
}

interface ManifestWorkflow {
  id?: string;
  label?: string;
  template?: string;
  description?: string;
}

interface AgentBootstrap {
  version?: string;
  entrypoint?: string;
  skills: ManifestSkill[];
  templates?: ManifestBlueprint[];
  workflows?: ManifestWorkflow[];
  mcp?: ManifestMcp[];
}

interface ToolManifest {
  version?: string;
  entrypoint?: string;
  skills: ManifestSkill[];
  templates: ManifestBlueprint[];
  workflows: ManifestWorkflow[];
  mcp: ManifestMcp[];
}

interface ChannelPolicy {
  name: string;
  file: string;
  requiredRefKind: 'tag' | 'branch' | string;
  requireTagShape: boolean;
  requireProvenance: boolean;
}

interface ResolvedRefSuccess {
  sha: string;
  kind: 'tag' | 'branch';
  error?: undefined;
}

interface ResolvedRefError {
  error: string;
  sha?: undefined;
  kind?: undefined;
}

type ResolvedRef = ResolvedRefSuccess | ResolvedRefError;

interface RefResolutionResult {
  violation: string | null;
  kind: 'tag' | 'branch' | null;
}

interface ValidationResult {
  violations: string[];
  bundled_blueprints: (string | { name?: string })[];
}

interface ApiResponse<T = any> {
  status: number;
  data: T | null;
  error?: string;
}

interface ManifestValidationArgs {
  repoRoot: string | null;
  channel: string | null;
}
