// ─────────────────────────────────────────────────────────────────────────────
// tests/docName.test.js  —  Unit tests for Document Name & Project Name Synchronization
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/store/session.js';
import { TabStrip } from '../src/ui/tabs.js';
import { saveProject, loadProject } from '../src/io/project.js';

describe('Document Name & Project Name Synchronization', () => {
  beforeEach(() => {
    global.window = global.window || {};
    global.window.api = global.window.api || {
      setWindowTitle: () => {},
      saveProject: async () => ({ ok: true }),
      loadProject: async () => ({
        ok: true,
        manifest: {
          format: 'com.compositor.project',
          version: 7,
          name: 'Restored Artwork',
          documentID: 'doc-123',
          width: 800,
          height: 600,
          resolution: 72,
          layers: [],
        },
        layers: [],
      }),
    };
  });

  it('assigns custom document name upon createDefaultDocument and newDocument', () => {
    const s1 = new EditorSession();
    s1.createDefaultDocument(1280, 720, 72, 'white', '#ffffff', 'Poster Flyer');
    assert.equal(s1.document.name, 'Poster Flyer');

    const s2 = new EditorSession();
    s2.newDocument(1920, 1080, 72, 'Digital Illustration');
    assert.equal(s2.document.name, 'Digital Illustration');
  });

  it('updates document name and fires change event when setDocumentName is called', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600, 72, 'white', '#ffffff', 'Initial Name');

    let changeFired = false;
    session.on('change', () => { changeFired = true; });

    session.setDocumentName('Updated Project Title');
    assert.equal(session.document.name, 'Updated Project Title');
    assert.equal(changeFired, true);
  });

  it('synchronizes TabStrip tab title with session document name', () => {
    let windowTitleSet = '';
    global.window.api.setWindowTitle = (t) => { windowTitleSet = t; };

    const strip = new TabStrip(() => {});
    const session = new EditorSession();
    session.createDefaultDocument(800, 600, 72, 'white', '#ffffff', 'Brand Logo');

    const tab = strip.addTab(session);
    assert.equal(tab.title, 'Brand Logo');
    assert.match(windowTitleSet, /Brand Logo/);

    // Changing document name directly or via setDocumentName updates tab title
    session.setDocumentName('Rebranded Logo');
    assert.equal(tab.title, 'Rebranded Logo');
    assert.match(windowTitleSet, /Rebranded Logo/);
  });

  it('allows renaming tab inline and updates document name', () => {
    const strip = new TabStrip(() => {});
    const session = new EditorSession();
    session.createDefaultDocument(800, 600, 72, 'white', '#ffffff', 'Draft Concept');
    const tab = strip.addTab(session);

    // Simulate double click rename by calling _startRename
    const titleEl = strip.el.querySelector('.tab-title');
    assert.ok(titleEl, 'Tab title element must exist');

    strip._startRename(tab.id, titleEl);

    const input = strip.el.querySelector('.tab-rename-input');
    assert.ok(input, 'Rename input must be mounted');
    assert.equal(input.value, 'Draft Concept');

    // Change input value and commit via blur
    input.value = 'Final Concept';
    input.dispatchEvent(new Event('blur'));

    assert.equal(tab.title, 'Final Concept');
    assert.equal(session.document.name, 'Final Concept');
  });

  it('preserves document name in project manifest on save and load', async () => {
    let savedManifest = null;
    global.window.api.saveProject = async ({ manifest }) => {
      savedManifest = manifest;
      return { ok: true };
    };

    const session = new EditorSession();
    session.createDefaultDocument(800, 600, 72, 'white', '#ffffff', 'Masterpiece');

    await saveProject(session, 'C:/Users/test/Documents/Masterpiece.compositor');

    assert.ok(savedManifest, 'Manifest must be sent to saveProject');
    assert.equal(savedManifest.name, 'Masterpiece');
    assert.equal(session.document.name, 'Masterpiece');

    // Loading project restores manifest.name
    const loadSession = new EditorSession();
    await loadProject(loadSession, 'C:/Users/test/Documents/Restored Artwork.compositor');

    assert.equal(loadSession.document.name, 'Restored Artwork');
  });

  it('new tab button creates document with matching next untitled title', () => {
    const strip = new TabStrip(() => {});
    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    strip.addTab(s1); // Untitled

    // Simulate clicking the '+' new tab button
    const addBtn = strip.el.querySelector('.tab-add');
    assert.ok(addBtn);
    addBtn.dispatchEvent(new Event('click'));

    assert.equal(strip.tabs.length, 2);
    assert.equal(strip.tabs[1].title, 'Untitled 2');
    assert.equal(strip.tabs[1].session.document.name, 'Untitled 2');
  });
});
