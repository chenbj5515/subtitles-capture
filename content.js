let lastSubtitle = { text: '', startTime: 0 };
let isNetflix = window.location.hostname.includes('netflix.com');

// Create and add notification element styles
function addNotificationStyle() {
    if (!document.head) return; // Ensure document.head exists
    
    const style = document.createElement('style');
    style.textContent = `
        .netflix-subtitle-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 9999;
            font-size: 14px;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        }
        .netflix-subtitle-notification.show {
            opacity: 1;
            transform: translateY(0);
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

function showNotification(message) {
    if (!document.body) return; // Ensure document.body exists
    
    const notification = document.createElement('div');
    notification.className = 'netflix-subtitle-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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

async function captureYoutubeSubtitle() {
    const video = document.querySelector('.video-stream');
    if (!video) {
        showNotification('找不到视频元素');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 设置canvas大小为视频的实际大小
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
        // 直接绘制视频帧到canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 将canvas转换为blob
        canvas.toBlob(async (blob) => {
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                showNotification('视频截图已复制到剪贴板');
            } catch (err) {
                console.error('复制到剪贴板失败:', err);
                showNotification('复制到剪贴板失败');
            }
        });

    } catch (err) {
        console.error('截图失败:', err);
        showNotification('截图失败');
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

        const subtitleData = {
            url: window.location.href.split('?')[0] + '?t=' + lastSubtitle.startTime,
            text: lastSubtitle.text
        };

        navigator.clipboard.writeText(JSON.stringify(subtitleData))
            .then(() => {
                showNotification('Subtitle copied successfully!');
                console.log('Copied Netflix subtitles:', subtitleData);
            })
            .catch(err => {
                showNotification('Failed to copy subtitle');
                console.error('Failed to copy subtitles:', err);
            });
    } else {
        // YouTube处理
        await captureYoutubeSubtitle();
    }
}, true);
