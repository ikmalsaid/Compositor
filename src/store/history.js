// ─────────────────────────────────────────────────────────────────────────────
// history.js  —  Undo/redo (mirrors DocumentHistory.swift)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot-based undo/redo.
 * Clones document layers and captures pixel revisions for fast, safe undo/redo.
 */
export class DocumentHistory {
  constructor({ entryLimit = 100, retainedByteLimit = 256 * 1024 * 1024 } = {}) {
    this.entryLimit = entryLimit;
    this.retainedByteLimit = retainedByteLimit;
    this._past = [];
    this._future = [];
    this._pending = null;
    this._pendingName = 'Edit';
    this._depth = 0;
    this._revision = crypto.randomUUID();
    this._savedRevision = this._revision;
  }

  get canUndo() { return this._depth === 0 && this._past.length > 0; }
  get canRedo()  { return this._depth === 0 && this._future.length > 0; }
  get undoName() { return this._past.at(-1)?.name ?? ''; }
  get redoName() { return this._future.at(-1)?.name ?? ''; }
  get undoCount() { return this._past.length; }
  get isModified() { return this._revision !== this._savedRevision; }

  markSaved() { this._savedRevision = this._revision; }

  reset() {
    this._past = [];
    this._future = [];
    this._pending = null;
    this._depth = 0;
    this._revision = crypto.randomUUID();
    this._savedRevision = this._revision;
  }

  /**
   * Begin an edit group.
   * @param {string} name  Human-readable name shown in Undo menu
   * @param {import('./document.js').CanvasDocument|null} document
   * @param {string|null} activeLayerID
   */
  begin(name, document, activeLayerID) {
    if (this._depth === 0) {
      this._pending = { document: document?.clone() ?? null, activeLayerID, revision: this._revision };
      this._pendingName = name;
    }
    this._depth++;
  }

  /**
   * End an edit group and push to history if the document changed.
   * @param {import('./document.js').CanvasDocument|null} document
   * @param {string|null} activeLayerID
   */
  end(document, activeLayerID) {
    if (this._depth <= 0) return;
    this._depth--;
    if (this._depth > 0 || !this._pending) return;
    const before = this._pending;
    this._pending = null;

    // Selecting, navigating, and no-op edits preserve redo history
    if (this._documentsEqual(before.document, document)) return;

    this._revision = crypto.randomUUID();
    const after = { document: document?.clone() ?? null, activeLayerID, revision: this._revision };
    this._past.push({ name: this._pendingName, before, after });
    this._future = [];
    this._trim(document);
  }

  undo() {
    if (!this.canUndo) return null;
    const entry = this._past.pop();
    this._future.push(entry);
    this._revision = entry.before.revision;
    this._trim(entry.before.document);
    return entry.before;
  }

  redo() {
    if (!this.canRedo) return null;
    const entry = this._future.pop();
    this._past.push(entry);
    this._revision = entry.after.revision;
    this._trim(entry.after.document);
    return entry.after;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _documentsEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.width !== b.width || a.height !== b.height) return false;
    if (a.layers.length !== b.layers.length) return false;
    for (let i = 0; i < a.layers.length; i++) {
      const la = a.layers[i], lb = b.layers[i];
      if (la.id !== lb.id) return false;
      if (la.version !== lb.version) return false;
      if (la.isVisible !== lb.isVisible) return false;
      if (la.isLocked !== lb.isLocked) return false;
      if (la.opacity !== lb.opacity) return false;
      if (la.blendMode !== lb.blendMode) return false;
      if (la.parentID !== lb.parentID) return false;
      if (JSON.stringify(la.transform) !== JSON.stringify(lb.transform)) return false;
    }
    return true;
  }

  _retainedBytes(current) {
    let bytes = 0;
    for (const entry of [...this._past, ...this._future]) {
      for (const snap of [entry.before, entry.after]) {
        for (const l of snap.document?.layers ?? []) {
          bytes += (l.pixelW || 100) * (l.pixelH || 100) * 4;
        }
      }
    }
    return bytes;
  }

  _trim(current) {
    while (
      this._past.length + this._future.length > this.entryLimit ||
      this._retainedBytes(current) > this.retainedByteLimit
    ) {
      if (this._past.length > 0) this._past.shift();
      else if (this._future.length > 0) this._future.shift();
      else break;
    }
  }
}
