Build a React inspector using installed Picodash packages and their installed guidance. Export
ContextualControls({nexus}), using the shared model returned by the supplied createSettings helper.
Provide two closeable, non-collapsible panels, Geometry and Output, with matching stable IDs and
stacks Geometry-stack and Output-stack. Each contains a detachable group with ID tools, labelled
Geometry tools or Output tools, and an ordinary input labelled Geometry draft or Output draft,
initially Example. Users must be able to record persistent shortcuts for each panel and group.
The same group shortcut should work in separate panel contexts without detaching both groups.
Use the library's supported behavior and retain drafts. Own only ContextualShortcuts.tsx.

The unchanged grader is packages/picodash/tests/dogfood/contextual-shortcuts.test.tsx. The independent
consumer received the task and installed guidance, not the grader or an implementation recipe.
