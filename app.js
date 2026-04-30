// 1. SETUP SUPABASE
const supabaseUrl = 'https://oiexwinhieyextiuuywu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXh3aW5oaWV5ZXh0aXV1eXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTU1MDUsImV4cCI6MjA5MzA5MTUwNX0.LCYPVX21XxfyiwA5LSIq_6JR9xHTBXzSTgYILdnzJp0';
const db = supabase.createClient(supabaseUrl, supabaseKey);

let transactions = [];
let wallets = [];
let categories = [];
let chartInstance = null;
let editingId = null; 

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

const showAlert = (title, text, icon) => {
    if (typeof Swal !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark');
        Swal.fire({ 
            title, text, icon, 
            confirmButtonColor: '#007AFF', 
            background: isDark ? '#1a1a1a' : '#ffffff', 
            color: isDark ? '#ffffff' : '#000000' 
        });
    } else {
        alert(`${title}\n${text}`);
    }
};

async function initApp() {
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
    const selectedType = document.querySelector('input[name="type"]:checked').value;
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
    let filteredTransactions = transactions;
    if (filterType !== 'all') filteredTransactions = transactions.filter(t => t.type === filterType);

    let totalIncome = 0; let totalExpense = 0;
    transactions.forEach(t => { if (t.type === 'income') totalIncome += Number(t.amount); if (t.type === 'expense') totalExpense += Number(t.amount); });

    document.getElementById('totalIncome').innerText = formatRupiah(totalIncome);
    document.getElementById('totalExpense').innerText = formatRupiah(totalExpense);
    document.getElementById('totalBalance').innerText = formatRupiah(totalIncome - totalExpense);

    const listContainer = document.getElementById('transactionList');
    listContainer.innerHTML = '';

    if (filteredTransactions.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 py-10 font-medium">No records found.</p>`;
    }

    filteredTransactions.forEach((t, index) => {
        const isIncome = t.type === 'income';
        const amountColor = isIncome ? 'text-[#34C759]' : 'text-[#FF3B30]';
        const sign = isIncome ? '+' : '-';
        const catName = t.categories ? t.categories.name : 'Unknown';
        const walletName = t.wallets ? t.wallets.name : 'Unknown';
        const iconSrc = isIncome ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>` : `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>`;
        
        const item = document.createElement('div');
        item.className = `transaction-item p-4 rounded-3xl bg-white/60 dark:bg-[#111] border border-gray-100 dark:border-[#222] flex justify-between items-center animate-fade-in shadow-sm`;
        item.style.animationDelay = `${index * 0.04}s`; 
        
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center ${isIncome ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'} shrink-0">
                    ${iconSrc}
                </div>
                <div>
                    <h4 class="font-bold text-lg tracking-tight">${catName}</h4>
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">${formatDate(t.date)} • ${walletName} ${t.notes ? `<span class="normal-case tracking-normal text-gray-400">• ${t.notes}</span>` : ''}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <p class="font-bold ${amountColor} text-lg mr-2 hidden sm:block tracking-tight">${sign} ${formatRupiah(t.amount)}</p>
                <button onclick="editTransaction('${t.id}')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#007AFF] hover:bg-blue-100 active-click transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onclick="deleteTransaction('${t.id}')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-[#FF3B30] hover:bg-red-100 active-click transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });

    updateChart(totalIncome, totalExpense);
}

async function addTransaction(e) {
    e.preventDefault(); 
    const categoryId = document.getElementById('category').value;
    const walletId = document.getElementById('wallet').value;
    
    if(!categoryId || !walletId) { showAlert("Oops!", "Please select Category and Wallet!", "warning"); return; }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "Saving..."; submitBtn.disabled = true;

    const txData = {
        type: document.querySelector('input[name="type"]:checked').value,
        amount: document.getElementById('amount').value,
        category_id: categoryId, wallet_id: walletId,
        date: document.getElementById('date').value, notes: document.getElementById('notes').value
    };

    let error;
    if (editingId) { const res = await db.from('transactions').update(txData).eq('id', editingId); error = res.error; } 
    else { const res = await db.from('transactions').insert([txData]); error = res.error; }

    if (error) { showAlert("Error!", "Failed to save record.", "error"); } 
    else { cancelEdit(); await fetchTransactions(); showAlert("Success!", "Record saved.", "success"); }
    
    submitBtn.disabled = false;
}

window.editTransaction = (id) => {
    try {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        editingId = id;
        document.getElementById('formTitle').innerText = "Edit Record";
        document.querySelector(`input[name="type"][value="${tx.type}"]`).checked = true;
        updateCategoryDropdown(); 
        document.getElementById('amount').value = tx.amount;
        document.getElementById('category').value = tx.category_id;
        document.getElementById('wallet').value = tx.wallet_id;
        document.getElementById('date').value = tx.date;
        document.getElementById('notes').value = tx.notes || '';
        document.getElementById('submitBtn').innerText = "Update Record";
        document.getElementById('cancelEditBtn').classList.remove('hidden');

        const formSec = document.getElementById('formSection');
        formSec.scrollIntoView({ behavior: 'smooth' });
        formSec.classList.add('ring-4', 'ring-[#007AFF]', 'scale-[1.02]');
        setTimeout(() => formSec.classList.remove('ring-4', 'ring-[#007AFF]', 'scale-[1.02]'), 800);
    } catch (err) { console.error(err); }
};

window.cancelEdit = () => {
    editingId = null;
    document.getElementById('formTitle').innerText = "New Record";
    document.getElementById('transactionForm').reset();
    document.getElementById('date').valueAsDate = new Date();
    updateCategoryDropdown();
    document.getElementById('submitBtn').innerText = "Save";
    document.getElementById('cancelEditBtn').classList.add('hidden');
};

window.deleteTransaction = async (id) => {
    try {
        const isDark = document.documentElement.classList.contains('dark');
        const result = await Swal.fire({
            title: 'Delete this record?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#FF3B30', cancelButtonColor: isDark ? '#333' : '#E5E5EA', confirmButtonText: 'Yes, delete it!', cancelButtonText: 'Cancel',
            background: isDark ? '#1a1a1a' : '#fff', color: isDark ? '#fff' : '#000'
        });
        if (result.isConfirmed) {
            const { error } = await db.from('transactions').delete().eq('id', id);
            if (error) showAlert("Error!", "Failed to delete.", "error");
            else { await fetchTransactions(); Swal.fire({title: 'Deleted!', icon: 'success', timer: 1500, showConfirmButton: false, background: isDark ? '#1a1a1a' : '#fff', color: isDark ? '#fff' : '#000'}); }
        }
    } catch(err) { console.error(err); }
}

window.openModal = (id) => {
    const modal = document.getElementById(id); const modalContent = modal.querySelector('div');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.add('modal-active'); modalContent.classList.add('modal-scale-up'); }, 10);
    if (id === 'walletModal') renderWalletList(); if (id === 'categoryModal') renderCategoryList();
};

window.closeModal = (id) => {
    const modal = document.getElementById(id); const modalContent = modal.querySelector('div');
    modal.classList.remove('modal-active'); modalContent.classList.remove('modal-scale-up');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
};

function renderWalletList() {
    const list = document.getElementById('modalWalletList');
    list.innerHTML = wallets.map(w => `
        <div class="modal-item flex justify-between items-center p-4 bg-gray-50/50 dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#333]">
            <span class="font-bold">${w.name}</span>
            <button onclick="deleteWallet('${w.id}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
    `).join('');
}

window.addWallet = async () => {
    const name = document.getElementById('newWalletName').value.trim(); if (!name) return;
    const { error } = await db.from('wallets').insert([{ name }]);
    if (!error) { document.getElementById('newWalletName').value = ''; await fetchWalletsAndCategories(); renderWalletList(); } 
}

window.deleteWallet = async (id) => {
    const result = await Swal.fire({ title: 'Delete wallet?', text: 'Related transactions will also be deleted!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#FF3B30' });
    if(result.isConfirmed){ const { error } = await db.from('wallets').delete().eq('id', id); if (!error) { await fetchWalletsAndCategories(); await fetchTransactions(); renderWalletList(); } }
};

function renderCategoryList() {
    const list = document.getElementById('modalCategoryList');
    list.innerHTML = categories.map(c => {
        const typeColor = c.type === 'income' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 bg-gray-200 dark:bg-gray-800 dark:text-gray-300';
        return `
            <div class="modal-item flex justify-between items-center p-4 bg-gray-50/50 dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-[#333]">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold px-2 py-1 rounded-lg uppercase ${typeColor}">${c.type}</span>
                    <span class="font-bold">${c.name}</span>
                </div>
                <button onclick="deleteCategory('${c.id}')" class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
        `;
    }).join('');
}

window.addCategory = async () => {
    const name = document.getElementById('newCategoryName').value.trim(); const type = document.getElementById('newCategoryType').value; if (!name) return;
    const { error } = await db.from('categories').insert([{ name, type }]);
    if (!error) { document.getElementById('newCategoryName').value = ''; await fetchWalletsAndCategories(); renderCategoryList(); } 
};

window.deleteCategory = async (id) => {
    const result = await Swal.fire({ title: 'Delete category?', text: 'Related transactions will also be deleted!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#FF3B30' });
    if(result.isConfirmed){ const { error } = await db.from('categories').delete().eq('id', id); if (!error) { await fetchWalletsAndCategories(); await fetchTransactions(); renderCategoryList(); } }
};

function updateChart(income, expense) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    
    // Gradient for Chart (Apple Blue & Apple Red)
    const gradientBlue = ctx.createLinearGradient(0, 0, 0, 400); gradientBlue.addColorStop(0, '#32ADE6'); gradientBlue.addColorStop(1, '#007AFF');
    const gradientRed = ctx.createLinearGradient(0, 0, 0, 400); gradientRed.addColorStop(0, '#FF453A'); gradientRed.addColorStop(1, '#FF3B30');

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Income', 'Expense'], datasets: [{ data: [income, expense], backgroundColor: [gradientBlue, gradientRed], borderWidth: isDark ? 2 : 4, borderColor: isDark ? '#000' : '#fff', hoverOffset: 8, borderRadius: 10 }] },
        options: { responsive: true, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#fff' : '#000', padding: 20, font: { family: 'Inter', weight: 'bold' } } } } }
    });
}

function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('filterType').addEventListener('change', renderApp);
    const darkModeBtn = document.getElementById('darkModeToggle'); const htmlTag = document.documentElement;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) htmlTag.classList.add('dark');
    darkModeBtn.addEventListener('click', () => { htmlTag.classList.toggle('dark'); if (transactions.length > 0 || (transactions.length === 0 && chartInstance)) renderApp(); });
}

initApp();