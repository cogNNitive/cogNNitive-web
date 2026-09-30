# Proposal: Left Sidebar Editor Tree and Header View Controls

## Intent

Streamline the iNNfo-editor layout by eliminating view switching confusion. The left sidebar becomes dedicated exclusively to the model/concept tree, while workspace-level view triggers ("Graph" and "Consoles") move to the top Header. Clicking any tree item while in non-editor views reactively transitions the main area back to the editor view.

## Scope

### In Scope
- **Sidebar Simplification**: Remove the 3-tab view switcher (`editor`, `graph`, `consoles`) from `LeftSidebar.vue`, permanently rendering the concept/model tree.
- **Header View Triggers**: Add navigation buttons in `Header.vue` for switching to `graph` and `consoles` views alongside existing workspace actions.
- **Reactive Tree Selection**: Update tree selection handlers (`selectNode` / `selectConcept`) so clicking any node/concept automatically switches `activeView` to `'editor'` when currently in `'graph'`, `'consoles'`, or other non-editor views.
- **Test Updates**: Adjust unit and E2E tests covering sidebar switcher tabs, header navigation, and view switching reactiveness.

### Out of Scope
- Redesigning the GraphViewer, ConsoleHubView, or TreeEditor views themselves.
- Adding new view types or changing keyboard navigation shortcuts.

## Capabilities

### Modified Capabilities
- `editor-workspace-navigation`: Header hosts primary workspace view triggers (`graph`, `consoles`), and LeftSidebar exclusively hosts tree navigation.
- `model-tree-selection`: Selecting tree nodes reactively restores `activeView = 'editor'`.

## Approach

1. **Header**: Integrate button controls with active-state indicators for switching between Editor, Graph, and Consoles.
2. **LeftSidebar**: Clean up navigation tabs and associated styles, leaving the tree container as the permanent sidebar body.
3. **Store / Selection Reactiveness**: Ensure selection actions in `uiStore` or `LeftSidebar` set `activeView = 'editor'` if not already active.
4. **Validation & Tests**: Run and update component tests (`LeftSidebar.spec.ts`, `Header.spec.ts`, `WorkspaceView.spec.ts`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `iNNfo/apps/innfo-editor/src/components/layout/LeftSidebar.vue` | Modified | Remove view switcher tabs; retain tree view permanently |
| `iNNfo/apps/innfo-editor/src/components/layout/Header.vue` | Modified | Add Graph and Consoles view toggle buttons |
| `iNNfo/apps/innfo-editor/src/stores/uiStore.ts` | Modified | Ensure node selection resets view to editor if needed |
| `iNNfo/apps/innfo-editor/tests/**` | Modified | Update tests asserting view switcher and selection behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Users surprised when tree click changes active view | Low | Standard IDE paradigm (e.g., VS Code explorer tree opens editor) |
| Header clutter on smaller screens | Med | Use responsive compact icon buttons with clear tooltips |

## Rollback Plan

Revert the layout commits in `iNNfo/apps/innfo-editor` on the change branch.

## Success Criteria

- [ ] Left sidebar contains no view switcher tabs and always displays the editor tree.
- [ ] Header includes functional buttons to open Graph and Consoles views.
- [ ] Clicking any item in the left sidebar tree while in Graph or Consoles view immediately switches the central viewport to the Editor view with that element selected.
- [ ] All automated editor tests pass.
