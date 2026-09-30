# Spec: Template Procedures Manifest Distribution and Dynamic MCP Discovery

## Requirements

### R-TPD-01: Directory-Based Template Package Discovery
`listTemplates` MUST scan both single-file markdown templates and directory-based template packages in workspace and global stores, resolving primary spec documents and versions accurately.

#### Scenario: Listing templates containing subdirectory packages
- GIVEN a template store containing `templates/video/spec_NN.md` and `templates/business.md`
- WHEN `listTemplates()` is invoked
- THEN both `video` and `business` MUST be returned in the discovered template list with valid file paths and versions.

### R-TPD-02: Transitive Procedure Discovery from Disk and Frontmatter
`listTemplateProcedures` and `discoverTransitiveAssets` MUST discover executable SOP procedures declared in template frontmatter AND procedure markdown files residing within the template's `procedures/` package directory, deduplicating by procedure `id`.

#### Scenario: Querying procedures of a package shipping a procedures folder
- GIVEN a template package with `procedures/generate_video_script_NN.md`
- WHEN `list_template_procedures` is called for that template or across workspace templates
- THEN the returned procedures list MUST contain `generate-video-script` with its title, path (`procedures/generate_video_script_NN.md`), and source template.

### R-TPD-03: Manifest Template Package Asset Hydration
`skills-manager` during install and update MUST preserve and extract the complete template package directory (`procedures/`, `assets/`, `samples/`) into `~/.agents/templates/<name>/`.

#### Scenario: Installing a template package from manifest
- GIVEN a template declared in `manifest/source.yaml` whose repository path resides in a package directory
- WHEN `skills-manager update --yes` or `skills-manager install` executes
- THEN the entire template directory including `procedures/` MUST be installed to the local templates directory.
