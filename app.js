document.addEventListener('DOMContentLoaded', () => {
    const inputVideo = document.getElementById('input-video');
    const watermarkSelect = document.getElementById('watermark-select');
    const processBtn = document.getElementById('process-btn');
    const progressBar = document.getElementById('progress-bar');
    const preview = document.getElementById('preview');
    const backgroundImage = 'reels_background.jpg';

    let isProcessing = false;

    processBtn.addEventListener('click', async () => {
        if (isProcessing) return;
        if (!inputVideo.files.length) {
            alert('الرجاء اختيار فيديو أولاً');
            return;
        }

        const file = inputVideo.files[0];
        const watermark = watermarkSelect.value;

        processBtn.disabled = true;
        progressBar.value = 0;
        isProcessing = true;

        try {
            const processedVideoBlob = await processVideo(file, watermark, (progress) => {
                progressBar.value = progress;
            });

            const videoUrl = URL.createObjectURL(processedVideoBlob);
            preview.src = videoUrl;
            preview.style.display = 'block';

            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = 'processed_video.webm';
            a.click();
        } catch (error) {
            console.error('Error processing video:', error);
            alert('حدث خطأ أثناء معالجة الفيديو');
        } finally {
            processBtn.disabled = false;
            isProcessing = false;
        }
    });

    async function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async function processVideo(videoFile, watermarkPath, progressCallback) {
        return new Promise(async (resolve, reject) => {
            try {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(videoFile);
                await new Promise(resolve => video.onloadedmetadata = resolve);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 1080;
                canvas.height = 1920;

                const background = await loadImage(backgroundImage);
                const watermark = await loadImage(watermarkPath);

                const stream = canvas.captureStream();
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

                const chunks = [];
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    resolve(blob);
                };

                video.onended = () => recorder.stop();
                recorder.start();

                const fps = video.videoWidth > 720 ? 30 : 60; // Adjust FPS based on video resolution
                const frameDuration = 1000 / fps;
                const totalFrames = Math.ceil(video.duration * fps);
                let currentFrame = 0;

                async function processFrame() {
                    if (currentFrame >= totalFrames) {
                        video.pause();
                        recorder.stop();
                        return;
                    }

                    video.currentTime = currentFrame / fps;
                    await new Promise(resolve => {
                        video.onseeked = () => {
                            drawFrame();
                            resolve();
                        };
                    });

                    currentFrame++;
                    progressCallback((currentFrame / totalFrames) * 100);

                    // Throttle frame processing to reduce load on the device
                    setTimeout(processFrame, frameDuration * 2); // Process at half the original speed
                }

                function drawFrame() {
                    ctx.drawImage(background, 0, 0, 1080, 1920);

                    const maxWidth = 900;
                    const maxHeight = 1380;
                    let newWidth = video.videoWidth;
                    let newHeight = video.videoHeight;

                    if (newWidth > maxWidth || newHeight > maxHeight) {
                        const widthRatio = maxWidth / newWidth;
                        const heightRatio = maxHeight / newHeight;
                        const ratio = Math.min(widthRatio, heightRatio);
                        newWidth = Math.floor(newWidth * ratio);
                        newHeight = Math.floor(newHeight * ratio);
                    }

                    const x_offset = Math.floor((1080 - newWidth) / 2);
                    const y_offset = Math.floor((1920 - newHeight) / 2);

                    const videoCanvas = document.createElement('canvas');
                    videoCanvas.width = newWidth;
                    videoCanvas.height = newHeight;
                    const videoCtx = videoCanvas.getContext('2d');

                    videoCtx.drawImage(video, 0, 0, newWidth, newHeight);
                    videoCtx.globalCompositeOperation = 'destination-in';
                    roundRect(videoCtx, 0, 0, newWidth, newHeight, 42);

                    ctx.drawImage(videoCanvas, x_offset, y_offset);

                    const watermarkWidth = 102;
                    const watermarkHeight = 50;
                    const watermarkX = x_offset + (newWidth - watermarkWidth) / 2;
                    const watermarkY = y_offset + newHeight - watermarkHeight - 50;
                    ctx.drawImage(watermark, watermarkX, watermarkY, watermarkWidth, watermarkHeight);
                }

                processFrame();
            } catch (error) {
                reject(error);
            }
        });
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
});
