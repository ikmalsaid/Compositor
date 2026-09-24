// ─────────────────────────────────────────────────────────────────────────────
// tests/cursorTool.test.js  —  Unit tests for Dedicated Cursor & Selection Tool
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession, Tool, IMPLEMENTED_TOOLS } from '../src/store/session.js';

describe('Dedicated Cursor & Move Tool Separation', () => {
  it('defines Tool.CURSOR and Tool.MOVE as distinct implemented tools', () => {
    assert.equal(Tool.CURSOR, 'cursor');
    assert.equal(Tool.MOVE, 'move');
    assert.notEqual(Tool.CURSOR, Tool.MOVE);
    assert.ok(IMPLEMENTED_TOOLS.has(Tool.CURSOR), 'Tool.CURSOR must be in IMPLEMENTED_TOOLS');
    assert.ok(IMPLEMENTED_TOOLS.has(Tool.MOVE), 'Tool.MOVE must be in IMPLEMENTED_TOOLS');
  });

  it('initializes EditorSession with Tool.CURSOR as the default active tool', () => {
    const session = new EditorSession();
    assert.equal(session.tool, Tool.CURSOR, 'Default tool should be Tool.CURSOR');
  });

  it('allows seamless switching between Tool.CURSOR, Tool.MOVE, and painting tools', () => {
    const session = new EditorSession();
    const history = [];
    session.on('tool-change', (e) => {
      history.push(e.detail?.tool ?? e.tool);
    });

    session.setTool(Tool.MOVE);
    assert.equal(session.tool, Tool.MOVE);

    session.setTool(Tool.BRUSH);
    assert.equal(session.tool, Tool.BRUSH);

    session.setTool(Tool.CURSOR);
    assert.equal(session.tool, Tool.CURSOR);

    assert.deepEqual(history, [Tool.MOVE, Tool.BRUSH, Tool.CURSOR]);
  });

  it('supports selecting multiple layer IDs in session for marquee cursor workflow', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const l1 = session.addBlankLayer('Layer A');
    const l2 = session.addBlankLayer('Layer B');
    const l3 = session.addBlankLayer('Layer C');

    assert.ok(session.selectedLayerIds instanceof Set);
    session.selectLayer(l1.id);
    assert.equal(session.activeLayerId, l1.id);
    assert.ok(session.selectedLayerIds.has(l1.id));

    // Multi-selection
    session.selectedLayerIds.add(l2.id);
    session.selectedLayerIds.add(l3.id);
    assert.equal(session.selectedLayerIds.size, 3);
  });
});
