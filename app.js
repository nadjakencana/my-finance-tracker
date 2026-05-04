// 1. SETUP SUPABASE
const supabaseUrl = 'https://oiexwinhieyextiuuywu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXh3aW5oaWV5ZXh0aXV1eXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTU1MDUsImV4cCI6MjA5MzA5MTUwNX0.LCYPVX21XxfyiwA5LSIq_6JR9xHTBXzSTgYILdnzJp0';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let transactions = [];
let wallets = [];
let categories = [];
let chartInstance = null;
let editingId = null; 

// ================= AUTHENTICATION LOGIC =================
// Cek status login saat web dibuka
db.auth.getSession().then(({ data: { session } }) => {
    if (session) { showApp(); } 
    else { showLogin(); }
});

// Listener kalau login/logout sukses
db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') showApp();
    if (event === 'SIGNED_OUT') showLogin();
});

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden', 'opacity-0');
    const app = document.getElementById('appContainer');
    app.classList.remove('hidden');
    setTimeout(() => app.classList.remove('opacity-0'), 50);
    initApp(); // Tarik data setelah login
}

function showLogin() {
    const app = document.getElementById('appContainer');
    app.classList.add('hidden', 'opacity-0');
    const loginSec = document.getElementById('loginScreen');
    loginSec.classList.remove('hidden');
    setTimeout(() => loginSec.classList.remove('opacity-0'), 50);
}

// Fungsi tombol Login
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
    const result = await Swal.fire({
        title: 'Keluar?', text: "Yakin mau kunci aplikasi ini?", icon: 'question', showCancelButton: true,
        confirmButtonColor: '#FF3B30', cancelButtonColor: document.documentElement.classList.contains('dark') ? '#333' : '#E5E5EA', 
        confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal',
        background: document.documentElement.classList.contains('dark') ? '#1a1a1a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
    });
    if(result.isConfirmed) {
        await db.auth.signOut();
        transactions = []; wallets = []; categories = [];
    }
};
// ========================================================

const triggerHaptic = () => { if (navigator.vibrate) navigator.vibrate(40); };

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const showAlert = (title, text, icon) => {
    if (typeof Swal !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark');
        Swal.fire({ title, text, icon, confirmButtonColor: '#007AFF', background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#ffffff' : '#000000' });
    } else alert(`${title}\n${text}`);
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

async function initApp() {
    setGreeting();
    document.getElementById('date').valueAsDate = new Date();
    setupEventListeners(); 
    await fetchWalletsAndCategories();
    await fetchTransactions();
}

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
        const walletSelect = document.getElementById('wallet');
        walletSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        updateCategoryDropdown();
    } catch (err) { console.error(err); }
}

window.updateCategoryDropdown = () => {
    const typeInputs = document.querySelector('input[name="type"]:checked');
    if(!typeInputs) return;
    const selectedType = typeInputs.value;
    const catSelect = document.getElementById('category');
    const filteredCats = categories.filter(c => c.type === selectedType);
    catSelect.innerHTML = filteredCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function fetchTransactions() {
    try {
        let { data, error } = await db.from('transactions').select(`*, wallets ( name ), categories ( name )`).order('date', { ascending: false });
        if (error) throw error;
        transactions = data || [];
        renderApp();
    } catch (err) { console.error(err); }
}

function renderApp() {
    const filterType = document.getElementById('filterType').value;
    const filterTime = document.getElementById('filterTime').value;
    
    let filteredTransactions = transactions;

    if (filterType !== 'all') filteredTransactions = filteredTransactions.filter(t => t.type === filterType);

    const today = new Date(); today.setHours(0,0,0,0);
    if (filterTime === 'today') filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= today);
    else if (filterTime === 'week') { const last7Days = new Date(today); last7Days.setDate(last7Days.getDate() - 7); filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= last7Days); } 
    else if (filterTime === 'month') { const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= startOfMonth); }

    let totalIncome = 0; let totalExpense = 0; const categoryTotals = {}; 

    filteredTransactions.forEach(t => { 
        const amount = Number(t.amount); const catName = t.categories ? t.categories.name : 'Unknown';
        if (t.type === 'income') totalIncome += amount; else if (t.type === 'expense') totalExpense += amount;
        if (!categoryTotals[catName]) categoryTotals[catName] = { amount: 0, type: t.type };
        categoryTotals[catName].amount += amount;
    });

    document.getElementById('totalIncome').innerText = formatRupiah(totalIncome);
    document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);

    const listContainer = document.getElementById('transactionList'); listContainer.innerHTML = '';

    if (filteredTransactions.length === 0) {
        listContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-12 opacity-50"><svg class="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg><p class="text-center font-bold text-lg">Belum Ada Catatan</p><p class="text-center text-sm font-medium">Keuanganmu belum tercatat di periode ini.</p></div>`;
    }

    filteredTransactions.forEach((t, index) => {
        const isIncome = t.type === 'income'; const amountColor = isIncome ? 'text-[#34C759]' : 'text-[#FF3B30]';
        const sign = isIncome ? '+' : '-'; const catName = t.categories ? t.categories.name : 'Unknown'; const walletName = t.wallets ? t.wallets.name : 'Unknown';
        const iconSrc = isIncome ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>` : `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>`;
        
        const item = document.createElement('div');
        item.className = `transaction-item p-4 rounded-[1.5rem] bg-white/60 dark:bg-[#111]/80 backdrop-blur-md border border-gray-100 dark:border-[#222] flex justify-between items-center animate-fade-in shadow-sm`;
        item.style.animationDelay = `${index * 0.04}s`; 
        
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center ${isIncome ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'} shrink-0">${iconSrc}</div>
                <div><h4 class="font-bold text-lg tracking-tight leading-tight">${catName}</h4><p class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">${formatDate(t.date)} • ${walletName}</p>${t.notes ? `<p class="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1 line-clamp-1">${t.notes}</p>` : ''}</div>
            </div>
            <div class="flex items-center gap-2">
                <p class="font-bold ${amountColor} text-lg mr-2 hidden sm:block tracking-tight">${sign} ${formatRupiah(t.amount)}</p>
                <button onclick="editTransaction('${t.id}')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#007AFF] hover:bg-blue-100 active-click transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                <button onclick="deleteTransaction('${t.id}')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-[#FF3B30] hover:bg-red-100 active-click transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
        `;
        listContainer.appendChild(item);
    });

    updateChart(totalIncome, totalExpense); renderCategoryLevels(categoryTotals, totalIncome, totalExpense);
}

function renderCategoryLevels(categoryTotals, totalIncome, totalExpense) {
    const container = document.getElementById('categoryStats');
    const categoriesArr = Object.keys(categoryTotals).map(name => ({ name, amount: categoryTotals[name].amount, type: categoryTotals[name].type })).sort((a, b) => b.amount - a.amount);
    if (categoriesArr.length === 0) { container.innerHTML = '<p class="text-sm text-gray-500 font-medium">Belum ada data level.</p>'; return; }
    container.innerHTML = categoriesArr.map((cat, index) => {
        const maxAmount = cat.type === 'income' ? totalIncome : totalExpense; const percentage = maxAmount === 0 ? 0 : Math.round((cat.amount / maxAmount) * 100);
        const bgGradient = cat.type === 'income' ? 'bg-gradient-to-r from-[#32ADE6] to-[#007AFF]' : 'bg-gradient-to-r from-[#FF453A] to-[#FF3B30]';
        return `<div class="mb-4 animate-fade-in" style="animation-delay: ${index * 0.1}s"><div class="flex justify-between text-xs font-bold mb-1.5 uppercase tracking-wider"><span class="text-gray-600 dark:text-gray-300">${cat.name}</span><span class="${cat.type === 'income' ? 'text-[#007AFF]' : 'text-[#FF3B30]'}">${percentage}%</span></div><div class="w-full bg-black/5 dark:bg-white/10 rounded-full h-3 overflow-hidden backdrop-blur-sm"><div class="${bgGradient} h-3 rounded-full animate-fill-bar shadow-sm" style="width: ${percentage}%"></div></div><p class="text-[10px] font-bold text-gray-400 mt-1 text-right">${formatRupiah(cat.amount)}</p></div>`;
    }).join('');
}

async function addTransaction(e) {
    e.preventDefault(); triggerHaptic(); 
    const categoryId = document.getElementById('category').value; const walletId = document.getElementById('wallet').value;
    if(!categoryId || !walletId) { showAlert("Oops!", "Pilih Kategori dan Dompet dulu!", "warning"); return; }
    const submitBtn = document.getElementById('submitBtn'); submitBtn.innerHTML = "Menyimpan... <span class='animate-pulse'>⏳</span>"; submitBtn.disabled = true;

    const txData = { type: document.querySelector('input[name="type"]:checked').value, amount: document.getElementById('amount').value, category_id: categoryId, wallet_id: walletId, date: document.getElementById('date').value, notes: document.getElementById('notes').value };
    let error; if (editingId) { const res = await db.from('transactions').update(txData).eq('id', editingId); error = res.error; } else { const res = await db.from('transactions').insert([txData]); error = res.error; }

    if (error) { showAlert("Error!", "Gagal menyimpan.", "error"); } else { cancelEdit(); await fetchTransactions(); showAlert("Sukses!", "Data tersimpan mulus.", "success"); }
    submitBtn.innerHTML = "Simpan <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'></path></svg>"; submitBtn.disabled = false;
}

window.editTransaction = (id) => {
    try {
        triggerHaptic(); const tx = transactions.find(t => t.id === id); if (!tx) return; editingId = id;
        document.getElementById('formTitle').innerText = "Edit Record"; document.querySelector(`input[name="type"][value="${tx.type}"]`).checked = true; updateCategoryDropdown(); 
        document.getElementById('amount').value = tx.amount; document.getElementById('category').value = tx.category_id; document.getElementById('wallet').value = tx.wallet_id; document.getElementById('date').value = tx.date;
        const notesEl = document.getElementById('notes'); notesEl.value = tx.notes || ''; notesEl.style.height = 'auto'; notesEl.style.height = notesEl.scrollHeight + 'px';
        document.getElementById('submitBtn').innerHTML = "Update <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'></path></svg>"; document.getElementById('cancelEditBtn').classList.remove('hidden');
        const formSec = document.getElementById('formSection'); formSec.scrollIntoView({ behavior: 'smooth' }); formSec.classList.add('ring-4', 'ring-[#007AFF]', 'scale-[1.02]'); setTimeout(() => formSec.classList.remove('ring-4', 'ring-[#007AFF]', 'scale-[1.02]'), 800);
    } catch (err) { console.error(err); }
};

window.cancelEdit = () => {
    editingId = null; document.getElementById('formTitle').innerText = "Record Baru"; document.getElementById('transactionForm').reset(); document.getElementById('date').valueAsDate = new Date(); document.getElementById('notes').style.height = 'auto'; updateCategoryDropdown();
    document.getElementById('submitBtn').innerHTML = "Simpan <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'></path></svg>"; document.getElementById('cancelEditBtn').classList.add('hidden');
};

window.deleteTransaction = async (id) => {
    try {
        triggerHaptic(); const isDark = document.documentElement.classList.contains('dark');
        const result = await Swal.fire({ title: 'Hapus data ini?', text: "Data bakal hilang permanen lho!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#FF3B30', cancelButtonColor: isDark ? '#333' : '#E5E5EA', confirmButtonText: 'Ya, Hapus!', cancelButtonText: 'Batal', background: isDark ? '#1a1a1a' : '#fff', color: isDark ? '#fff' : '#000' });
        if (result.isConfirmed) { const { error } = await db.from('transactions').delete().eq('id', id); if (error) showAlert("Error!", "Gagal menghapus.", "error"); else { await fetchTransactions(); Swal.fire({title: 'Terhapus!', icon: 'success', timer: 1500, showConfirmButton: false, background: isDark ? '#1a1a1a' : '#fff', color: isDark ? '#fff' : '#000'}); } }
    } catch(err) { console.error(err); }
}

window.openModal = (id) => { triggerHaptic(); const modal = document.getElementById(id); const modalContent = modal.querySelector('div'); modal.classList.remove('hidden'); setTimeout(() => { modal.classList.add('modal-active'); modalContent.classList.add('modal-scale-up'); }, 10); if (id === 'walletModal') renderWalletList(); if (id === 'categoryModal') renderCategoryList(); };
window.closeModal = (id) => { const modal = document.getElementById(id); const modalContent = modal.querySelector('div'); modal.classList.remove('modal-active'); modalContent.classList.remove('modal-scale-up'); setTimeout(() => { modal.classList.add('hidden'); }, 300); };

function renderWalletList() { const list = document.getElementById('modalWalletList'); list.innerHTML = wallets.map(w => `<div class="modal-item flex justify-between items-center p-4 bg-gray-50/50 dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#333]"><span class="font-bold">${w.name}</span><button onclick="deleteWallet('${w.id}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>`).join(''); }
window.addWallet = async () => { const name = document.getElementById('newWalletName').value.trim(); if (!name) return; const { error } = await db.from('wallets').insert([{ name }]); if (!error) { document.getElementById('newWalletName').value = ''; await fetchWalletsAndCategories(); renderWalletList(); } }
window.deleteWallet = async (id) => { const result = await Swal.fire({ title: 'Hapus dompet?', text: 'Transaksi terkait ikut terhapus!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#FF3B30' }); if(result.isConfirmed){ const { error } = await db.from('wallets').delete().eq('id', id); if (!error) { await fetchWalletsAndCategories(); await fetchTransactions(); renderWalletList(); } } };

function renderCategoryList() { const list = document.getElementById('modalCategoryList'); list.innerHTML = categories.map(c => { const typeColor = c.type === 'income' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 bg-gray-200 dark:bg-gray-800 dark:text-gray-300'; return `<div class="modal-item flex justify-between items-center p-4 bg-gray-50/50 dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#333]"><div class="flex items-center gap-3"><span class="text-xs font-bold px-2 py-1 rounded-lg uppercase ${typeColor}">${c.type}</span><span class="font-bold">${c.name}</span></div><button onclick="deleteCategory('${c.id}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>`; }).join(''); }
window.addCategory = async () => { const name = document.getElementById('newCategoryName').value.trim(); const type = document.getElementById('newCategoryType').value; if (!name) return; const { error } = await db.from('categories').insert([{ name, type }]); if (!error) { document.getElementById('newCategoryName').value = ''; await fetchWalletsAndCategories(); renderCategoryList(); } };
window.deleteCategory = async (id) => { const result = await Swal.fire({ title: 'Hapus kategori?', text: 'Transaksi terkait ikut terhapus!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#FF3B30' }); if(result.isConfirmed){ const { error } = await db.from('categories').delete().eq('id', id); if (!error) { await fetchWalletsAndCategories(); await fetchTransactions(); renderCategoryList(); } } };

function updateChart(income, expense) {
    const ctx = document.getElementById('financeChart').getContext('2d'); if (chartInstance) chartInstance.destroy(); const isDark = document.documentElement.classList.contains('dark');
    const gradientBlue = ctx.createLinearGradient(0, 0, 0, 400); gradientBlue.addColorStop(0, '#32ADE6'); gradientBlue.addColorStop(1, '#007AFF');
    const gradientRed = ctx.createLinearGradient(0, 0, 0, 400); gradientRed.addColorStop(0, '#FF453A'); gradientRed.addColorStop(1, '#FF3B30');
    chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Pemasukan', 'Pengeluaran'], datasets: [{ data: [income, expense], backgroundColor: [gradientBlue, gradientRed], borderWidth: isDark ? 2 : 4, borderColor: isDark ? '#000' : '#fff', hoverOffset: 8, borderRadius: 10 }] }, options: { responsive: true, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#fff' : '#000', padding: 20, font: { family: 'Inter', weight: 'bold' } } } } } });
}

function setupEventListeners() {
    // INI DIA KABEL YANG SEMPET PUTUS KEMARIN!
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    
    document.getElementById('filterType').addEventListener('change', renderApp);
    document.getElementById('filterTime').addEventListener('change', renderApp);
    const darkModeBtn = document.getElementById('darkModeToggle'); const htmlTag = document.documentElement;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) htmlTag.classList.add('dark');
    darkModeBtn.addEventListener('click', () => { triggerHaptic(); htmlTag.classList.toggle('dark'); if (transactions.length > 0 || (transactions.length === 0 && chartInstance)) renderApp(); });
}