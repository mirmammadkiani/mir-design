document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('artboard');
    const canvasContainer = document.getElementById('canvas-container');
    const viewport = document.getElementById('viewport');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const createBtn = document.getElementById('create-btn');
    const widthInput = document.getElementById('width-input');
    const heightInput = document.getElementById('height-input');
    const colorPicker = document.getElementById('color-picker');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const deleteLayerBtn = document.getElementById('delete-layer-btn');
    const layerList = document.getElementById('layer-list');
    const historyList = document.getElementById('history-list');
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
    const handToolBtn = document.getElementById('hand-tool');
    const addImageBtn = document.getElementById('add-image-btn');
    const imageInput = document.getElementById('image-input');

    // File Popup Elements
    const fileBtn = document.getElementById('file-btn');
    const filePopupPanel = document.getElementById('file-popup-panel');
    const closeFilePopupBtn = document.getElementById('close-file-popup-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const loadProjectBtn = document.getElementById('load-project-btn');
    const loadProjectInput = document.getElementById('load-project-input');
    const canvasInfoWidth = document.getElementById('canvas-info-width');
    const canvasInfoHeight = document.getElementById('canvas-info-height');
    const canvasInfoZoom = document.getElementById('canvas-info-zoom');

    // View UI Elements
    const viewBtn = document.getElementById('view-btn');
    const viewPopupPanel = document.getElementById('view-popup-panel');
    const closeViewPopupBtn = document.getElementById('close-view-popup-btn');
    const toggleLayersPanel = document.getElementById('toggle-layers-panel');
    const toggleHistoryPanel = document.getElementById('toggle-history-panel');
    const layersPanel = document.getElementById('layers-panel');
    const historyPanel = document.getElementById('history-panel');

    // App State
    let artboardWidth = 0, artboardHeight = 0;
    let isDrawing = false, isErasing = false, isSelecting = false, isMoving = false, isCropping = false, isResizing = false, isPanning = false, isSpacebarDown = false;
    let resizeHandle = null;
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
    let panStartPos = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
    
    let layers = [];
    let activeLayerIndex = -1;

    let selectionRect = null;
    let selectedShapes = [];

    // --- History (Undo/Redo) ---
    let history = [];
    let historyIndex = -1;

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

    function drawPolygon(context, shape) {
        if (!shape.points || shape.points.length < 2) return;
        context.fillStyle = shape.color;
        context.beginPath();
        context.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
            context.lineTo(shape.points[i].x, shape.points[i].y);
        }
        context.closePath();
        context.fill();
    }

    function drawImage(context, shape) {
        if (!shape.img || !shape.img.complete) return;
        const x = Math.min(shape.x1, shape.x2);
        const y = Math.min(shape.y1, shape.y2);
        const width = Math.abs(shape.x1 - shape.x2);
        const height = Math.abs(shape.y1 - shape.y2);
        context.drawImage(shape.img, x, y, width, height);
    }

    // --- Project Save/Load ---
    function saveProject() {
        const projectData = {
            artboardWidth: artboardWidth,
            artboardHeight: artboardHeight,
            layers: layers.map(layer => ({
                ...layer,
                shapes: layer.shapes.map(shape => {
                    if (shape.type === 'image' && shape.img) {
                        return { ...shape, imgSrc: shape.img.src, img: undefined };
                    }
                    return shape;
                })
            })),
            history: history.map(h => ({
                ...h,
                layers: h.layers.map(layer => ({
                    ...layer,
                    shapes: layer.shapes.map(shape => {
                        if (shape.type === 'image' && shape.img) {
                            return { ...shape, imgSrc: shape.img.src, img: undefined };
                        }
                        return shape;
                    })
                }))
            })),
            historyIndex: historyIndex
        };

        const dataStr = JSON.stringify(projectData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'artboard_project.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function loadProject(projectData) {
        artboardWidth = projectData.artboardWidth;
        artboardHeight = projectData.artboardHeight;

        const imageLoadPromises = [];

        layers = projectData.layers.map(layer => ({
            ...layer,
            shapes: layer.shapes.map(shape => {
                if (shape.type === 'image' && shape.imgSrc) {
                    const newImg = new Image();
                    const promise = new Promise(resolve => {
                        newImg.onload = () => resolve();
                    });
                    newImg.src = shape.imgSrc;
                    imageLoadPromises.push(promise);
                    return { ...shape, img: newImg };
                }
                return shape;
            })
        }));

        history = projectData.history.map(h => ({
            ...h,
            layers: h.layers.map(layer => ({
                ...layer,
                shapes: layer.shapes.map(shape => {
                    if (shape.type === 'image' && shape.imgSrc) {
                        const newImg = new Image();
                        const promise = new Promise(resolve => {
                            newImg.onload = () => resolve();
                        });
                        newImg.src = shape.imgSrc;
                        imageLoadPromises.push(promise);
                        return { ...shape, img: newImg };
                    }
                    return shape;
                })
            }))
        }));
        historyIndex = projectData.historyIndex;

        updateLayerListUI();
        updateHistoryUI();
        updateCanvasInfo();
        render(); // Initial render

        if (imageLoadPromises.length > 0) {
            Promise.all(imageLoadPromises).then(() => {
                render(); // Re-render after all images are loaded
            });
        }
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
        handToolBtn.classList.toggle('active', tool === 'hand');
        
        if (tool === 'hand') {
            canvas.style.cursor = 'grab';
        } else if (['rectangle', 'circle', 'line', 'eraser', 'crop'].includes(tool)) {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'default';
        }
        
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
                        case 'polygon': drawPolygon(exportCtx, shape); break;
                        case 'image': drawImage(exportCtx, shape); break;
                    }
                });
            }
        });

        const link = document.createElement('a');
        link.download = 'vector-art.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    // --- History Management ---
    function saveState(actionName = 'Unnamed Action') {
        if (historyIndex < history.length - 1) {
            history.splice(historyIndex + 1);
        }

        const layersForHistory = layers.map(layer => ({
            ...layer,
            shapes: layer.shapes.map(shape => {
                if (shape.type === 'image' && shape.img) {
                    return { ...shape, imgSrc: shape.img.src, img: undefined };
                }
                return shape;
            })
        }));

        const newLayersState = JSON.stringify(layersForHistory);

        // Compare with the last state in history to avoid redundant entries
        if (historyIndex >= 0) {
            const lastLayersState = JSON.stringify(history[historyIndex].layers);
            if (newLayersState === lastLayersState) {
                return; // No change, do not save state
            }
        }

        history.push({
            name: actionName,
            layers: JSON.parse(newLayersState) // Parse back to object
        });
        historyIndex++;
        updateHistoryUI();
    }

    function restoreState(state) {
        const stateToRestore = JSON.parse(JSON.stringify(state.layers));
        const imageLoadPromises = [];

        layers = stateToRestore.map(layer => ({
            ...layer,
            shapes: layer.shapes.map(shape => {
                if (shape.type === 'image' && shape.imgSrc) {
                    const newImg = new Image();
                    const promise = new Promise(resolve => {
                        newImg.onload = () => resolve();
                    });
                    newImg.src = shape.imgSrc;
                    imageLoadPromises.push(promise);
                    return { ...shape, img: newImg };
                }
                return shape;
            })
        }));

        updateLayerListUI();
        render(); // Initial render

        if (imageLoadPromises.length > 0) {
            Promise.all(imageLoadPromises).then(() => {
                render(); // Re-render after all images are loaded
            });
        }
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState(history[historyIndex]);
            updateHistoryUI();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState(history[historyIndex]);
            updateHistoryUI();
        }
    }

    // --- Canvas and Layer Logic ---
    function render() {
        if (!artboardWidth || !artboardHeight) return;

        ctx.save();
        canvas.width = artboardWidth * zoomLevel;
        canvas.height = artboardHeight * zoomLevel;
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        ctx.scale(zoomLevel, zoomLevel);

        drawCheckerboard(ctx, artboardWidth, artboardHeight);

        layers.forEach(layer => {
            if (layer.isVisible) {
                layer.shapes.forEach(shape => {
                    if (shape.isVisible !== false) {
                        switch (shape.type) {
                            case 'rectangle': drawRectangle(ctx, shape); break;
                            case 'circle': drawCircle(ctx, shape); break;
                            case 'line': drawLine(ctx, shape); break;
                            case 'polygon': drawPolygon(ctx, shape); break;
                            case 'image': drawImage(ctx, shape); break;
                        }
                    }
                });
            }
        });

        if (isGridVisible) drawGrid();
        drawGuideGrid();

        if (startPos && endPos) {
            if (isDrawing) {
                const previewShape = { type: currentTool, color: currentColor, x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y };
                switch (currentTool) {
                    case 'rectangle': drawRectangle(ctx, previewShape); break;
                    case 'circle': drawCircle(ctx, previewShape); break;
                    case 'line': drawLine(ctx, previewShape); break;
                }
            } else if (isErasing || isSelecting || isCropping) {
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

        if (selectionRect) {
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
            ctx.lineWidth = 1 / zoomLevel;
            ctx.setLineDash([4 / zoomLevel, 2 / zoomLevel]);
            ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
            ctx.setLineDash([]);

            const handles = getResizeHandles(selectionRect);
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
            ctx.lineWidth = 1 / zoomLevel;
            for (const key in handles) {
                const handle = handles[key];
                ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
                ctx.strokeRect(handle.x, handle.y, handle.width, handle.height);
            }

        }
        
        ctx.restore();
    }

    function getResizeHandles(rect) {
        const handleSize = 8 / zoomLevel;
        const halfHandleSize = handleSize / 2;
        return {
            'top-left': { x: rect.x - halfHandleSize, y: rect.y - halfHandleSize, width: handleSize, height: handleSize },
            'top-middle': { x: rect.x + rect.width / 2 - halfHandleSize, y: rect.y - halfHandleSize, width: handleSize, height: handleSize },
            'top-right': { x: rect.x + rect.width - halfHandleSize, y: rect.y - halfHandleSize, width: handleSize, height: handleSize },
            'middle-left': { x: rect.x - halfHandleSize, y: rect.y + rect.height / 2 - halfHandleSize, width: handleSize, height: handleSize },
            'middle-right': { x: rect.x + rect.width - halfHandleSize, y: rect.y + rect.height / 2 - halfHandleSize, width: handleSize, height: handleSize },
            'bottom-left': { x: rect.x - halfHandleSize, y: rect.y + rect.height - halfHandleSize, width: handleSize, height: handleSize },
            'bottom-middle': { x: rect.x + rect.width / 2 - halfHandleSize, y: rect.y + rect.height - halfHandleSize, width: handleSize, height: handleSize },
            'bottom-right': { x: rect.x + rect.width - halfHandleSize, y: rect.y + rect.height - halfHandleSize, width: handleSize, height: handleSize },
        };
    }

    function getHandleAtPos(pos, rect) {
        if (!rect) return null;
        const handles = getResizeHandles(rect);
        for (const key in handles) {
            const handle = handles[key];
            if (pos.x >= handle.x && pos.x <= handle.x + handle.width &&
                pos.y >= handle.y && pos.y <= handle.y + handle.height) {
                return key;
            }
        }
        return null;
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
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, artboardHeight); ctx.stroke();
        }
        for (let y = 0; y <= artboardHeight; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(artboardWidth, y); ctx.stroke();
        }
    }

    function createArtboard() {
        let rawWidth = parseInt(widthInput.value, 10);
        let rawHeight = parseInt(heightInput.value, 10);
        if (isNaN(rawWidth) || rawWidth <= 0) rawWidth = 128;
        if (isNaN(rawHeight) || rawHeight <= 0) rawHeight = 128;
        artboardWidth = Math.round(rawWidth / 32) * 32;
        artboardHeight = Math.round(rawHeight / 32) * 32;
        if (artboardWidth < 32) artboardWidth = 32;
        if (artboardHeight < 32) artboardHeight = 32;
        widthInput.value = artboardWidth;
        heightInput.value = artboardHeight;
        layers = [];
        addNewLayer();
        resetZoom();
        history = [];
        historyIndex = -1;
        saveState('Initial State');
    }

    function addNewLayer() {
        const newLayer = { shapes: [], name: `Layer ${layers.length + 1}`, isVisible: true };
        layers.push(newLayer);
        setActiveLayer(layers.length - 1);
    }

    function setActiveLayer(index, rerender = true) {
        activeLayerIndex = index;
        if (rerender) {
            updateLayerListUI();
        }
    }

    function updateLayerListUI() {
        layerList.innerHTML = '';
        layers.forEach((layer, index) => {
            const layerDetails = document.createElement('details');
            layerDetails.open = true; // Keep layers expanded by default
            
            const layerSummary = document.createElement('summary');
            layerSummary.classList.add('layer-item');
            layerSummary.draggable = true;
            if (index === activeLayerIndex) {
                layerSummary.classList.add('active');
            }
            layerSummary.dataset.index = index;

            const visibilityToggle = document.createElement('i');
            visibilityToggle.classList.add('bi', layer.isVisible ? 'bi-eye-fill' : 'bi-eye-slash-fill', 'layer-visibility');
            visibilityToggle.dataset.index = index;
            
            const layerName = document.createElement('span');
            layerName.textContent = layer.name;
            layerName.classList.add('layer-name');
            layerName.dataset.index = index;

            layerSummary.appendChild(visibilityToggle);
            layerSummary.appendChild(layerName);
            
            layerDetails.appendChild(layerSummary);

            const shapeList = document.createElement('div');
            shapeList.classList.add('shape-list');
            layer.shapes.slice().reverse().forEach((shape, i) => { // reverse to show newest on top
                const shapeIndex = layer.shapes.length - 1 - i;
                const shapeItem = document.createElement('div');
                shapeItem.classList.add('shape-item');
                shapeItem.dataset.shapeId = shape.id;
                shapeItem.draggable = true;

                const shapeVisibilityToggle = document.createElement('i');
                shapeVisibilityToggle.classList.add('bi', (shape.isVisible === false) ? 'bi-eye-slash-fill' : 'bi-eye-fill', 'shape-visibility');
                shapeVisibilityToggle.dataset.layerIndex = index;
                shapeVisibilityToggle.dataset.shapeIndex = shapeIndex;
                
                const shapeNameSpan = document.createElement('span');
                shapeNameSpan.classList.add('shape-name');
                shapeNameSpan.textContent = `└ ${shape.name || shape.type}`;
                shapeNameSpan.dataset.layerIndex = index;
                shapeNameSpan.dataset.shapeIndex = shapeIndex;

                shapeItem.appendChild(shapeVisibilityToggle);
                shapeItem.appendChild(shapeNameSpan);
                shapeList.appendChild(shapeItem);
            });
            layerDetails.appendChild(shapeList);

            layerList.appendChild(layerDetails);
        });
    }

    function applyZoom() {
        zoomLevel = parseInt(zoomSlider.value, 10) / 100;
        if (zoomLevel < 0.1) zoomLevel = 0.1;
        render();
    }

    function resetZoom() {
        const viewportWidth = viewport.offsetWidth - 40; // Subtract padding
        const viewportHeight = viewport.offsetHeight - 40; // Subtract padding

        const scaleX = viewportWidth / artboardWidth;
        const scaleY = viewportHeight / artboardHeight;

        zoomLevel = Math.min(scaleX, scaleY); // Fit to screen, allowing zoom in beyond 100%
        if (zoomLevel < 0.1) zoomLevel = 0.1; // Minimum zoom
        if (zoomLevel > 32) zoomLevel = 32; // Maximum zoom (3200% / 100)

        zoomSlider.value = zoomLevel * 100;
        render();
        updateCanvasInfo(); // Update info after zoom reset
    }

    function updateCanvasInfo() {
        canvasInfoWidth.textContent = artboardWidth;
        canvasInfoHeight.textContent = artboardHeight;
        canvasInfoZoom.textContent = Math.round(zoomLevel * 100);
    }

    // --- Vector Clipping & Polygon Logic ---
    function shapeToPolygon(shape) {
        const points = [];
        if (shape.type === 'polygon') {
            return shape.points;
        }
        if (shape.type === 'rectangle' || shape.type === 'image') {
            const x1 = Math.min(shape.x1, shape.x2);
            const y1 = Math.min(shape.y1, shape.y2);
            const x2 = Math.max(shape.x1, shape.x2);
            const y2 = Math.max(shape.y1, shape.y2);
            points.push({ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 });
        } else if (shape.type === 'circle') {
            const radiusX = Math.abs(shape.x1 - shape.x2) / 2;
            const radiusY = Math.abs(shape.y1 - shape.y2) / 2;
            if (radiusX === 0 || radiusY === 0) return [];
            const centerX = Math.min(shape.x1, shape.x2) + radiusX;
            const centerY = Math.min(shape.y1, shape.y2) + radiusY;
            const segments = 72; // High-resolution approximation
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * 2 * Math.PI;
                points.push({
                    x: centerX + Math.cos(angle) * radiusX,
                    y: centerY + Math.sin(angle) * radiusY
                });
            }
        } else if (shape.type === 'line') {
             points.push({x: shape.x1, y: shape.y1}, {x: shape.x2, y: shape.y2});
        }
        return points;
    }

    function clip(subjectPolygon, clipPolygon) {
        let outputList = subjectPolygon;
        let cp1 = clipPolygon[clipPolygon.length - 1];
        for (let j = 0; j < clipPolygon.length; j++) {
            const cp2 = clipPolygon[j];
            const inputList = outputList;
            outputList = [];
            if (inputList.length === 0) continue;
            let s = inputList[inputList.length - 1];
            for (let i = 0; i < inputList.length; i++) {
                let e = inputList[i];
                const dc = { x: cp2.x - cp1.x, y: cp2.y - cp1.y };
                const dp = { x: s.x - cp1.x, y: s.y - cp1.y };
                const de = { x: e.x - cp1.x, y: e.y - cp1.y };
                const n = dc.x * de.y - dc.y * de.x;
                const d = dc.x * dp.y - dc.y * dp.x;

                if (n >= 0) { // e is inside
                    if (d < 0) { // s is outside
                        const t = d / (d - n);
                        outputList.push({ x: s.x + t * (e.x - s.x), y: s.y + t * (e.y - s.y) });
                    }
                    outputList.push(e);
                } else if (d >= 0) { // s is inside
                    const t = d / (d - n);
                    outputList.push({ x: s.x + t * (e.x - s.x), y: s.y + t * (e.y - s.y) });
                }
                s = e;
            }
            cp1 = cp2;
        }
        return outputList;
    }

    // --- Selection & Move Logic ---
    function isPointInRect(point, rect) {
        if (!rect) return false;
        return point.x >= rect.x && point.x <= rect.x + rect.width &&
               point.y >= rect.y && point.y <= rect.y + rect.height;
    }

    function findAndBoundSelectedShapes(userRect) {
        const activeLayer = layers[activeLayerIndex];
        if (!activeLayer) { selectedShapes = []; selectionRect = null; return; }

        selectedShapes = activeLayer.shapes.filter(shape => {
            const shapePoly = shapeToPolygon(shape);
            if (shapePoly.length === 0) return false;
            const shapeX1 = Math.min(...shapePoly.map(p => p.x));
            const shapeY1 = Math.min(...shapePoly.map(p => p.y));
            const shapeX2 = Math.max(...shapePoly.map(p => p.x));
            const shapeY2 = Math.max(...shapePoly.map(p => p.y));
            const rectX1 = userRect.x, rectY1 = userRect.y;
            const rectX2 = userRect.x + userRect.width, rectY2 = userRect.y + userRect.height;
            return shapeX1 < rectX2 && shapeX2 > rectX1 && shapeY1 < rectY2 && shapeY2 > rectY1;
        });

        if (selectedShapes.length === 0) { selectionRect = null; return; }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedShapes.forEach(shape => {
            const poly = shapeToPolygon(shape);
            poly.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        });
        selectionRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // --- Input Handling ---
    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (evt.clientX - rect.left) / zoomLevel;
        const mouseY = (evt.clientY - rect.top) / zoomLevel;
        return { x: mouseX, y: mouseY };
    }

    function handleMouseDown(e) {
        if (isSpacebarDown || currentTool === 'hand') {
            isPanning = true;
            panStartPos.x = e.clientX;
            panStartPos.y = e.clientY;
            panStartPos.scrollX = viewport.scrollLeft;
            panStartPos.scrollY = viewport.scrollTop;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        let pos = getMousePos(e);
        if (currentTool === 'select') {
            const handle = getHandleAtPos(pos, selectionRect);
            if (handle) {
                isResizing = true;
                resizeHandle = handle;
                moveStartPos = pos; // Use moveStartPos to track mouse movement
                selectedShapes.forEach(shape => {
                    if (shape.type === 'polygon') {
                        shape.initialPoints = shape.points.map(p => ({...p}));
                    } else {
                        shape.initialX1 = shape.x1;
                        shape.initialY1 = shape.y1;
                        shape.initialX2 = shape.x2;
                        shape.initialY2 = shape.y2;
                    }
                });
                selectionRect.initial = { ...selectionRect };
                return; // Stop further processing
            }

            if (isPointInRect(pos, selectionRect)) {
                isMoving = true;
                moveStartPos = pos;
                selectedShapes.forEach(shape => {
                    if (shape.type === 'polygon') {
                        shape.initialPoints = shape.points.map(p => ({...p}));
                    } else {
                        shape.initialX1 = shape.x1;
                        shape.initialY1 = shape.y1;
                        shape.initialX2 = shape.x2;
                        shape.initialY2 = shape.y2;
                    }
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
            startPos = isSnapEnabled ? { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) } : pos;
            endPos = startPos;
        } else {
            pos = isSnapEnabled ? { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) } : pos;
            startPos = pos;
            endPos = pos;
            if (['rectangle', 'circle', 'line'].includes(currentTool)) isDrawing = true;
            else if (currentTool === 'eraser') isErasing = true;
        }
        render();
    }

    function handleMouseMove(e) {
        if (isPanning) {
            const dx = e.clientX - panStartPos.x;
            const dy = e.clientY - panStartPos.y;
            viewport.scrollLeft = panStartPos.scrollX - dx;
            viewport.scrollTop = panStartPos.scrollY - dy;
            return;
        }

        if (!isDrawing && !isErasing && !isSelecting && !isMoving && !isResizing && !isCropping) {
            // --- Cursor Style Logic ---
            if (currentTool === 'select' && selectionRect) {
                const pos = getMousePos(e);
                const handle = getHandleAtPos(pos, selectionRect);
                if (handle) {
                    if (handle.includes('top') && handle.includes('left')) canvas.style.cursor = 'nwse-resize';
                    else if (handle.includes('top') && handle.includes('right')) canvas.style.cursor = 'nesw-resize';
                    else if (handle.includes('bottom') && handle.includes('left')) canvas.style.cursor = 'nesw-resize';
                    else if (handle.includes('bottom') && handle.includes('right')) canvas.style.cursor = 'nwse-resize';
                    else if (handle.includes('top') || handle.includes('bottom')) canvas.style.cursor = 'ns-resize';
                    else if (handle.includes('left') || handle.includes('right')) canvas.style.cursor = 'ew-resize';
                } else if (isPointInRect(pos, selectionRect)) {
                    canvas.style.cursor = 'move';
                } else {
                    canvas.style.cursor = 'default';
                }
            }
            return;
        }

        let pos = getMousePos(e);

        if (isResizing) {
            const dx = pos.x - moveStartPos.x;
            const dy = pos.y - moveStartPos.y;
            const initial = selectionRect.initial;
            const constrainProportions = e.shiftKey;
            const initialAspectRatio = initial.width / initial.height;

            let newX = initial.x;
            let newY = initial.y;
            let newWidth = initial.width;
            let newHeight = initial.height;

            const minDimension = isSnapEnabled ? snapGridSize : 1; // Minimum dimension based on snap state

            // Calculate potential new dimensions and position
            if (resizeHandle.includes('right')) {
                newWidth = initial.width + dx;
            }
            if (resizeHandle.includes('left')) {
                newWidth = initial.width - dx;
                newX = initial.x + dx;
            }
            if (resizeHandle.includes('bottom')) {
                newHeight = initial.height + dy;
            }
            if (resizeHandle.includes('top')) {
                newHeight = initial.height - dy;
                newY = initial.y + dy;
            }

            // Apply proportion constraint if Shift is held
            if (constrainProportions) {
                let anchorX = initial.x;
                let anchorY = initial.y;

                // Determine the anchor point (opposite corner/side)
                if (resizeHandle.includes('right')) anchorX = initial.x;
                else if (resizeHandle.includes('left')) anchorX = initial.x + initial.width;

                if (resizeHandle.includes('bottom')) anchorY = initial.y;
                else if (resizeHandle.includes('top')) anchorY = initial.y + initial.height;

                // Calculate current mouse position relative to the anchor point
                const currentMouseXRelativeToAnchor = pos.x - anchorX;
                const currentMouseYRelativeToAnchor = pos.y - anchorY;

                // Calculate potential new width and height based on mouse position relative to anchor
                let potentialNewWidth = Math.abs(currentMouseXRelativeToAnchor);
                let potentialNewHeight = Math.abs(currentMouseYRelativeToAnchor);

                // Determine the scale factor based on which dimension changed more, to maintain aspect ratio
                let scaleFactor;
                if (initial.width === 0 || initial.height === 0) {
                    scaleFactor = 1; // Avoid division by zero, or handle as a special case
                } else {
                    const scaleX = potentialNewWidth / initial.width;
                    const scaleY = potentialNewHeight / initial.height;
                    scaleFactor = Math.max(scaleX, scaleY); // Use the larger scale to ensure it covers the mouse position
                }

                newWidth = initial.width * scaleFactor;
                newHeight = initial.height * scaleFactor;

                // Adjust newX and newY based on the anchor point and new dimensions
                if (resizeHandle.includes('left')) newX = anchorX - newWidth;
                else newX = anchorX;

                if (resizeHandle.includes('top')) newY = anchorY - newHeight;
                else newY = anchorY;

                // Handle cases where newX/newY might need to be adjusted if anchor is not a corner
                if (!resizeHandle.includes('left') && !resizeHandle.includes('right')) {
                    // Vertical handles: center horizontally
                    newX = initial.x + (initial.width - newWidth) / 2;
                }
                if (!resizeHandle.includes('top') && !resizeHandle.includes('bottom')) {
                    // Horizontal handles: center vertically
                    newY = initial.y + (initial.height - newHeight) / 2;
                }
            }

            // Prevent flipping and ensure minimum dimensions
            if (newWidth < minDimension) {
                newWidth = minDimension;
                // Adjust newX if resizing from left
                if (resizeHandle.includes('left')) {
                    newX = initial.x + initial.width - minDimension;
                }
            }
            if (newHeight < minDimension) {
                newHeight = minDimension;
                // Adjust newY if resizing from top
                if (resizeHandle.includes('top')) {
                    newY = initial.y + initial.height - minDimension;
                }
            }

            if (isSnapEnabled) {
                // Calculate the potential new corners
                let x1_new = newX;
                let y1_new = newY;
                let x2_new = newX + newWidth;
                let y2_new = newY + newHeight;

                // Snap the corners
                let snapped_x1 = snap(x1_new, snapGridSize);
                let snapped_y1 = snap(y1_new, snapGridSize);
                let snapped_x2 = snap(x2_new, snapGridSize);
                let snapped_y2 = snap(y2_new, snapGridSize);

                // Re-calculate newX, newY, newWidth, newHeight from snapped corners
                newX = snapped_x1;
                newY = snapped_y1;
                newWidth = snapped_x2 - snapped_x1;
                newHeight = snapped_y2 - snapped_y1;

                // Ensure minimum width/height after snapping
                if (newWidth < snapGridSize) newWidth = snapGridSize;
                if (newHeight < snapGridSize) newHeight = snapGridSize;
            }

            // Recalculate scale factors based on potentially adjusted newWidth/Height
            const finalScaleX = newWidth / initial.width;
            const finalScaleY = newHeight / initial.height;

            selectedShapes.forEach(shape => {
                if (shape.type === 'polygon') {
                    shape.points = shape.initialPoints.map(p => ({
                        x: newX + (p.x - initial.x) * finalScaleX,
                        y: newY + (p.y - initial.y) * finalScaleY
                    }));
                } else {
                    // For simple shapes, update x1, y1, x2, y2 based on the new bounding box
                    const initialShapeX1 = initial.x + (shape.initialX1 - initial.x);
                    const initialShapeY1 = initial.y + (shape.initialY1 - initial.y);
                    const initialShapeX2 = initial.x + (shape.initialX2 - initial.x);
                    const initialShapeY2 = initial.y + (shape.initialY2 - initial.y);

                    shape.x1 = newX + (initialShapeX1 - initial.x) * finalScaleX;
                    shape.y1 = newY + (initialShapeY1 - initial.y) * finalScaleY;
                    shape.x2 = newX + (initialShapeX2 - initial.x) * finalScaleX;
                    shape.y2 = newY + (initialShapeY2 - initial.y) * finalScaleY;
                }
            });

            selectionRect.x = newX;
            selectionRect.y = newY;
            selectionRect.width = newWidth;
            selectionRect.height = newHeight;

        } else if (isMoving) {
            let dx = pos.x - moveStartPos.x;
            let dy = pos.y - moveStartPos.y;

            if (isSnapEnabled) {
                // Calculate snapped target position for the selection rectangle's top-left corner
                const snappedTargetX = snap(selectionRect.initialX + dx, snapGridSize);
                const snappedTargetY = snap(selectionRect.initialY + dy, snapGridSize);

                // Adjust dx and dy to match the snapped movement
                dx = snappedTargetX - selectionRect.initialX;
                dy = snappedTargetY - selectionRect.initialY;
            }

            selectedShapes.forEach(shape => {
                if (shape.type === 'polygon') {
                    shape.points = shape.initialPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
                } else {
                    shape.x1 = shape.initialX1 + dx;
                    shape.y1 = shape.initialY1 + dy;
                    shape.x2 = shape.initialX2 + dx;
                    shape.y2 = shape.initialY2 + dy;
                }
            });
            selectionRect.x = selectionRect.initialX + dx;
            selectionRect.y = selectionRect.initialY + dy;
        } else {
             pos = isSnapEnabled ? { x: snap(pos.x, snapGridSize), y: snap(pos.y, snapGridSize) } : pos;
             endPos = pos;
        }
        render();
    }

    function handleMouseUp() {
        // If no action is in progress, do nothing. This prevents multiple triggers.
        if (!isDrawing && !isErasing && !isSelecting && !isMoving && !isCropping && !isResizing && !isPanning) {
             return;
        }

        if (isPanning) {
            isPanning = false;
            if (currentTool === 'hand') {
                canvas.style.cursor = 'grab';
            } else if (!isSpacebarDown) {
                setCurrentTool(currentTool); // Reset to the tool's cursor
            }
            return;
        }

        const activeLayer = layers[activeLayerIndex];
        if (!activeLayer) return;
        if (isDrawing) {
            const width = Math.abs(startPos.x - endPos.x);
            const height = Math.abs(startPos.y - endPos.y);

            // Prevent zero-area shapes (lines)
            if (width === 0 || height === 0 || (isSnapEnabled && (width % snapGridSize !== 0 || height % snapGridSize !== 0))) {
                isDrawing = false;
                render();
                return;
            }
            
            const shapeX1 = Math.min(startPos.x, endPos.x);
            const shapeY1 = Math.min(startPos.y, endPos.y);
            const shapeX2 = Math.max(startPos.x, endPos.x);
            const shapeY2 = Math.max(startPos.y, endPos.y);

            // Prevent creating shapes outside the artboard
            if (shapeX2 < 0 || shapeX1 > artboardWidth || shapeY2 < 0 || shapeY1 > artboardHeight) {
                 isDrawing = false;
                 render();
                 return;
            }

            const shapeName = currentTool.charAt(0).toUpperCase() + currentTool.slice(1);
            activeLayer.shapes.push({
                id: Date.now() + Math.random(),
                type: currentTool,
                name: shapeName,
                color: currentColor,
                x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y,
                isVisible: true
            });
            updateLayerListUI();
            saveState(`Draw ${currentTool}`);
        } else if (isErasing) {
            const eraseRect = { x: Math.min(startPos.x, endPos.x), y: Math.min(startPos.y, endPos.y), width: Math.abs(startPos.x - endPos.x), height: Math.abs(startPos.y - endPos.y) };
            const initialShapeCount = activeLayer.shapes.length;
            
            const originalShapes = [...activeLayer.shapes];
            activeLayer.shapes = activeLayer.shapes.filter(shape => {
                const shapePoly = shapeToPolygon(shape);
                if (shapePoly.length === 0) return true;
                const shapeX1 = Math.min(...shapePoly.map(p => p.x)), shapeY1 = Math.min(...shapePoly.map(p => p.y));
                const shapeX2 = Math.max(...shapePoly.map(p => p.x)), shapeY2 = Math.max(...shapePoly.map(p => p.y));
                return !(shapeX1 < eraseRect.x + eraseRect.width && shapeX2 > eraseRect.x && shapeY1 < eraseRect.y + eraseRect.height && shapeY2 > eraseRect.y);
            });

            if (initialShapeCount !== activeLayer.shapes.length) {
                saveState('Erase');
                updateLayerListUI();
            } else {
                activeLayer.shapes = originalShapes;
            }
        } else if (isSelecting) {
            const userRect = { x: Math.min(startPos.x, endPos.x), y: Math.min(startPos.y, endPos.y), width: Math.abs(startPos.x - endPos.x), height: Math.abs(startPos.y - endPos.y) };
            if (userRect.width > 0 || userRect.height > 0) findAndBoundSelectedShapes(userRect);
            else { selectionRect = null; selectedShapes = []; }
        } else if (isCropping) {
            const cropRect = {
                x: Math.min(startPos.x, endPos.x),
                y: Math.min(startPos.y, endPos.y),
                width: Math.abs(startPos.x - endPos.x),
                height: Math.abs(startPos.y - endPos.y)
            };

            if (cropRect.width > 0 && cropRect.height > 0) {
                // Clamp cropRect to be within the artboard - REMOVED, cropRect should be what user drew
                // cropRect.x = Math.max(0, cropRect.x);
                // cropRect.y = Math.max(0, cropRect.y);
                // cropRect.width = Math.min(artboardWidth - cropRect.x, cropRect.width);
                // cropRect.height = Math.min(artboardHeight - cropRect.y, cropRect.height);

                const newShapes = [];
                const clipPoly = [
                    {x: cropRect.x, y: cropRect.y},
                    {x: cropRect.x + cropRect.width, y: cropRect.y},
                    {x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height},
                    {x: cropRect.x, y: cropRect.y + cropRect.height}
                ];

                for (const layer of layers) {
                    const croppedShapes = [];
                    for (const shape of layer.shapes) {
                        const subjectPoly = shapeToPolygon(shape);
                        if (subjectPoly.length === 0) continue;

                        // Bounding box check for quick discard
                        const shapeX1 = Math.min(...subjectPoly.map(p => p.x));
                        const shapeY1 = Math.min(...subjectPoly.map(p => p.y));
                        const shapeX2 = Math.max(...subjectPoly.map(p => p.x));
                        const shapeY2 = Math.max(...subjectPoly.map(p => p.y));
                        if (shapeX2 < cropRect.x || shapeX1 > cropRect.x + cropRect.width ||
                            shapeY2 < cropRect.y || shapeY1 > cropRect.y + cropRect.height) {
                            continue; // Shape is completely outside the crop area
                        }

                        // If shape is completely inside, just offset it
                        if (shapeX1 >= cropRect.x && shapeX2 <= cropRect.x + cropRect.width &&
                            shapeY1 >= cropRect.y && shapeY2 <= cropRect.y + cropRect.height) {
                            const newShape = JSON.parse(JSON.stringify(shape));
                            if (newShape.type === 'polygon') {
                                newShape.points.forEach(p => {
                                    // p.x -= cropRect.x;
                                    // p.y -= cropRect.y;
                                });
                            } else {
                                // newShape.x1 -= cropRect.x;
                                // newShape.y1 -= cropRect.y;
                                // newShape.x2 -= cropRect.x;
                                // newShape.y2 -= cropRect.y;
                            }
                            croppedShapes.push(newShape);
                            continue;
                        }
                        
                        // Handle images with a specialized, simpler clipping method
                        if (shape.type === 'image') {
                            const imgX = Math.min(shape.x1, shape.x2);
                            const imgY = Math.min(shape.y1, shape.y2);
                            const imgWidth = Math.abs(shape.x1 - shape.x2);
                            const imgHeight = Math.abs(shape.y1 - shape.y2);

                            const intersectX = Math.max(imgX, cropRect.x);
                            const intersectY = Math.max(imgY, cropRect.y);
                            const intersectWidth = Math.min(imgX + imgWidth, cropRect.x + cropRect.width) - intersectX;
                            const intersectHeight = Math.min(imgY + imgHeight, cropRect.y + cropRect.height) - intersectY;

                            if (intersectWidth > 0 && intersectHeight > 0) {
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = intersectWidth;
                                tempCanvas.height = intersectHeight;
                                const tempCtx = tempCanvas.getContext('2d');

                                const sourceXInImage = (intersectX - imgX);
                                const sourceYInImage = (intersectY - imgY);

                                tempCtx.drawImage(shape.img, sourceXInImage, sourceYInImage, intersectWidth, intersectHeight, 0, 0, intersectWidth, intersectHeight);
                                
                                const newImg = new Image();
                                newImg.src = tempCanvas.toDataURL();
                                // onload is not strictly needed if we don't re-render immediately,
                                // but good practice if we did.
                                
                                croppedShapes.push({
                                    ...shape,
                                    id: Date.now() + Math.random(),
                                    img: newImg,
                                    x1: intersectX,
                                    y1: intersectY,
                                    x2: intersectX + intersectWidth,
                                    y2: intersectY + intersectHeight,
                                });
                            }
                            continue; // Move to next shape
                        }


                        // For other vector shapes, use the clipping algorithm
                        const clippedPoints = clip(subjectPoly, clipPoly);
                        if (clippedPoints.length > 2) {
                            const newShape = {
                                ...shape,
                                id: Date.now() + Math.random(),
                                type: 'polygon',
                                points: clippedPoints.map(p => ({
                                    x: p.x,
                                    y: p.y
                                }))
                            };
                            croppedShapes.push(newShape);
                        }
                    }
                    layer.shapes = croppedShapes;
                }

                saveState('Crop Content');
                updateLayerListUI();
            }
        } else if (isMoving) {
            // Only save state if position actually changed from initial drag start
            if (selectionRect.x !== selectionRect.initialX || selectionRect.y !== selectionRect.initialY) {
                saveState('Move Shape');
            }
        } else if (isResizing) {
            // Only save state if dimensions or position actually changed from initial drag start
            if (selectionRect.x !== selectionRect.initial.x ||
                selectionRect.y !== selectionRect.initial.y ||
                selectionRect.width !== selectionRect.initial.width ||
                selectionRect.height !== selectionRect.initial.height) {
                saveState('Resize Shape');
            }
        }

        isDrawing = false; isErasing = false; isSelecting = false; isMoving = false; isCropping = false; isResizing = false;
        resizeHandle = null;
        startPos = null; endPos = null; moveStartPos = null;
        hasResized = false; // Reset flag
        hasMoved = false; // Reset flag
        render();
    }

    // --- Event Listeners ---
    createBtn.addEventListener('click', createArtboard);
    addLayerBtn.addEventListener('click', () => {
        addNewLayer();
        saveState('Add Layer');
    });

    deleteLayerBtn.addEventListener('click', () => {
        if (layers.length > 1 && activeLayerIndex > -1) {
            layers.splice(activeLayerIndex, 1);
            if (activeLayerIndex >= layers.length) {
                activeLayerIndex = Math.max(0, layers.length - 1);
            }
            setActiveLayer(activeLayerIndex);
            render();
            saveState('Delete Layer');
        }
    });
    exportBtn.addEventListener('click', exportImage);
    eraserToolBtn.addEventListener('click', () => setCurrentTool('eraser'));
    rectangleToolBtn.addEventListener('click', () => setCurrentTool('rectangle'));
    circleToolBtn.addEventListener('click', () => setCurrentTool('circle'));
    lineToolBtn.addEventListener('click', () => setCurrentTool('line'));
    selectToolBtn.addEventListener('click', () => setCurrentTool('select'));
    cropToolBtn.addEventListener('click', () => setCurrentTool('crop'));
    handToolBtn.addEventListener('click', () => setCurrentTool('hand'));
    addImageBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const activeLayer = layers[activeLayerIndex];
                if (activeLayer) {
                    let imgWidth = img.width;
                    let imgHeight = img.height;

                    // Scale down image if it's larger than the artboard
                    const aspectRatio = imgWidth / imgHeight;
                    if (imgWidth > artboardWidth || imgHeight > artboardHeight) {
                        if (imgWidth / artboardWidth > imgHeight / artboardHeight) {
                            imgWidth = artboardWidth;
                            imgHeight = imgWidth / aspectRatio;
                        } else {
                            imgHeight = artboardHeight;
                            imgWidth = imgHeight * aspectRatio;
                        }
                    }

                    // Center the image on the artboard
                    const x = (artboardWidth - imgWidth) / 2;
                    const y = (artboardHeight - imgHeight) / 2;

                    const newImage = {
                        id: Date.now() + Math.random(),
                        type: 'image',
                        name: 'Image',
                        img: img,
                        x1: x,
                        y1: y,
                        x2: x + imgWidth,
                        y2: y + imgHeight,
                        isVisible: true
                    };
                    activeLayer.shapes.push(newImage);
                    updateLayerListUI();
                    render();
                    saveState('Add Image');

                    // Automatically select the newly added image
                    setCurrentTool('select');
                    selectedShapes = [newImage];
                    selectionRect = { x: newImage.x1, y: newImage.y1, width: newImage.x2 - newImage.x1, height: newImage.y2 - newImage.y1 };
                    render();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input so same file can be loaded again
    });

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

    fileBtn.addEventListener('click', () => {
        filePopupPanel.style.display = filePopupPanel.style.display === 'block' ? 'none' : 'block';
        if (filePopupPanel.style.display === 'block') {
            updateCanvasInfo();
        }
    });

    closeFilePopupBtn.addEventListener('click', () => {
        filePopupPanel.style.display = 'none';
    });

    saveProjectBtn.addEventListener('click', saveProject);

    loadProjectBtn.addEventListener('click', () => {
        loadProjectInput.click(); // Trigger the hidden file input
    });

    function isValidProjectData(data) {
        if (typeof data !== 'object' || data === null) return false;
        if (typeof data.artboardWidth !== 'number' || typeof data.artboardHeight !== 'number') return false;
        if (!Array.isArray(data.layers) || !Array.isArray(data.history)) return false;
        if (typeof data.historyIndex !== 'number') return false;

        // Basic check for layer and history item structure
        if (data.layers.some(layer => typeof layer !== 'object' || !Array.isArray(layer.shapes))) return false;
        if (data.history.some(h => typeof h !== 'object' || !Array.isArray(h.layers))) return false;

        return true;
    }

    loadProjectInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const projectData = JSON.parse(event.target.result);
                if (isValidProjectData(projectData)) {
                    loadProject(projectData);
                    filePopupPanel.style.display = 'none'; // Close popup after loading
                } else {
                    alert('Failed to load project. The file structure is invalid.');
                }
            } catch (error) {
                console.error('Error loading project:', error);
                alert('Failed to load project. The file might be corrupted or not a valid JSON file.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input so same file can be loaded again
    });

    // View Panel Event Listeners
    viewBtn.addEventListener('click', () => {
        viewPopupPanel.style.display = viewPopupPanel.style.display === 'block' ? 'none' : 'block';
        if (viewPopupPanel.style.display === 'block') {
            // Update toggle states based on current panel visibility
            toggleLayersPanel.checked = layersPanel.style.display !== 'none';
            toggleHistoryPanel.checked = historyPanel.style.display !== 'none';
        }
    });

    closeViewPopupBtn.addEventListener('click', () => {
        viewPopupPanel.style.display = 'none';
    });

    toggleLayersPanel.addEventListener('change', (e) => {
        layersPanel.style.display = e.target.checked ? 'block' : 'none';
    });

    toggleHistoryPanel.addEventListener('change', (e) => {
        historyPanel.style.display = e.target.checked ? 'block' : 'none';
    });

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', () => {
        if (isDrawing || isErasing || isSelecting || isMoving) {
            handleMouseUp();
        }
    });

    layerList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('layer-visibility')) {
            const index = parseInt(target.dataset.index, 10);
            layers[index].isVisible = !layers[index].isVisible;
            updateLayerListUI();
            render();
        } else if (target.classList.contains('shape-visibility')) {
            const layerIndex = parseInt(target.dataset.layerIndex, 10);
            const shapeIndex = parseInt(target.dataset.shapeIndex, 10);
            const shape = layers[layerIndex].shapes[shapeIndex];
            shape.isVisible = shape.isVisible === false; // Toggle visibility
            updateLayerListUI();
            render();
        } else if (target.closest('.layer-item')) {
            const layerItem = target.closest('.layer-item');
            const index = parseInt(layerItem.dataset.index, 10);

            if (activeLayerIndex !== index) {
                if (activeLayerIndex !== -1) {
                    const prevActiveLayer = layerList.querySelector(`.layer-item[data-index="${activeLayerIndex}"]`);
                    if (prevActiveLayer) {
                        prevActiveLayer.classList.remove('active');
                    }
                }
                layerItem.classList.add('active');
                setActiveLayer(index, false);
            }
        }
    });

    layerList.addEventListener('dblclick', (e) => {
        const target = e.target;

        const createRenameInput = (element, onSave) => {
            const currentName = element.textContent.replace('└ ', '').trim();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.classList.add('layer-name-input');
            
            element.replaceWith(input);
            input.focus();
            input.select();

            const save = () => {
                const newName = input.value.trim();
                onSave(newName || currentName); // Pass the new name to the callback
                // The updateLayerListUI will redraw everything, so no need to replace input back
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') input.blur();
                else if (ev.key === 'Escape') {
                    input.value = currentName;
                    input.blur();
                }
            });
        };

        if (target.classList.contains('layer-name')) {
            const layerIndex = parseInt(target.dataset.index, 10);
            createRenameInput(target, (newName) => {
                if (layers[layerIndex].name !== newName && newName) {
                    layers[layerIndex].name = newName;
                    updateLayerListUI();
                    saveState('Rename Layer');
                }
            });
        } else if (target.classList.contains('shape-name')) {
            const layerIndex = parseInt(target.dataset.layerIndex, 10);
            const shapeIndex = parseInt(target.dataset.shapeIndex, 10);
            createRenameInput(target, (newName) => {
                if (layers[layerIndex].shapes[shapeIndex].name !== newName && newName) {
                    layers[layerIndex].shapes[shapeIndex].name = newName;
                    updateLayerListUI();
                    saveState('Rename Shape');
                }
            });
        } else if (target.closest('.layer-item')) {
            // Toggle the <details> element on dblclick of the summary
            const details = target.closest('details');
            if (details) {
                details.open = !details.open;
            }
        }
    });

    // --- Drag and Drop Reordering ---
    let draggedItemData = null;

    layerList.addEventListener('dragstart', (e) => {
        const target = e.target;
        if (target.classList.contains('shape-item')) {
            draggedItemData = {
                type: 'shape',
                id: target.dataset.shapeId
            };
        } else if (target.classList.contains('layer-item')) {
            draggedItemData = {
                type: 'layer',
                index: parseInt(target.dataset.index, 10)
            };
        } else {
            return;
        }
        setTimeout(() => { target.classList.add('dragging'); }, 0);
    });

    layerList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('shape-item') || e.target.classList.contains('layer-item')) {
            e.target.classList.remove('dragging');
        }
        draggedItemData = null;
        removeDropIndicator();
    });

    layerList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedItemData) return;

        let container, selector;

        if (draggedItemData.type === 'shape') {
            const detailsEl = e.target.closest('details');
            if (!detailsEl) return;
            container = detailsEl.querySelector('.shape-list');
            selector = '.shape-item';
        } else if (draggedItemData.type === 'layer') {
            container = e.target.closest('#layer-list');
            selector = '.layer-item';
        } else {
            return;
        }
        
        if (container) {
            const afterElement = getDragAfterElement(container, selector, e.clientY);
            removeDropIndicator();
            const indicator = document.createElement('div');
            indicator.classList.add('drop-indicator');
            if (afterElement) {
                container.insertBefore(indicator, afterElement);
            } else {
                container.appendChild(indicator);
            }
        }
    });

    layerList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedItemData) return;

        if (draggedItemData.type === 'shape') {
            const detailsEl = e.target.closest('details');
            if (!detailsEl) return;
            const shapeList = detailsEl.querySelector('.shape-list');
            if (!shapeList) return;

            // Find source layer and shape
            let sourceLayer, draggedShape, sourceShapeIndex;
            for (const layer of layers) {
                sourceShapeIndex = layer.shapes.findIndex(s => s.id == draggedItemData.id);
                if (sourceShapeIndex > -1) {
                    sourceLayer = layer;
                    draggedShape = layer.shapes[sourceShapeIndex];
                    break;
                }
            }

            if (!sourceLayer) return;

            // Find target layer
            const targetLayerIndex = parseInt(shapeList.closest('details').querySelector('.layer-item').dataset.index, 10);
            const targetLayer = layers[targetLayerIndex];

            // Remove from source
            sourceLayer.shapes.splice(sourceShapeIndex, 1);

            // Find drop position and add to target
            const afterElement = getDragAfterElement(shapeList, '.shape-item', e.clientY);
            if (afterElement == null) {
                // Dropped at the end of the UI list (bottom) -> becomes oldest (start of array)
                targetLayer.shapes.unshift(draggedShape);
            } else {
                const afterShapeId = afterElement.dataset.shapeId;
                const dropIndex = targetLayer.shapes.findIndex(s => s.id == afterShapeId);
                targetLayer.shapes.splice(dropIndex, 0, draggedShape);
            }
            saveState('Move Shape');

        } else if (draggedItemData.type === 'layer') {
            const [draggedLayer] = layers.splice(draggedItemData.index, 1);
            const afterElement = getDragAfterElement(layerList, '.layer-item', e.clientY);
            if (afterElement == null) {
                layers.push(draggedLayer);
            } else {
                const dropIndex = parseInt(afterElement.dataset.index, 10);
                // Adjust index due to splice
                const adjustedDropIndex = layers.findIndex((l, index) => index === dropIndex);
                layers.splice(adjustedDropIndex, 0, draggedLayer);
            }
            saveState('Reorder Layer');
        }

        updateLayerListUI();
        render();
    });

    function getDragAfterElement(container, selector, y) {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function removeDropIndicator() {
        const indicator = layerList.querySelector('.drop-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function updateHistoryUI() {
        historyList.innerHTML = '';
        history.forEach((state, index) => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (index === historyIndex) {
                historyItem.classList.add('active');
            }
            historyItem.textContent = state.name || `State ${index}`;
            historyItem.dataset.index = index;
            historyList.appendChild(historyItem);
        });
        // Scroll to the active item
        const activeItem = historyList.querySelector('.history-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }

    historyList.addEventListener('click', (e) => {
        if (e.target.classList.contains('history-item')) {
            const index = parseInt(e.target.dataset.index, 10);
            if (index !== historyIndex) {
                historyIndex = index;
                restoreState(history[historyIndex]);
                updateHistoryUI();
            }
        }
    });

    zoomSlider.addEventListener('input', applyZoom);
    resetZoomBtn.addEventListener('click', resetZoom);

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
            e.preventDefault();
            redo();
        } else if (e.key === ' ' && !isSpacebarDown) {
            isSpacebarDown = true;
            if (!isDrawing && !isMoving && !isResizing) {
                 canvas.style.cursor = 'grab';
            }
        }

        if (['Delete', 'Backspace'].includes(e.key) && selectedShapes.length > 0) {
            const activeLayer = layers[activeLayerIndex];
            if (activeLayer) {
                activeLayer.shapes = activeLayer.shapes.filter(shape => !selectedShapes.includes(shape));
                selectedShapes = [];
                selectionRect = null;
                updateLayerListUI();
                render();
                saveState('Delete Shape');
            }
        }

        if (e.key === 'Escape') {
            if (isDrawing || isErasing || isSelecting || isCropping || isResizing || isMoving) {
                isDrawing = isErasing = isSelecting = isCropping = isResizing = isMoving = false;
                startPos = endPos = moveStartPos = resizeHandle = null;
                render();
            } else if (selectedShapes.length > 0) {
                selectedShapes = [];
                selectionRect = null;
                render();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            isSpacebarDown = false;
            if (!isPanning) {
                 setCurrentTool(currentTool); // Reset cursor
            }
        }
    });

    // --- Initial Setup ---
    createArtboard();
    setCurrentTool('rectangle');
});
