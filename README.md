# Compositor for Windows

Adobe Photoshop costs too much and tools like GIMP don’t feel familiar enough for me to stay in flow. That’s why Compositor was ported to Windows.

The goal was to create a full-featured image editor that is completely free, open source, and lightweight. I use Photoshop for compositing and post-processing, so Compositor is built around that workflow — with the tools needed to create a pixel-perfect final image, powered by a modern, hardware-accelerated Windows engine.

Because it’s open source, you can clone the project and add, remove, or modify any feature to fit your workflow.

## Features

### Layers
- Layers and folders, with 13 blend modes and real-time opacity slider / numeric input
- Multi-layer selection using Ctrl/Cmd toggle and Shift range selection; batch delete (Del)
- Shape framing: non-destructively frame any layer into circles, rounded rectangles, stars, hearts, diamonds, polygons, and arrows
- Invert colors (Ctrl+I) and AI background removal
- Merge Down (Ctrl+E) and Flatten Image
- Duplicate (Ctrl+J), rename inline (double-click), lock toggle, visibility toggle, and nest by drag and drop
- Right-click canvas and layer context menu: Cut (Ctrl+X), Copy (Ctrl+C), Paste (Ctrl+V), and Paste in Place (Ctrl+Shift+V)
- Layer arrangement: Bring to Front, Bring Forward, Send Backward, and Send to Back

### Transform
- Non-destructive move, scale, rotate and flip (Horizontal & Vertical) — images keep their full pixel resolution
- Live Transform HUD with real-time coordinates (X, Y), dimensions (W, H), and percentage relative to canvas
- Interactive Rulers and customizable draggable Guides with smart snapping
- Snapping to canvas boundaries, layer edges, centers, and guide lines with cardinal / 45° angle constraints (Shift)
- Center on Canvas shortcut action

### Selections
- Rectangular Marquee, Freehand Polygonal Lasso, and Magic Wand
- Magic Wand with adjustable tolerance, contiguous detection, and "Sample All Layers" mode
- Animated marching ants selection boundary loop (60 fps)
- Pixel-precise Selection Cut (Ctrl+X), Copy (Ctrl+C), and Paste (Ctrl+V) as a new layer positioned at exact document coordinates
- Fill selection with foreground color and Clear selection (Del)

### Painting and retouching
- Brush tool with adjustable size, hardness, and opacity, and `[` / `]` keyboard resizing
- Eraser tool with smooth hardness falloff
- Spot Healing Brush for content-aware blemish removal
- Clone Stamp with Alt+Click source sampling and source reset
- Blur tool to soften pixels and feather edges
- Paint Bucket tool with tolerance and contiguous flood fill
- Gradient tool with Linear and Radial blending modes
- Vector Shape tool with 13 geometric presets (rectangles, rounded rectangles, ellipses, triangles, stars, hearts, polygons, lines)
- Eyedropper pixel sampler and full color picker
- Prominent overlapping Foreground and Background color swatches with quick swap (X) and default black/white reset (D)

### Typography and text
- Dynamic text tool with auto-expanding and auto-contracting text layers that tightly follow content
- Full typography formatting: font family, font size, bold, italic, text alignment, line height, and letter spacing
- Crop-safe text editing: text retains full typography data and editing capabilities even after layer transformations

### Canvas and files
- Multiple projects in tabs with unsaved modification indicators
- Streamlined New Document modal with preset catalogue (Popular, Recent, Photo, Print, Social, Web) and custom size inspector
- Smart unsaved work confirmation when creating a new canvas or closing projects
- Automatic downscaling of large imported images to fit canvas while preserving original resolution
- Image Size dialog with aspect ratio constraint and resampling methods
- Canvas Size dialog with 9-point directional anchor grid and background extension fills
- Interactive Print Preview with paper presets, orientation, margin guides, direct printing, and PDF export
- Full native `.compositor` project format compatibility (version 7 schema)
- Photoshop-style keyboard shortcuts throughout

## Requirements

- Windows 10 / 11 (64-bit)
- Node.js 18+ (to run or build from source)

## Building and Running

Clone the repository and start the development application:

```bash
git clone https://github.com/ikmalsaid/Compositor.git
cd Compositor
npm install
npm start
```

## Running Tests

Run the unit and regression test suite:

```bash
npm test
```

## Building Release Installer

Build an NSIS installer and standalone executable for Windows:

```bash
npm run build
```

The output installer will be generated in `dist` folder.

## License

MIT — see [LICENSE](LICENSE).