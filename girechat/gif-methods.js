
    async showGifs(query = '') {
    const grid = document.getElementById('emoji-grid');
    grid.innerHTML = '<div style="padding: 20px; text-align: center; color: #8696a0;">Loading GIFs...</div>';

    const GIPHY_API_KEY = 'Lx9DONbmTU25A5sGeHc40KOHO5cqPwDR';
    const limit = 30;

    try {
        let url;
        if (query && query.trim() !== '') {
            url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g`;
        } else {
            url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`;
        }

        const response = await fetch(url);
        const data = await response.json();

        grid.innerHTML = '';

        if (data.data && data.data.length > 0) {
            data.data.forEach(gif => {
                const gifBtn = document.createElement('button');
                gifBtn.className = 'gif-item';
                gifBtn.style.cssText = 'border: none; background: none; padding: 2px; cursor: pointer; border-radius: 4px; overflow: hidden;';

                const img = document.createElement('img');
                img.src = gif.images.fixed_height_small.url;
                img.alt = gif.title;
                img.style.cssText = 'width: 100%; height: auto; display: block; border-radius: 4px;';

                gifBtn.appendChild(img);
                gifBtn.onclick = () => this.insertGif(gif.images.fixed_height.url);

                grid.appendChild(gifBtn);
            });

            grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            grid.style.gap = '8px';
        } else {
            grid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.6;">No GIFs found</div>';
        }

        const searchInput = document.getElementById('emoji-search');
        if (searchInput) {
            searchInput.placeholder = 'Search GIFs...';
            searchInput.oninput = (e) => this.showGifs(e.target.value);
        }

    } catch (error) {
        console.error('Error loading GIFs:', error);
        grid.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Failed to load GIFs</div>';
    }
}

insertGif(gifUrl) {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        const gifText = `[GIF: ${gifUrl}]`;
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;

        messageInput.value = text.substring(0, start) + gifText + text.substring(end);

        const newPos = start + gifText.length;
        messageInput.setSelectionRange(newPos, newPos);
        messageInput.focus();
    }
    this.close();
}
