document.addEventListener('DOMContentLoaded', () => {
    const inputVideo = document.getElementById('input-video');
    const watermarkSelect = document.getElementById('watermark-select');
    const textBox = document.getElementById('textBox');
    const additionalTextBox = document.getElementById('additionalTextBox');
    const processBtn = document.getElementById('process-btn');
    const progressBar = document.getElementById('progress-bar');
    const preview = document.getElementById('preview');
    const downloadBtn = document.getElementById('download-btn');
    const backgroundImage = 'reels_background.jpg';

    // Load custom font
    const font = new FontFace('LamaRounded', 'url(LamaRounded-SemiBold.ttf)');
    font.load().then(font => {
        document.fonts.add(font);
    });

    processBtn.addEventListener('click', async () => {
        if (!inputVideo.files.length) {
            alert('الرجاء اختيار فيديو أولاً');
            return;
        }

        const file = inputVideo.files[0];
        const watermark = watermarkSelect.value;
        const whiteText = textBox.value;
        const greenText = additionalTextBox.value;

        processBtn.disabled = true;
        progressBar.value = 0;
        preview.style.display = 'none';
        downloadBtn.style.display = 'none';

        try {
            const processedVideoBlob = await processVideo(file, watermark, whiteText, greenText, (progress) => {
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

    async function processVideo(videoFile, watermarkPath, whiteText, greenText, progressCallback) {
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

                            // Draw texts
                            drawTexts(ctx, whiteText, greenText, canvas.width, y_offset);

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

    function drawTexts(ctx, whiteText, greenText, canvasWidth, y_offset) {
        const padding_x = 20;
        const text_box_width = canvasWidth - (padding_x * 2);
        const lineHeight = 63.6;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        // Draw green text
        ctx.fillStyle = '#6ef13e';
        ctx.font = '45px LamaRounded';
        const greenTextY = y_offset + 20;
        wrapText(ctx, greenText, canvasWidth - padding_x, greenTextY, text_box_width, lineHeight);

        // Draw white text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '45px LamaRounded';
        const whiteTextY = greenTextY + (lineHeight * 2); // Adjust this value as needed
        wrapText(ctx, whiteText, canvasWidth - padding_x, whiteTextY, text_box_width, lineHeight);
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
    }
});
