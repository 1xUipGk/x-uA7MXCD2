document.addEventListener('DOMContentLoaded', () => {
    const inputVideo = document.getElementById('input-video');
    const watermarkSelect = document.getElementById('watermark-select');
    const processBtn = document.getElementById('process-btn');
    const progressBar = document.getElementById('progress-bar');
    const preview = document.getElementById('preview');
    const downloadBtn = document.getElementById('download-btn');
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
        preview.style.display = 'none';
        downloadBtn.style.display = 'none';

        try {
            const processedVideoBlob = await processVideo(file, watermark, (progress) => {
                progressBar.value = progress;
            });

            const videoUrl = URL.createObjectURL(processedVideoBlob);
            preview.src = videoUrl;
            preview.style.display = 'block';

            downloadBtn.style.display = 'block';
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = 'processed_video.webm';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
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
                canvas.width = 720;
                canvas.height = 1280;

                const background = new Image();
                background.src = backgroundImage;
                background.onload = () => {
                    const watermark = new Image();
                    watermark.src = watermarkPath;
                    watermark.onload = () => {
                        const stream = canvas.captureStream(30); // 30 FPS for better quality
                        const audioContext = new AudioContext();
                        const audioSource = audioContext.createMediaElementSource(video);
                        const audioDestination = audioContext.createMediaStreamDestination();
                        audioSource.connect(audioDestination);

                        const combinedStream = new MediaStream([
                            ...stream.getVideoTracks(),
                            ...audioDestination.stream.getAudioTracks()
                        ]);

                        const recorder = new MediaRecorder(combinedStream, { 
                            mimeType: 'video/webm; codecs=vp9,opus',
                            videoBitsPerSecond: 2500000 // 2.5 Mbps for better quality
                        });

                        const chunks = [];
                        recorder.ondataavailable = e => chunks.push(e.data);
                        recorder.onstop = () => {
                            const blob = new Blob(chunks, { type: 'video/webm' });
                            resolve(blob);
                        };

                        video.onended = () => recorder.stop();
                        recorder.start();

                        let frameCount = 0;
                        const totalFrames = video.duration * 30; // 30 FPS

                        video.play();
                        
                        function drawFrame() {
                            if (video.paused || video.ended) return;

                            // Draw background
                            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                            // Calculate video dimensions
                            const maxWidth = 600;
                            const maxHeight = 920;
                            let newWidth = video.videoWidth;
                            let newHeight = video.videoHeight;

                            if (newWidth > maxWidth || newHeight > maxHeight) {
                                const ratio = Math.min(maxWidth / newWidth, maxHeight / newHeight);
                                newWidth = Math.floor(newWidth * ratio);
                                newHeight = Math.floor(newHeight * ratio);
                            }

                            const x_offset = Math.floor((canvas.width - newWidth) / 2);
                            const y_offset = Math.floor((canvas.height - newHeight) / 2);

                            // Draw video frame
                            ctx.save();
                            ctx.beginPath();
                            roundRect(ctx, x_offset, y_offset, newWidth, newHeight, 21);
                            ctx.clip();
                            ctx.drawImage(video, x_offset, y_offset, newWidth, newHeight);
                            ctx.restore();

                            // Draw watermark
                            const watermarkWidth = 68;
                            const watermarkHeight = 33;
                            const watermarkX = x_offset + (newWidth - watermarkWidth) / 2;
                            const watermarkY = y_offset + newHeight - watermarkHeight - 50;
                            ctx.drawImage(watermark, watermarkX, watermarkY, watermarkWidth, watermarkHeight);

                            frameCount++;
                            progressCallback(Math.min((frameCount / totalFrames) * 100, 100));

                            requestAnimationFrame(drawFrame);
                        }

                        requestAnimationFrame(drawFrame);
                    };
                };
            };
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
    }
});
