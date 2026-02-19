(function() {
    'use strict';

    const STORAGE_KEY = 'savemoney_transactions';
    const PIN_KEY = 'savemoney_pin';
    const MAX_AMOUNT = 999_999_999_999;
    const MIN_AMOUNT = 100;
    const MAX_DESC_LENGTH = 50;
    const RENDER_LIMIT = 50;

    let chartInstance = null;
    let isProgressBar = true;
    let editingId = null;
    let autoNightInterval;
    let activeSubmenu = null;
    
    let customDarkStart = '22:00';
    let customDarkEnd = '05:00';
    let autoModeType = 'dark';
    let searchTerm = '';

    let transactions = [
        { id: 1, type: 'income', description: 'Tabungan', amount: 116555, date: '2026-02-19', time: '07:36', notes: '' },
        { id: 2, type: 'income', description: 'Gaji', amount: 5000000, date: '2026-02-01', time: '09:00', notes: '' },
        { id: 3, type: 'expense', description: 'Makan', amount: 50000, date: '2026-02-05', time: '12:30', notes: '' },
        { id: 4, type: 'expense', description: 'Transport', amount: 20000, date: '2026-02-10', time: '08:15', notes: '' },
        { id: 5, type: 'income', description: 'Bonus', amount: 1000000, date: '2026-02-15', time: '16:20', notes: '' }
    ];

    // Fungsi WIB
    function getCurrentWIBDateTime() {
        try {
            const now = new Date();
            const options = { 
                timeZone: 'Asia/Jakarta', 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            };
            
            const formatter = new Intl.DateTimeFormat('id-ID', options);
            const parts = formatter.formatToParts(now);
            
            let year, month, day, hour, minute;
            
            for (const part of parts) {
                if (part.type === 'year') year = part.value;
                if (part.type === 'month') month = part.value;
                if (part.type === 'day') day = part.value;
                if (part.type === 'hour') hour = part.value;
                if (part.type === 'minute') minute = part.value;
            }
            
            return {
                date: `${year}-${month}-${day}`,
                time: `${hour}:${minute}`
            };
        } catch (e) {
            const now = new Date();
            const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
            return {
                date: wibTime.toISOString().split('T')[0],
                time: wibTime.toISOString().split('T')[1].substring(0,5)
            };
        }
    }

    // Helper Functions
    function formatRupiah(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.innerText = message;
        toast.className = type;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 2000);
    }

    function calculateTotals(transactions) {
        let income = 0, expense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
        });
        return { income, expense, balance: Math.max(0, income - expense) };
    }

    function getDayName(dateStr) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const date = new Date(dateStr + 'T12:00:00');
        return days[date.getDay()];
    }

    function formatFullDate(dateStr, timeStr) {
        const date = new Date(dateStr + 'T12:00:00');
        const dayName = getDayName(dateStr);
        const formattedDate = date.toLocaleDateString('id-ID', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
        return `${dayName}, ${formattedDate} • ${timeStr}`;
    }

    // Render Functions
    function renderStats() {
        const { income, expense, balance } = calculateTotals(transactions);
        
        document.getElementById('totalIncomeDisplay').innerText = formatRupiah(income);
        document.getElementById('totalExpenseDisplay').innerText = formatRupiah(expense);
        document.getElementById('totalSavingsDisplay').innerText = formatRupiah(balance);
        document.getElementById('incomeAmount').innerText = formatRupiah(income);
        document.getElementById('expenseAmount').innerText = formatRupiah(expense);
        document.getElementById('balanceAmount').innerText = formatRupiah(balance);
        
        const maxValue = Math.max(income, expense, balance, 1);
        document.getElementById('incomeBar').style.height = (income / maxValue) * 100 + '%';
        document.getElementById('expenseBar').style.height = (expense / maxValue) * 100 + '%';
        document.getElementById('balanceBar').style.height = (balance / maxValue) * 100 + '%';
        
        document.getElementById('incomeProgress').style.width = (income / maxValue) * 100 + '%';
        document.getElementById('expenseProgress').style.width = (expense / maxValue) * 100 + '%';
        document.getElementById('balanceProgress').style.width = (balance / maxValue) * 100 + '%';
    }

    function renderTransactions() {
        let filtered = transactions;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = transactions.filter(t => 
                t.description.toLowerCase().includes(term) ||
                (t.notes && t.notes.toLowerCase().includes(term)) ||
                t.amount.toString().includes(term)
            );
        }
        
        const sorted = [...filtered].sort((a, b) => 
            new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))
        );
        
        let html = '';
        sorted.slice(0, RENDER_LIMIT).forEach(t => {
            const isIncome = t.type === 'income';
            const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
            const iconBg = isIncome ? 'var(--income-soft)' : 'var(--expense-soft)';
            const sign = isIncome ? '+ ' : '- ';
            const fullDate = formatFullDate(t.date, t.time || '00:00');
            
            html += `<li class="transaction-item" data-id="${t.id}" onclick="openEditModal(${t.id})">
                <div class="transaction-left">
                    <div class="transaction-icon" style="background: ${iconBg}; color: ${isIncome ? 'var(--income)' : 'var(--expense)'}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <h4>${t.description}</h4>
                        <div class="transaction-date">${fullDate}</div>
                    </div>
                </div>
                <div class="transaction-amount ${isIncome ? 'income-amount' : 'expense-amount'}">${sign}${formatRupiah(t.amount)}</div>
            </li>`;
        });
        
        if (sorted.length === 0) {
            html = '<li style="color: var(--text-secondary); text-align: center; padding: 2rem;">Tidak ada transaksi</li>';
        }
        
        document.getElementById('transactionList').innerHTML = html;
        document.getElementById('transactionCount').innerText = filtered.length + ' item';
        
        const searchClear = document.getElementById('searchClear');
        if (searchClear) {
            searchClear.style.display = searchTerm ? 'block' : 'none';
        }
    }

    function renderDonutChart() {
        const canvas = document.getElementById('financeChart');
        if (!canvas) return;
        
        const { income, expense, balance } = calculateTotals(transactions);
        
        try {
            const ctx = canvas.getContext('2d');
            
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
            
            const incomeColor = getComputedStyle(document.body).getPropertyValue('--income').trim() || '#0f7b5c';
            const expenseColor = getComputedStyle(document.body).getPropertyValue('--expense').trim() || '#b83e45';
            const savingColor = getComputedStyle(document.body).getPropertyValue('--saving').trim() || '#f39c12';
            
            chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Pemasukan', 'Pengeluaran', 'Sisa Uang'],
                    datasets: [{
                        data: [income, expense, balance],
                        backgroundColor: [incomeColor, expenseColor, savingColor],
                        borderWidth: 0,
                        borderRadius: 8
                    }]
                },
                options: {
                    cutout: '70%',
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => formatRupiah(ctx.raw)
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Gagal render donut chart:', e);
        }
    }

    function toggleChartType() {
        isProgressBar = !isProgressBar;
        
        const donutContainer = document.getElementById('donutChartContainer');
        const progressContainer = document.getElementById('progressBarContainer');
        const icon = document.getElementById('ringkasanIcon');
        
        if (isProgressBar) {
            donutContainer.style.display = 'none';
            progressContainer.style.display = 'block';
            icon.className = 'fas fa-chart-bar';
        } else {
            donutContainer.style.display = 'block';
            progressContainer.style.display = 'none';
            icon.className = 'fas fa-chart-pie';
            renderDonutChart();
        }
    }

    // Periodic Report Class
    class PeriodicReport {
        constructor() {
            this.currentPeriod = 'month';
            this.currentDate = new Date(2026, 1, 15);
            this.defaultDate = new Date(2026, 1, 15);
            this.init();
        }
        
        getDateRange() {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            const date = this.currentDate.getDate();
            
            let start, end;
            
            switch(this.currentPeriod) {
                case 'day':
                    start = new Date(year, month, date);
                    end = new Date(year, month, date);
                    break;
                case 'week': {
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const weekNumber = Math.floor((date - 1) / 7);
                    start = new Date(year, month, weekNumber * 7 + 1);
                    end = new Date(year, month, Math.min((weekNumber + 1) * 7, lastDay.getDate()));
                    break;
                }
                case 'month':
                    start = new Date(year, month, 1);
                    end = new Date(year, month + 1, 0);
                    break;
                case 'year':
                    start = new Date(year, 0, 1);
                    end = new Date(year, 11, 31);
                    break;
            }
            
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            return { start, end };
        }
        
        formatDateRange(start, end) {
            if (this.currentPeriod === 'day') {
                return start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            }
            if (this.currentPeriod === 'week') {
                return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString('id-ID', { month: 'long' })} ${start.getFullYear()}`;
            }
            if (this.currentPeriod === 'month') {
                return start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            }
            return start.getFullYear().toString();
        }
        
        calculatePercentageChange(current, previous) {
            if (previous === 0) return { value: 100, icon: '▲', class: 'positive' };
            const change = ((current - previous) / previous) * 100;
            const rounded = Math.round(change * 10) / 10;
            
            if (change > 0) {
                return { value: rounded, icon: '▲', class: 'positive' };
            } else if (change < 0) {
                return { value: Math.abs(rounded), icon: '▼', class: 'negative' };
            } else {
                return { value: 0, icon: '•', class: '' };
            }
        }
        
        updateCharts(filteredTransactions) {
            const { income, expense, balance } = calculateTotals(filteredTransactions);
            const maxValue = Math.max(income, expense, balance, 1);
            
            const incomeBar = document.getElementById('incomeBar');
            const expenseBar = document.getElementById('expenseBar');
            const balanceBar = document.getElementById('balanceBar');
            
            incomeBar.style.height = '0%';
            expenseBar.style.height = '0%';
            balanceBar.style.height = '0%';
            
            setTimeout(() => {
                incomeBar.style.height = (income / maxValue) * 100 + '%';
                expenseBar.style.height = (expense / maxValue) * 100 + '%';
                balanceBar.style.height = (balance / maxValue) * 100 + '%';
                
                document.getElementById('incomeProgress').style.width = (income / maxValue) * 100 + '%';
                document.getElementById('expenseProgress').style.width = (expense / maxValue) * 100 + '%';
                document.getElementById('balanceProgress').style.width = (balance / maxValue) * 100 + '%';
            }, 50);
            
            document.getElementById('incomeAmount').innerText = formatRupiah(income);
            document.getElementById('expenseAmount').innerText = formatRupiah(expense);
            document.getElementById('balanceAmount').innerText = formatRupiah(balance);
            
            const prevIncome = income * 0.88;
            const prevExpense = expense * 1.08;
            const prevBalance = balance * 0.85;
            
            const incomeChange = this.calculatePercentageChange(income, prevIncome);
            const expenseChange = this.calculatePercentageChange(expense, prevExpense);
            const balanceChange = this.calculatePercentageChange(balance, prevBalance);
            
            document.getElementById('incomePercentage').innerHTML = 
                `<i class="fas fa-arrow-${incomeChange.icon === '▲' ? 'up' : 'down'}"></i> ${incomeChange.value}%`;
            document.getElementById('incomePercentage').className = `info-percentage ${incomeChange.class}`;
            
            document.getElementById('expensePercentage').innerHTML = 
                `<i class="fas fa-arrow-${expenseChange.icon === '▲' ? 'up' : 'down'}"></i> ${expenseChange.value}%`;
            document.getElementById('expensePercentage').className = `info-percentage ${expenseChange.class}`;
            
            document.getElementById('balancePercentage').innerHTML = 
                `<i class="fas fa-arrow-${balanceChange.icon === '▲' ? 'up' : 'down'}"></i> ${balanceChange.value}%`;
            document.getElementById('balancePercentage').className = `info-percentage ${balanceChange.class}`;
            
            if (!isProgressBar) {
                if (chartInstance) {
                    chartInstance.destroy();
                    chartInstance = null;
                }
                
                setTimeout(() => {
                    const canvas = document.getElementById('financeChart');
                    if (!canvas) return;
                    
                    try {
                        const ctx = canvas.getContext('2d');
                        const incomeColor = getComputedStyle(document.body).getPropertyValue('--income').trim() || '#0f7b5c';
                        const expenseColor = getComputedStyle(document.body).getPropertyValue('--expense').trim() || '#b83e45';
                        const savingColor = getComputedStyle(document.body).getPropertyValue('--saving').trim() || '#f39c12';
                        
                        chartInstance = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: ['Pemasukan', 'Pengeluaran', 'Sisa Uang'],
                                datasets: [{
                                    data: [income, expense, balance],
                                    backgroundColor: [incomeColor, expenseColor, savingColor],
                                    borderWidth: 0,
                                    borderRadius: 8
                                }]
                            },
                            options: {
                                cutout: '70%',
                                responsive: true,
                                maintainAspectRatio: true,
                                animation: {
                                    animateRotate: true,
                                    animateScale: true,
                                    duration: 1000,
                                    easing: 'easeInOutQuart'
                                },
                                plugins: { 
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: (ctx) => formatRupiah(ctx.raw)
                                        }
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.error('Gagal render donut chart:', e);
                    }
                }, 100);
            }
        }
        
        update() {
            const { start, end } = this.getDateRange();
            document.getElementById('periodicDateRange').innerText = this.formatDateRange(start, end);
            
            const filtered = transactions.filter(t => {
                const tDate = new Date(t.date + 'T12:00:00');
                return tDate >= start && tDate <= end;
            });
            
            const total = filtered.reduce((sum, t) => sum + t.amount, 0);
            const avg = filtered.length ? total / filtered.length : 0;
            const largest = filtered.length ? Math.max(...filtered.map(t => t.amount)) : 0;
            
            document.getElementById('periodicAvg').innerText = formatRupiah(avg);
            document.getElementById('periodicCount').innerText = filtered.length + ' transaksi';
            document.getElementById('periodicLargest').innerText = formatRupiah(largest);
            document.getElementById('periodicTotal').innerText = formatRupiah(total);
            
            this.updateCharts(filtered);
        }
        
        navigate(direction) {
            const newDate = new Date(this.currentDate);
            switch(this.currentPeriod) {
                case 'day': newDate.setDate(newDate.getDate() + direction); break;
                case 'week': newDate.setDate(newDate.getDate() + (direction * 7)); break;
                case 'month': newDate.setMonth(newDate.getMonth() + direction); break;
                case 'year': newDate.setFullYear(newDate.getFullYear() + direction); break;
            }
            
            const today = new Date();
            if (newDate <= today) {
                this.currentDate = newDate;
                this.update();
            }
        }
        
        reset() {
            this.currentDate = new Date(this.defaultDate);
            this.update();
        }
        
        setPeriod(period) {
            this.currentPeriod = period;
            this.update();
        }
        
        init() {
            document.querySelectorAll('.periodic-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.periodic-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.setPeriod(tab.dataset.period);
                });
            });
            
            document.getElementById('periodicPrev').addEventListener('click', () => this.navigate(-1));
            document.getElementById('periodicNext').addEventListener('click', () => this.navigate(1));
            
            this.update();
        }
    }

    // PIN Functions
    function initPin() {
        const pinOverlay = document.getElementById('pinOverlay');
        const pinDots = document.getElementById('pinDots');
        const pinError = document.getElementById('pinError');
        const savedPin = localStorage.getItem(PIN_KEY);
        
        if (!savedPin || savedPin === 'null') {
            return;
        }
        
        let pinInput = '';
        const dots = pinDots.children;
        
        pinOverlay.classList.add('show');
        document.body.classList.add('pin-active');
        
        document.querySelectorAll('.pin-key').forEach(key => {
            key.addEventListener('click', function pinHandler() {
                const keyVal = this.dataset.key;
                
                if (keyVal === 'clear') {
                    pinInput = '';
                } else if (keyVal === 'backspace') {
                    pinInput = pinInput.slice(0, -1);
                } else {
                    if (pinInput.length < 4) {
                        pinInput += keyVal;
                    }
                }
                
                for (let i = 0; i < 4; i++) {
                    if (i < pinInput.length) {
                        dots[i].classList.add('filled');
                    } else {
                        dots[i].classList.remove('filled');
                    }
                }
                
                pinError.innerText = '';
                
                if (pinInput.length === 4) {
                    if (pinInput === savedPin) {
                        pinOverlay.classList.remove('show');
                        document.body.classList.remove('pin-active');
                    } else {
                        pinError.innerText = 'PIN salah! Coba lagi.';
                        pinInput = '';
                        for (let i = 0; i < 4; i++) {
                            dots[i].classList.remove('filled');
                        }
                    }
                }
            });
        });
        
        document.getElementById('forgotPin').addEventListener('click', () => {
            if (confirm('Reset PIN? Semua data akan dihapus.')) {
                localStorage.removeItem(PIN_KEY);
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        });
    }

    function setPin(newPin) {
        localStorage.setItem(PIN_KEY, newPin);
        showToast('PIN berhasil disimpan', 'success');
    }

    // Edit Modal Functions
    window.openEditModal = function(id) {
        const t = transactions.find(t => t.id === id);
        if (!t) return;
        
        editingId = id;
        
        const date = new Date(t.date + 'T' + (t.time || '00:00'));
        const dayName = getDayName(t.date);
        const formattedDate = date.toLocaleDateString('id-ID', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
        
        document.getElementById('editDay').innerText = dayName;
        document.getElementById('editFullDate').innerText = `${formattedDate} • ${t.time || '00:00'}`;
        
        if (t.type === 'income') {
            document.getElementById('editTypeBadge').classList.remove('expense');
            document.getElementById('editTypeIcon').className = 'fas fa-arrow-down';
            document.getElementById('editTypeText').innerText = 'Pemasukan';
        } else {
            document.getElementById('editTypeBadge').classList.add('expense');
            document.getElementById('editTypeIcon').className = 'fas fa-arrow-up';
            document.getElementById('editTypeText').innerText = 'Pengeluaran';
        }
        
        document.getElementById('editDesc').value = t.description || '';
        document.getElementById('editAmount').value = t.amount || '';
        document.getElementById('editDate').value = t.date || '';
        document.getElementById('editTime').value = t.time || '00:00';
        document.getElementById('editCategory').value = t.type || 'income';
        document.getElementById('editNotes').value = t.notes || '';
        
        document.getElementById('editModal').classList.add('show');
        document.body.classList.add('modal-open');
    };

    window.closeEditModal = function() {
        document.getElementById('editModal').classList.remove('show');
        document.body.classList.remove('modal-open');
        editingId = null;
    };

    window.saveEditData = function() {
        if (!editingId) return;
        
        const index = transactions.findIndex(t => t.id === editingId);
        if (index === -1) return;
        
        const newDesc = document.getElementById('editDesc').value.trim();
        const newAmount = Number(document.getElementById('editAmount').value);
        const newDate = document.getElementById('editDate').value;
        const newTime = document.getElementById('editTime').value;
        const newCategory = document.getElementById('editCategory').value;
        const newNotes = document.getElementById('editNotes').value;
        
        // Validasi
        if (!newDesc) {
            showToast('Deskripsi tidak boleh kosong', 'error');
            return;
        }
        if (newDesc.length > MAX_DESC_LENGTH) {
            showToast('Deskripsi maksimal 50 karakter', 'error');
            return;
        }
        if (isNaN(newAmount) || newAmount <= 0) {
            showToast('Jumlah harus lebih dari 0', 'error');
            return;
        }
        if (newAmount < MIN_AMOUNT) {
            showToast(`Minimal Rp ${MIN_AMOUNT}`, 'error');
            return;
        }
        if (newAmount > MAX_AMOUNT) {
            showToast(`Maksimal Rp ${MAX_AMOUNT}`, 'error');
            return;
        }
        
        // Update transaksi
        transactions[index] = {
            ...transactions[index],
            description: newDesc,
            amount: newAmount,
            date: newDate,
            time: newTime,
            type: newCategory,
            notes: newNotes
        };
        
        // Simpan ke storage
        saveToStorage();
        
        // Update UI
        refreshUI();
        
        // Tutup modal
        closeEditModal();
        
        showToast('Transaksi diperbarui', 'success');
    };

    window.deleteFromEditModal = function() {
        if (!editingId) return;
        
        if (!confirm('Hapus transaksi ini?')) return;
        
        transactions = transactions.filter(t => t.id !== editingId);
        saveToStorage();
        refreshUI();
        closeEditModal();
        showToast('Transaksi dihapus', 'info');
    };

    window.deleteTransaction = function(id) {
        if (!confirm('Hapus transaksi ini?')) return;
        
        transactions = transactions.filter(t => t.id !== id);
        saveToStorage();
        refreshUI();
        showToast('Transaksi dihapus', 'info');
    };

    // Theme Functions
    function setTheme(theme) {
        const currentCustom = localStorage.getItem('savemoney_custom_theme');
        
        document.body.classList.remove('dark-mode', 'light-mode', 'auto-mode');
        
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            localStorage.setItem('savemoney_theme_mode', 'dark');
        } else if (theme === 'light') {
            document.body.classList.add('light-mode');
            localStorage.setItem('savemoney_theme_mode', 'light');
        } else if (theme === 'auto') {
            document.body.classList.add('auto-mode');
            checkAutoNight();
            startAutoNightCheck();
        }
        
        if (currentCustom && currentCustom !== 'default') {
            document.body.classList.remove('theme-ocean', 'theme-forest', 'theme-sunset', 'theme-space');
            document.body.classList.add(`theme-${currentCustom}`);
        }
        
        document.querySelectorAll('[data-theme]').forEach(item => {
            if (item.dataset.theme === theme) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        localStorage.setItem('savemoney_theme', theme);
        
        if (!isProgressBar) {
            renderDonutChart();
        }
    }

    function setCustomTheme(customTheme) {
        document.body.classList.remove('theme-ocean', 'theme-forest', 'theme-sunset', 'theme-space');
        
        if (customTheme !== 'default') {
            document.body.classList.add(`theme-${customTheme}`);
            localStorage.setItem('savemoney_custom_theme', customTheme);
        } else {
            localStorage.removeItem('savemoney_custom_theme');
        }
        
        document.querySelectorAll('[data-custom]').forEach(item => {
            if (item.dataset.custom === customTheme) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        if (!isProgressBar) {
            renderDonutChart();
        }
    }

    function checkAutoNight() {
        const theme = localStorage.getItem('savemoney_theme');
        if (theme === 'auto') {
            const hour = new Date().getHours();
            const currentCustom = localStorage.getItem('savemoney_custom_theme');
            
            document.body.classList.remove('dark-mode', 'light-mode');
            
            if (hour >= 22 || hour < 5) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.add('light-mode');
            }
            
            if (currentCustom && currentCustom !== 'default') {
                document.body.classList.add(`theme-${currentCustom}`);
            }
        }
    }

    function startAutoNightCheck() {
        if (autoNightInterval) clearInterval(autoNightInterval);
        autoNightInterval = setInterval(checkAutoNight, 60000);
    }

    // Translations
    const translations = {
        id: {
            settingsTitle: 'Pengaturan',
            appSectionTitle: 'APLIKASI',
            tampilanText: 'Tampilan',
            darkText: 'Gelap',
            lightText: 'Siang',
            autoText: 'Auto Darkmode',
            kustomText: 'Custom Tampilan',
            defaultText: 'Bawaan',
            oceanText: 'Ocean',
            forestText: 'Forest',
            sunsetText: 'Sunset',
            spaceText: 'Ruang Angkasa',
            bahasaText: 'Bahasa',
            autoDarkText: 'Gelap (22:00 - 05:00)',
            autoCustomText: 'Kustom',
            keamananText: 'Keamanan & Privasi',
            enablePinText: 'Aktifkan PIN',
            changePinText: 'Ubah PIN',
            disablePinText: 'Nonaktifkan PIN',
            backupTitle: 'Backup & Restore',
            backupText: 'Backup',
            restoreText: 'Restore',
            incomeLabel: 'Pemasukan',
            incomeSub: 'total pemasukan',
            expenseLabel: 'Pengeluaran',
            expenseSub: 'total pengeluaran',
            savingLabel: 'Sisa Uang Anda',
            savingSub: 'saldo tersedia',
            ringkasanText: 'Ringkasan',
            pemasukanLabel: 'PEMASUKAN',
            pengeluaranLabel: 'PENGELUARAN',
            sisaUangLabel: 'SISA UANG',
            legendPemasukan: 'Pemasukan',
            legendPengeluaran: 'Pengeluaran',
            legendSisa: 'Sisa Uang',
            transaksiText: 'Transaksi',
            tambahPemasukanText: 'Tambah Pemasukan',
            tambahPengeluaranText: 'Tambah Pengeluaran',
            descLabel: 'Deskripsi',
            amountLabel: 'Jumlah (Rp)',
            tambahPemasukanBtn: 'Tambah Pemasukan',
            tambahPengeluaranBtn: 'Tambah Pengeluaran',
            resetText: 'Reset Semua',
            challengeName: '#30HariHemat'
        },
        en: {
            settingsTitle: 'Settings',
            appSectionTitle: 'APP',
            tampilanText: 'Display',
            darkText: 'Dark',
            lightText: 'Light',
            autoText: 'Auto Darkmode',
            kustomText: 'Custom Theme',
            defaultText: 'Default',
            oceanText: 'Ocean',
            forestText: 'Forest',
            sunsetText: 'Sunset',
            spaceText: 'Space',
            bahasaText: 'Language',
            autoDarkText: 'Dark (22:00 - 05:00)',
            autoCustomText: 'Custom',
            keamananText: 'Security & Privacy',
            enablePinText: 'Enable PIN',
            changePinText: 'Change PIN',
            disablePinText: 'Disable PIN',
            backupTitle: 'Backup & Restore',
            backupText: 'Backup',
            restoreText: 'Restore',
            incomeLabel: 'Income',
            incomeSub: 'total income',
            expenseLabel: 'Expense',
            expenseSub: 'total expense',
            savingLabel: 'Your Savings',
            savingSub: 'available balance',
            ringkasanText: 'Summary',
            pemasukanLabel: 'INCOME',
            pengeluaranLabel: 'EXPENSE',
            sisaUangLabel: 'BALANCE',
            legendPemasukan: 'Income',
            legendPengeluaran: 'Expense',
            legendSisa: 'Balance',
            transaksiText: 'Transactions',
            tambahPemasukanText: 'Add Income',
            tambahPengeluaranText: 'Add Expense',
            descLabel: 'Description',
            amountLabel: 'Amount (Rp)',
            tambahPemasukanBtn: 'Add Income',
            tambahPengeluaranBtn: 'Add Expense',
            resetText: 'Reset All',
            challengeName: '#30DaysSaving'
        }
    };

    function setLanguage(lang) {
        const t = translations[lang];
        if (!t) return;
        
        const elements = {
            settingsTitle: document.getElementById('settingsTitle'),
            appSectionTitle: document.getElementById('appSectionTitle'),
            tampilanText: document.getElementById('tampilanText'),
            darkText: document.getElementById('darkText'),
            lightText: document.getElementById('lightText'),
            autoText: document.getElementById('autoText'),
            kustomText: document.getElementById('kustomText'),
            defaultText: document.getElementById('defaultText'),
            oceanText: document.getElementById('oceanText'),
            forestText: document.getElementById('forestText'),
            sunsetText: document.getElementById('sunsetText'),
            spaceText: document.getElementById('spaceText'),
            bahasaText: document.getElementById('bahasaText'),
            autoDarkText: document.getElementById('autoDarkText'),
            autoCustomText: document.getElementById('autoCustomText'),
            keamananText: document.getElementById('keamananText'),
            enablePinText: document.getElementById('enablePinText'),
            changePinText: document.getElementById('changePinText'),
            disablePinText: document.getElementById('disablePinText'),
            backupTitle: document.getElementById('backupTitle'),
            backupText: document.getElementById('backupText'),
            restoreText: document.getElementById('restoreText'),
            incomeLabel: document.getElementById('incomeLabel'),
            incomeSub: document.getElementById('incomeSub'),
            expenseLabel: document.getElementById('expenseLabel'),
            expenseSub: document.getElementById('expenseSub'),
            savingLabel: document.getElementById('savingLabel'),
            savingSub: document.getElementById('savingSub'),
            ringkasanText: document.getElementById('ringkasanText'),
            pemasukanLabel: document.getElementById('pemasukanLabel'),
            pengeluaranLabel: document.getElementById('pengeluaranLabel'),
            sisaUangLabel: document.getElementById('sisaUangLabel'),
            legendPemasukan: document.getElementById('legendPemasukan'),
            legendPengeluaran: document.getElementById('legendPengeluaran'),
            legendSisa: document.getElementById('legendSisa'),
            transaksiText: document.getElementById('transaksiText'),
            tambahPemasukanText: document.getElementById('tambahPemasukanText'),
            tambahPengeluaranText: document.getElementById('tambahPengeluaranText'),
            descLabel: document.getElementById('descLabel'),
            amountLabel: document.getElementById('amountLabel'),
            descLabel2: document.getElementById('descLabel2'),
            amountLabel2: document.getElementById('amountLabel2'),
            tambahPemasukanBtn: document.getElementById('tambahPemasukanBtn'),
            tambahPengeluaranBtn: document.getElementById('tambahPengeluaranBtn'),
            resetText: document.getElementById('resetText'),
            challengeName: document.getElementById('challengeName')
        };
        
        for (let [id, el] of Object.entries(elements)) {
            if (el && t[id]) {
                el.innerText = t[id];
            }
        }
        
        const chartToggleBadge = document.getElementById('chartToggleBadge');
        if (chartToggleBadge) {
            chartToggleBadge.innerText = lang === 'id' ? 'Bulan ini' : 'This month';
        }
        
        document.querySelectorAll('[data-lang]').forEach(item => {
            item.classList.toggle('active', item.dataset.lang === lang);
        });
        
        localStorage.setItem('savemoney_language', lang);
    }

    // Storage Functions
    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }

    function loadFromStorage() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                transactions = JSON.parse(stored);
            } catch (e) {}
        }
    }

    function refreshUI() {
        renderStats();
        renderTransactions();
        if (window.periodicReport) window.periodicReport.update();
        if (!isProgressBar) renderDonutChart();
    }

    // Initialize
    loadFromStorage();
    renderStats();
    renderTransactions();

    setTimeout(() => {
        window.periodicReport = new PeriodicReport();
    }, 100);

    // Event Listeners
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('show');
        document.body.classList.add('modal-open');
    });
    
    document.getElementById('settingsClose').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('show');
        document.body.classList.remove('modal-open');
        if (activeSubmenu) {
            activeSubmenu.classList.remove('show');
            activeSubmenu = null;
        }
    });
    
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').classList.remove('show');
            document.body.classList.remove('modal-open');
            if (activeSubmenu) {
                activeSubmenu.classList.remove('show');
                activeSubmenu = null;
            }
        }
    });

    document.getElementById('tampilanItem').addEventListener('click', (e) => {
        e.stopPropagation();
        const submenu = document.getElementById('tampilanSubmenu');
        if (activeSubmenu === submenu) {
            submenu.classList.remove('show');
            activeSubmenu = null;
        } else {
            if (activeSubmenu) activeSubmenu.classList.remove('show');
            submenu.classList.add('show');
            activeSubmenu = submenu;
        }
    });
    
    document.getElementById('kustomItem').addEventListener('click', (e) => {
        e.stopPropagation();
        const submenu = document.getElementById('kustomSubmenu');
        if (activeSubmenu === submenu) {
            submenu.classList.remove('show');
            activeSubmenu = null;
        } else {
            if (activeSubmenu) activeSubmenu.classList.remove('show');
            submenu.classList.add('show');
            activeSubmenu = submenu;
        }
    });
    
    document.getElementById('bahasaItem').addEventListener('click', (e) => {
        e.stopPropagation();
        const submenu = document.getElementById('bahasaSubmenu');
        if (activeSubmenu === submenu) {
            submenu.classList.remove('show');
            activeSubmenu = null;
        } else {
            if (activeSubmenu) activeSubmenu.classList.remove('show');
            submenu.classList.add('show');
            activeSubmenu = submenu;
        }
    });

    document.getElementById('keamananItem').addEventListener('click', (e) => {
        e.stopPropagation();
        const submenu = document.getElementById('keamananSubmenu');
        if (activeSubmenu === submenu) {
            submenu.classList.remove('show');
            activeSubmenu = null;
        } else {
            if (activeSubmenu) activeSubmenu.classList.remove('show');
            submenu.classList.add('show');
            activeSubmenu = submenu;
        }
    });

    document.querySelectorAll('[data-theme]').forEach(el => {
        el.addEventListener('click', () => {
            setTheme(el.dataset.theme);
        });
    });

    document.querySelectorAll('[data-custom]').forEach(el => {
        el.addEventListener('click', () => {
            setCustomTheme(el.dataset.custom);
        });
    });

    document.querySelectorAll('[data-lang]').forEach(el => {
        el.addEventListener('click', () => {
            setLanguage(el.dataset.lang);
        });
    });

    document.querySelector('[data-theme="auto"]').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('autoDarkmodeSubmenu').classList.toggle('show');
    });

    document.querySelectorAll('[data-auto]').forEach(el => {
        el.addEventListener('click', () => {
            autoModeType = el.dataset.auto;
            localStorage.setItem('savemoney_auto_type', autoModeType);
            
            document.querySelectorAll('[data-auto]').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
            
            document.getElementById('customTimePanel').style.display = 
                autoModeType === 'custom' ? 'block' : 'none';
            
            if (localStorage.getItem('savemoney_theme') === 'auto') {
                checkAutoNight();
            }
        });
    });

    document.getElementById('saveCustomTimeBtn').addEventListener('click', () => {
        const start = document.getElementById('darkStartTime').value;
        const end = document.getElementById('darkEndTime').value;
        customDarkStart = start;
        customDarkEnd = end;
        localStorage.setItem('savemoney_dark_start', start);
        localStorage.setItem('savemoney_dark_end', end);
        showToast('Waktu auto darkmode diperbarui', 'success');
    });

    document.getElementById('enablePin').addEventListener('click', () => {
        const pin = prompt('Masukkan PIN baru (4 digit angka):');
        if (pin && pin.length === 4 && /^\d+$/.test(pin)) {
            setPin(pin);
            showToast('PIN diaktifkan', 'success');
        } else {
            showToast('PIN harus 4 digit angka', 'error');
        }
    });

    document.getElementById('changePin').addEventListener('click', () => {
        const oldPin = prompt('Masukkan PIN lama:');
        const savedPin = localStorage.getItem(PIN_KEY);
        
        if (oldPin === savedPin) {
            const newPin = prompt('Masukkan PIN baru (4 digit):');
            if (newPin && newPin.length === 4 && /^\d+$/.test(newPin)) {
                setPin(newPin);
                showToast('PIN berhasil diubah', 'success');
            } else {
                showToast('PIN harus 4 digit angka', 'error');
            }
        } else {
            showToast('PIN salah!', 'error');
        }
    });

    document.getElementById('disablePin').addEventListener('click', () => {
        if (confirm('Nonaktifkan PIN?')) {
            localStorage.removeItem(PIN_KEY);
            showToast('PIN dinonaktifkan', 'success');
        }
    });

    document.getElementById('backupBtn').addEventListener('click', () => {
        const data = JSON.stringify(transactions);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup berhasil', 'success');
    });

    document.getElementById('restoreFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    transactions = data;
                    saveToStorage();
                    refreshUI();
                    showToast('Restore berhasil', 'success');
                } else {
                    showToast('File tidak valid', 'error');
                }
            } catch {
                showToast('File tidak valid', 'error');
            }
        };
        reader.readAsText(file);
        document.getElementById('restoreFile').value = '';
    });

    document.getElementById('ringkasanTitle').addEventListener('click', toggleChartType);

    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderTransactions();
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchTerm = '';
            renderTransactions();
        });
    }

    document.getElementById('addIncomeBtn').addEventListener('click', () => {
        const desc = document.getElementById('incomeDesc').value;
        const amount = Number(document.getElementById('incomeAmountInput').value);
        
        if (!desc.trim()) {
            document.getElementById('incomeDescError').innerText = 'Deskripsi tidak boleh kosong';
            return;
        }
        if (desc.length > MAX_DESC_LENGTH) {
            document.getElementById('incomeDescError').innerText = 'Maksimal 50 karakter';
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            document.getElementById('incomeAmountError').innerText = 'Jumlah harus lebih dari 0';
            return;
        }
        if (amount < MIN_AMOUNT) {
            document.getElementById('incomeAmountError').innerText = `Minimal Rp ${MIN_AMOUNT}`;
            return;
        }
        
        const { date, time } = getCurrentWIBDateTime();

        transactions.push({
            id: Date.now(),
            type: 'income',
            description: desc.trim(),
            amount: amount,
            date: date,
            time: time,
            notes: ''
        });
        
        saveToStorage();
        refreshUI();
        
        document.getElementById('incomeDesc').value = '';
        document.getElementById('incomeAmountInput').value = '';
        document.getElementById('incomeDescError').innerText = '';
        document.getElementById('incomeAmountError').innerText = '';
        showToast('Pemasukan ditambahkan', 'success');
    });

    document.getElementById('addExpenseBtn').addEventListener('click', () => {
        const desc = document.getElementById('expenseDesc').value;
        const amount = Number(document.getElementById('expenseAmountInput').value);
        
        if (!desc.trim()) {
            document.getElementById('expenseDescError').innerText = 'Deskripsi tidak boleh kosong';
            return;
        }
        if (desc.length > MAX_DESC_LENGTH) {
            document.getElementById('expenseDescError').innerText = 'Maksimal 50 karakter';
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            document.getElementById('expenseAmountError').innerText = 'Jumlah harus lebih dari 0';
            return;
        }
        if (amount < MIN_AMOUNT) {
            document.getElementById('expenseAmountError').innerText = `Minimal Rp ${MIN_AMOUNT}`;
            return;
        }
        
        const { date, time } = getCurrentWIBDateTime();

        transactions.push({
            id: Date.now(),
            type: 'expense',
            description: desc.trim(),
            amount: amount,
            date: date,
            time: time,
            notes: ''
        });
        
        saveToStorage();
        refreshUI();
        
        document.getElementById('expenseDesc').value = '';
        document.getElementById('expenseAmountInput').value = '';
        document.getElementById('expenseDescError').innerText = '';
        document.getElementById('expenseAmountError').innerText = '';
        showToast('Pengeluaran ditambahkan', 'success');
    });

    document.getElementById('resetDataBtn').addEventListener('click', () => {
        if (confirm('Reset semua data?')) {
            transactions = [];
            saveToStorage();
            refreshUI();
            showToast('Semua data direset', 'info');
        }
    });

    document.getElementById('incomeInfo').addEventListener('click', () => {
        document.querySelectorAll('.info-item').forEach(i => i.classList.remove('active'));
        document.getElementById('incomeInfo').classList.add('active');
    });
    
    document.getElementById('expenseInfo').addEventListener('click', () => {
        document.querySelectorAll('.info-item').forEach(i => i.classList.remove('active'));
        document.getElementById('expenseInfo').classList.add('active');
    });
    
    document.getElementById('balanceInfo').addEventListener('click', () => {
        document.querySelectorAll('.info-item').forEach(i => i.classList.remove('active'));
        document.getElementById('balanceInfo').classList.add('active');
    });

    document.querySelector('[data-type="income"]').addEventListener('click', () => {
        document.getElementById('incomeInfo').click();
    });
    
    document.querySelector('[data-type="expense"]').addEventListener('click', () => {
        document.getElementById('expenseInfo').click();
    });
    
    document.querySelector('[data-type="balance"]').addEventListener('click', () => {
        document.getElementById('balanceInfo').click();
    });

    document.getElementById('addPhotoBtn').addEventListener('click', () => {
        document.getElementById('photoUpload').click();
    });

    document.getElementById('photoUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('defaultAvatar').style.display = 'none';
                document.getElementById('profileImage').style.display = 'block';
                document.getElementById('profileImage').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Load saved settings
    const savedTheme = localStorage.getItem('savemoney_theme');
    if (savedTheme) {
        setTheme(savedTheme);
        if (savedTheme === 'auto') startAutoNightCheck();
    } else {
        setTheme('dark');
    }

    const savedCustom = localStorage.getItem('savemoney_custom_theme');
    if (savedCustom) setCustomTheme(savedCustom);

    const savedLang = localStorage.getItem('savemoney_language');
    if (savedLang) {
        setLanguage(savedLang);
    } else {
        setLanguage('id');
    }

    const savedStart = localStorage.getItem('savemoney_dark_start');
    const savedEnd = localStorage.getItem('savemoney_dark_end');
    const savedAutoType = localStorage.getItem('savemoney_auto_type');
    
    if (savedStart) {
        customDarkStart = savedStart;
        document.getElementById('darkStartTime').value = savedStart;
    }
    if (savedEnd) {
        customDarkEnd = savedEnd;
        document.getElementById('darkEndTime').value = savedEnd;
    }
    if (savedAutoType) {
        autoModeType = savedAutoType;
        document.getElementById('customTimePanel').style.display = 
            autoModeType === 'custom' ? 'block' : 'none';
        document.querySelectorAll('[data-auto]').forEach(i => {
            i.classList.toggle('active', i.dataset.auto === autoModeType);
        });
    }

    setTimeout(() => {
        initPin();
    }, 500);

    window.openEditModal = openEditModal;
    window.closeEditModal = closeEditModal;
    window.saveEditData = saveEditData;
    window.deleteTransaction = deleteTransaction;
    window.deleteFromEditModal = deleteFromEditModal;
})();
