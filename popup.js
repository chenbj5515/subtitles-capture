document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');

    // Load saved API key
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }
    });

    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '10000';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.fontSize = '14px';
        toast.style.color = 'white';
        toast.style.backgroundColor = type === 'success' ? 'black' : 'white';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';

        document.body.appendChild(toast);

        // Show and auto-hide
        setTimeout(() => {
            toast.style.opacity = '1';
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }, 10);
    }

    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showToast('Please enter a valid API key', 'error');
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            showToast('Please enter a valid OpenAI API key', 'error');
            return;
        }

        chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
            showToast('Settings saved successfully', 'success');
        });
    });
});