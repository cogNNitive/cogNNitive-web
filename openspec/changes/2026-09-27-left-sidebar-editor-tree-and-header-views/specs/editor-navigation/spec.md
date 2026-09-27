# Delta for Editor Navigation

## ADDED Requirements

### Requirement: Sidebar Dedicated to Model and Concept Tree Navigation

The `LeftSidebar` component MUST permanently render the model and concept tree structure for the active workspace. The `LeftSidebar` MUST NOT contain tab controls or view switchers for switching between `editor`, `graph`, and `consoles` views.

#### Scenario: Left sidebar displays concept tree without view switcher tabs
- GIVEN the `innfo-editor` application is open with an active workspace
- WHEN the user views the left sidebar
- THEN the concept and model tree is permanently visible
- AND no tab buttons for switching between Editor, Graph, or Consoles views are displayed within the sidebar

#### Scenario: Tree remains accessible across different workspace views
- GIVEN the application is in any workspace view (such as `editor`, `graph`, or `consoles`)
- WHEN the left sidebar is visible
- THEN the user can browse, expand, collapse, and interact with the model tree nodes without leaving the sidebar

---

### Requirement: Workspace View Controls in Header

The `Header` component MUST provide interactive navigation controls for switching among the primary workspace views (`editor`, `graph`, and `consoles`). The header view controls MUST reflect the currently active view with an active state indicator.

#### Scenario: Navigating to Graph view from Header
- GIVEN the application is currently displaying the `editor` view
- WHEN the user clicks the "Graph" view button in the Header
- THEN the application state updates `activeView` to `'graph'`
- AND the central workspace renders the `GraphViewer`
- AND the Header's "Graph" button displays an active state indicator

#### Scenario: Navigating to Consoles view from Header
- GIVEN the application is currently displaying the `editor` or `graph` view
- WHEN the user clicks the "Consoles" view button in the Header
- THEN the application state updates `activeView` to `'consoles'`
- AND the central workspace renders the `ConsoleHubView`
- AND the Header's "Consoles" button displays an active state indicator

#### Scenario: Header visual state indicates active view
- GIVEN the application is displaying any view (`editor`, `graph`, or `consoles`)
- WHEN the Header is rendered
- THEN the button corresponding to the current `activeView` MUST indicate active status
- AND the other view buttons MUST indicate inactive status

---

### Requirement: Tree Node Selection Reactivity Across Workspace Views

Selecting any node, element, or concept in the `LeftSidebar` tree MUST immediately transition the application's `activeView` to `'editor'` if the current view is `'graph'`, `'consoles'`, or any other non-editor view, and display/focus the selected element in the editor.

#### Scenario: Selecting a concept while viewing the Graph
- GIVEN the application's `activeView` is `'graph'`
- WHEN the user clicks on a concept or element in the `LeftSidebar` tree
- THEN `activeView` is updated to `'editor'`
- AND the editor main viewport displays the selected concept or element
- AND the Header view indicator updates to reflect `'editor'` as active

#### Scenario: Selecting an element while viewing the Consoles
- GIVEN the application's `activeView` is `'consoles'`
- WHEN the user clicks on a concept or element in the `LeftSidebar` tree
- THEN `activeView` is updated to `'editor'`
- AND the editor main viewport displays the selected concept or element
- AND the Header view indicator updates to reflect `'editor'` as active

#### Scenario: Selecting a node while already in Editor view
- GIVEN the application's `activeView` is `'editor'`
- WHEN the user clicks on a concept or element in the `LeftSidebar` tree
- THEN `activeView` remains `'editor'`
- AND the editor main viewport displays the newly selected concept or element
