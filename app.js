// 1. SETUP SUPABASE
const supabaseUrl = 'https://oiexwinhieyextiuuywu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXh3aW5oaWV5ZXh0aXV1eXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTU1MDUsImV4cCI6MjA5MzA5MTUwNX0.LCYPVX21XxfyiwA5LSIq_6JR9xHTBXzSTgYILdnzJp0';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let transactions = [];
let wallets = [];
let categories = [];
let chartInstance = null;
let editingId = null;
let currentSubItems = []; // Array of { id, name, amount } for active form
const expandedReceipts = new Set(); // Set of transaction IDs with open receipt accordion

// ================= AUTHENTICATION LOGIC =================
db.auth.getSession().then(({ data: { session } }) => {
    if (session) { showApp(); } 
    else { showLogin(); }
});

db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') showApp();
    if (event === 'SIGNED_OUT') showLogin();
});

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden', 'opacity-0');
    const app = document.getElementById('appContainer');
    app.classList.remove('hidden');
    setTimeout(() => app.classList.remove('opacity-0'), 50);
    initApp();
}

function showLogin() {
    const app = document.getElementById('appContainer');
    app.classList.add('hidden', 'opacity-0');
    const loginSec = document.getElementById('loginScreen');
    loginSec.classList.remove('hidden');
    setTimeout(() => loginSec.classList.remove('opacity-0'), 50);
}

// Fungsi Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    btn.innerHTML = "Memeriksa... <span class='animate-pulse'>⏳</span>";
    btn.disabled = true;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    
    if (error) {
        showAlert("Akses Ditolak", "Email atau Password kamu salah Bos!", "error");
        btn.innerHTML = "Masuk <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1'></path></svg>";
        btn.disabled = false;
    } else {
        document.getElementById('loginForm').reset();
        btn.innerHTML = "Masuk...";
        btn.disabled = false;
    }
});

// Fungsi Logout
window.handleLogout = async () => {
    triggerHaptic();
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
        title: 'Keluar?',
        text: "Yakin mau kunci aplikasi ini?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#FF3B30',
        cancelButtonColor: isDark ? '#333' : '#E5E5EA', 
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        background: isDark ? '#1a1a1a' : '#fff',
        color: isDark ? '#fff' : '#000'
    });
    if (result.isConfirmed) {
        await db.auth.signOut();
        transactions = [];
        wallets = [];
        categories = [];
        currentSubItems = [];
    }
};

// ================= UTILITIES & HELPERS =================
const triggerHaptic = () => { if (navigator.vibrate) navigator.vibrate(40); };

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
}).format(Number(angka) || 0);

const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
});

const showAlert = (title, text, icon) => {
    if (typeof Swal !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark');
        Swal.fire({ 
            title, 
            text, 
            icon, 
            confirmButtonColor: '#FF3B30', 
            background: isDark ? '#1a1a1a' : '#ffffff', 
            color: isDark ? '#ffffff' : '#000000' 
        });
    } else {
        alert(`${title}\n${text}`);
    }
};

const setGreeting = () => {
    const hour = new Date().getHours();
    let greet = 'Halo,';
    if (hour >= 5 && hour < 11) greet = 'Selamat Pagi,';
    else if (hour >= 11 && hour < 15) greet = 'Selamat Siang,';
    else if (hour >= 15 && hour < 18) greet = 'Selamat Sore,';
    else greet = 'Selamat Malam,';
    document.getElementById('greetingText').innerText = greet;
};

// ================= APP INITIALIZATION =================
async function initApp() {
    setGreeting();
    document.getElementById('date').valueAsDate = new Date();
    setupEventListeners();
    renderSubItems();
    await fetchWalletsAndCategories();
    await fetchTransactions();
}

// ================= DATA FETCHING =================
async function fetchWalletsAndCategories() {
    try {
        const [resWallets, resCategories] = await Promise.all([
            db.from('wallets').select('*').order('created_at', { ascending: true }),
            db.from('categories').select('*').order('created_at', { ascending: true })
        ]);
        if (resWallets.error) throw resWallets.error;
        if (resCategories.error) throw resCategories.error;
        
        wallets = resWallets.data || [];
        categories = resCategories.data || [];

        updateWalletDropdowns();
        updateCategoryDropdown();
    } catch (err) { 
        console.error('Error fetching wallets/categories:', err); 
    }
}

function updateWalletDropdowns() {
    const walletSelect = document.getElementById('wallet');
    const filterWalletSelect = document.getElementById('filterWallet');
    const currentFilterWallet = filterWalletSelect ? filterWalletSelect.value : 'all';

    walletSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    
    if (filterWalletSelect) {
        filterWalletSelect.innerHTML = `<option value="all">Semua Dompet</option>` + 
            wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
        filterWalletSelect.value = currentFilterWallet;
    }
}

function updateCategoryDropdown() {
    const catSelect = document.getElementById('category');
    const expenseCats = categories.filter(c => !c.type || c.type === 'expense');
    const displayCats = expenseCats.length > 0 ? expenseCats : categories;
    catSelect.innerHTML = displayCats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function fetchTransactions() {
    try {
        const { data, error } = await db
            .from('transactions')
            .select(`*, wallets ( name ), categories ( name )`)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Parse items JSON safely
        transactions = (data || []).map(t => {
            let parsedItems = [];
            if (Array.isArray(t.items)) {
                parsedItems = t.items;
            } else if (typeof t.items === 'string' && t.items.trim() !== '') {
                try { parsedItems = JSON.parse(t.items); } catch(e) { parsedItems = []; }
            }
            return {
                ...t,
                items: parsedItems
            };
        });

        renderApp();
    } catch (err) { 
        console.error('Error fetching transactions:', err); 
    }
}

// ================= SUB-ITEMS (RINCIAN NOTA) LOGIC =================
window.addSubItem = (name = '', amount = '') => {
    triggerHaptic();
    currentSubItems.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: name,
        amount: amount
    });
    renderSubItems();
    if (amount !== '') {
        recalculateTotalFromSubItems();
    }
    
    // Focus ke input nama item baru
    setTimeout(() => {
        const rows = document.querySelectorAll('.sub-item-row');
        if (rows.length > 0) {
            const lastRowInput = rows[rows.length - 1].querySelector('input[type="text"]');
            if (lastRowInput) lastRowInput.focus();
        }
    }, 50);
};

window.removeSubItem = (index) => {
    triggerHaptic();
    currentSubItems.splice(index, 1);
    renderSubItems();
    recalculateTotalFromSubItems();
};

window.updateSubItemField = (index, field, value) => {
    if (!currentSubItems[index]) return;
    currentSubItems[index][field] = value;
    if (field === 'amount') {
        recalculateTotalFromSubItems();
    }
};

function recalculateTotalFromSubItems() {
    if (currentSubItems.length === 0) return;
    const sum = currentSubItems.reduce((acc, curr) => {
        const val = Number(curr.amount);
        return acc + (isNaN(val) ? 0 : val);
    }, 0);
    
    if (sum > 0) {
        document.getElementById('amount').value = sum;
    }
}

// Render Sub-Items secara Atas-Bawah (Anti Overflow)
function renderSubItems() {
    const container = document.getElementById('subItemsList');
    if (!container) return;

    if (currentSubItems.length === 0) {
        container.innerHTML = `
            <div class="py-2.5 px-3 rounded-xl bg-white/40 dark:bg-black/40 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">
                Belum ada rincian nota. Klik <span class="text-[#007AFF] font-bold cursor-pointer hover:underline" onclick="addSubItem()">+ Tambah Item</span> untuk merinci pengeluaran.
            </div>
        `;
        return;
    }

    container.innerHTML = currentSubItems.map((item, idx) => `
        <div class="sub-item-row p-3 rounded-2xl bg-white/70 dark:bg-black/60 border border-gray-200/70 dark:border-[#2a2a2a] animate-fade-in shadow-sm space-y-2">
            <div class="flex items-center justify-between gap-2">
                <input type="text" 
                       value="${escapeHtml(item.name || '')}" 
                       placeholder="Nama item..." 
                       oninput="updateSubItemField(${idx}, 'name', this.value)"
                       class="w-full px-2 py-1 text-sm font-semibold bg-transparent border-b border-transparent focus:border-[#FF3B30] outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500">
                
                <button type="button" 
                        onclick="removeSubItem(${idx})" 
                        class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shrink-0 active-click"
                        title="Hapus baris item">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="relative w-full">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rp</span>
                <input type="number" 
                       value="${item.amount !== '' ? item.amount : ''}" 
                       placeholder="0" 
                       onwheel="this.blur()"
                       oninput="updateSubItemField(${idx}, 'amount', this.value)"
                       class="w-full pl-9 pr-3 py-2 text-sm font-bold bg-black/5 dark:bg-white/5 rounded-xl border border-transparent focus:border-[#FF3B30] outline-none transition-all placeholder:font-normal">
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Toggle accordion rincian nota pada riwayat transaksi
window.toggleReceipt = (id) => {
    triggerHaptic();
    const receiptBox = document.getElementById(`receipt-${id}`);
    const toggleIcon = document.getElementById(`receipt-toggle-icon-${id}`);
    
    if (expandedReceipts.has(id)) {
        expandedReceipts.delete(id);
        if (receiptBox) receiptBox.classList.add('hidden');
        if (toggleIcon) toggleIcon.innerText = '▾';
    } else {
        expandedReceipts.add(id);
        if (receiptBox) receiptBox.classList.remove('hidden');
        if (toggleIcon) toggleIcon.innerText = '▴';
    }
};

// ================= RENDER APLIKASI UTAMA =================
function renderApp() {
    const filterTime = document.getElementById('filterTime').value;
    const filterWallet = document.getElementById('filterWallet') ? document.getElementById('filterWallet').value : 'all';
    const searchQuery = document.getElementById('searchFilter') ? document.getElementById('searchFilter').value.trim().toLowerCase() : '';

    let filteredTransactions = transactions;

    // Filter Waktu
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    const periodBadge = document.getElementById('periodBadge');
    if (filterTime === 'today') {
        filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= today);
        if (periodBadge) periodBadge.innerText = 'Hari Ini';
    } else if (filterTime === 'week') {
        const last7Days = new Date(today); 
        last7Days.setDate(last7Days.getDate() - 7); 
        filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= last7Days);
        if (periodBadge) periodBadge.innerText = '7 Hari Terakhir';
    } else if (filterTime === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); 
        filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= startOfMonth);
        if (periodBadge) periodBadge.innerText = 'Bulan Ini';
    } else {
        if (periodBadge) periodBadge.innerText = 'Semua Waktu';
    }

    // Filter Dompet
    if (filterWallet !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.wallet_id === filterWallet);
    }

    // Filter Pencarian (Cari Catatan, Kategori, Dompet, atau Nama Sub-Item)
    if (searchQuery !== '') {
        filteredTransactions = filteredTransactions.filter(t => {
            const catName = (t.categories ? t.categories.name : '').toLowerCase();
            const walletName = (t.wallets ? t.wallets.name : '').toLowerCase();
            const notes = (t.notes || '').toLowerCase();
            const hasSubItemMatch = Array.isArray(t.items) && t.items.some(item => (item.name || '').toLowerCase().includes(searchQuery));
            return catName.includes(searchQuery) || walletName.includes(searchQuery) || notes.includes(searchQuery) || hasSubItemMatch;
        });
    }

    // Hitung Total Pengeluaran
    let totalExpense = 0;
    const categoryTotals = {};

    filteredTransactions.forEach(t => {
        const amount = Number(t.amount) || 0;
        const catName = t.categories ? t.categories.name : 'Lain-lain';
        totalExpense += amount;
        if (!categoryTotals[catName]) {
            categoryTotals[catName] = 0;
        }
        categoryTotals[catName] += amount;
    });

    const txCount = filteredTransactions.length;

    // Update Highlight Dashboard Card
    document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);
    const txCountEl = document.getElementById('txCount');
    if (txCountEl) txCountEl.innerText = `${txCount} Transaksi`;

    // Render Riwayat Transaksi
    const listContainer = document.getElementById('transactionList');
    listContainer.innerHTML = '';

    if (filteredTransactions.length === 0) {
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 opacity-60">
                <svg class="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                <p class="text-center font-bold text-lg">Belum Ada Pengeluaran</p>
                <p class="text-center text-sm font-medium text-gray-500">Tidak ada data pengeluaran pada filter saat ini.</p>
            </div>
        `;
    }

    let lastDateGroup = '';

    filteredTransactions.forEach((t, index) => {
        const catName = t.categories ? t.categories.name : 'Umum';
        const walletName = t.wallets ? t.wallets.name : 'Dompet';
        const hasSubItems = Array.isArray(t.items) && t.items.length > 0;
        const isExpanded = expandedReceipts.has(t.id);

        // Header Pengelompokan Tanggal
        const currentDateGroup = formatDate(t.date);
        if (currentDateGroup !== lastDateGroup) {
            lastDateGroup = currentDateGroup;
            const dateHeader = document.createElement('div');
            dateHeader.className = `text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] pt-5 pb-2 pl-1 animate-fade-in flex items-center justify-between`;
            dateHeader.style.animationDelay = `${index * 0.02}s`;
            dateHeader.innerHTML = `<span>${currentDateGroup}</span>`;
            listContainer.appendChild(dateHeader);
        }

        const item = document.createElement('div');
        item.className = `transaction-item p-5 rounded-[1.75rem] bg-white/70 dark:bg-[#111]/80 backdrop-blur-md border border-gray-100 dark:border-[#222] animate-fade-in shadow-sm space-y-3`;
        item.style.animationDelay = `${index * 0.03}s`;

        // Sub-items receipt HTML
        let receiptHtml = '';
        if (hasSubItems) {
            receiptHtml = `
                <div id="receipt-${t.id}" class="${isExpanded ? '' : 'hidden'} mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-[#2a2a2a] animate-fade-in">
                    <div class="receipt-paper pl-3 py-1.5 space-y-1.5 bg-gray-50/60 dark:bg-black/30 rounded-r-xl">
                        <div class="flex items-center justify-between text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                            <span>Item Rincian</span>
                            <span>Nominal</span>
                        </div>
                        ${t.items.map(sub => `
                            <div class="flex justify-between items-center text-xs font-medium">
                                <span class="text-gray-700 dark:text-gray-300">• ${escapeHtml(sub.name || 'Item')}</span>
                                <span class="font-bold text-gray-800 dark:text-gray-200">${formatRupiah(sub.amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="flex justify-between items-start gap-3">
                <div class="flex items-start gap-3.5 flex-1 min-w-0">
                    <div class="w-11 h-11 rounded-2xl flex items-center justify-center bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0 mt-0.5 shadow-sm">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-extrabold text-base md:text-lg tracking-tight leading-tight text-gray-900 dark:text-white truncate">${catName}</h4>
                            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#222] text-gray-500 dark:text-gray-400 uppercase tracking-wider">${walletName}</span>
                        </div>
                        
                        ${t.notes ? `<p class="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">${escapeHtml(t.notes)}</p>` : ''}
                        
                        ${hasSubItems ? `
                            <button onclick="toggleReceipt('${t.id}')" class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#FF3B30] text-xs font-bold hover:opacity-80 active-click transition-all border border-red-200/50 dark:border-red-900/30">
                                <span>🧾 ${t.items.length} Rincian Nota</span>
                                <span id="receipt-toggle-icon-${t.id}" class="text-xs font-black">${isExpanded ? '▴' : '▾'}</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="flex flex-col items-end shrink-0">
                    <p class="font-extrabold text-[#FF3B30] text-base md:text-lg tracking-tight whitespace-nowrap mb-2">- ${formatRupiah(t.amount)}</p>
                    <div class="flex items-center gap-1.5">
                        <button onclick="editTransaction('${t.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#007AFF] hover:bg-blue-100 active-click transition-colors" title="Edit Transaksi">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="deleteTransaction('${t.id}')" class="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-[#FF3B30] hover:bg-red-100 active-click transition-colors" title="Hapus Transaksi">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
            ${receiptHtml}
        `;
        listContainer.appendChild(item);
    });

    updateChart(categoryTotals, totalExpense);
    renderCategoryLevels(categoryTotals, totalExpense);
}

// ================= CHART & LEVEL KATEGORI =================
const chartPalette = [
    '#FF3B30', '#FF9500', '#FFCC00', '#34C759', 
    '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', 
    '#5AC8FA', '#30B0C7', '#A2845E', '#8E8E93'
];

function updateChart(categoryTotals, totalExpense) {
    const canvas = document.getElementById('financeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = Object.keys(categoryTotals);
    const dataValues = labels.map(l => categoryTotals[l]);
    const isDark = document.documentElement.classList.contains('dark');

    if (labels.length === 0 || totalExpense === 0) {
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Belum ada pengeluaran'],
                datasets: [{
                    data: [1],
                    backgroundColor: [isDark ? '#222' : '#e5e7eb'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
        return;
    }

    const backgroundColors = labels.map((_, i) => chartPalette[i % chartPalette.length]);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: backgroundColors,
                borderWidth: isDark ? 2 : 3,
                borderColor: isDark ? '#000' : '#fff',
                hoverOffset: 6,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            cutout: '72%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: isDark ? '#fff' : '#000',
                        padding: 12,
                        boxWidth: 10,
                        usePointStyle: true,
                        font: { family: 'Inter', weight: '600', size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed || 0;
                            const pct = totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0;
                            return ` ${context.label}: ${formatRupiah(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderCategoryLevels(categoryTotals, totalExpense) {
    const container = document.getElementById('categoryStats');
    if (!container) return;

    const categoriesArr = Object.keys(categoryTotals)
        .map(name => ({ name, amount: categoryTotals[name] }))
        .sort((a, b) => b.amount - a.amount);

    if (categoriesArr.length === 0 || totalExpense === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium">Belum ada data pengeluaran.</p>';
        return;
    }

    container.innerHTML = categoriesArr.map((cat, index) => {
        const percentage = totalExpense === 0 ? 0 : Math.round((cat.amount / totalExpense) * 100);
        const color = chartPalette[index % chartPalette.length];
        return `
            <div class="mb-3.5 animate-fade-in" style="animation-delay: ${index * 0.05}s">
                <div class="flex justify-between text-xs font-bold mb-1.5 uppercase tracking-wider">
                    <span class="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${color}"></span>
                        ${cat.name}
                    </span>
                    <span class="text-gray-900 dark:text-white font-extrabold">${percentage}%</span>
                </div>
                <div class="w-full bg-black/5 dark:bg-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <div class="h-2.5 rounded-full animate-fill-bar shadow-sm" style="width: ${percentage}%; background-color: ${color}"></div>
                </div>
                <p class="text-[10px] font-bold text-gray-400 mt-1 text-right">${formatRupiah(cat.amount)}</p>
            </div>
        `;
    }).join('');
}

// ================= TAMBAH / EDIT TRANSAKSI =================
async function addTransaction(e) {
    e.preventDefault();
    triggerHaptic();

    const categoryId = document.getElementById('category').value;
    const walletId = document.getElementById('wallet').value;
    const amount = document.getElementById('amount').value;
    const date = document.getElementById('date').value;
    const notes = document.getElementById('notes').value;

    if (!categoryId || !walletId) {
        showAlert("Oops!", "Pilih Kategori dan Dompet dulu!", "warning");
        return;
    }
    if (!amount || Number(amount) <= 0) {
        showAlert("Oops!", "Masukkan jumlah pengeluaran yang valid!", "warning");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = "Menyimpan... <span class='animate-pulse'>⏳</span>";
    submitBtn.disabled = true;

    // Bersihkan sub-items (ambil yang memiliki nama atau nominal)
    const cleanedItems = currentSubItems
        .filter(item => (item.name && item.name.trim() !== '') || (item.amount && Number(item.amount) > 0))
        .map(item => ({
            name: (item.name || '').trim(),
            amount: Number(item.amount) || 0
        }));

    const txData = {
        type: 'expense',
        amount: Number(amount),
        category_id: categoryId,
        wallet_id: walletId,
        date: date,
        notes: notes,
        items: cleanedItems
    };

    let error;
    if (editingId) {
        const res = await db.from('transactions').update(txData).eq('id', editingId);
        error = res.error;
    } else {
        const res = await db.from('transactions').insert([txData]);
        error = res.error;
    }

    if (error) {
        console.error('Error saving transaction:', error);
        if (error.message && error.message.includes('items')) {
            showAlert("Info Supabase", "Kolom 'items' belum ada di tabel 'transactions' Supabase. Silakan jalankan script SQL di SQL Editor Supabase terlebih dahulu.", "warning");
        } else {
            showAlert("Error!", `Gagal menyimpan: ${error.message || 'Coba lagi.'}`, "error");
        }
    } else {
        cancelEdit();
        await fetchTransactions();
        showAlert("Sukses!", "Pengeluaran berhasil disimpan mulus.", "success");
    }

    submitBtn.innerHTML = "Simpan <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'></path></svg>";
    submitBtn.disabled = false;
}

window.editTransaction = (id) => {
    try {
        triggerHaptic();
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        editingId = id;

        document.getElementById('formTitle').innerText = "Edit Pengeluaran";
        document.getElementById('amount').value = tx.amount;
        document.getElementById('category').value = tx.category_id;
        document.getElementById('wallet').value = tx.wallet_id;
        document.getElementById('date').value = tx.date;

        const notesEl = document.getElementById('notes');
        notesEl.value = tx.notes || '';
        notesEl.style.height = 'auto';
        notesEl.style.height = notesEl.scrollHeight + 'px';

        // Load sub-items
        currentSubItems = Array.isArray(tx.items) ? JSON.parse(JSON.stringify(tx.items)) : [];
        renderSubItems();

        document.getElementById('submitBtn').innerHTML = "Update <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'></path></svg>";
        document.getElementById('cancelEditBtn').classList.remove('hidden');

        const formSec = document.getElementById('formSection');
        formSec.scrollIntoView({ behavior: 'smooth' });
        formSec.classList.add('ring-4', 'ring-[#FF3B30]', 'scale-[1.02]');
        setTimeout(() => formSec.classList.remove('ring-4', 'ring-[#FF3B30]', 'scale-[1.02]'), 800);
    } catch (err) { 
        console.error('Error editing transaction:', err); 
    }
};

window.cancelEdit = () => {
    editingId = null;
    currentSubItems = [];
    document.getElementById('formTitle').innerText = "Catat Pengeluaran";
    document.getElementById('transactionForm').reset();
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('notes').style.height = 'auto';
    renderSubItems();
    document.getElementById('submitBtn').innerHTML = "Simpan <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'></path></svg>";
    document.getElementById('cancelEditBtn').classList.add('hidden');
};

window.deleteTransaction = async (id) => {
    try {
        triggerHaptic();
        const isDark = document.documentElement.classList.contains('dark');
        const result = await Swal.fire({
            title: 'Hapus data ini?',
            text: "Data pengeluaran bakal hilang permanen!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#FF3B30',
            cancelButtonColor: isDark ? '#333' : '#E5E5EA',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
            background: isDark ? '#1a1a1a' : '#fff',
            color: isDark ? '#fff' : '#000'
        });
        if (result.isConfirmed) {
            const { error } = await db.from('transactions').delete().eq('id', id);
            if (error) {
                showAlert("Error!", "Gagal menghapus.", "error");
            } else {
                expandedReceipts.delete(id);
                await fetchTransactions();
                Swal.fire({
                    title: 'Terhapus!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    background: isDark ? '#1a1a1a' : '#fff',
                    color: isDark ? '#fff' : '#000'
                });
            }
        }
    } catch (err) { 
        console.error('Error deleting transaction:', err); 
    }
};

// ================= MODAL KELOLA DOMPET & KATEGORI =================
window.openModal = (id) => {
    triggerHaptic();
    const modal = document.getElementById(id);
    const modalContent = modal.querySelector('div');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('modal-active');
        modalContent.classList.add('modal-scale-up');
    }, 10);
    if (id === 'walletModal') renderWalletList();
    if (id === 'categoryModal') renderCategoryList();
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    const modalContent = modal.querySelector('div');
    modal.classList.remove('modal-active');
    modalContent.classList.remove('modal-scale-up');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// Modal Dompet
function renderWalletList() {
    const list = document.getElementById('modalWalletList');
    list.innerHTML = wallets.map(w => `
        <div class="modal-item flex justify-between items-center p-4 bg-gray-50/50 dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#333]">
            <span class="font-bold">${escapeHtml(w.name)}</span>
            <button onclick="deleteWallet('${w.id}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors" title="Hapus Dompet">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    `).join('');
}

window.addWallet = async () => {
    const name = document.getElementById('newWalletName').value.trim();
    if (!name) return;
    const { error } = await db.from('wallets').insert([{ name }]);
    if (!error) {
        document.getElementById('newWalletName').value = '';
        await fetchWalletsAndCategories();
        renderWalletList();
    } else {
        showAlert("Error!", error.message, "error");
    }
};

window.deleteWallet = async (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
        title: 'Hapus dompet?',
        text: 'Transaksi terkait dengan dompet ini bisa terpengaruh!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FF3B30',
        cancelButtonColor: isDark ? '#333' : '#E5E5EA',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: isDark ? '#1a1a1a' : '#fff',
        color: isDark ? '#fff' : '#000'
    });
    if (result.isConfirmed) {
        const { error } = await db.from('wallets').delete().eq('id', id);
        if (!error) {
            await fetchWalletsAndCategories();
            await fetchTransactions();
            renderWalletList();
        } else {
            showAlert("Error!", error.message, "error");
        }
    }
};

// Modal Kategori
function renderCategoryList() {
    const list = document.getElementById('modalCategoryList');
    list.innerHTML = categories.map(c => `
        <div class="modal-item flex justify-between items-center p-4 bg-gray-50/50 dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#333]">
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-lg uppercase ${c.type === 'expense' || !c.type ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' : 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'}">${c.type || 'expense'}</span>
                <span class="font-bold">${escapeHtml(c.name)}</span>
            </div>
            <button onclick="deleteCategory('${c.id}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors" title="Hapus Kategori">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    `).join('');
}

window.addCategory = async () => {
    const name = document.getElementById('newCategoryName').value.trim();
    if (!name) return;
    const { error } = await db.from('categories').insert([{ name, type: 'expense' }]);
    if (!error) {
        document.getElementById('newCategoryName').value = '';
        await fetchWalletsAndCategories();
        renderCategoryList();
    } else {
        showAlert("Error!", error.message, "error");
    }
};

window.deleteCategory = async (id) => {
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
        title: 'Hapus kategori?',
        text: 'Transaksi terkait dengan kategori ini bisa terpengaruh!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FF3B30',
        cancelButtonColor: isDark ? '#333' : '#E5E5EA',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: isDark ? '#1a1a1a' : '#fff',
        color: isDark ? '#fff' : '#000'
    });
    if (result.isConfirmed) {
        const { error } = await db.from('categories').delete().eq('id', id);
        if (!error) {
            await fetchWalletsAndCategories();
            await fetchTransactions();
            renderCategoryList();
        } else {
            showAlert("Error!", error.message, "error");
        }
    }
};

// ================= EVENT LISTENERS =================
function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    
    document.getElementById('filterTime').addEventListener('change', renderApp);
    const filterWallet = document.getElementById('filterWallet');
    if (filterWallet) filterWallet.addEventListener('change', renderApp);
    
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) searchFilter.addEventListener('input', renderApp);

    // Mencegah scroll mouse mengubah nilai di seluruh input number
    document.addEventListener('wheel', (e) => {
        if (document.activeElement && document.activeElement.type === 'number') {
            document.activeElement.blur();
        }
    }, { passive: true });

    const darkModeBtn = document.getElementById('darkModeToggle');
    const htmlTag = document.documentElement;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        htmlTag.classList.add('dark');
    }
    darkModeBtn.addEventListener('click', () => {
        triggerHaptic();
        htmlTag.classList.toggle('dark');
        if (transactions.length > 0 || chartInstance) {
            renderApp();
        }
    });
}