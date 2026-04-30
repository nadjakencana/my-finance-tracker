// 1. SETUP SUPABASE
// MASUKKAN URL DAN KEY KAMU DI SINI:
const supabaseUrl = 'https://oiexwinhieyextiuuywu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXh3aW5oaWV5ZXh0aXV1eXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTU1MDUsImV4cCI6MjA5MzA5MTUwNX0.LCYPVX21XxfyiwA5LSIq_6JR9xHTBXzSTgYILdnzJp0';
const db = supabase.createClient(supabaseUrl, supabaseKey);

// State Management
let transactions = [];
let wallets = [];
let categories = [];
let chartInstance = null;

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

// 2. FUNGSI INISIALISASI
async function initApp() {
    document.getElementById('date').valueAsDate = new Date();
    setupEventListeners(); 
    await fetchWalletsAndCategories();
    await fetchTransactions();
}

// 3. READ: Mengambil Master Data (Dipakai di Form Utama & Modal)
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

        // Update Dropdown Utama
        const walletSelect = document.getElementById('wallet');
        walletSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        updateCategoryDropdown();

    } catch (err) {
        console.error("Gagal mengambil master data:", err);
    }
}

function updateCategoryDropdown() {
    const selectedType = document.getElementById('type').value;
    const catSelect = document.getElementById('category');
    
    const filteredCats = categories.filter(c => c.type === selectedType);
    catSelect.innerHTML = filteredCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// 4. READ: Mengambil Transaksi
async function fetchTransactions() {
    try {
        let { data, error } = await db
            .from('transactions')
            .select(`*, wallets ( name ), categories ( name )`)
            .order('date', { ascending: false });

        if (error) throw error;
        transactions = data || [];
        renderApp();
    } catch (err) {
        console.error("Gagal mengambil transaksi:", err);
    }
}

// 5. UPDATE UI UTAMA
function renderApp() {
    const filterType = document.getElementById('filterType').value;
    let filteredTransactions = transactions;
    
    if (filterType !== 'all') {
        filteredTransactions = transactions.filter(t => t.type === filterType);
    }

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
        if (t.type === 'income') totalIncome += Number(t.amount);
        if (t.type === 'expense') totalExpense += Number(t.amount);
    });

    document.getElementById('totalIncome').innerText = formatRupiah(totalIncome);
    document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);
    document.getElementById('totalBalance').innerText = formatRupiah(totalIncome - totalExpense);

    const listContainer = document.getElementById('transactionList');
    listContainer.innerHTML = '';

    if (filteredTransactions.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Belum ada transaksi.</p>`;
    }

    filteredTransactions.forEach((t, index) => {
        const isIncome = t.type === 'income';
        const amountColor = isIncome ? 'text-green-500' : 'text-red-500';
        const sign = isIncome ? '+' : '-';
        
        const catName = t.categories ? t.categories.name : 'Unknown Category';
        const walletName = t.wallets ? t.wallets.name : 'Unknown Wallet';
        
        const item = document.createElement('div');
        item.className = `transaction-item p-4 rounded-2xl border border-gray-100 dark:border-nothing-border flex justify-between items-center animate-fade-in`;
        item.style.animationDelay = `${index * 0.05}s`; 
        
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full flex items-center justify-center ${isIncome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                    ${isIncome ? '↓' : '↑'}
                </div>
                <div>
                    <h4 class="font-semibold text-lg">${catName}</h4>
                    <p class="text-sm text-gray-500">${t.date} • ${walletName} ${t.notes ? '• ' + t.notes : ''}</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <p class="font-bold ${amountColor}">${sign} ${formatRupiah(t.amount)}</p>
                <button onclick="deleteTransaction('${t.id}')" class="text-red-400 hover:text-red-600 active-click font-bold text-xl ml-4">✕</button>
            </div>
        `;
        listContainer.appendChild(item);
    });

    updateChart(totalIncome, totalExpense);
}

// 6. TRANSAKSI CRUD
async function addTransaction(e) {
    e.preventDefault(); 
    const categoryId = document.getElementById('category').value;
    const walletId = document.getElementById('wallet').value;
    
    if(!categoryId || !walletId) {
        alert("Pilih Kategori dan Dompet terlebih dahulu!");
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerText = "Menyimpan...";
    submitBtn.disabled = true;

    const newTx = {
        type: document.getElementById('type').value,
        amount: document.getElementById('amount').value,
        category_id: categoryId,
        wallet_id: walletId,
        date: document.getElementById('date').value,
        notes: document.getElementById('notes').value
    };

    const { error } = await db.from('transactions').insert([newTx]);
    if (error) { alert("Gagal menyimpan!"); console.error(error); } 
    else {
        document.getElementById('amount').value = '';
        document.getElementById('notes').value = '';
        await fetchTransactions(); 
    }
    submitBtn.innerText = "Simpan Transaksi";
    submitBtn.disabled = false;
}

window.deleteTransaction = async (id) => {
    if(!confirm("Yakin ingin menghapus transaksi ini?")) return;
    const { error } = await db.from('transactions').delete().eq('id', id);
    if (!error) await fetchTransactions();
}

// ==========================================
// 7. FITUR KELOLA MODAL (WALLET & CATEGORY)
// ==========================================

window.openModal = (id) => {
    const modal = document.getElementById(id);
    const modalContent = modal.querySelector('div');
    
    modal.classList.remove('hidden');
    // Beri jeda sangat kecil agar transisi CSS berjalan
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
    
    // Tunggu animasi selesai baru di-hide
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// --- LOGIKA DOMPET (WALLET) ---
function renderWalletList() {
    const list = document.getElementById('modalWalletList');
    list.innerHTML = wallets.map(w => `
        <div class="modal-item flex justify-between items-center p-3 bg-gray-50 dark:bg-black rounded-xl border border-gray-200 dark:border-nothing-border">
            <span class="font-medium">${w.name}</span>
            <button onclick="deleteWallet('${w.id}')" class="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
        </div>
    `).join('');
}

window.addWallet = async () => {
    const input = document.getElementById('newWalletName');
    const name = input.value.trim();
    if (!name) return;

    const { error } = await db.from('wallets').insert([{ name }]);
    if (!error) {
        input.value = '';
        await fetchWalletsAndCategories(); // Ambil ulang data dari Supabase
        renderWalletList(); // Update UI Modal
    } else {
        alert("Gagal menambahkan dompet.");
    }
};

window.deleteWallet = async (id) => {
    if(!confirm("Hapus dompet ini? Peringatan: Semua transaksi yang menggunakan dompet ini juga akan terhapus!")) return;
    const { error } = await db.from('wallets').delete().eq('id', id);
    if (!error) {
        await fetchWalletsAndCategories();
        await fetchTransactions(); // Refresh transaksi karena data terkait ikut terhapus (Cascade)
        renderWalletList();
    }
};

// --- LOGIKA KATEGORI (CATEGORY) ---
function renderCategoryList() {
    const list = document.getElementById('modalCategoryList');
    list.innerHTML = categories.map(c => {
        const typeLabel = c.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const typeColor = c.type === 'income' ? 'text-green-500 bg-green-100' : 'text-red-500 bg-red-100';
        return `
            <div class="modal-item flex justify-between items-center p-3 bg-gray-50 dark:bg-black rounded-xl border border-gray-200 dark:border-nothing-border">
                <div>
                    <span class="font-medium block">${c.name}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColor}">${typeLabel}</span>
                </div>
                <button onclick="deleteCategory('${c.id}')" class="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
            </div>
        `;
    }).join('');
}

window.addCategory = async () => {
    const inputName = document.getElementById('newCategoryName');
    const inputType = document.getElementById('newCategoryType');
    
    const name = inputName.value.trim();
    const type = inputType.value;
    if (!name) return;

    const { error } = await db.from('categories').insert([{ name, type }]);
    if (!error) {
        inputName.value = '';
        await fetchWalletsAndCategories(); 
        renderCategoryList();
    } else {
        alert("Gagal menambahkan kategori.");
    }
};

window.deleteCategory = async (id) => {
    if(!confirm("Hapus kategori ini? Peringatan: Semua transaksi dengan kategori ini juga akan terhapus!")) return;
    const { error } = await db.from('categories').delete().eq('id', id);
    if (!error) {
        await fetchWalletsAndCategories();
        await fetchTransactions(); 
        renderCategoryList();
    }
};

// ==========================================

// 8. GRAFIK
function updateChart(income, expense) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#ffffff' : '#000000';

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pemasukan', 'Pengeluaran'],
            datasets: [{
                data: [income, expense],
                backgroundColor: ['#22c55e', '#ef4444'], 
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            cutout: '75%', 
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor } }
            }
        }
    });
}

// 9. EVENT LISTENERS
function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('type').addEventListener('change', updateCategoryDropdown);
    document.getElementById('filterType').addEventListener('change', renderApp);

    const darkModeBtn = document.getElementById('darkModeToggle');
    const htmlTag = document.documentElement;
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        htmlTag.classList.add('dark');
    }

    darkModeBtn.addEventListener('click', () => {
        htmlTag.classList.toggle('dark');
        if (transactions.length > 0 || (transactions.length === 0 && chartInstance)) {
            renderApp();
        }
    });
}

// EKSEKUSI
initApp();