let lastSubtitle = { text: '', startTime: 0 };
let isNetflix = window.location.hostname.includes('netflix.com');
let isYouTube = window.location.hostname.includes('youtube.com');
let isRequestInProgress = false; // 新增变量，标记是否有请求正在进行中
let lastCopiedTime = null; // 新增变量，记录上次ctrl+c指令的时间

// Create and add notification element styles
function addNotificationStyle() {
    if (!document.head) return; // Ensure document.head exists
    
    const style = document.createElement('style');
    style.textContent = `
        .netflix-subtitle-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FFFFFF;
            color: #000000;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 9999;
            font-size: 14px;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .netflix-subtitle-notification.show {
            opacity: 1;
            transform: translateY(0);
        }
        .netflix-subtitle-notification .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid #ccc;
            border-top-color: transparent;
            border-radius: 50%;
            display: none;
            animation: spin 1s linear infinite;
        }
        .netflix-subtitle-notification.loading .spinner {
            display: inline-block;
        }
        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
    `;
    document.head.appendChild(style);
}

// Wait for DOM to load before adding styles
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addNotificationStyle);
} else {
    addNotificationStyle();
}

function showNotification(message, isLoading = false) {
    if (!document.body) return; // Ensure document.body exists
    
    const notification = document.createElement('div');
    notification.className = 'netflix-subtitle-notification';
    
    if (isLoading) {
        notification.classList.add('loading');
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        notification.appendChild(spinner);
    }
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    notification.appendChild(messageSpan);
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove notification after 3 seconds if not loading
    if (!isLoading) {
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

function hideNotification() {
    const notification = document.querySelector('.netflix-subtitle-notification');
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }
}

function checkSubtitle() {
    const subtitleSpans = document.querySelectorAll('.player-timedtext-text-container span');
    const currentTime = document.querySelector('video')?.currentTime;

    // Concatenate all subtitle text
    const currentText = Array.from(subtitleSpans)?.[0]?.innerText?.trim();

    // If subtitle changes, update lastSubtitle
    if (currentText && currentText !== lastSubtitle.text) {
        lastSubtitle = { text: currentText, startTime: currentTime };
        console.log('Updated subtitle:', lastSubtitle);
    }
}

// Check subtitles every 500ms for Netflix
if (isNetflix) {
    setInterval(checkSubtitle, 500);
}

async function extractSubtitlesFromImage(imageBlob) {
    // 获取API Key
    const { openaiApiKey } = await chrome.storage.sync.get(['openaiApiKey']);
    
    if (!openaiApiKey) {
        showNotification('No API Key found');
        throw new Error('No API Key found');
    }

    const base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(imageBlob);
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Please only recognize and output the Japanese subtitle text at the bottom of the image, do not output any other content. If no subtitles are found, please return an empty string."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 100
        })
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

async function captureYoutubeSubtitle() {
    if (isRequestInProgress) {
        showNotification('A request is already in progress');
        return;
    }

    const video = document.querySelector('.video-stream');
    if (!video) {
        showNotification('Video element not found');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
            try {
                isRequestInProgress = true; // 标记请求开始
                showNotification('Reading current subtitles...', true);
                const subtitleText = await extractSubtitlesFromImage(blob);
                if (subtitleText) {
                    const currentTime = video.currentTime - 2;
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set('t', Math.floor(currentTime));
                    
                    const subtitleData = {
                        url: currentUrl.toString(),
                        text: subtitleText
                    };

                    await navigator.clipboard.writeText(JSON.stringify(subtitleData));
                    showNotification('Subtitle data copied to clipboard');
                    lastCopiedTime = currentTime; // 记录上次复制的时间
                } else {
                    showNotification('Failed to recognize subtitles');
                }
            } catch (err) {
                console.error('Processing failed:', err);
                showNotification('Processing failed');
            } finally {
                isRequestInProgress = false; // 标记请求结束
                hideNotification(); // 隐藏通知
            }
        });
    } catch (err) {
        console.error('Screenshot failed:', err);
        showNotification('Screenshot failed');
        hideNotification(); // 隐藏通知
    }
}

// Listen for copy shortcut
window.addEventListener('keydown', async (e) => {
    const isCopyShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c';
    if (!isCopyShortcut) return;

    e.preventDefault();

    if (isNetflix) {
        if (!lastSubtitle.text) {
            showNotification('No subtitle available to copy');
            console.log('No subtitles to copy.');
            return;
        }

        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('t', Math.floor(lastSubtitle.startTime));
        
        const subtitleData = {
            url: currentUrl.toString(),
            text: lastSubtitle.text
        };

        navigator.clipboard.writeText(JSON.stringify(subtitleData))
            .then(() => {
                showNotification('Subtitle copied successfully!');
                console.log('Copied Netflix subtitles:', subtitleData);
                lastCopiedTime = lastSubtitle.startTime; // 记录上次复制的时间
            })
            .catch(err => {
                showNotification('Failed to copy subtitle');
                console.error('Failed to copy subtitles:', err);
            });
    } else if (isYouTube) {
        // YouTube处理
        await captureYoutubeSubtitle();
    }
}, true);

// Listen for left and right arrow keys on YouTube
window.addEventListener('keydown', (e) => {
    if (isYouTube) {
        const video = document.querySelector('.video-stream');
        if (video) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                video.currentTime -= 1;
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                video.currentTime += 1;
            }
        }
    }
}, true);

// Listen for ctrl+r to adjust video time
window.addEventListener('keydown', (e) => {
    const isAdjustTimeShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r';
    if (!isAdjustTimeShortcut) return;

    e.preventDefault();

    const video = document.querySelector('video');
    if (video) {
        console.log('lastCopiedTime:', lastCopiedTime);
        if (lastCopiedTime !== null) {
            video.currentTime = lastCopiedTime;
            showNotification('Video time adjusted to last copied time: ' + lastCopiedTime + ' seconds');
        } else {
            const currentUrl = new URL(window.location.href);
            const timeParam = currentUrl.searchParams.get('t');
            if (timeParam) {
                video.currentTime = parseFloat(timeParam);
                showNotification('Video time adjusted to ' + timeParam + ' seconds');
            } else {
                showNotification('No time parameter found in URL');
            }
        }
    } else {
        showNotification('Video element not found');
    }
}, true);

// TODO, 宣传图片，图标设计