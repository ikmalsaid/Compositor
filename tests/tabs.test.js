// ─────────────────────────────────────────────────────────────────────────────
// tests/tabs.test.js  —  Unit tests for TabStrip, Save Confirmation & Untitled Naming
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TabStrip } from '../src/ui/tabs.js';
import { EditorSession } from '../src/store/session.js';

describe('Tab Strip, Save Confirmation & Untitled Naming', () => {
  it('initializes with a tab named Untitled', () => {
    const strip = new TabStrip(() => {});
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const tab = strip.addTab(session);

    assert.equal(tab.title, 'Untitled');
    assert.equal(strip.tabs.length, 1);
    assert.equal(strip.activeTab.id, tab.id);
  });

  it('closing the only tab names the replacement tab "Untitled" instead of "Untitled 2"', async () => {
    const strip = new TabStrip(() => {});
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const tab1 = strip.addTab(session);
    assert.equal(tab1.title, 'Untitled');

    // Close the only tab
    await strip.closeTab(tab1.id);

    assert.equal(strip.tabs.length, 1);
    assert.equal(strip.tabs[0].title, 'Untitled', 'Replacement tab must be named "Untitled", not "Untitled 2"');
    assert.notEqual(strip.tabs[0].id, tab1.id);
  });

  it('closing the only tab multiple times in a row always names it "Untitled"', async () => {
    const strip = new TabStrip(() => {});
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    strip.addTab(session);

    for (let i = 0; i < 5; i++) {
      const currentId = strip.tabs[0].id;
      assert.equal(strip.tabs[0].title, 'Untitled');
      await strip.closeTab(currentId);
      assert.equal(strip.tabs.length, 1);
      assert.equal(strip.tabs[0].title, 'Untitled', `Iteration ${i + 1} must still name the tab "Untitled"`);
    }
  });

  it('dynamically increments untitled numbers when multiple tabs are open', () => {
    const strip = new TabStrip(() => {});
    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    const tab1 = strip.addTab(s1);

    const s2 = new EditorSession();
    s2.createDefaultDocument(800, 600);
    const tab2 = strip.addTab(s2);

    const s3 = new EditorSession();
    s3.createDefaultDocument(800, 600);
    const tab3 = strip.addTab(s3);

    assert.equal(tab1.title, 'Untitled');
    assert.equal(tab2.title, 'Untitled 2');
    assert.equal(tab3.title, 'Untitled 3');
  });

  it('reuses the lowest available untitled number when an intermediate tab is closed', async () => {
    const strip = new TabStrip(() => {});
    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    strip.addTab(s1); // Untitled

    const s2 = new EditorSession();
    s2.createDefaultDocument(800, 600);
    const tab2 = strip.addTab(s2); // Untitled 2

    const s3 = new EditorSession();
    s3.createDefaultDocument(800, 600);
    strip.addTab(s3); // Untitled 3

    // Close Untitled 2
    await strip.closeTab(tab2.id);

    // Opening another tab should reuse Untitled 2
    const s4 = new EditorSession();
    s4.createDefaultDocument(800, 600);
    const tab4 = strip.addTab(s4);
    assert.equal(tab4.title, 'Untitled 2');
  });

  it('closes unmodified tabs immediately without prompting', async () => {
    let confirmCalled = false;
    const strip = new TabStrip(() => {}, {
      onConfirmClose: async () => {
        confirmCalled = true;
        return 'discard';
      },
    });

    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    s1.isModified = false;
    const tab1 = strip.addTab(s1);

    const s2 = new EditorSession();
    s2.createDefaultDocument(800, 600);
    s2.isModified = false;
    const tab2 = strip.addTab(s2);

    await strip.closeTab(tab2.id);
    assert.equal(confirmCalled, false, 'Should not prompt when tab is not modified');
    assert.equal(strip.tabs.length, 1);
  });

  it('prompts to confirm when closing a modified tab and cancels when requested', async () => {
    let confirmPromptedFor = null;
    const strip = new TabStrip(() => {}, {
      onConfirmClose: async (tab) => {
        confirmPromptedFor = tab.title;
        return 'cancel';
      },
    });

    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    s1.isModified = true;
    const tab1 = strip.addTab(s1, 'My artwork');

    const closed = await strip.closeTab(tab1.id);
    assert.equal(confirmPromptedFor, 'My artwork');
    assert.equal(closed, false, 'Tab should not close on cancel');
    assert.equal(strip.tabs.length, 1);
  });

  it('prompts to confirm when closing a modified tab and discards when requested', async () => {
    let confirmPromptedFor = null;
    const strip = new TabStrip(() => {}, {
      onConfirmClose: async (tab) => {
        confirmPromptedFor = tab.title;
        return 'discard';
      },
    });

    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    s1.isModified = true;
    const tab1 = strip.addTab(s1, 'Artwork 1');

    const s2 = new EditorSession();
    s2.createDefaultDocument(800, 600);
    const tab2 = strip.addTab(s2, 'Artwork 2');

    const closed = await strip.closeTab(tab1.id);
    assert.equal(confirmPromptedFor, 'Artwork 1');
    assert.equal(closed, true);
    assert.equal(strip.tabs.length, 1);
    assert.equal(strip.tabs[0].title, 'Artwork 2');
  });

  it('prompts to confirm when closing a modified tab, saves, and closes upon success', async () => {
    let savedTabTitle = null;
    const strip = new TabStrip(() => {}, {
      onConfirmClose: async () => 'save',
      onSaveTab: async (tab) => {
        savedTabTitle = tab.title;
        return true; // saved successfully
      },
    });

    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    s1.isModified = true;
    const tab1 = strip.addTab(s1, 'Poster Design');

    const s2 = new EditorSession();
    s2.createDefaultDocument(800, 600);
    strip.addTab(s2, 'Banner Design');

    const closed = await strip.closeTab(tab1.id);
    assert.equal(savedTabTitle, 'Poster Design');
    assert.equal(closed, true);
    assert.equal(strip.tabs.length, 1);
  });

  it('aborts tab close if user cancels the save dialog', async () => {
    let saveAttempted = false;
    const strip = new TabStrip(() => {}, {
      onConfirmClose: async () => 'save',
      onSaveTab: async () => {
        saveAttempted = true;
        return false; // User clicked "Cancel" on the file picker
      },
    });

    const s1 = new EditorSession();
    s1.createDefaultDocument(800, 600);
    s1.isModified = true;
    const tab1 = strip.addTab(s1, 'Unsaved Work');

    const closed = await strip.closeTab(tab1.id);
    assert.equal(saveAttempted, true);
    assert.equal(closed, false, 'Tab must remain open if save was cancelled');
    assert.equal(strip.tabs.length, 1);
  });
});
