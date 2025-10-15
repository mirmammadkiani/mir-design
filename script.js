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
    const selectToolBtn = document.getElementById('select-tool');
    const cropToolBtn = document.getElementById('crop-tool');

    // App State
    let artboardWidth = 0, artboardHeight = 0;
    let isDrawing = false, isErasing = false, isSelecting = false, isMoving = false, isCropping = false;
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
    let moveStartPos = null;
    
    let layers = [];
    let activeLayerIndex = -1;

    let selectionRect = null;
    let selectedShapes = [];

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
        selectToolBtn.classList.toggle('active', tool === 'select');
        cropToolBtn.classList.toggle('active', tool === 'crop');
        
        canvas.style.cursor = (['rectangle', 'circle', 'line', 'eraser', 'crop'].includes(tool)) ? 'crosshair' : 'default';
        
        // Clear selection when switching tools
        selectionRect = null;
        selectedShapes = [];
        render();
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

        ctx.save(); // Save the default state

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

        // Draw preview shape
        if (startPos && endPos) {
            if (isDrawing) {
                const previewShape = { type: currentTool, color: currentColor, x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y };
                switch (currentTool) {
                    case 'rectangle': drawRectangle(ctx, previewShape); break;
                    case 'circle': drawCircle(ctx, previewShape); break;
                    case 'line': drawLine(ctx, previewShape); break;
                }
            } else if (isErasing) {
                ctx.fillStyle = 'rgba(0, 123, 255, 0.25)';
                ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
                ctx.lineWidth = 1 / zoomLevel;
                const x = Math.min(startPos.x, endPos.x);
                const y = Math.min(startPos.y, endPos.y);
                const width = Math.abs(startPos.x - endPos.x);
                const height = Math.abs(startPos.y - endPos.y);
                ctx.fillRect(x, y, width, height);
                ctx.strokeRect(x, y, width, height);
            }
        }

        // Draw selection rectangle
        if (selectionRect) {
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
            ctx.lineWidth = 1 / zoomLevel;
            ctx.setLineDash([4 / zoomLevel, 2 / zoomLevel]);
            ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
            ctx.setLineDash([]);
        } else if (isSelecting || isCropping) {
            const x = Math.min(startPos.x, endPos.x);
            const y = Math.min(startPos.y, endPos.y);
            const width = Math.abs(startPos.x - endPos.x);
            const height = Math.abs(startPos.y - endPos.y);
            ctx.strokeStyle = isCropping ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 123, 255, 0.8)'; // Red for crop
            ctx.lineWidth = 1 / zoomLevel;
            ctx.setLineDash([4 / zoomLevel, 2 / zoomLevel]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);
        }
        
        ctx.restore(); // Restore to the default state
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
        const gridSize = 32;

        for (let y = 0; y < artboardHeight; y += gridSize) {
            for (let x = 0; x < artboardWidth; x += gridSize) {
                ctx.strokeRect(x, y, gridSize, gridSize);
            }
        }
    }

    function drawGrid() {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1 / zoomLevel;
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

        artboardWidth = Math.round(rawWidth / 32) * 32;
        artboardHeight = Math.round(rawHeight / 32) * 32;
        
        if (artboardWidth < 32) artboardWidth = 32;
        if (artboardHeight < 32) artboardHeight = 32;

        widthInput.value = artboardWidth;
        heightInput.value = artboardHeight;

        layers = [];
        addNewLayer();
        resetZoom();
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

    // --- Selection & Move Logic ---
    function isPointInRect(point, rect) {
        if (!rect) return false;
        return point.x >= rect.x && point.x <= rect.x + rect.width &&
               point.y >= rect.y && point.y <= rect.y + rect.height;
    }

    function findAndBoundSelectedShapes(userRect) {
        const activeLayer = layers[activeLayerIndex];
        if (!activeLayer) {
            selectedShapes = [];
            selectionRect = null;
            return;
        }

        selectedShapes = activeLayer.shapes.filter(shape => {
            const shapeX1 = Math.min(shape.x1, shape.x2);
            const shapeY1 = Math.min(shape.y1, shape.y2);
            const shapeX2 = Math.max(shape.x1, shape.x2);
            const shapeY2 = Math.max(shape.y1, shape.y2);
            
            const rectX1 = userRect.x;
            const rectY1 = userRect.y;
            const rectX2 = userRect.x + userRect.width;
            const rectY2 = userRect.y + userRect.height;

            return shapeX1 < rectX2 && shapeX2 > rectX1 && shapeY1 < rectY2 && shapeY2 > rectY1;
        });

        if (selectedShapes.length === 0) {
            selectionRect = null;
            return;
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        selectedShapes.forEach(shape => {
            minX = Math.min(minX, shape.x1, shape.x2);
            minY = Math.min(minY, shape.y1, shape.y2);
            maxX = Math.max(maxX, shape.x1, shape.x2);
            maxY = Math.max(maxY, shape.y1, shape.y2);
        });

        selectionRect = {
            x: minX, y: minY,
            width: maxX - minX, height: maxY - minY
        };
    }

    // --- Input Handling ---
    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (evt.clientX - rect.left) / zoomLevel;
        const mouseY = (evt.clientY - rect.top) / zoomLevel;
        return { x: mouseX, y: mouseY };
    }

    function handleMouseDown(e) {
        let pos = getMousePos(e);
        
        if (currentTool === 'select') {
            if (isPointInRect(pos, selectionRect)) {
                isMoving = true;
                moveStartPos = pos;
                // Store initial positions for smooth dragging
                selectedShapes.forEach(shape => {
                    shape.initialX1 = shape.x1;
                    shape.initialY1 = shape.y1;
                    shape.initialX2 = shape.x2;
                    shape.initialY2 = shape.y2;
                });
                selectionRect.initialX = selectionRect.x;
                selectionRect.initialY = selectionRect.y;
            } else {
                isSelecting = true;
                selectionRect = null;
                selectedShapes = [];
                startPos = { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) };
                endPos = startPos;
            }
        } else if (currentTool === 'crop') {
            isCropping = true;
            startPos = { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) };
            endPos = startPos;
        } else {
            pos = { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) };
            startPos = pos;
            endPos = pos;

            if (['rectangle', 'circle', 'line'].includes(currentTool)) {
                isDrawing = true;
            } else if (currentTool === 'eraser') {
                isErasing = true;
            }
        }
        render();
    }

    function handleMouseMove(e) {
        if (!isDrawing && !isErasing && !isSelecting && !isMoving && !isCropping) return;
        
        let pos = getMousePos(e);

        if (isMoving) {
            const dx = pos.x - moveStartPos.x;
            const dy = pos.y - moveStartPos.y;

            selectedShapes.forEach(shape => {
                shape.x1 = shape.initialX1 + dx;
                shape.y1 = shape.initialY1 + dy;
                shape.x2 = shape.initialX2 + dx;
                shape.y2 = shape.initialY2 + dy;
            });
            selectionRect.x = selectionRect.initialX + dx;
            selectionRect.y = selectionRect.initialY + dy;

        } else {
             pos = { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) };
             endPos = pos;
        }
        
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
        } else if (isSelecting) {
            const userRectX = Math.min(startPos.x, endPos.x);
            const userRectY = Math.min(startPos.y, endPos.y);
            const userRectWidth = Math.abs(startPos.x - endPos.x);
            const userRectHeight = Math.abs(startPos.y - endPos.y);
            
            if (userRectWidth > 0 || userRectHeight > 0) {
                const userRect = { x: userRectX, y: userRectY, width: userRectWidth, height: userRectHeight };
                findAndBoundSelectedShapes(userRect);
            } else {
                selectionRect = null;
                selectedShapes = [];
            }
        } else if (isCropping) {
            const cropRect = {
                x: Math.min(startPos.x, endPos.x),
                y: Math.min(startPos.y, endPos.y),
                width: Math.abs(startPos.x - endPos.x),
                height: Math.abs(startPos.y - endPos.y)
            };

            if (cropRect.width > 0 && cropRect.height > 0) {
                const shapesToKeep = [];
                const shapesToAdd = [];

                for (const shape of activeLayer.shapes) {
                    const shapeRect = {
                        x: Math.min(shape.x1, shape.x2),
                        y: Math.min(shape.y1, shape.y2),
                        width: Math.abs(shape.x1 - shape.x2),
                        height: Math.abs(shape.y1 - shape.y2)
                    };

                    // Check if shape is outside the crop area
                    if (shapeRect.x >= cropRect.x + cropRect.width ||
                        shapeRect.x + shapeRect.width <= cropRect.x ||
                        shapeRect.y >= cropRect.y + cropRect.height ||
                        shapeRect.y + shapeRect.height <= cropRect.y) {
                        shapesToKeep.push(shape); // Keep shapes completely outside
                        continue;
                    }

                    // If we are here, the shape intersects the crop area
                    const intersectX1 = Math.max(shapeRect.x, cropRect.x);
                    const intersectY1 = Math.max(shapeRect.y, cropRect.y);
                    const intersectX2 = Math.min(shapeRect.x + shapeRect.width, cropRect.x + cropRect.width);
                    const intersectY2 = Math.min(shapeRect.y + shapeRect.height, cropRect.y + cropRect.height);

                    if (intersectX1 < intersectX2 && intersectY1 < intersectY2) {
                        if (shape.type === 'rectangle' || shape.type === 'circle') {
                            shapesToAdd.push({
                                type: shape.type,
                                color: shape.color,
                                x1: intersectX1, y1: intersectY1,
                                x2: intersectX2, y2: intersectY2
                            });
                        }
                        // Other shapes (lines) inside are discarded
                    }
                }
                activeLayer.shapes = [...shapesToKeep, ...shapesToAdd];
            }
        }

        isDrawing = false;
        isErasing = false;
        isSelecting = false;
        isMoving = false;
        isCropping = false;
        startPos = null;
        endPos = null;
        moveStartPos = null;
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
    selectToolBtn.addEventListener('click', () => setCurrentTool('select'));
    cropToolBtn.addEventListener('click', () => setCurrentTool('crop'));

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
        if (isDrawing || isErasing || isSelecting || isMoving) {
            handleMouseUp();
        }
    });

    zoomSlider.addEventListener('input', applyZoom);
    resetZoomBtn.addEventListener('click', resetZoom);

    // --- Initial Setup ---
    createArtboard();
    setCurrentTool('rectangle');
});