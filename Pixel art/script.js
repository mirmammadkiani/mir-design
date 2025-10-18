const fileInput = document.getElementById('fileInput');
const pixelSizeSlider = document.getElementById('pixelSize');
const colorCountSlider = document.getElementById('colorCount');
const scaleInput = document.getElementById('scale');
const pixelSizeValue = document.getElementById('pixelSizeValue');
const colorCountValue = document.getElementById('colorCountValue');
const originalCanvas = document.getElementById('originalCanvas');
const pixelatedCanvas = document.getElementById('pixelatedCanvas');
const downloadBtn = document.getElementById('downloadBtn');

const originalCtx = originalCanvas.getContext('2d');
const pixelatedCtx = pixelatedCanvas.getContext('2d');

let originalImage = null;

// Update slider value display
pixelSizeSlider.addEventListener('input', (e) => {
    pixelSizeValue.textContent = e.target.value;
    if (originalImage) {
        pixelateImage();
    }
});

colorCountSlider.addEventListener('input', (e) => {
    colorCountValue.textContent = e.target.value;
    if (originalImage) {
        pixelateImage();
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            drawImageOnCanvas(originalImage, originalCanvas, originalCtx);
            pixelateImage();
            downloadBtn.disabled = false;
        };
        originalImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

downloadBtn.addEventListener('click', () => {
    const scale = parseInt(scaleInput.value, 10) || 1;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    tempCanvas.width = pixelatedCanvas.width * scale;
    tempCanvas.height = pixelatedCanvas.height * scale;

    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(pixelatedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'pixel-art.png';
    link.click();
});

function drawImageOnCanvas(image, canvas, ctx) {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function pixelateImage() {
    if (!originalImage) return;

    const pixelSize = parseInt(pixelSizeSlider.value, 10);
    const colorCount = parseInt(colorCountSlider.value, 10);

    // 1. Downsample to create pixel effect
    const smallWidth = originalCanvas.width / pixelSize;
    const smallHeight = originalCanvas.height / pixelSize;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = smallWidth;
    tempCanvas.height = smallHeight;

    tempCtx.drawImage(originalCanvas, 0, 0, smallWidth, smallHeight);
    
    // 2. Apply color quantization
    const imageData = tempCtx.getImageData(0, 0, smallWidth, smallHeight);
    const data = imageData.data;
    const colorLevels = Math.ceil(Math.pow(colorCount, 1/3));
    const step = 256 / (colorLevels - 1);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / step) * step;     // Red
        data[i + 1] = Math.round(data[i + 1] / step) * step; // Green
        data[i + 2] = Math.round(data[i + 2] / step) * step; // Blue
    }
    tempCtx.putImageData(imageData, 0, 0);

    // 3. Scale up to final canvas with sharp pixels
    pixelatedCanvas.width = originalCanvas.width;
    pixelatedCanvas.height = originalCanvas.height;
    pixelatedCtx.imageSmoothingEnabled = false;
    pixelatedCtx.drawImage(tempCanvas, 0, 0, smallWidth, smallHeight, 0, 0, pixelatedCanvas.width, pixelatedCanvas.height);
}
