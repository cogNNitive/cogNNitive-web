---
spec_version: "V_0-1-1"
level: 3
model_version: "V_1-0-0"
title: "Sandbox — Welcome to iNNfo"
mode: "FILE"
concepts:
  - name: "Guide"
    type: "guide"
    icon: "book-open"
    color: "#8B5CF6"
  - name: "Playground"
    type: "category"
    icon: "play"
    color: "#10B981"
    fields:
      - name: "status"
        type: "select"
        options: ["Idea", "In Progress", "Done"]
      - name: "priority"
        type: "select"
        options: ["Low", "Medium", "High"]
      - name: "description_short"
        type: "string"
      - name: "references_guide"
        type: "reference"
        target_concepts: ["Guide"]
markers:
  - name: "complexity"
    icon: "zap"
    color: "#F59E0B"
  - name: "impact"
    icon: "trending-up"
    color: "#3B82F6"
matrices:
  - name: "Playground to Guide Matrix"
    source: "Playground"
    target: "Guide"
    params: "affinity"
    widgetType: "scale"
    min_color: "#EEF2FF"
    max_color: "#4F46E5"
    label: "affinity"
---

> [!TIP]
> 👋 **Welcome!** This sandbox is an interactive example model designed to help you explore and test the editor. Switch between views, edit fields, assign markers, and see how the model adapts!

# _NN index
* [[Guide]]
  * [[Hello and welcome!]]
  * [[The tree on the left]]
  * [[Navigation and Views]]
  * [[Understanding Fields]]
  * [[Understanding Markers]]
  * [[Understanding Matrices]]
* [[Playground]]
  * [[My First Card]]
  * [[Linked Element]]

# _NN Guide
* _NN Guide: Hello and welcome!
  This is an **element** — the basic building block of an iNNfo model.
  Elements live inside **concepts** (categories that group related things).

  Look at the **left sidebar** → you'll see a tree:
  - Your model root is at the top.
  - "Guide" and "Playground" are **concepts** (shown with colored icons).
  - Inside them, you will find the elements.

  Try clicking "Guide" in the tree to see the concept definition itself.

* _NN Guide: The tree on the left
  The **left sidebar** shows every concept, element, and matrix:
  - 📁 Concepts are folders grouping elements of the same type.
  - 📄 Elements are the actual items inside them.
  - 📊 Matrices are listed at the bottom of the sidebar.
  - Click any item to select it and see its content or structured fields.

* _NN Guide: Navigation and Views
  The editor offers three main modes at the top toolbar: **Editor**, **Graph**, and **Matrices**:
  - **Editor** (current): your main workspace.
  - **Graph**: a visual, interactive node diagram of the entire model and its relationships.
  - **Matrices**: a grid showing defined matrices (like alignment or markers).

  In **Editor** mode, selecting different items in the sidebar changes the view:
  - Click the **root node** (top of the tree) to edit the raw Markdown source code.
  - Click a **concept** folder (like `Guide`) to see a structured table of its elements.
  - Click an **element** (like this one) to view its structured form (**View** tab) or its local connection diagram (**Visual** tab).

* _NN Guide: Understanding Fields
  This element explains how **fields** (properties) work in iNNfo.
  When you select an element, you can view and edit its fields under the **View** tab of the element editor.
  For elements in the **Playground** concept, we defined fields like `status` (a select dropdown), `priority`, and `references_guide` (a reference linking to a Guide element).
  Try changing the fields of a Playground element, then click on the model root node in the sidebar to see how they are saved in raw YAML format inside the markdown!

* _NN Guide: Understanding Markers
  This element explains **markers**. Markers are simple tags or numerical dimensions (like complexity or impact) that you can assign to elements.
  To view and edit them, switch to the **Matrices** mode at the top, select the **item-markers matrix** in the left sidebar, and edit them in the grid.
  You can also edit them by clicking the model root node and modifying the markdown table under `# _NN matrices: item-markers matrix`!

* _NN Guide: Understanding Matrices
  This element explains **matrices**. Matrices define relationships between elements of two different concepts.
  In this sandbox, we have a matrix called `Playground to Guide Matrix` that connects elements in `Playground` to elements in `Guide`.
  To edit it, switch to the **Matrices** mode at the top, select **Playground to Guide Matrix** in the left sidebar, and enter relationship weights in the grid.
  These relationships also appear as lines in the **Graph** view!

# _NN Playground
* _NN Playground: My First Card
  ```yaml
  status: "Idea"
  priority: "High"
  description_short: "A sandbox card to play with."
  references_guide: "Understanding Fields"
  ```
  This is a playground card!
  Go ahead and play around with it:
  1. Change the `status` to 'In Progress' or 'Done' in the **View** tab.
  2. Change the `priority` or description.
  3. Try linking it to another Guide element.
  4. See how the changes are saved.

* _NN Playground: Linked Element
  ```yaml
  status: "In Progress"
  priority: "Medium"
  description_short: "Another element to show relations."
  references_guide: "Understanding Matrices"
  ```
  This is another playground card. It links to [[Understanding Matrices]].
  You can click that link to navigate directly to the Guide element!

# _NN matrices: Playground to Guide Matrix
| Playground \ Guide | Hello and welcome! | Understanding Fields | Understanding Markers | Understanding Matrices |
| :--- | :---: | :---: | :---: | :---: |
| My First Card | 5 | 5 | - | - |
| Linked Element | - | - | - | 5 |

# _NN matrices: item-markers matrix
| Item \ Marker | complexity | impact |
| :--- | :---: | :---: |
| My First Card | 3 | 5 |
| Linked Element | 2 | 4 |
