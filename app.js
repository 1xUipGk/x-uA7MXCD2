document.addEventListener('DOMContentLoaded', () => {
    const inputVideo = document.getElementById('input-video');
    const outputVideo = document.getElementById('output-video');
    const watermarkSelect = document.getElementById('watermark-select');
    const processBtn = document.getElementById('process-btn');
    const progressBar = document.getElementById('progress-bar');
    const preview = document.getElementById('preview');

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
            a.download = outputVideo.value || 'processed_video.webm';
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
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');

                const watermark = new Image();
                watermark.src = watermarkPath;
                watermark.onload = () => {
                    const stream = canvas.captureStream();
                    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

                    const chunks = [];
                    recorder.ondataavailable = e => chunks.push(e.data);
                    recorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'video/webm' });
                        resolve(blob);
                    };

                    video.onended = () => recorder.stop();
                    recorder.start();

                    let frameCount = 0;
                    const totalFrames = video.duration * 30; // تقدير 30 إطار في الثانية

                    function drawFrame() {
                        if (video.paused || video.ended) return;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        // إضافة العلامة المائية
                        const watermarkSize = Math.min(canvas.width, canvas.height) * 0.2;
                        ctx.drawImage(watermark, canvas.width - watermarkSize - 10, canvas.height - watermarkSize - 10, watermarkSize, watermarkSize);
                        
                        frameCount++;
                        progressCallback(Math.min((frameCount / totalFrames) * 100, 100));
                        requestAnimationFrame(drawFrame);
                    }

                    video.play();
                    drawFrame();
                };
            };
        });
    }
});