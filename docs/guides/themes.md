# Design your site with themes

Open **Themes** in the sidebar's **System** group. The active theme controls the public site. Colossal Default is protected from deletion.

## Install or create a theme

Choose **Install theme ZIP**, select the archive, and review its validation summary. Installation leaves the current theme active. Choose **Activate** when ready; if some pages use unavailable templates, the confirmation lists those pages and they use a fallback. Their content and original template choices remain intact.

Choose **New theme** to make an independent copy of Colossal Default. **Preview** opens a temporary site preview. **Export** downloads a portable ZIP. An inactive, non-core theme can be deleted.

## Build a layout

1. Choose **Edit theme**, then a template from the toolbar.
2. Search the block library. Drag a block into an insertion zone or click it to add it to the selected container.
3. Select a block in the canvas for its floating toolbar, or use the Inspector for all settings. Containers, Groups, Rows and Columns accept nested blocks, up to eight levels. A Columns block creates two Column children; adding other blocks directly to Columns wraps them in a new Column.
4. Drag existing blocks between containers, or use the move arrows. Duplicate, delete, copy/paste, undo and redo are available in the editor. Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z redoes. Ctrl/Cmd+S saves.
5. Open **Shared parts** to edit Header, Footer, Sidebar or Content. Place `core/content` in the Content part to render the current page or post body, then place `theme/part-content` in templates that need the body. Every template using the part updates together. Use **← Template** to return.
6. Choose **Preview** and a Desktop, Tablet or Mobile width to review the result.

Template settings in the inspector let you rename the template, choose applicable content types and set theme/type defaults. **More → New template** copies the current layout to a new named template.

Every theme includes Home, Page, Posts, Single, Search and 404 templates. Older themes gain missing role templates while retaining their existing layouts and additional templates. Home is used for an assigned Home page; with Latest posts at `/`, the Posts template still renders the index. The 404 template renders the assigned 404 page's content when one is selected.

Use **More → Show block toolbar** to toggle the floating toolbar. Alt+F10 focuses it; arrow keys move between its controls, and Escape returns focus to the block. Formatting buttons use the current Heading or Rich Text selection when one exists. The glTF block accepts a model from the Media Library or an HTTPS URL; add a model description and optional poster image.

## Save and review

**Save draft** keeps experiments private. **Publish** makes the draft the theme's published version and increments its patch version; only the active theme affects the live site. Editing an inactive theme never activates it automatically.

**Preview on site** saves pending edits and opens a signed link that expires in 15 minutes. A later save or publish invalidates the link. Under **More**, use **Save as new theme**, **Export ZIP**, **Revert to published**, or **Version history**. Restoring history creates a draft; publish it when ready.

Leaving with unsaved edits prompts you to keep editing or discard them. If another tab changes the theme, saving reports a conflict instead of overwriting it. Preserve your unsaved text and reload the latest version before continuing.

## Change one page or post

Open the content editor's **Template** panel. Choose an applicable template from the active theme or **Automatic** to use the defaults. Publish the content to apply the choice. If a later theme switch removes that template, the editor explains the fallback and the content remains editable.

## V2.0.4 toolbars and drawers

The primary toolbar contains Back, a centered Template selector, then Preview, Publish and More. Save Draft is in More alongside clone, export, revert, history and Show block boundaries.

The secondary toolbar has two regions. Blocks and Canvas/Outline stay on the left. Undo, Redo, a divider, then Desktop/Tablet/Mobile stay together at the right edge. Hover an icon for its label and shortcut. Tab visits the active option in each segmented group; arrow keys change the option and Home/End select its first/last option.

| Shortcut             | Action                                         |
| -------------------- | ---------------------------------------------- |
| Ctrl/Cmd+B           | Toggle Blocks                                  |
| Ctrl/Cmd+Shift+C / O | Canvas / Outline                               |
| Ctrl/Cmd+1 / 2 / 3   | Desktop / Tablet / Mobile                      |
| Ctrl/Cmd+Z / Shift+Z | Undo / Redo                                    |
| Ctrl/Cmd+S           | Save Draft                                     |
| Escape               | Close Blocks, or Inspector if Blocks is closed |

Shortcuts for view changes do not intercept typing in text fields. The Blocks drawer keeps its open state and scroll position for the session. At desktop widths of 1200px and above, the 320px drawer pushes the canvas; below that it overlays with a dismissible scrim. The Inspector uses the same width and animation duration. Use its close button or the Inspector button beneath the canvas to collapse or reopen it. Reduced-motion settings disable drawer transitions.

The library stays open while you add or drag blocks. Clicking the canvas closes it and clears the selection. Select a block again to edit its settings.
