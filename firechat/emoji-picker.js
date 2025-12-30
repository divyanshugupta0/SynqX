/**
 * FireChat Emoji Picker - Reconstructed
 * Robust, Glassmorphic, and Fast.
 */

(function () {
    // 🛡️ Prevent duplicate execution
    if (window.FireChatEmojiPicker) {
        console.log('✅ Emoji Picker already loaded');
        return;
    }

    console.log('🚀 Initializing FireChat Emoji Picker...');

    class EmojiPicker {
        constructor() {
            this.apiKey = 'ee50ec1e16d1745c72b44160ea42605b037849ea';
            this.emojis = [];
            this.isOpen = false;
            this.pickerElement = null;
            this.backdropElement = null;

            // Pre-defined categories for instant UI rendering
            this.categoryIcons = {
                'smileys-emotion': '😊',
                'people-body': '👋',
                'animals-nature': '🐶',
                'food-drink': '🍕',
                'travel-places': '✈️',
                'activities': '⚽',
                'objects': '💡',
                'symbols': '❤️',
                'flags': '🏁'
            };

            this.categories = {};
            // Initialize empty categories
            Object.keys(this.categoryIcons).forEach(key => this.categories[key] = []);

            this.init();
        }

        async init() {
            // 1. Create the UI shell immediately
            this.createInterface();

            // 2. Load data in the background
            await this.loadEmojis();
        }

        createInterface() {
            // Remove existing if any (cleanup)
            const old = document.getElementById('emoji-picker');
            if (old) old.remove();

            // --- Backdrop (for closing) ---
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 1999; display: none; background: transparent;
            `;
            backdrop.onclick = () => this.close();
            document.body.appendChild(backdrop);
            this.backdropElement = backdrop;

            // --- Picker Container ---
            const picker = document.createElement('div');
            picker.id = 'emoji-picker';
            picker.className = 'emoji-picker';
            picker.style.display = 'none';

            // Mobile Close Button (Hidden on Desktop by CSS default, shown on mobile by mobile-ui.css)
            const closeBtn = document.createElement('button');
            closeBtn.className = 'emoji-mobile-close';
            closeBtn.style.display = 'none'; // Default hidden
            closeBtn.innerHTML = '<i class="material-icons" style="font-size: 18px;">close</i>';
            closeBtn.onclick = () => this.close();
            picker.appendChild(closeBtn);

            // ========== SUPER HEADER - Main Tabs ==========
            const superHeader = document.createElement('div');
            superHeader.className = 'emoji-super-header';
            superHeader.innerHTML = `
                <button class="super-tab active" data-tab="emojis">
                    <span class="tab-icon">😊</span>
                    <span class="tab-label">Emojis</span>
                </button>
                <button class="super-tab" data-tab="gif">
                    <span class="tab-icon">🎬</span>
                    <span class="tab-label">GIF</span>
                </button>
                <button class="super-tab" data-tab="stickers">
                    <span class="tab-icon">🎨</span>
                    <span class="tab-label">Stickers</span>
                </button>
            `;

            // Tab click handlers
            superHeader.querySelectorAll('.super-tab').forEach(tab => {
                tab.onclick = () => {
                    superHeader.querySelectorAll('.super-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    const tabName = tab.dataset.tab;
                    if (tabName === 'emojis') {
                        this.showEmojisSection();
                    } else if (tabName === 'gif') {
                        this.showGifs();
                    } else if (tabName === 'stickers') {
                        this.showStickers();
                    }
                };
            });

            // 1. Search Bar
            const searchContainer = document.createElement('div');
            searchContainer.className = 'emoji-search-container';
            searchContainer.id = 'emoji-search-container';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.id = 'emoji-search-input';
            searchInput.className = 'emoji-search-input';
            searchInput.placeholder = 'Search emojis...';
            searchInput.oninput = (e) => this.filterEmojis(e.target.value);
            searchContainer.appendChild(searchInput);

            // 2. Categories (Middle) - for emoji subcategories
            const header = document.createElement('div');
            header.className = 'emoji-picker-header';
            header.id = 'emoji-categories-header';

            Object.entries(this.categoryIcons).forEach(([slug, icon]) => {
                const btn = document.createElement('button');
                btn.className = 'emoji-category-btn';
                btn.textContent = icon;
                btn.dataset.category = slug;
                btn.onclick = () => this.showCategory(slug);
                header.appendChild(btn);
            });

            // 3. Grid (Bottom)
            const grid = document.createElement('div');
            grid.id = 'emoji-grid';
            grid.className = 'emoji-grid';
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">Loading...</div>';

            // Assemble
            picker.appendChild(superHeader);
            picker.appendChild(searchContainer);
            picker.appendChild(header);
            picker.appendChild(grid);
            document.body.appendChild(picker);

            this.pickerElement = picker;
        }

        showEmojisSection() {
            // Show emoji-specific UI elements
            const searchContainer = document.getElementById('emoji-search-container');
            const categoriesHeader = document.getElementById('emoji-categories-header');
            const searchInput = document.getElementById('emoji-search-input');

            if (searchContainer) searchContainer.style.display = 'block';
            if (categoriesHeader) categoriesHeader.style.display = 'flex';
            if (searchInput) {
                searchInput.placeholder = 'Search emojis...';
                searchInput.oninput = (e) => this.filterEmojis(e.target.value);
            }

            // Reset grid to emoji mode
            const grid = document.getElementById('emoji-grid');
            if (grid) {
                grid.className = 'emoji-grid';
            }

            // Show first category
            this.showCategory('smileys-emotion');
        }

        async loadEmojis() {
            try {
                const response = await fetch(`https://emoji-api.com/emojis?access_key=${this.apiKey}`);
                if (!response.ok) throw new Error('API Error');

                const data = await response.json();
                if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid Data');

                this.emojis = data;
                console.log(`✅ Loaded ${this.emojis.length} emojis`);
            } catch (err) {
                console.warn('⚠️ Using fallback emojis:', err);
                this.emojis = this.getFallbackData();
            }

            this.processCategories();

            // Show first category by default
            const firstCat = Object.keys(this.categoryIcons)[0];
            this.showCategory(firstCat);
        }

        processCategories() {
            // Reset categories array
            Object.keys(this.categoryIcons).forEach(key => this.categories[key] = []);

            this.emojis.forEach(emoji => {
                const group = emoji.group; // API uses same slugs as our keys: 'smileys-emotion' etc.
                if (this.categories[group]) {
                    this.categories[group].push(emoji);
                } else {
                    // Put unknowns in first category or ignore
                    // this.categories['smileys-emotion'].push(emoji);
                }
            });
        }

        showCategory(categorySlug) {
            const grid = document.getElementById('emoji-grid');
            if (!grid) return;

            // Highlight active tab
            document.querySelectorAll('.emoji-category-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === categorySlug);
            });

            // Populate Grid
            grid.className = 'emoji-grid'; // Reset (remove gif-mode)
            grid.innerHTML = '';

            const list = this.categories[categorySlug] || [];

            if (list.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">No emojis found</div>';
                return;
            }

            // Use Fragment for performance
            const fragment = document.createDocumentFragment();
            list.slice(0, 200).forEach(emoji => { // Limit render for perf
                const btn = document.createElement('button');
                btn.className = 'emoji-btn';

                // Windows Flag Fix: Render country flags as images
                let renderedAsImage = false;
                if (categorySlug === 'flags' && emoji.subGroup === 'country-flag') {
                    try {
                        const points = [...emoji.character].map(c => c.codePointAt(0));
                        // Check if it's a valid 2-letter regional indicator sequence
                        if (points.length === 2 && points.every(p => p >= 127462 && p <= 127487)) {
                            const char1 = String.fromCharCode(points[0] - 127397);
                            const char2 = String.fromCharCode(points[1] - 127397);
                            const iso = (char1 + char2).toLowerCase();

                            const img = document.createElement('img');
                            img.src = `https://flagcdn.com/w40/${iso}.png`;
                            img.alt = emoji.character;
                            // Style for the flag image
                            img.style.width = '24px';
                            img.style.height = 'auto';
                            img.style.objectFit = 'contain';
                            img.style.pointerEvents = 'none';

                            img.onerror = () => {
                                btn.innerHTML = '';
                                btn.textContent = emoji.character;
                            };

                            btn.appendChild(img);
                            renderedAsImage = true;
                        }
                    } catch (err) {
                        console.warn('Flag render error:', err);
                    }
                }

                if (!renderedAsImage) {
                    btn.textContent = emoji.character;
                }

                btn.title = emoji.unicodeName;
                btn.onclick = () => this.insertEmoji(emoji.character);
                fragment.appendChild(btn);
            });
            grid.appendChild(fragment);
        }

        filterEmojis(query) {
            const grid = document.getElementById('emoji-grid');
            if (!query) {
                this.showCategory(Object.keys(this.categoryIcons)[0]);
                return;
            }

            const term = query.toLowerCase();
            const matches = this.emojis.filter(e =>
                (e.unicodeName && e.unicodeName.toLowerCase().includes(term)) ||
                (e.slug && e.slug.toLowerCase().includes(term))
            ).slice(0, 100);

            grid.innerHTML = '';
            if (matches.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; opacity: 0.5;">No results</div>';
                return;
            }

            matches.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'emoji-btn';

                // Windows Flag Fix for Search
                let renderedAsImage = false;
                // Note: Check 'flags' group. subGroup might be 'country-flag'
                if (emoji.group === 'flags' && emoji.subGroup === 'country-flag') {
                    try {
                        const points = [...emoji.character].map(c => c.codePointAt(0));
                        if (points.length === 2 && points.every(p => p >= 127462 && p <= 127487)) {
                            const char1 = String.fromCharCode(points[0] - 127397);
                            const char2 = String.fromCharCode(points[1] - 127397);
                            const iso = (char1 + char2).toLowerCase();

                            const img = document.createElement('img');
                            img.src = `https://flagcdn.com/w40/${iso}.png`;
                            img.alt = emoji.character;
                            img.style.width = '24px';
                            img.style.height = 'auto';
                            img.style.objectFit = 'contain';
                            img.style.pointerEvents = 'none';

                            img.onerror = () => {
                                btn.innerHTML = '';
                                btn.textContent = emoji.character;
                            };

                            btn.appendChild(img);
                            renderedAsImage = true;
                        }
                    } catch (err) {
                        // ignore
                    }
                }

                if (!renderedAsImage) {
                    btn.textContent = emoji.character;
                }

                btn.onclick = () => this.insertEmoji(emoji.character);
                grid.appendChild(btn);
            });
        }

        async showGifs(searchTerm = '') {
            // Hide emoji-specific UI elements
            const searchContainer = document.getElementById('emoji-search-container');
            const categoriesHeader = document.getElementById('emoji-categories-header');
            if (searchContainer) searchContainer.style.display = 'none';
            if (categoriesHeader) categoriesHeader.style.display = 'none';

            const grid = document.getElementById('emoji-grid');
            grid.className = 'emoji-grid gif-mode';
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">Loading GIFs...</div>';

            // Update super header active state
            document.querySelectorAll('.super-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.super-tab[data-tab="gif"]')?.classList.add('active');

            try {
                // Tenor API v2 with Google Cloud API key
                const TENOR_API_KEY = 'AIzaSyATr4JsoLAi3w89ARnlXtxmBrtpaD3zTeY';
                const limit = 20;
                const clientKey = 'firechat_app';

                // Use search or featured endpoint based on search term
                let apiUrl;
                if (searchTerm && searchTerm.trim()) {
                    apiUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchTerm)}&key=${TENOR_API_KEY}&client_key=${clientKey}&limit=${limit}`;
                } else {
                    apiUrl = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${clientKey}&limit=${limit}`;
                }

                const res = await fetch(apiUrl);
                const data = await res.json();

                grid.innerHTML = '';

                // Add search input for GIFs with autocomplete
                const searchWrapper = document.createElement('div');
                searchWrapper.style.cssText = 'grid-column: 1/-1; padding: 8px; margin-bottom: 8px; position: relative;';

                const gifSearchInput = document.createElement('input');
                gifSearchInput.type = 'text';
                gifSearchInput.placeholder = 'Search GIFs...';
                gifSearchInput.value = searchTerm;
                gifSearchInput.id = 'gif-search-input';
                gifSearchInput.style.cssText = `
                    width: 100%; padding: 10px 14px; border-radius: 8px; border: none;
                    background: rgba(255,255,255,0.1); color: #fff; font-size: 14px;
                    outline: none;
                `;

                // Autocomplete dropdown
                const autocompleteDropdown = document.createElement('div');
                autocompleteDropdown.id = 'gif-autocomplete';
                autocompleteDropdown.style.cssText = `
                    position: absolute; top: 100%; left: 8px; right: 8px;
                    background: rgba(30, 40, 50, 0.98); border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100;
                    display: none; max-height: 150px; overflow-y: auto;
                `;

                let autocompleteTimer = null;

                gifSearchInput.oninput = (e) => {
                    const query = e.target.value.trim();

                    // Clear previous timer
                    if (autocompleteTimer) clearTimeout(autocompleteTimer);

                    if (query.length < 2) {
                        autocompleteDropdown.style.display = 'none';
                        return;
                    }

                    // Debounce autocomplete requests
                    autocompleteTimer = setTimeout(async () => {
                        try {
                            const acUrl = `https://tenor.googleapis.com/v2/autocomplete?key=${TENOR_API_KEY}&client_key=${clientKey}&q=${encodeURIComponent(query)}&limit=5`;
                            const acRes = await fetch(acUrl);
                            const acData = await acRes.json();

                            if (acData.results && acData.results.length > 0) {
                                autocompleteDropdown.innerHTML = '';
                                acData.results.forEach(suggestion => {
                                    const item = document.createElement('div');
                                    item.textContent = suggestion;
                                    item.style.cssText = `
                                        padding: 10px 14px; cursor: pointer; color: #e9edef;
                                        border-bottom: 1px solid rgba(255,255,255,0.05);
                                        transition: background 0.2s;
                                    `;
                                    item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.1)';
                                    item.onmouseleave = () => item.style.background = 'transparent';
                                    item.onclick = () => {
                                        autocompleteDropdown.style.display = 'none';
                                        this.showGifs(suggestion);
                                    };
                                    autocompleteDropdown.appendChild(item);
                                });
                                autocompleteDropdown.style.display = 'block';
                            } else {
                                autocompleteDropdown.style.display = 'none';
                            }
                        } catch (e) {
                            autocompleteDropdown.style.display = 'none';
                        }
                    }, 300);
                };

                gifSearchInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        autocompleteDropdown.style.display = 'none';
                        this.showGifs(gifSearchInput.value);
                    } else if (e.key === 'Escape') {
                        autocompleteDropdown.style.display = 'none';
                    }
                };

                gifSearchInput.onblur = () => {
                    // Delay hiding so click events can fire
                    setTimeout(() => autocompleteDropdown.style.display = 'none', 200);
                };

                searchWrapper.appendChild(gifSearchInput);
                searchWrapper.appendChild(autocompleteDropdown);
                grid.appendChild(searchWrapper);

                if (!data.results || data.results.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.style.cssText = 'grid-column: 1/-1; text-align: center; color: #8696a0; padding: 20px;';
                    noResults.textContent = 'No GIFs found';
                    grid.appendChild(noResults);
                    return;
                }

                // Store current search term for registershare
                this.lastGifSearchTerm = searchTerm || 'trending';

                // Debug: Log API response
                console.log('Tenor API Response:', data.results?.length, 'GIFs');
                if (data.results?.[0]) {
                    console.log('Sample GIF structure:', JSON.stringify(data.results[0], null, 2));
                }

                data.results.forEach(gif => {
                    const div = document.createElement('div');
                    div.className = 'gif-item';
                    div.style.minHeight = '100px';

                    const img = document.createElement('img');

                    // Tenor API v2 uses media_formats object
                    // Try multiple formats as fallback
                    const previewUrl = gif.media_formats?.nanogif?.url
                        || gif.media_formats?.tinygif?.url
                        || gif.media_formats?.gif?.url
                        || gif.url; // Some responses have direct url

                    console.log('GIF preview URL:', previewUrl);

                    if (previewUrl) {
                        img.src = previewUrl;
                    } else {
                        console.warn('No preview URL found for GIF:', gif);
                        return; // Skip this GIF
                    }

                    img.loading = 'lazy';
                    img.alt = 'GIF';
                    img.style.cssText = 'width: 100%; height: 120px; object-fit: cover; display: block;';

                    // Error handling for broken images
                    img.onerror = () => {
                        console.warn('Failed to load GIF image:', previewUrl);
                        div.style.display = 'none'; // Hide broken GIFs
                    };

                    div.appendChild(img);

                    div.onclick = () => {
                        if (window.fireflyChat && window.fireflyChat.currentPeer) {
                            // Send the higher quality GIF
                            const gifUrl = gif.media_formats?.gif?.url
                                || gif.media_formats?.mediumgif?.url
                                || gif.media_formats?.tinygif?.url
                                || previewUrl;
                            window.fireflyChat.sendGifMessage(gifUrl);

                            // Register share with Tenor (helps improve recommendations)
                            this.registerTenorShare(gif.id, this.lastGifSearchTerm);

                            this.close();
                        }
                    };
                    grid.appendChild(div);
                });
            } catch (e) {
                console.error('Tenor API Error:', e);
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ff4444;">Failed to load GIFs</div>';
            }
        }

        // Register GIF share with Tenor API (improves recommendations)
        async registerTenorShare(gifId, searchTerm) {
            try {
                const TENOR_API_KEY = 'AIzaSyATr4JsoLAi3w89ARnlXtxmBrtpaD3zTeY';
                const clientKey = 'firechat_app';
                const shareUrl = `https://tenor.googleapis.com/v2/registershare?id=${gifId}&key=${TENOR_API_KEY}&client_key=${clientKey}&q=${encodeURIComponent(searchTerm)}`;

                // Fire and forget - no need to wait for response
                fetch(shareUrl).catch(() => { });
            } catch (e) {
                // Silent fail - this is just analytics
            }
        }

        async showStickers(searchTerm = '') {
            // Hide emoji-specific UI elements
            const searchContainer = document.getElementById('emoji-search-container');
            const categoriesHeader = document.getElementById('emoji-categories-header');
            if (searchContainer) searchContainer.style.display = 'none';
            if (categoriesHeader) categoriesHeader.style.display = 'none';

            const grid = document.getElementById('emoji-grid');
            grid.className = 'emoji-grid gif-mode'; // Reuse GIF grid layout
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">Loading Stickers...</div>';

            // Update super header active state
            document.querySelectorAll('.super-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.super-tab[data-tab="stickers"]')?.classList.add('active');

            try {
                const MOJILALA_API_KEY = 'dc6zaTOxFJmzC';
                const limit = 20;

                // Use search or trending endpoint based on search term
                let apiUrl;
                if (searchTerm && searchTerm.trim()) {
                    apiUrl = `https://api.mojilala.com/v1/stickers/search?q=${encodeURIComponent(searchTerm)}&api_key=${MOJILALA_API_KEY}&limit=${limit}`;
                } else {
                    apiUrl = `https://api.mojilala.com/v1/stickers/trending?api_key=${MOJILALA_API_KEY}&limit=${limit}`;
                }

                const res = await fetch(apiUrl);
                const data = await res.json();

                grid.innerHTML = '';

                // Add search input for Stickers
                const searchWrapper = document.createElement('div');
                searchWrapper.style.cssText = 'grid-column: 1/-1; padding: 8px; margin-bottom: 8px; position: relative;';

                const stickerSearchInput = document.createElement('input');
                stickerSearchInput.type = 'text';
                stickerSearchInput.placeholder = 'Search Stickers...';
                stickerSearchInput.value = searchTerm;
                stickerSearchInput.id = 'sticker-search-input';
                stickerSearchInput.style.cssText = `
                    width: 100%; padding: 10px 14px; border-radius: 8px; border: none;
                    background: rgba(255,255,255,0.1); color: #fff; font-size: 14px;
                    outline: none;
                `;

                stickerSearchInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        this.showStickers(stickerSearchInput.value);
                    }
                };

                searchWrapper.appendChild(stickerSearchInput);
                grid.appendChild(searchWrapper);

                if (!data.data || data.data.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.style.cssText = 'grid-column: 1/-1; text-align: center; color: #8696a0; padding: 20px;';
                    noResults.textContent = 'No stickers found';
                    grid.appendChild(noResults);
                    return;
                }

                console.log('Mojilala API Response:', data.data.length, 'stickers');

                data.data.forEach(sticker => {
                    const div = document.createElement('div');
                    div.className = 'gif-item sticker-item';
                    div.style.cssText = 'min-height: 100px; background: rgba(255,255,255,0.05);';

                    const img = document.createElement('img');

                    // Mojilala API uses images.fixed_height for preview
                    const previewUrl = sticker.images?.fixed_height?.url
                        || sticker.images?.fixed_height_small?.url
                        || sticker.images?.fixed_width?.url;

                    if (previewUrl) {
                        img.src = previewUrl;
                    } else {
                        console.warn('No preview URL found for sticker:', sticker);
                        return;
                    }

                    img.loading = 'lazy';
                    img.alt = 'Sticker';
                    img.style.cssText = 'width: 100%; height: 120px; object-fit: contain; display: block;';

                    img.onerror = () => {
                        console.warn('Failed to load sticker:', previewUrl);
                        div.style.display = 'none';
                    };

                    div.appendChild(img);

                    div.onclick = () => {
                        if (window.fireflyChat && window.fireflyChat.currentPeer) {
                            // Send the full size sticker
                            const stickerUrl = sticker.images?.fixed_width_medium?.url
                                || sticker.images?.fixed_width?.url
                                || previewUrl;

                            // Send as GIF type (stickers work the same way)
                            window.fireflyChat.sendGifMessage(stickerUrl);
                            this.close();
                        }
                    };

                    grid.appendChild(div);
                });

            } catch (e) {
                console.error('Mojilala API Error:', e);
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ff4444;">Failed to load stickers</div>';
            }
        }

        insertEmoji(char) {
            const input = document.getElementById('message-input');
            if (input) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const text = input.value;
                input.value = text.substring(0, start) + char + text.substring(end);

                // Trigger input event for listeners (e.g. Mobile UI Send Button)
                input.dispatchEvent(new Event('input', { bubbles: true }));

                input.focus();
                input.selectionStart = input.selectionEnd = start + char.length;
            }
        }

        toggle(triggerBtn) {
            if (this.isOpen) {
                this.close();
            } else {
                this.open(triggerBtn);
            }
        }

        open(triggerBtn) {
            if (!this.pickerElement) return;

            // Show elements
            this.backdropElement.style.display = 'block';
            this.pickerElement.style.display = 'flex';
            this.isOpen = true;

            // Positioning Logic
            if (triggerBtn) {
                const rect = triggerBtn.getBoundingClientRect();
                const pickerHeight = 450;
                const pickerWidth = 360;

                let bottom = window.innerHeight - rect.top + 10;
                let left = rect.left;

                // Prevent going off screen (right)
                if (left + pickerWidth > window.innerWidth) {
                    left = window.innerWidth - pickerWidth - 20;
                }

                // Prevent going off screen (top) - if not enough space above, show below? 
                // Currently positioning ABOVE input.
                if (rect.top < pickerHeight) {
                    // Not enough space above?
                    // Ideally we stick to bottom unless absolutely necessary?
                    // Just clamp bottom
                }

                this.pickerElement.style.top = 'auto';
                this.pickerElement.style.bottom = `${bottom}px`;
                this.pickerElement.style.left = `${left}px`;
            }
        }

        close() {
            if (!this.pickerElement) return;
            this.pickerElement.style.display = 'none';
            this.backdropElement.style.display = 'none';
            this.isOpen = false;
        }

        getFallbackData() {
            const basics = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
                '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
                '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
                '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟',
                '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'];

            return basics.map((c, i) => ({
                character: c,
                slug: `basic-${i}`,
                group: 'smileys-emotion',
                unicodeName: 'Basic Emoji'
            }));
        }
    }

    // Export Class
    window.FireChatEmojiPicker = EmojiPicker;

    // Instantiate
    window.emojiPicker = new EmojiPicker();

    // Global helper for HTML onclick
    window.triggerEmojiPicker = function (event) {
        // Prevent event bubbling so it doesn't immediately close if we used document click (which we don't, but good practice)
        if (event) event.stopPropagation();

        const btn = event ? event.target.closest('.input-btn') : null;
        window.emojiPicker.toggle(btn);
    };

    // Global ESC handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.emojiPicker && window.emojiPicker.isOpen) {
            window.emojiPicker.close();
        }
    });

})();
