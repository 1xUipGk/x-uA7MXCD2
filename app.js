document.addEventListener('DOMContentLoaded', () => {
    const inputVideo = document.getElementById('input-video');
    const outputVideo = document.getElementById('output-video');
    const watermarkSelect = document.getElementById('watermark-select');
    const processBtn = document.getElementById('process-btn');
    const progressBar = document.getElementById('progress-bar');
    const preview = document.getElementById('preview');
    const backgroundImage = 'reels_background.jpg'; // صورة الخلفية

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

            // تحميل الفيديو المعالج
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = outputVideo.value || 'processed_video.mp4'; // تغيير الصيغة إلى mp4
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
                canvas.width = 1080; // عرض الفيديو النهائي
                canvas.height = 1920; // ارتفاع الفيديو النهائي
                const ctx = canvas.getContext('2d');

                const watermark = new Image();
                watermark.src = watermarkPath;
                watermark.onload = () => {
                    const background = new Image();
                    background.src = backgroundImage;
                    background.onload = () => {
                        const stream = canvas.captureStream();
                        const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' }); // تغيير MIME type إلى mp4

                        const chunks = [];
                        recorder.ondataavailable = e => chunks.push(e.data);
                        recorder.onstop = () => {
                            const blob = new Blob(chunks, { type: 'video/mp4' });
                            resolve(blob);
                        };

                        video.onended = () => recorder.stop();
                        recorder.start();

                        let frameCount = 0;
                        const fps = 30; // تقدير 30 إطار في الثانية
                        const totalFrames = video.duration * fps;

                        function drawFrame() {
                            if (video.paused || video.ended) return;

                            // تحديد حجم الفيديو الجديد بناءً على الأبعاد القصوى
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

                            canvas.width = newWidth;
                            canvas.height = newHeight;
                            ctx.drawImage(video, 0, 0, newWidth, newHeight);

                            // تطبيق قناع مستطيل بزوايا دائرية
                            const borderRadius = 42;
                            const mask = createRoundedRectangleMask(newWidth, newHeight, borderRadius);
                            ctx.globalCompositeOperation = 'destination-in';
                            ctx.drawImage(mask, 0, 0);

                            // إضافة الخلفية
                            ctx.globalCompositeOperation = 'source-over';
                            ctx.drawImage(background, 0, 0, 1080, 1920);

                            // إضافة العلامة المائية
                            const watermarkSize = Math.min(newWidth, newHeight) * 0.2;
                            const watermarkX = newWidth - watermarkSize - 10;
                            const watermarkY = newHeight - watermarkSize - 10;
                            ctx.drawImage(watermark, watermarkX, watermarkY, watermarkSize, watermarkSize);

                            frameCount++;
                            progressCallback(Math.min((frameCount / totalFrames) * 100, 100));
                            requestAnimationFrame(drawFrame);
                        }

                        video.play();
                        drawFrame();
                    };
                };
            };
        });
    }

    function createRoundedRectangleMask(width, height, radius) {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.fillStyle = 'black';
        maskCtx.beginPath();
        maskCtx.moveTo(radius, 0);
        maskCtx.lineTo(width - radius, 0);
        maskCtx.arc(width - radius, radius, radius, -Math.PI / 2, 0);
        maskCtx.lineTo(width, height - radius);
        maskCtx.arc(width - radius, height - radius, radius, 0, Math.PI / 2);
        maskCtx.lineTo(radius, height);
        maskCtx.arc(radius, height - radius, radius, Math.PI / 2, Math.PI);
        maskCtx.lineTo(0, radius);
        maskCtx.arc(radius, radius, radius, Math.PI, -Math.PI / 2);
        maskCtx.closePath();
        maskCtx.fill();
        return maskCanvas;
    }
});
