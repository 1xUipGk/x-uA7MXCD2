document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        inputVideo: document.getElementById('input-video'),
        watermarkSelect: document.getElementById('watermark-select'),
        textBox: document.getElementById('textBox'),
        processBtn: document.getElementById('process-btn'),
        progressBar: document.getElementById('progress-bar'),
        preview: document.getElementById('preview'),
        downloadBtn: document.getElementById('download-btn')
    };

    const backgroundImage = 'reels_background.jpg';

    // التحقق من وجود جميع العناصر المطلوبة
    const missingElements = Object.entries(elements)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingElements.length > 0) {
        console.error('العناصر التالية مفقودة:', missingElements.join(', '));
        return;
    }

    // تحميل الخط المخصص
    loadCustomFont('LamaRounded', 'LamaRounded-SemiBold.ttf');

    elements.processBtn.addEventListener('click', handleProcessClick);

    async function handleProcessClick() {
        if (!elements.inputVideo.files.length) {
            alert('الرجاء اختيار فيديو أولاً');
            return;
        }

        const file = elements.inputVideo.files[0];
        const watermark = elements.watermarkSelect.value;
        const whiteText = elements.textBox.value;

        setUIState('processing');

        try {
            const processedVideoBlob = await processVideo(file, watermark, whiteText, updateProgress);
            displayProcessedVideo(processedVideoBlob);
        } catch (error) {
            console.error('خطأ في معالجة الفيديو:', error);
            alert('حدث خطأ أثناء معالجة الفيديو');
        } finally {
            setUIState('ready');
        }
    }

    function setUIState(state) {
        elements.processBtn.disabled = state === 'processing';
        elements.progressBar.value = 0;
        elements.preview.style.display = state === 'ready' ? 'block' : 'none';
        elements.downloadBtn.style.display = state === 'ready' ? 'block' : 'none';
    }

    function updateProgress(progress) {
        elements.progressBar.value = progress;
    }

    function displayProcessedVideo(videoBlob) {
        const videoUrl = URL.createObjectURL(videoBlob);
        elements.preview.src = videoUrl;
        elements.preview.style.display = 'block';

        elements.downloadBtn.style.display = 'block';
        elements.downloadBtn.onclick = () => downloadVideo(videoUrl);
    }

    function downloadVideo(videoUrl) {
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = 'processed_video.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function processVideo(videoFile, watermarkPath, whiteText, progressCallback) {
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
                            drawTexts(ctx, whiteText, canvas.width, y_offset, newHeight);

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
    
    function drawTexts(ctx, whiteText, greenText, canvasWidth, y_offset, videoHeight) {
        const padding_x = 20;
        const text_box_width = canvasWidth - (padding_x * 2);
        const lineHeight = 63.6;
        const textPadding = 25; // مسافة إضافية فوق الفيديو

        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        const whiteTextY = y_offset - textPadding - lineHeight; 
        
        // رسم النص الأبيض
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '35px LamaRounded';
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

    function loadCustomFont(fontName, fontUrl) {
        const font = new FontFace(fontName, `url(${fontUrl})`);
        font.load().then(loadedFont => {
            document.fonts.add(loadedFont);
        }).catch(error => {
            console.error('فشل في تحميل الخط:', error);
        });
    }
});
