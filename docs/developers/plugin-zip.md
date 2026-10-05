# Packaging V2 plugins

ZIP uploads are validated and stored **inactive**. Uploaded JavaScript execution and activation are disabled pending explicit user approval. Bundled plugins continue to work. The runtime loader is deliberately not installed; successful ZIP validation does not mean an extension has executed.

An archive must contain a root `plugin.manifest.json` and the file named by `runtime.entry`. Example:

```json
{
  "id": "com.example.notes",
  "name": "Notes",
  "version": "1.0.0",
  "description": "A notes extension",
  "author": "Example",
  "license": "MIT",
  "isCore": false,
  "requires": { "colossal": ">=2.0.0", "plugins": [] },
  "admin": {
    "entryComponent": "NotesComponent",
    "menu": { "label": "Notes", "path": "/admin/notes", "order": 90 }
  },
  "frontend": { "routes": [] },
  "runtime": { "entry": "index.mjs" }
}
```

Use a unique reverse-domain ID, semantic version, compatible Colossal range, installed dependency IDs, and nonconflicting literal routes. Uploaded archives cannot replace bundled plugins.

The installer enforces a 25 MB compressed limit, at most 500 entries, 16 MB per unpacked entry and 32 MB total unpacked content. It rejects encrypted archives, unsafe paths, duplicate names, symlinks, unsupported compression, checksum failures, missing entry modules and incompatible manifests.

Files are staged under a new revision directory. Storage or registration failure cleans up staged files. A previous installed revision is retained during replacement. The pending version can be discarded via the API; previous versions can be restored from the plugin card. New uploads must have a newer version. Uninstall removes uploaded package files. No uploaded package is automatically activated.

The planned trust model in the V2 PDF gives activated plugins the signed-in user's CMS access within the same Angular context. That is the approval boundary still outstanding; archive checks are not a sandbox or a trust assessment.
