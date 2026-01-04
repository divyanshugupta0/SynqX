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
            // Use local robust dataset immediately - faster and reliable
            console.log('🚀 Loading local emoji dataset...');
            this.emojis = this.getLocalEmojiData();

            this.processCategories();

            // Show first category by default
            const firstCat = Object.keys(this.categoryIcons)[0];
            this.showCategory(firstCat);
        }

        processCategories() {
            // Reset categories array
            Object.keys(this.categoryIcons).forEach(key => this.categories[key] = []);

            this.emojis.forEach(emoji => {
                const group = emoji.group;
                if (this.categories[group]) {
                    this.categories[group].push(emoji);
                }
            });
        }

        getLocalEmojiData() {
            // Format: "char|keywords" - Group is determined by section
            const dataset = {
                'smileys-emotion': [
                    "😀|grinning face happy smile", "😃|grinning face with big eyes happy", "😄|grinning face with smiling eyes happy", "😁|beaming face with smiling eyes happy",
                    "😆|grinning squinting face happy laugh", "😅|grinning face with sweat relief", "😂|face with tears of joy laugh cry", "🤣|rolling on the floor laughing",
                    "🥲|smiling face with tear emotional", "🥹|face holding back tears", "☺️|smiling face happy", "😊|smiling face with smiling eyes happy",
                    "😇|smiling face with halo angel", "🙂|slightly smiling face", "🙃|upside-down face silly", "😉|winking face flirt", "😌|relieved face",
                    "😍|smiling face with heart-eyes love", "🥰|smiling face with hearts love", "😘|face blowing a kiss love", "😗|kissing face", "😙|kissing face with smiling eyes",
                    "😚|kissing face with closed eyes", "😋|face savoring food yum", "😛|face with tongue silly", "😝|squinting face with tongue silly", "😜|winking face with tongue silly",
                    "🤪|zany face silly crazy", "🤨|face with raised eyebrow skeptical", "🧐|face with monocle sophisticated", "🤓|nerd face smart", "😎|smiling face with sunglasses cool",
                    "🥸|disguised face glasses", "🤩|star-struck excited", "🥳|partying face celebration", "😏|smirking face flirt", "😒|unamused face annoyed", "😞|disappointed face sad",
                    "😔|pensive face sad", "😟|worried face", "😕|confused face", "🙁|slightly frowning face sad", "☹️|frowning face sad", "😣|persevering face struggle",
                    "😖|confounded face struggle", "😫|tired face exhaust", "😩|weary face exhaust", "🥺|pleading face beg", "😢|crying face sad tear", "😭|loudly crying face sad sob",
                    "😤|face with steam from nose angry", "😠|angry face mad", "😡|pouting face angry mad", "🤬|face with symbols on mouth swear", "🤯|exploding head mind blown",
                    "😳|flushed face embarrassed", "🥵|hot face heat", "🥶|cold face freeze", "😱|face screaming in fear scared", "😨|fearful face scared", "😰|anxious face with sweat nervous",
                    "😥|sad but relieved face", "😓|downcast face with sweat", "🤗|hugging face hug", "🤔|thinking face wonder", "🫣|face with peeking eye shy",
                    "🤭|face with hand over mouth giggle", "🤫|shushing face quiet", "🫠|melting face hot", "🤥|lying face pinocchio", "😶|face without mouth silent",
                    "😐|neutral face meh", "😑|expressionless face meh", "😬|grimacing face awkward", "🙄|face with rolling eyes eyeroll", "😯|hushed face surprise",
                    "😦|frowning face with open mouth", "😧|anguished face", "😮|face with open mouth surprise", "😲|astonished face shock", "🥱|yawning face tired",
                    "😴|sleeping face sleep", "🤤|drooling face hungry", "😪|sleepy face tired", "😵|dizzy face sick", "😵‍💫|face with spiral eyes dizzy", "🤐|zipper-mouth face silent",
                    "🥴|woozy face drunk", "🤢|nauseated face sick", "🤮|face vomiting sick", "🤧|sneezing face sick", "😷|face with medical mask sick", "🤒|face with thermometer sick",
                    "🤕|face with head-bandage hurt", "🤑|money-mouth face rich", "🤠|cowboy hat face", "😈|smiling face with horns devil", "👿|angry face with horns devil",
                    "🤡|clown face circus", "💩|pile of poo poop", "👻|ghost halloween", "💀|skull death", "☠️|skull and crossbones death", "👽|alien ufo", "👾|alien monster game",
                    "🤖|robot bot", "🎃|jack-o-lantern pumpkin", "😺|grinning cat", "😸|grinning cat with smiling eyes", "😹|cat with tears of joy", "😻|smiling cat with heart-eyes love",
                    "😼|cat with wry smile", "😽|kissing cat", "🙀|weary cat", "😿|crying cat", "😾|pouting cat", "❤️|red heart love", "🧡|orange heart love", "💛|yellow heart love",
                    "💚|green heart love", "💙|blue heart love", "💜|purple heart love", "🖤|black heart love", "🤍|white heart love", "🤎|brown heart love", "💔|broken heart sad"
                ],
                'people-body': [
                    "👋|waving hand hello", "🤚|raised back of hand", "🖐️|hand with fingers splayed", "✋|raised hand stop", "🖖|vulcan salute spock", "👌|OK hand okay",
                    "🤌|pinched fingers italian", "🤏|pinching hand small", "✌️|victory hand peace", "🤞|crossed fingers luck", "🤟|love-you gesture", "🤘|sign of the horns rock",
                    "🤙|call me hand phone", "👈|backhand index pointing left", "👉|backhand index pointing right", "👆|backhand index pointing up", "🖕|middle finger rude",
                    "👇|backhand index pointing down", "☝️|index pointing up one", "👍|thumbs up like", "👎|thumbs down dislike", "✊|raised fist power", "👊|oncoming fist punch",
                    "🤛|left-facing fist punch", "🤜|right-facing fist punch", "👏|clapping hands applause", "🙌|raising hands celebration", "👐|open hands", "🤲|palms up together",
                    "🤝|handshake deal", "🙏|folded hands pray thanks", "✍️|writing hand", "💅|nail polish sassy", "🤳|selfie phone", "💪|flexed biceps strong", "🧠|brain smart",
                    "👀|eyes look", "👁️|eye look", "👄|mouth kiss", "💋|kiss mark love", "👶|baby child", "👧|girl child", "🧒|child kid", "👦|boy child", "👩|woman female",
                    "🧑|person gender neutral", "👨|man male", "👱|person: blond hair", "🧔|person: beard", "👵|old woman grandma", "🧓|older person", "👴|old man grandpa",
                    "👮|police officer", "👷|construction worker", "💂|guard", "🕵️|detective spy", "👩‍⚕️|woman health worker doctor", "👨‍⚕️|man health worker doctor",
                    "👩‍🎓|woman student grad", "👨‍🎓|man student grad", "👩‍🏫|woman teacher", "👨‍🏫|man teacher", "👩‍💻|woman technologist developer", "👨‍💻|man technologist developer",
                    "👰|person with veil wedding", "🤵|person in tuxedo wedding", "👸|princess queen", "🤴|prince king", "🤰|pregnant woman", "🤱|breast-feeding",
                    "💃|woman dancing", "🕺|man dancing", "👫|woman and man holding hands", "💏|kissing", "💑|couple with heart", "👪|family"
                ],
                'animals-nature': [
                    "🐶|dog face puppy", "🐕|dog puppy", "🐩|poodle dog", "🐺|wolf", "🦊|fox", "🦝|raccoon", "🐱|cat face kitten", "🐈|cat kitten", "🦁|lion", "🐯|tiger face",
                    "🐅|tiger", "🐆|leopard", "🐴|horse face", "🐎|horse", "🦄|unicorn magic", "🦓|zebra", "🦌|deer", "🐮|cow face", "🐂|ox", "🐃|water buffalo", "🐄|cow",
                    "🐷|pig face", "🐖|pig", "🐗|boar", "🐽|pig nose", "🐏|ram", "🐑|sheep", "🐐|goat", "🐪|camel", "🐫|two-hump camel", "🦙|llama", "🦒|giraffe", "🐘|elephant",
                    "🦏|rhinoceros", "🦛|hippopotamus", "🐭|mouse face", "🐁|mouse", "🐀|rat", "🐹|hamster", "🐰|rabbit face bunny", "🐇|rabbit bunny", "🐿️|chipmunk", "🦇|bat",
                    "🐻|bear", "🐨|koala", "🐼|panda", "🦥|sloth", "🦦|otter", "🦨|skunk", "🦘|kangaroo", "🦡|badger", "🐾|paw prints", "🦃|turkey", "🐔|chicken", "🐓|rooster",
                    "🐣|hatching chick", "🐤|baby chick", "🐥|front-facing baby chick", "🐦|bird", "🐧|penguin", "🕊️|dove peace", "🦅|eagle", "🦆|duck", "🦢|swan", "🦉|owl",
                    "🦩|flamingo", "🦚|peacock", "🦜|parrot", "🐸|frog", "🐊|crocodile", "🐢|turtle", "🦎|lizard", "🐍|snake", "🐲|dragon face", "🐉|dragon", "🦕|sauropod dinosaur",
                    "🦖|t-rex dinosaur", "🐳|spouting whale", "🐋|whale", "🐬|dolphin", "🐟|fish", "🐠|tropical fish", "🐡|blowfish", "🦈|shark", "🐙|octopus", "🐚|spiral shell",
                    "🐌|snail", "🦋|butterfly", "🐛|bug", "🐜|ant", "🐝|honeybee", "🐞|lady beetle ladybug", "🦗|cricket", "🕷️|spider", "🕸️|spider web", "🦂|scorpion", "🦟|mosquito",
                    "🦠|microbe virus", "💐|bouquet flowers", "🌸|cherry blossom flower", "💮|white flower", "🏵️|rosette", "🌹|rose flower love", "🥀|wilted flower", "🌺|hibiscus flower",
                    "🌻|sunflower", "🌼|blossom", "🌷|tulip", "🌱|seedling plant", "🪴|potted plant", "🌲|evergreen tree", "🌳|deciduous tree", "🌴|palm tree", "🌵|cactus",
                    "🌾|sheaf of rice", "🌿|herb", "☘️|shamrock", "🍀|four leaf clover luck", "🍁|maple leaf", "🍂|fallen leaf", "🍃|leaf fluttering in wind", "🍄|mushroom",
                    "🌑|new moon", "🌒|waxing crescent moon", "🌓|first quarter moon", "🌔|waxing gibbous moon", "🌕|full moon", "🌖|waning gibbous moon", "🌗|last quarter moon",
                    "🌘|waning crescent moon", "🌙|crescent moon", "🌚|new moon face", "🌛|first quarter moon face", "🌜|last quarter moon face", "☀️|sun", "🌝|full moon face",
                    "🌞|sun with face", "⭐|star", "🌟|glowing star", "🌠|shooting star", "☁️|cloud", "⛅|sun behind cloud", "⛈️|cloud with lightning and rain", "🌤️|sun behind small cloud",
                    "🌥️|sun behind large cloud", "🌦️|sun behind rain cloud", "🌧️|cloud with rain", "🌨️|cloud with snow", "🌩️|cloud with lightning", "🌪️|tornado", "🌫️|fog",
                    "🌬️|wind face", "🌈|rainbow", "☂️|umbrella", "☔|umbrella with rain drops", "⚡|high voltage lightning", "❄️|snowflake", "☃️|snowman", "🔥|fire hot", "💧|droplet water",
                    "🌊|water wave"
                ],
                'food-drink': [
                    "🍇|grapes", "🍈|melon", "🍉|watermelon", "🍊|tangerine", "🍋|lemon", "🍌|banana", "🍍|pineapple", "🥭|mango", "🍎|red apple", "🍏|green apple", "🍐|pear", "🍑|peach",
                    "🍒|cherries", "🍓|strawberry", "🫐|blueberries", "🥝|kiwi fruit", "🍅|tomato", "🫒|olive", "🥥|coconut", "🥑|avocado", "🍆|eggplant", "🥔|potato", "🥕|carrot",
                    "🌽|ear of corn", "🌶️|hot pepper", "🫑|bell pepper", "🥒|cucumber", "🥬|leafy green", "🥦|broccoli", "🧄|garlic", "🧅|onion", "🍄|mushroom", "🥜|peanuts",
                    "🌰|chestnut", "🍞|bread", "🥐|croissant", "🥖|baguette bread", "🥨|pretzel", "🥯|bagel", "🥞|pancakes", "🧇|waffle", "🧀|cheese wedge", "🍖|meat on bone",
                    "🍗|poultry leg", "🥩|cut of meat", "🥓|bacon", "🍔|hamburger burger", "🍟|french fries", "🍕|pizza", "🌭|hot dog", "🥪|sandwich", "🌮|taco", "🌯|burrito",
                    "🫔|tamale", "🥙|stuffed flatbread", "🧆|falafel", "🥚|egg", "🍳|cooking", "🥘|shallow pan of food", "🍲|pot of food", "🥣|bowl with spoon", "🥗|green salad",
                    "🍿|popcorn", "🧈|butter", "🧂|salt", "🥫|canned food", "🍱|bento box", "🍘|rice cracker", "🍙|rice ball", "🍚|cooked rice", "🍛|curry rice", "🍜|steaming bowl noodle",
                    "🍝|spaghetti pasta", "🍠|roasted sweet potato", "🍢|oden", "🍣|sushi", "🍤|fried shrimp", "🍥|fish cake with swirl", "🥮|moon cake", "🍡|dango", "🥟|dumpling",
                    "🥠|fortune cookie", "🥡|takeout box", "🦀|crab", "🦞|lobster", "🦐|shrimp", "🦑|squid", "🦪|oyster", "🍦|soft ice cream", "🍧|shaved ice", "🍨|ice cream",
                    "🍩|doughnut", "🍪|cookie", "🎂|birthday cake", "🍰|shortcake", "🧁|cupcake", "🥧|pie", "🍫|chocolate bar", "🍬|candy", "🍭|lollipop", "🍮|custard",
                    "🍯|honey pot", "🍼|baby bottle", "🥛|glass of milk", "☕|hot beverage coffee", "🫖|teapot", "🍵|teacup without handle", "🍶|sake", "🍾|bottle with popping cork",
                    "🍷|wine glass", "🍸|cocktail glass", "🍹|tropical drink", "🍺|beer mug", "🍻|clinking beer mugs", "🥂|clinking glasses cheers", "🥃|tumbler glass whiskey",
                    "🥤|cup with straw", "🧋|bubble tea", "🧃|beverage box", "🧉|mate", "🧊|ice", "🥢|chopsticks", "🍽️|fork and knife with plate", "🍴|fork and knife",
                    "🥄|spoon", "🔪|kitchen knife", "🏺|amphora"
                ],
                'travel-places': [
                    "🌍|globe showing Europe-Africa", "🌎|globe showing Americas", "🌏|globe showing Asia-Australia", "🗺️|world map", "🧭|compass", "🏔️|snow-capped mountain",
                    "⛰️|mountain", "🌋|volcano", "🗻|mount fuji", "🏕️|camping", "🏖️|beach with umbrella", "🏜️|desert", "🏝️|desert island", "🏞️|national park", "🏟️|stadium",
                    "🏛️|classical building", "🏗️|building construction", "🧱|brick", "🏠|house", "🏡|house with garden", "🏢|office building", "🏣|Japanese post office",
                    "🏤|post office", "🏥|hospital", "🏦|bank", "🏨|hotel", "🏩|love hotel", "🏪|convenience store", "🏫|school", "🏬|department store", "🏭|factory", "🏯|Japanese castle",
                    "🏰|castle", "💒|wedding", "🗼|Tokyo tower", "🗽|Statue of Liberty", "⛪|church", "🕌|mosque", "🛕|hindu temple", "🕍|synagogue", "⛩️|shinto shrine", "🕋|kaaba",
                    "⛲|fountain", "⛺|tent", "🌁|foggy", "🌃|night with stars", "🏙️|cityscape", "🌄|sunrise over mountains", "🌅|sunrise", "🌆|cityscape at dusk", "🌇|sunset",
                    "🌉|bridge at night", "🎠|horse", "🎡|ferris wheel", "🎢|roller coaster", "🎪|circus tent", "🚂|locomotive", "🚃|railway car", "🚄|high-speed train",
                    "🚅|bullet train", "🚆|train", "🚇|metro", "🚈|light rail", "🚉|station", "🚊|tram", "🚝|monorail", "🚞|mountain railway", "🚋|tram car", "BUS|bus",
                    "🚍|oncoming bus", "🚎|trolleybus", "🚐|minibus", "🚑|ambulance", "🚒|fire engine", "🚓|police car", "🚔|oncoming police car", "🚕|taxi", "🚖|oncoming taxi",
                    "🚗|automobile car", "🚘|oncoming automobile", "🚙|sport utility vehicle", "🛻|pickup truck", "🚚|delivery truck", "🚛|articulated lorry", "🚜|tractor",
                    "🏎️|racing car", "🏍️|motorcycle", "🛵|motor scooter", "🛺|auto rickshaw", "🚲|bicycle", "🛴|kick scooter", "🛹|skateboard", "🛼|roller skate", "🚏|bus stop",
                    "⛽|fuel pump", "🚨|police car light", "🚥|horizontal traffic light", "🚦|vertical traffic light", "🛑|stop sign", "🚧|construction", "⚓|anchor", "⛵|sailboat",
                    "🛶|canoe", "🚤|speedboat", "🛳️|passenger ship", "⛴️|ferry", "🛥️|motor boat", "🚢|ship", "✈️|airplane", "🛩️|small airplane", "🛫|airplane departure",
                    "🛬|airplane arrival", "🪂|parachute", "💺|seat", "🚁|helicopter", "🚟|suspension railway", "🚠|mountain cableway", "🚡|aerial tramway", "🛰️|satellite",
                    "🚀|rocket", "🛸|flying saucer"
                ],
                'activities': [
                    "🎃|jack-o-lantern", "🎄|Christmas tree", "🎆|fireworks", "🎇|sparkler", "🧨|firecracker", "✨|sparkles", "🎈|balloon", "🎉|party popper", "🎊|confetti ball",
                    "🎋|tanabata tree", "🎍|pine decoration", "🎎|Japanese dolls", "🎏|carp streamer", "🎐|wind chime", "🎑|moon viewing ceremony", "🧧|red envelope", "🎀|ribbon",
                    "🎁|wrapped gift", "🎗️|reminder ribbon", "🎟️|admission tickets", "🎫|ticket", "🎖️|military medal", "🏆|trophy", "🏅|sports medal", "🥇|1st place medal",
                    "🥈|2nd place medal", "🥉|3rd place medal", "⚽|soccer ball", "⚾|baseball", "🥎|softball", "🏀|basketball", "🏐|volleyball", "🏈|american football", "🏉|rugby football",
                    "🎾|tennis", "🥏|flying disc", "🎳|bowling", "🏏|cricket game", "🏑|field hockey", "🏒|ice hockey", "🥍|lacrosse", "🏓|ping pong", "🏸|badminton", "🥊|boxing glove",
                    "🥋|martial arts uniform", "🥅|goal net", "⛳|flag in hole", "⛸️|ice skate", "🎣|fishing pole", "🤿|diving mask", "🎽|running shirt", "🎿|skis", "🛷|sled",
                    "🥌|curling stone", "🎯|direct hit", "🪀|yo-yo", "🪁|kite", "🎱|pool 8 ball", "🔮|crystal ball", "🪄|magic wand", "🧿|nazar amulet", "🎮|video game",
                    "🕹️|joystick", "🎰|slot machine", "🎲|game die", "🧩|puzzle piece", "🧸|teddy bear", "🪅|piñata", "🪩|mirror ball", "🪆|nesting dolls", "♠️|spade suit",
                    "♥️|heart suit", "♦️|diamond suit", "♣️|club suit", "♟️|chess pawn", "🃏|joker", "🀄|mahjong red dragon", "🎴|flower playing cards", "🎭|performing arts",
                    "🖼️|framed picture", "🎨|artist palette", "🧵|thread", "🪡|sewing needle", "🧶|yarn", "🪢|knot"
                ],
                'objects': [
                    "👓|glasses", "🕶️|sunglasses", "🥽|goggles", "🥼|lab coat", "🦺|safety vest", "👔|necktie", "👕|t-shirt", "👖|jeans", "🧣|scarf", "🧤|gloves", "🧥|coat",
                    "🧦|socks", "👗|dress", "👘|kimono", "🥻|sari", "🩱|one-piece swimsuit", "🩲|briefs", "🩳|shorts", "👙|bikini", "👚|woman’s clothes", "👛|purse", "👜|handbag",
                    "👝|clutch bag", "🛍️|shopping bags", "🎒|backpack", "🩴|thong sandal", "👞|man’s shoe", "👟|running shoe", "🥾|hiking boot", "🥿|flat shoe", "👠|high-heeled shoe",
                    "👡|woman’s sandal", "🩰|ballet shoes", "👢|woman’s boot", "👑|crown", "👒|woman’s hat", "🎩|top hat", "🎓|graduation cap", "🧢|billed cap", "🪖|military helmet",
                    "⛑️|rescue worker’s helmet", "📿|prayer beads", "💄|lipstick", "💍|ring", "💎|gem stone", "🔇|muted speaker", "🔈|speaker low volume", "🔉|speaker medium volume",
                    "🔊|speaker high volume", "📢|loudspeaker", "📣|megaphone", "📯|postal horn", "🔔|bell", "🔕|bell with slash", "🎼|musical score", "🎵|musical note",
                    "🎶|musical notes", "🎙️|studio microphone", "🎚️|level slider", "🎛️|control knobs", "🎤|microphone", "🎧|headphone", "📻|radio", "🎷|saxophone", "🪗|accordion",
                    "🎸|guitar", "🎹|musical keyboard", "🎺|trumpet", "🎻|violin", "🪕|banjo", "🥁|drum", "🪘|long drum", "📱|mobile phone", "📲|mobile phone with arrow",
                    "☎️|telephone", "📞|telephone receiver", "📟|pager", "📠|fax machine", "🔋|battery", "🔌|electric plug", "💻|laptop", "🖥️|desktop computer", "🖨️|printer",
                    "⌨️|keyboard", "🖱️|computer mouse", "🖲️|trackball", "💽|computer disk", "💾|floppy disk", "💿|optical disk", "📀|dvd", "🧮|abacus", "🎥|movie camera",
                    "🎞️|film frames", "📽️|film projector", "🎬|clapper board", "📺|television", "📷|camera", "📸|camera with flash", "📹|video camera", "📼|videocassette",
                    "🔍|magnifying glass tilted left", "🔎|magnifying glass tilted right", "🕯️|candle", "💡|light bulb", "🔦|flashlight", "🏮|red paper lantern", "🪔|diya lamp",
                    "📔|notebook with decorative cover", "📕|closed book", "📖|open book", "📗|green book", "📘|blue book", "📙|orange book", "📚|books", "📓|notebook",
                    "📒|ledger", "📃|page with curl", "📜|scroll", "📄|page facing up", "📰|newspaper", "🗞️|rolled-up newspaper", "📑|bookmark tabs", "🔖|bookmark", "🏷️|label",
                    "💰|money bag", "🪙|coin", "💴|yen banknote", "💵|dollar banknote", "💶|euro banknote", "💷|pound banknote", "💸|money with wings", "💳|credit card",
                    "🧾|receipt", "✉️|envelope", "📧|e-mail", "📨|incoming envelope", "📩|envelope with arrow", "📤|outbox tray", "📥|inbox tray", "📦|package", "📫|closed mailbox with raised flag",
                    "📪|closed mailbox with lowered flag", "📫|mailbox", "📭|open mailbox with lowered flag", "📮|postbox", "🗳️|ballot box with ballot", "✏️|pencil", "✒️|black nib",
                    "🖋️|fountain pen", "🖊️|pen", "🖌️|paintbrush", "🖍️|crayon", "📝|memo", "💼|briefcase", "📁|file folder", "📂|open file folder", "🗂️|card index dividers",
                    "📅|calendar", "📆|tear-off calendar", "🗒️|spiral notepad", "🗓️|spiral calendar", "📇|card index", "📈|chart increasing", "📉|chart decreasing", "📊|bar chart",
                    "📋|clipboard", "📌|pushpin", "📍|round pushpin", "📎|paperclip", "🖇️|linked paperclips", "📏|straight ruler", "📐|triangular ruler", "✂️|scissors", "🗃️|card file box",
                    "🗄️|file cabinet", "🗑️|wastebasket", "🔒|locked", "🔓|unlocked", "🔏|locked with pen", "🔐|locked with key", "🔑|key", "🗝️|old key", "🔨|hammer", "🪓|axe",
                    "⛏️|pick", "⚒️|hammer and pick", "🛠️|hammer and wrench", "🗡️|dagger", "⚔️|crossed swords", "🔫|gun", "🪃|boomerang", "🏹|bow", "🛡️|shield", "🪚|carpentry saw",
                    "🔧|wrench", "🪛|screwdriver", "🔩|nut", "⚙️|gear", "🗜️|clamp", "⚖️|balance scale", "🦯|white cane", "🔗|link", "⛓️|chains", "🪝|hook", "🧰|toolbox", "🧲|magnet", "🪜|ladder", "⚗️|alembic",
                    "🧪|test tube", "🧫|petri dish", "🧬|dna", "🔬|microscope", "🔭|telescope", "📡|satellite antenna", "💉|syringe", "🩸|blood", "💊|pill", "🩹|adhesive bandage", "🩺|stethoscope", "🚪|door",
                    "🛗|elevator", "🪞|mirror", "🪟|window", "🛏️|bed", "🛋️|couch", "🪑|chair", "🚽|toilet", "🪠|plunger", "🚿|shower", "🛁|bathtub", "🪤|mouse trap", "🪒|razor", "🧴|lotion bottle", "🧷|safety pin",
                    "🧹|broom", "🧺|basket", "🧻|roll of paper", "🪣|bucket", "🧼|soap", "🫧|bubbles", "🪥|toothbrush", "🧽|sponge", "🧯|fire extinguisher", "🛒|shopping cart", "🚬|cigarette", "⚰️|coffin",
                    "🪦|headstone", "⚱️|funeral urn", "🧿|nazar amulet", "🪬|hamsa", "🗿|moai"
                ],
                'symbols': [
                    "❤️|red heart love", "🧡|orange heart", "💛|yellow heart", "💚|green heart", "💙|blue heart", "💜|purple heart", "🖤|black heart", "🤍|white heart", "🤎|brown heart", "💔|broken heart", "💘|heart with arrow", "💝|heart with ribbon", "💖|sparkling heart", "💗|growing heart", "💓|beating heart", "💞|revolving hearts", "💕|two hearts", "💟|heart decoration", "❣️|heart exclamation", "💯|hundred points", "💢|anger symbol", "💥|collision", "💫|dizzy", "💦|sweat droplets", "💨|dashing away", "🕳️|hole", "💣|bomb", "💬|speech balloon", "👁️‍🗨️|eye in speech bubble", "🗨️|left speech bubble", "🗯️|right anger bubble", "💭|thought balloon", "💤|zzz sleep"
                ],
                'flags': [
                    "🏁|checkered flag", "🚩|triangular flag", "🎌|crossed flags", "🏴|black flag", "🏳️|white flag", "🏳️‍🌈|rainbow flag pride", "🏳️‍⚧️|transgender flag",
                    "🏴‍☠️|pirate flag", "🇺🇳|united nations", "🇦🇫|afghanistan", "🇦🇱|albania", "🇩🇿|algeria", "🇦🇸|american samoa", "🇦🇩|andorra", "🇦🇴|angola", "🇦🇮|anguilla", "🇦🇶|antarctica",
                    "🇦🇬|antigua & barbuda", "🇦🇷|argentina", "🇦🇲|armenia", "🇦🇼|aruba", "🇦🇺|australia", "🇦🇹|austria", "🇦🇿|azerbaijan", "🇧🇸|bahamas", "🇧🇭|bahrain", "🇧🇩|bangladesh", "🇧🇧|barbados",
                    "🇧🇾|belarus", "🇧🇪|belgium", "🇧🇿|belize", "🇧🇯|benin", "🇧🇲|bermuda", "🇧🇹|bhutan", "🇧🇴|bolivia", "🇧🇦|bosnia & herzegovina", "🇧🇼|botswana", "🇧🇷|brazil", "🇮🇴|british indian ocean territory",
                    "🇻🇬|british virgin islands", "🇧🇳|brunei", "🇧🇬|bulgaria", "🇧🇫|burkina faso", "🇧🇮|burundi", "🇰🇭|cambodia", "🇨🇲|cameroon", "🇨🇦|canada", "🇮🇨|canary islands", "🇨🇻|cape verde",
                    "🇧🇶|caribbean netherlands", "🇰🇾|cayman islands", "🇨🇫|central african republic", "🇹🇩|chad", "🇨🇱|chile", "🇨🇳|china", "🇨🇽|christmas island", "🇨🇨|cocos (keeling) islands",
                    "🇨🇴|colombia", "🇰🇲|comoros", "🇨🇬|congo - brazzaville", "🇨🇩|congo - kinshasa", "🇨🇰|cook islands", "🇨🇷|costa rica", "🇨🇮|cote d’ivoire", "🇭🇷|croatia", "🇨🇺|cuba", "🇨🇼|curacao",
                    "🇨🇾|cyprus", "🇨🇿|czechia", "🇩🇰|denmark", "🇩🇯|djibouti", "🇩🇲|dominica", "🇩🇴|dominican republic", "🇪🇨|ecuador", "🇪🇬|egypt", "🇸🇻|el salvador", "🇬🇶|equatorial guinea",
                    "🇪🇷|eritrea", "🇪🇪|estonia", "🇸🇿|eswatini", "🇪🇹|ethiopia", "🇪🇺|european union", "🇫🇰|falkland islands", "🇫🇴|faroe islands", "🇫🇯|fiji", "🇫🇮|finland", "🇫🇷|france",
                    "🇬🇫|french guiana", "🇵🇫|french polynesia", "🇹🇫|french southern territories", "🇬🇦|gabon", "🇬🇲|gambia", "🇬🇪|georgia", "🇩🇪|germany", "🇬🇭|ghana", "🇬🇮|gibraltar", "🇮🇳|india",
                    "🇺🇸|usa united states", "🇬🇧|uk united kingdom", "🇯🇵|japan"
                ]
            };

            const results = [];
            Object.keys(dataset).forEach(group => {
                dataset[group].forEach(entry => {
                    const parts = entry.split('|');
                    const char = parts[0];
                    const keywords = parts[1] || ''; // Handle missing keywords

                    results.push({
                        character: char,
                        unicodeName: keywords || char, // Fallback to char if no name
                        slug: (keywords || char).replace(/ /g, '-'),
                        group: group,
                        subGroup: (group === 'flags') ? 'country-flag' : 'other'
                    });
                });
            });
            return results;
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
