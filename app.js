// ==================== ГРУППОВОЙ КАТАЛОГ С SCROLL SPY ====================


let productsData = {};
let allProducts = [];
let productsByGroup = {};    

let currentProduct = null;
let modalMode = 'catalog';
let currentCartIndex = null;

// Fetch products from Google Sheets
async function fetchProducts() {
    const res = await fetch("https://script.google.com/macros/s/AKfycbxgoLRxCH-sRFYarW2S2Sz15zZUCQETk8vG3HZdsdom0P-GZMcvfGEc7oBt4mrNhNQrDQ/exec");
    productsData = await res.json();
    allProducts = Object.values(productsData).flat().map(product => {

        if (product.image) {
            let urls = [];
            if (product.image.includes(',')) {
                urls = product.image.split(',');
            } else if (product.image.includes(';')) {
                urls = product.image.split(';');
            } else {
                urls = [product.image];
            }
            product.images = urls.map(i => i.trim());
        } else {
            product.images = [];
        }

        console.log(product.name, JSON.stringify(product.images)); // для отладки

        return product;
    });

    groupProductsByGroup();
    renderGroupedProducts();
    renderGroupButtons();
    setupScrollSpy();
    hideLoader();
}

// Группировка товаров по полю group
function groupProductsByGroup() {
    productsByGroup = {};
    
    allProducts.forEach(product => {
        const group = product.group || 'Без категории';
        if (!productsByGroup[group]) {
            productsByGroup[group] = [];
        }
        productsByGroup[group].push(product);
    });
}

// Рендер кнопок групп
function renderGroupButtons() {
    const nav = document.getElementById('groups-nav');
    nav.innerHTML = '';
    
    Object.keys(productsByGroup).forEach(group => {
        const btn = document.createElement('button');
        btn.className = 'group-btn';
        btn.textContent = group;
        btn.dataset.group = group;
        
        btn.addEventListener('click', () => {
            scrollToGroup(group);
        });
        
        nav.appendChild(btn);
    });
    
    // Сделать первую кнопку активной
    const firstBtn = nav.querySelector('.group-btn');
    if (firstBtn) {
        firstBtn.classList.add('active');
    }
}

// Рендер товаров по группам
function renderGroupedProducts() {
    const container = document.getElementById('products-by-groups');
    container.innerHTML = '';
    
    Object.entries(productsByGroup).forEach(([group, products]) => {
        const section = document.createElement('div');
        section.className = 'product-group-section';
        section.dataset.group = group;
        
        const title = document.createElement('h2');
        title.className = 'group-title';
        title.textContent = group;
        
        const grid = document.createElement('div');
        grid.className = 'products-grid';
        
        products.forEach(product => {
            grid.appendChild(createProductCard(product));
        });
        
        section.appendChild(title);
        section.appendChild(grid);
        container.appendChild(section);
    });
}

// Scroll Spy - отслеживание видимой группы
function setupScrollSpy() {
    const mainContent = document.querySelector('.main-content');
    const sections = document.querySelectorAll('.product-group-section');
    const groupButtons = document.querySelectorAll('.group-btn');
    
    let isScrollingProgrammatically = false;
    let scrollTimeout = null;
    
    function updateActiveGroup() {
        if (isScrollingProgrammatically) return;
        
        const scrollPosition = mainContent.scrollTop + 180; // Учитываем sticky header + немного отступа
        
        let activeSection = null;
        let minDistance = Infinity;
        
        // Находим секцию, которая ближе всего к верху видимой области
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const distance = Math.abs(scrollPosition - sectionTop);
            
            if (scrollPosition >= sectionTop - 50 && distance < minDistance) {
                minDistance = distance;
                activeSection = section;
            }
        });
        
        // Если не нашли, берём первую видимую
        if (!activeSection) {
            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                const containerRect = mainContent.getBoundingClientRect();
                
                if (rect.top < containerRect.height / 2 && rect.bottom > 180) {
                    activeSection = section;
                }
            });
        }
        
        if (activeSection) {
            const group = activeSection.dataset.group;
            
            // Обновляем активную кнопку
            groupButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.group === group);
            });
            
            // Прокручиваем кнопку в видимую область
            const activeBtn = document.querySelector(`.group-btn[data-group="${group}"]`);
            if (activeBtn) {
                activeBtn.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        }
    }
    
    // Слушаем скролл
    mainContent.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateActiveGroup, 50);
    });
    
    // Начальная установка
    updateActiveGroup();
    
    // Экспортируем функции для использования при программной прокрутке
    window.scrollSpySetProgrammaticScroll = (value) => {
        isScrollingProgrammatically = value;
    };
}

// Плавная прокрутка к группе
function scrollToGroup(group) {
    const section = document.querySelector(`.product-group-section[data-group="${group}"]`);
    const mainContent = document.querySelector('.main-content');
    
    if (section && mainContent) {
        // Отключаем scroll spy на время программной прокрутки
        if (window.scrollSpySetProgrammaticScroll) {
            window.scrollSpySetProgrammaticScroll(true);
        }
        
        const offset = section.offsetTop - 140; // Учитываем sticky header
        
        mainContent.scrollTo({
            top: offset,
            behavior: 'smooth'
        });
        
        // Сразу обновляем активную кнопку
        document.querySelectorAll('.group-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.group === group);
        });
        
        // Включаем scroll spy обратно через небольшую задержку
        setTimeout(() => {
            if (window.scrollSpySetProgrammaticScroll) {
                window.scrollSpySetProgrammaticScroll(false);
            }
        }, 800);
    }
}

// Telegram WebApp initialization
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();


// State Management
const user = tg.initDataUnsafe?.user;
const CART_KEY = `cart_${user?.id}`;

let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];

let cartSyncTimer = null;
let isSyncingCart = false;
let lastCartHash = null;
let realtimeCartTimer = null;

let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });

    // Search with filtering
    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterProductsInGroups(query);
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    
    let modalTouchStart = null;
    const modal = document.getElementById('product-modal');
    
    modal.addEventListener('touchstart', (e) => {
        if (e.target.id === 'product-modal') {
            modalTouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });
    
    modal.addEventListener('touchend', (e) => {
        if (e.target.id === 'product-modal' && modalTouchStart) {
            const deltaX = Math.abs(e.changedTouches[0].clientX - modalTouchStart.x);
            const deltaY = Math.abs(e.changedTouches[0].clientY - modalTouchStart.y);
            
            if (deltaX < 10 && deltaY < 10) {
                closeModal();
            }
        }
        modalTouchStart = null;
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'product-modal') closeModal();
    });

    // Quantity Controls
    document.getElementById('qty-minus').addEventListener('click', () => {
        const input = document.getElementById('qty-input');
        let val = parseInt(input.value, 10) || 1;
        if (val > 1) input.value = val - 1;
    });

    document.getElementById('qty-plus').addEventListener('click', () => {
        const input = document.getElementById('qty-input');
        let val = parseInt(input.value, 10) || 1;
        input.value = val + 1;
    });

    // Add to Cart from Modal
    document.getElementById('modal-add-to-cart')
        .addEventListener('click', () => {
            const qty = parseInt(document.getElementById('qty-input').value, 10) || 1;

            if (modalMode === 'catalog') {
                addToCartFromModal();
                return;
            }

            if (modalMode === 'cart' && currentCartIndex !== null) {
                cart[currentCartIndex].quantity = qty;
                localStorage.setItem('cart', JSON.stringify(cart));
                renderCart();
                closeModal();
            }
        });

    // Checkout
    document.getElementById('checkout-btn').addEventListener('click', checkout);
    document.getElementById('clear-cart-top')?.addEventListener('click', () => {
        if (!confirm('Очистить корзину?')) return;

        cart = [];
        saveCart();
        updateCartBadge();
        renderCart();
    });
}

// Фильтрация товаров в группах
function filterProductsInGroups(query) {
    const sections = document.querySelectorAll('.product-group-section');
    
    if (!query) {
        // Показываем все группы и товары
        sections.forEach(section => {
            section.style.display = 'block';
            const cards = section.querySelectorAll('.product-card');
            cards.forEach(card => card.style.display = 'grid');
        });
        return;
    }
    
    sections.forEach(section => {
        const cards = section.querySelectorAll('.product-card');
        let hasVisibleProducts = false;
        
        cards.forEach(card => {
            const productName = card.querySelector('.product-name').textContent.toLowerCase();
            const matches = productName.includes(query);
            
            card.style.display = matches ? 'grid' : 'none';
            if (matches) hasVisibleProducts = true;
        });
        
        // Скрываем группу, если нет подходящих товаров
        section.style.display = hasVisibleProducts ? 'block' : 'none';
    });
}

// Page Switching
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${page}-page`).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    if (page === 'favorites') {
        loadFavorites();
    } else if (page === 'cart') {
        renderCart();
    } else if (page === 'profile') {
        loadUserOrders();
    }
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const isFavorite = favorites.includes(product.id);
    
    const images = product.images || [product.image];

    let badgeHTML = '';
    if (product.badge === 'hit') {
        badgeHTML = '<div class="product-badge hit">Хит продаж</div>';
    }
    if (product.badge === 'new') {
        badgeHTML = '<div class="product-badge new">Новинка</div>';
    }

    card.innerHTML = `
    ${badgeHTML}

    <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
        <svg viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
    </button>

    <div class="slider" data-index="0">
        <div class="slides">
            ${images.map(img => `
                <img src="${img}" class="slide">
            `).join('')}
        </div>
        <div class="dots">
            ${images.map((_, i) => `
                <span class="dot ${i === 0 ? 'active' : ''}"></span>
            `).join('')}
        </div>
    </div>

    <div class="product-price">${formatPrice(product.price)}</div>
    <div class="product-name">${product.name}</div>

    ${product.pack_qty ? `
    <div class="product-pack">
    Упаковка: ${product.pack_qty} шт<br>
    Вес: ${product.weight} кг<br>
    Куб: ${product.cube} м³
    </div>
    ` : ''}

    <button class="product-add-btn">
        <span class="btn-text">Добавить в</span>
        <svg class="cart-icon" viewBox="0 0 24 24" fill="none">
            <path d="M7 4H3V6H5L8.6 13.6L7.25 15.05C6.47 15.83 7.02 17 8.12 17H19V15H8.42L9.1 14H15.55C16.3 14 16.96 13.59 17.3 12.97L21 6H7.42L6.7 4Z" fill="currentColor"/>
            <circle cx="9" cy="21" r="1" fill="currentColor"/>
            <circle cx="20" cy="21" r="1" fill="currentColor"/>
        </svg>
    </button>
    `;
    
    card.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(product.id);
    });
    
    card.addEventListener('click', () => {
        openModal(product);
    });
    
    return card;
}

// Modal functions
function openModal(product) {
    currentProduct = product;
    modalMode = 'catalog';
    
    const modal = document.getElementById('product-modal');
    document.getElementById('modal-title').textContent = product.name;
    document.getElementById('modal-description').textContent = product.description || '';
    document.getElementById('modal-price').textContent = formatPrice(product.price);
    
    const images = product.images || [product.image];
    const modalSlides = document.getElementById('modal-slides');
    const modalDots = document.getElementById('modal-dots');
    
    modalSlides.innerHTML = images.map(img => `<img src="${img}" class="slide">`).join('');
    modalDots.innerHTML = images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
    
    const qtyInput = document.getElementById('qty-input');
    qtyInput.value = '';
    qtyInput.min = '';
    qtyInput.step = product.pack_qty || 1;
    
    modal.classList.remove('hidden');
}

function openModalFromCart(index) {
    currentCartIndex = index;
    modalMode = 'cart';
    
    const cartItem = cart[index];
    const product = allProducts.find(p => p.id === cartItem.id);
    
    if (!product) return;
    
    currentProduct = product;
    
    const modal = document.getElementById('product-modal');
    document.getElementById('modal-title').textContent = product.name;
    document.getElementById('modal-description').textContent = product.description || '';
    document.getElementById('modal-price').textContent = formatPrice(product.price);
    
    const images = product.images || [product.image];
    const modalSlides = document.getElementById('modal-slides');
    const modalDots = document.getElementById('modal-dots');
    
    modalSlides.innerHTML = images.map(img => `<img src="${img}" class="slide">`).join('');
    modalDots.innerHTML = images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
    
    document.getElementById('qty-input').value = cartItem.quantity;
    
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
    currentProduct = null;
    modalMode = 'catalog';
    currentCartIndex = null;
}

function addToCartFromModal() {
    if (!currentProduct) return;
    
    const qty = parseInt(document.getElementById('qty-input').value, 10) || 1;
    
    const existingItem = cart.find(item => item.id === currentProduct.id);
    
    if (existingItem) {
        existingItem.quantity += qty;
    } else {
        cart.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: currentProduct.price,
            image: currentProduct.images?.[0] || currentProduct.image, // ← первое фото
            quantity: qty
        });
    }
    
    saveCart();
    updateCartBadge();
    closeModal();
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
}

function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
            updateCartBadge();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    updateCartBadge();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Ваша корзина пуста</p></div>';
        summary.classList.add('hidden');
        return;
    }

    container.innerHTML = '';
    summary.classList.remove('hidden');

    let total = 0;
    let totalWeight = 0;
    let totalCube = 0;

    cart.forEach((cartItem, index) => {
        const product = allProducts.find(p => p.id === cartItem.id);
        if (!product) return;

        const itemTotal = product.price * cartItem.quantity;
        const itemWeight = (product.weight || 0) * cartItem.quantity;
        const itemCube = (product.cube || 0) * cartItem.quantity;
        total += itemTotal;
        totalWeight += (product.weight || 0) * cartItem.quantity;
        totalCube += (product.cube || 0) * cartItem.quantity;

        const el = document.createElement('div');
        el.className = 'cart-item';

        const cartImage = product.images?.[0] || product.image;

        el.innerHTML = `
            <img src="${cartImage}" class="cart-item-image">
            <div class="cart-item-info">
                <div class="cart-item-name">${product.name}</div>
               <div class="cart-item-meta">
                Упаковка: ${product.pack_qty || "-"} шт<br>
                Вес: ${itemWeight.toFixed(2)} кг<br>
                Куб: ${itemCube.toFixed(3)} м³
                </div>
                <div class="cart-item-price">
                ${formatPrice(product.price)} × ${cartItem.quantity} =
                ${formatPrice(itemTotal)}
                </div>
                <div class="cart-item-controls">
                    <button class="cart-qty-btn" data-id="${product.id}" data-change="-1">-</button>
                    <span class="cart-qty">${cartItem.quantity}</span>
                    <button class="cart-qty-btn" data-id="${product.id}" data-change="1">+</button>
                    <button class="cart-item-remove" data-id="${product.id}">Удалить</button>
                </div>
            </div>
        `;

        el.querySelectorAll('.cart-qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                updateCartQuantity(
                    parseInt(btn.dataset.id),
                    parseInt(btn.dataset.change)
                );
            });
        });

        el.querySelector('.cart-item-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromCart(product.id);
        });

        el.addEventListener('click', () => {
            openModalFromCart(index);
        });

        container.appendChild(el);
    });

    document.getElementById('cart-total-amount').innerHTML = `
    ${formatPrice(total)}<br>
    Вес: ${totalWeight.toFixed(2)} кг<br>
    Куб: ${totalCube.toFixed(3)} м³
    `;
}

async function saveCart() {

    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    if(cartSyncTimer){
        clearTimeout(cartSyncTimer);
    }

    cartSyncTimer = setTimeout(syncCartToCloud,1200);
}

async function syncCartToCloud(){

    if(isSyncingCart) return;

    try{
        isSyncingCart = true;

        await fetch(API_URL + "/cart", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                initData: tg.initData,
                cart: cart
            })
        });

    }catch(e){
        console.log("sync error", e);
    }finally{
        isSyncingCart = false;
    }
}

function getCartHash(cartData){
    return JSON.stringify(cartData);
}

async function realtimeCartSync(){

    try{

        const res = await fetch(
            API_URL + "/cart?initData=" + encodeURIComponent(tg.initData)
        );

        const cloudCart = await res.json();

        if(!Array.isArray(cloudCart)) return;

        const newHash = JSON.stringify(cloudCart);

        if(newHash === lastCartHash) return;

        lastCartHash = newHash;

        cart = cloudCart;

        localStorage.setItem(`cart_${tg.initDataUnsafe.user.id}`, JSON.stringify(cart));

        updateCartBadge();

        if(document.getElementById('cart-page').classList.contains('active')){
            renderCart();
        }

    }catch(e){
        console.log("realtime error",e);
    }
}

function startRealtimeCart(){

    if(realtimeCartTimer){
        clearInterval(realtimeCartTimer);
    }

    realtimeCartTimer = setInterval(()=>{
        realtimeCartSync();
    },5000);
}



function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    badge.textContent = count;
    
    if (count > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Favorites
function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(productId);
    }
    
    saveFavorites();

    if (document.getElementById('catalog-page').classList.contains('active')) {
        // Обновляем только кнопки избранного в текущих карточках
        updateFavoriteButtons();
    } else if (document.getElementById('favorites-page').classList.contains('active')) {
        loadFavorites();
    }
}

function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const productId = parseInt(btn.dataset.id);
        const isFavorite = favorites.includes(productId);
        
        btn.classList.toggle('active', isFavorite);
        const svg = btn.querySelector('svg');
        svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
    });
}

function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    
    if (favorites.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>У вас пока нет избранных товаров</p></div>';
        return;
    }
    
    grid.innerHTML = '';
    
    favorites.forEach(id => {
        const product = allProducts.find(p => p.id === id);
        if (product) {
            const card = createProductCard(product);
            grid.appendChild(card);
        }
    });
}

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Profile
function loadUserProfile() {
    const user = tg.initDataUnsafe?.user;
    
    if (user) {
        document.getElementById('user-name').textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
        document.getElementById('user-phone').textContent = user.username ? '@' + user.username : 'Не указан';
        document.getElementById('user-city').textContent = 'Ташкент';
    } else {
        document.getElementById('user-name').textContent = 'Гость';
        document.getElementById('user-phone').textContent = 'Не указан';
        document.getElementById('user-city').textContent = 'Не указан';
    }
}

function loadUserOrders() {
    const ordersList = document.getElementById('orders-list');
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">У вас пока нет заказов</p>';
        return;
    }
    
    ordersList.innerHTML = '';
    
    orders.forEach(order => {
        const orderEl = document.createElement('div');
        orderEl.className = 'order-item';
        orderEl.innerHTML = `
            <div class="order-id">Заказ #${order.id}</div>
            <div class="order-date">${order.date} • ${formatPrice(order.total)}</div>
        `;
        ordersList.appendChild(orderEl);
    });
}

// Checkout
function checkout() {
    if (cart.length === 0) return;
    showConfirmationDialog();
}

function showConfirmationDialog() {
    const modal = document.getElementById('confirmation-modal');
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        const confirmModal = document.getElementById('confirmation-modal');
        let confirmTouchStart = null;
        
        const handleTouchStart = (e) => {
            if (e.target.id === 'confirmation-modal') {
                confirmTouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };
        
        const handleTouchEnd = (e) => {
            if (e.target.id === 'confirmation-modal' && confirmTouchStart) {
                const deltaX = Math.abs(e.changedTouches[0].clientX - confirmTouchStart.x);
                const deltaY = Math.abs(e.changedTouches[0].clientY - confirmTouchStart.y);
                
                if (deltaX < 10 && deltaY < 10) {
                    closeConfirmationDialog();
                }
            }
            confirmTouchStart = null;
        };
        
        confirmModal.addEventListener('touchstart', handleTouchStart);
        confirmModal.addEventListener('touchend', handleTouchEnd);
    }, 100);
}

function closeConfirmationDialog() {
    const modal = document.getElementById('confirmation-modal');
    modal.classList.add('hidden');
}

function confirmCheckout() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const orderData = {
        items: cart.map(item => ({
            id: item.id,
            qty: item.quantity
        })),
        total: total,
        user: tg.initDataUnsafe?.user || null
    };
    
    tg.sendData(JSON.stringify(orderData));
    
    const orderId = Date.now();
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    orders.push({
        id: orderId,
        date: new Date().toLocaleDateString('ru-RU'),
        total: total,
        items: cart
    });
    localStorage.setItem('orders', JSON.stringify(orders));
    
    cart = [];
    saveCart();
    updateCartBadge();
    
    closeConfirmationDialog();
    switchPage('profile');
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

// Utils
function formatPrice(price) {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
}

// Slider Swipe (touch + mouse)
let sliderMouseStart = null;

document.addEventListener('touchstart', e => {
    const slider = e.target.closest('.slider');
    if (!slider) return;
    slider.startX = e.touches[0].clientX;
});

document.addEventListener('touchend', e => {
    const slider = e.target.closest('.slider');
    if (!slider) return;
    moveSlider(slider, e.changedTouches[0].clientX - slider.startX);
});

document.addEventListener('mousedown', e => {
    const slider = e.target.closest('.slider');
    if (!slider) return;
    slider.startX = e.clientX;
    sliderMouseStart = slider;
});

document.addEventListener('mouseup', e => {
    if (!sliderMouseStart) return;
    moveSlider(sliderMouseStart, e.clientX - sliderMouseStart.startX);
    sliderMouseStart = null;
});

function moveSlider(slider, diff) {
    const slides = slider.querySelector('.slides');
    const dots = slider.querySelectorAll('.dot');
    const count = slides.children.length;
    let index = +slider.dataset.index;
    if (diff < -50 && index < count - 1) index++;
    if (diff > 50 && index > 0) index--;
    slider.dataset.index = index;
    slides.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

// Zoom on tap
document.addEventListener('click', e => {
    const img = e.target.closest('.zoomable');
    if (!img) return;
    img.classList.toggle('zoomed');
});

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    setupEventListeners();
    updateCartBadge();
    loadUserProfile();
    startRealtimeCart();
});

function hideLoader(){
   const loader = document.getElementById("loader");
   if(!loader) return;
   loader.style.opacity = "0";
   setTimeout(()=>{
      loader.style.display = "none";
   },500);
}

