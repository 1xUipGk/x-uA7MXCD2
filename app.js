document.addEventListener('DOMContentLoaded', () => {
    const inputVideo = document.getElementById('input-video');
    const outputVideo = document.getElementById('output-video');
    const watermarkSelect = document.getElementById('watermark-select');
    const processBtn = document.getElementById('process-btn');
    const progressBar = document.getElementById('progress-bar');
    const preview = document.getElementById('preview');
    const backgroundImage = 'reels_background.jpg';

    processBtn.addEventListener('click', async () => {
        if (!inputVideo.files.length) {
            alert('الرجاء اختيار فيديو أولاً');
            return;
        }

        const file = inputVideo.files[0];
        const watermark = watermarkSelect.value;

        processBtn.disabled = true;
        progressBar.value = 0;

        try {
            const processedVideoBlob = await processVideo(file, watermark, (progress) => {
                progressBar.value = progress;
            });

            const videoUrl = URL.createObjectURL(processedVideoBlob);
            preview.src = videoUrl;
            preview.style.display = 'block';

            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = outputVideo.value || 'processed_video.mp4';
            a.click();
        } catch (error) {
            console.error('Error processing video:', error);
            alert('حدث خطأ أثناء معالجة الفيديو');
        } finally {
            processBtn.disabled = false;
        }
    });

  async function processVideo(videoFile, watermarkPath, progressCallback) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1080;
            canvas.height = 1920;

            const background = new Image();
            background.src = backgroundImage; // هذا هو reels_background.jpg
            background.onload = () => {
                const watermark = new Image();
                watermark.src = watermarkPath;
                watermark.onload = () => {
                    const stream = canvas.captureStream();
                    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });

                    const chunks = [];
                    recorder.ondataavailable = e => chunks.push(e.data);
                    recorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'video/mp4' });
                        resolve(blob);
                    };

                    video.onended = () => recorder.stop();
                    recorder.start();

                    let frameCount = 0;
                    const fps = 30;
                    video.play();
                    video.addEventListener('play', function () {
                        function drawFrame() {
                            if (video.paused || video.ended) return;

                            // رسم صورة الخلفية كخلفية للكانفا
                            ctx.drawImage(background, 0, 0, 1080, 1920);

                            const maxWidth = 900;
                            const maxHeight = 1380;
                            let newWidth = video.videoWidth;
                            let newHeight = video.videoHeight;

                            if (newWidth > maxWidth || newHeight > maxHeight) {
                                const widthRatio = maxWidth / newWidth;
                                const heightRatio = maxHeight / newHeight;
                                const ratio = Math.min(widthRatio, heightRatio);
                                newWidth = newWidth * ratio;
                                newHeight = newHeight * ratio;
                            }

                            const xOffset = (1080 - newWidth) / 2;
                            const yOffset = (1920 - newHeight) / 2;

                            // إنشاء كانفا مؤقت للفيديو مع الزوايا المستديرة
                            const videoCanvas = document.createElement('canvas');
                            videoCanvas.width = newWidth;
                            videoCanvas.height = newHeight;
                            const videoCtx = videoCanvas.getContext('2d');

                            // رسم الفيديو على الكانفا المؤقت
                            videoCtx.drawImage(video, 0, 0, newWidth, newHeight);

                            // تطبيق القناع ذو الزوايا المستديرة
                            const borderRadius = 42;
                            videoCtx.globalCompositeOperation = 'destination-in';
                            roundRect(videoCtx, 0, 0, newWidth, newHeight, borderRadius);

                            // رسم الفيديو مع الزوايا المستديرة على الكانفا الرئيسي
                            ctx.drawImage(videoCanvas, xOffset, yOffset);

                            // إضافة العلامة المائية
                            const watermarkWidth = 102;
                            const watermarkHeight = 50;
                            const watermarkX = xOffset + (newWidth - watermarkWidth) / 2;
                            const watermarkY = yOffset + newHeight - watermarkHeight - 50;
                            ctx.drawImage(watermark, watermarkX, watermarkY, watermarkWidth, watermarkHeight);

                            frameCount++;
                            progressCallback(Math.min((frameCount / (video.duration * fps)) * 100, 100));
                            requestAnimationFrame(drawFrame);
                        }

                        drawFrame();
                    });
                };
            };
        };
    });
}

// دالة مساعدة لرسم مستطيل بزوايا مستديرة
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
