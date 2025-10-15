document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('artboard');
    const canvasContainer = document.getElementById('canvas-container');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const createBtn = document.getElementById('create-btn');
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');
    const colorPicker = document.getElementById('color-picker');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const layerList = document.getElementById('layer-list');
    const exportBtn = document.getElementById('export-btn');
    const eraserToolBtn = document.getElementById('eraser-tool');
    const gridToggle = document.getElementById('grid-toggle');
    const gridColorPicker = document.getElementById('grid-color-picker');
    const guideGridToggle = document.getElementById('guide-grid-toggle');
    const guideGridColorPicker = document.getElementById('guide-grid-color-picker');
    const snapToggle = document.getElementById('snap-toggle');
    const snapSizeInput = document.getElementById('snap-size-input');
    const zoomSlider = document.getElementById('zoom-slider');
    const resetZoomBtn = document.getElementById('reset-zoom-btn');
    const rectangleToolBtn = document.getElementById('rectangle-tool');
    const circleToolBtn = document.getElementById('circle-tool');
    const lineToolBtn = document.getElementById('line-tool');

    // App State
    let artboardWidth = 0, artboardHeight = 0;
    let isDrawing = false, isErasing = false;
    let currentColor = colorPicker.value;
    let currentTool = 'rectangle';
    let isGridVisible = true;
    let gridColor = gridColorPicker.value;
    let isGuideGridVisible = true;
    let guideGridColor = guideGridColorPicker.value;
    let isSnapEnabled = true;
    let snapGridSize = 32;
    let zoomLevel = 1;
    let startPos = null;
    let endPos = null;
    
    let layers = [];
    let activeLayerIndex = -1;

    // --- Drawing Logic ---
    function drawRectangle(context, shape) {
        context.fillStyle = shape.color;
        const x = Math.min(shape.x1, shape.x2);
        const y = Math.min(shape.y1, shape.y2);
        const width = Math.abs(shape.x1 - shape.x2);
        const height = Math.abs(shape.y1 - shape.y2);
        context.fillRect(x, y, width, height);
    }

    function drawCircle(context, shape) {
        context.fillStyle = shape.color;
        const radiusX = Math.abs(shape.x1 - shape.x2) / 2;
        const radiusY = Math.abs(shape.y1 - shape.y2) / 2;
        const centerX = Math.min(shape.x1, shape.x2) + radiusX;
        const centerY = Math.min(shape.y1, shape.y2) + radiusY;
        
        context.beginPath();
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.fill();
    }

    function drawLine(context, shape) {
        context.strokeStyle = shape.color;
        context.lineWidth = 1; // Line width in world space
        context.beginPath();
        context.moveTo(shape.x1, shape.y1);
        context.lineTo(shape.x2, shape.y2);
        context.stroke();
    }

    // --- Snap Logic ---
    function snap(value, gridSize) {
        if (!isSnapEnabled || gridSize <= 0) return value;
        return Math.round(value / gridSize) * gridSize;
    }

    // --- Tool Management ---
    function setCurrentTool(tool) {
        currentTool = tool;
        
        eraserToolBtn.classList.toggle('active', tool === 'eraser');
        rectangleToolBtn.classList.toggle('active', tool === 'rectangle');
        circleToolBtn.classList.toggle('active', tool === 'circle');
        lineToolBtn.classList.toggle('active', tool === 'line');
        
        canvas.style.cursor = (['rectangle', 'circle', 'line', 'eraser'].includes(tool)) ? 'crosshair' : 'default';
    }

    // --- Export Logic ---
    function exportImage() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = artboardWidth;
        exportCanvas.height = artboardHeight;
        const exportCtx = exportCanvas.getContext('2d');

        layers.forEach(layer => {
            if (layer.isVisible) {
                layer.shapes.forEach(shape => {
                    switch (shape.type) {
                        case 'rectangle': drawRectangle(exportCtx, shape); break;
                        case 'circle': drawCircle(exportCtx, shape); break;
                        case 'line': drawLine(exportCtx, shape); break;
                    }
                });
            }
        });

        const link = document.createElement('a');
        link.download = 'vector-art.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    // --- Canvas and Layer Logic ---
    function render() {
        if (!artboardWidth || !artboardHeight) return;

        // 1. Update canvas resolution based on zoom
        canvas.width = artboardWidth * zoomLevel;
        canvas.height = artboardHeight * zoomLevel;

        // 2. Update canvas display size to match resolution
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;

        // 3. Scale the drawing context
        ctx.scale(zoomLevel, zoomLevel);

        // --- Redraw everything from vector data ---
        
        drawCheckerboard(ctx, artboardWidth, artboardHeight);

        layers.forEach(layer => {
            if (layer.isVisible) {
                layer.shapes.forEach(shape => {
                    switch (shape.type) {
                        case 'rectangle': drawRectangle(ctx, shape); break;
                        case 'circle': drawCircle(ctx, shape); break;
                        case 'line': drawLine(ctx, shape); break;
                    }
                });
            }
        });

        if (isGridVisible) {
            drawGrid();
        }

        drawGuideGrid(); // Draw the 32x32 guide grid on top

        if (startPos && endPos) {
            if (isDrawing) {
                const previewShape = { type: currentTool, color: currentColor, x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y };
                switch (currentTool) {
                    case 'rectangle': drawRectangle(ctx, previewShape); break;
                    case 'circle': drawCircle(ctx, previewShape); break;
                    case 'line': drawLine(ctx, previewShape); break;
                }
            } else if (isErasing) {
                // Use a semi-transparent fill for a more modern selection look
                ctx.fillStyle = 'rgba(0, 123, 255, 0.25)'; // Light, semi-transparent blue
                ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)'; // Solid blue border
                ctx.lineWidth = 1 / zoomLevel; // Keep border visually 1px thick

                const x = Math.min(startPos.x, endPos.x);
                const y = Math.min(startPos.y, endPos.y);
                const width = Math.abs(startPos.x - endPos.x);
                const height = Math.abs(startPos.y - endPos.y);
                
                ctx.fillRect(x, y, width, height);
                ctx.strokeRect(x, y, width, height);
            }
        }
    }

    function drawCheckerboard(context, width, height) {
        const tileSize = 16;
        for (let y = 0; y < height; y += tileSize) {
            for (let x = 0; x < width; x += tileSize) {
                context.fillStyle = ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) ? '#ffffff' : '#cccccc';
                context.fillRect(x, y, tileSize, tileSize);
            }
        }
    }

    function drawGuideGrid() {
        if (!isGuideGridVisible) return;
        
        ctx.strokeStyle = guideGridColor;
        ctx.lineWidth = 1 / zoomLevel;
        const gridSize = 32; // Always 32 for these borders

        for (let y = 0; y < artboardHeight; y += gridSize) {
            for (let x = 0; x < artboardWidth; x += gridSize) {
                ctx.strokeRect(x, y, gridSize, gridSize);
            }
        }
    }

    function drawGrid() {
        // This is the user-customizable grid
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1 / zoomLevel; // Keep grid lines visually 1px thick
        const gridSize = snapGridSize;

        for (let x = 0; x <= artboardWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, artboardHeight);
            ctx.stroke();
        }
        for (let y = 0; y <= artboardHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(artboardWidth, y);
            ctx.stroke();
        }
    }

    function createArtboard() {
        let rawWidth = parseInt(widthInput.value, 10);
        let rawHeight = parseInt(heightInput.value, 10);

        if (isNaN(rawWidth) || rawWidth <= 0) rawWidth = 512;
        if (isNaN(rawHeight) || rawHeight <= 0) rawHeight = 512;

        // Snap dimensions to the nearest multiple of 32
        artboardWidth = Math.round(rawWidth / 32) * 32;
        artboardHeight = Math.round(rawHeight / 32) * 32;
        
        // Ensure minimum size
        if (artboardWidth < 32) artboardWidth = 32;
        if (artboardHeight < 32) artboardHeight = 32;

        // Update the input fields with the corrected values
        widthInput.value = artboardWidth;
        heightInput.value = artboardHeight;

        layers = [];
        addNewLayer();
        resetZoom(); // This will call render
    }

    function addNewLayer() {
        const newLayer = {
            shapes: [],
            name: `Layer ${layers.length + 1}`,
            isVisible: true
        };
        layers.push(newLayer);
        setActiveLayer(layers.length - 1);
    }

    function setActiveLayer(index) {
        activeLayerIndex = index;
        updateLayerListUI();
    }

    function updateLayerListUI() {
        layerList.innerHTML = '';
        layers.forEach((layer, index) => {
            const layerItem = document.createElement('div');
            layerItem.textContent = layer.name;
            layerItem.classList.add('layer-item');
            if (index === activeLayerIndex) layerItem.classList.add('active');
            layerItem.addEventListener('click', () => setActiveLayer(index));
            layerList.appendChild(layerItem);
        });
    }

    // --- Zoom Logic ---
    function applyZoom() {
        zoomLevel = parseInt(zoomSlider.value, 10) / 100;
        if (zoomLevel < 0.1) zoomLevel = 0.1;

        render();
    }

    function resetZoom() {
        zoomLevel = 1;
        zoomSlider.value = 100;
        
        render();
    }

    // --- Input Handling ---
    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        // Convert mouse position from screen space to world space
        const mouseX = (evt.clientX - rect.left) / zoomLevel;
        const mouseY = (evt.clientY - rect.top) / zoomLevel;
        return { x: mouseX, y: mouseY };
    }

    function handleMouseDown(e) {
        let pos = getMousePos(e);
        pos = { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) };
        
        startPos = pos;
        endPos = pos;

        if (['rectangle', 'circle', 'line'].includes(currentTool)) {
            isDrawing = true;
        } else if (currentTool === 'eraser') {
            isErasing = true;
        }
    }

    function handleMouseMove(e) {
        if (!isDrawing && !isErasing) return;
        
        let pos = getMousePos(e);
        pos = { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) };

        endPos = pos;
        render();
    }

    function handleMouseUp() {
        const activeLayer = layers[activeLayerIndex];
        if (!activeLayer) return;

        if (isDrawing) {
            const newShape = {
                type: currentTool,
                color: currentColor,
                x1: startPos.x,
                y1: startPos.y,
                x2: endPos.x,
                y2: endPos.y
            };
            activeLayer.shapes.push(newShape);
        } else if (isErasing) {
            const eraseX1 = Math.min(startPos.x, endPos.x);
            const eraseY1 = Math.min(startPos.y, endPos.y);
            const eraseX2 = Math.max(startPos.x, endPos.x);
            const eraseY2 = Math.max(startPos.y, endPos.y);

            activeLayer.shapes = activeLayer.shapes.filter(shape => {
                const shapeX1 = Math.min(shape.x1, shape.x2);
                const shapeY1 = Math.min(shape.y1, shape.y2);
                const shapeX2 = Math.max(shape.x1, shape.x2);
                const shapeY2 = Math.max(shape.y1, shape.y2);
                return !(shapeX1 < eraseX2 && shapeX2 > eraseX1 && shapeY1 < eraseY2 && shapeY2 > eraseY1);
            });
        }

        isDrawing = false;
        isErasing = false;
        startPos = null;
        endPos = null;
        render();
    }

    // --- Event Listeners ---
    createBtn.addEventListener('click', createArtboard);
    addLayerBtn.addEventListener('click', addNewLayer);
    exportBtn.addEventListener('click', exportImage);
    eraserToolBtn.addEventListener('click', () => setCurrentTool('eraser'));
    rectangleToolBtn.addEventListener('click', () => setCurrentTool('rectangle'));
    circleToolBtn.addEventListener('click', () => setCurrentTool('circle'));
    lineToolBtn.addEventListener('click', () => setCurrentTool('line'));

    gridToggle.addEventListener('change', (e) => { isGridVisible = e.target.checked; render(); });
    gridColorPicker.addEventListener('input', (e) => { gridColor = e.target.value; render(); });
    guideGridToggle.addEventListener('change', (e) => { isGuideGridVisible = e.target.checked; render(); });
    guideGridColorPicker.addEventListener('input', (e) => { guideGridColor = e.target.value; render(); });
    snapToggle.addEventListener('change', (e) => { isSnapEnabled = e.target.checked; });
    snapSizeInput.addEventListener('input', (e) => {
        const newSize = parseInt(e.target.value, 10);
        if (newSize > 0) { snapGridSize = newSize; render(); }
    });
    colorPicker.addEventListener('change', (e) => currentColor = e.target.value);

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', () => {
        if (isDrawing || isErasing) {
            handleMouseUp();
        }
    });

    zoomSlider.addEventListener('input', applyZoom);
    resetZoomBtn.addEventListener('click', resetZoom);

    // --- Initial Setup ---
    createArtboard();
    setCurrentTool('rectangle');
});