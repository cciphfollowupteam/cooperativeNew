const API_URL = '/api'; // Use relative path for Vercel/Production
 // Changed from localhost to 127.0.0.1 for better compatibility

let currentUser = null;
let authToken = null;

// --- View Templates ---

const views = {
    dashboard: (data) => `
        <div class="fade-in space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="stat-card">
                    <div class="bg-emerald-100 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center">
                        <i class="fa-solid fa-wallet text-xl"></i>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 font-medium">Total Contributions</p>
                        <h3 class="text-2xl font-bold text-slate-800">$${data.total_contributions.toLocaleString()}</h3>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="bg-rose-100 text-rose-600 w-12 h-12 rounded-xl flex items-center justify-center">
                        <i class="fa-solid fa-hand-holding-dollar text-xl"></i>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 font-medium">Loan Balance</p>
                        <h3 class="text-2xl font-bold text-slate-800">$${data.active_loans.reduce((acc, l) => acc + l.remaining, 0).toLocaleString()}</h3>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="bg-indigo-100 text-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center">
                        <i class="fa-solid fa-calendar-check text-xl"></i>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 font-medium">Active Loans</p>
                        <h3 class="text-2xl font-bold text-slate-800">${data.active_loans.length}</h3>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">My Loan Summary</h3>
                    <button onclick="showView('loans')" class="text-indigo-600 text-sm font-medium hover:underline">View All</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th class="px-6 py-3">Type</th>
                                <th class="px-6 py-3">Principal</th>
                                <th class="px-6 py-3">Remaining</th>
                                <th class="px-6 py-3">Status</th>
                                <th class="px-6 py-3">Due Date</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${data.active_loans.length ? data.active_loans.map(loan => `
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="px-6 py-4 font-medium text-slate-700">${loan.type}</td>
                                    <td class="px-6 py-4 text-slate-600">$${loan.principal.toLocaleString()}</td>
                                    <td class="px-6 py-4 text-slate-600">$${loan.remaining.toLocaleString()}</td>
                                    <td class="px-6 py-4">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(loan.status)}">
                                            ${loan.status}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 text-slate-600">${loan.end_date ? new Date(loan.end_date).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No active loans found.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `,
    loans: (data) => `
        <div class="fade-in space-y-6">
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-bold text-slate-800">Apply for a New Loan</h3>
            </div>
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-2xl">
                <form id="loan-app-form" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Loan Type</label>
                            <select id="loan-type" class="input-field">
                                <option value="personal">Personal</option>
                                <option value="business">Business</option>
                                <option value="emergency">Emergency</option>
                                <option value="education">Education</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                            <input type="number" id="loan-amount" required class="input-field" placeholder="0.00">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Repayment Period (Months)</label>
                        <input type="number" id="loan-tenure" required class="input-field" placeholder="e.g. 12">
                    </div>
                    <button type="submit" class="btn-primary w-full mt-4">Submit Application</button>
                </form>
            </div>
        </div>
    `,
    'admin-upload': () => `
        <div class="fade-in space-y-6">
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-3xl">
                <div class="text-center mb-8">
                    <h3 class="text-xl font-bold text-slate-800">Upload Payment Sheet</h3>
                    <p class="text-slate-500">Upload .xlsx or .csv files to update member contributions</p>
                </div>
                <div id="drop-zone" class="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-indigo-500 transition-all cursor-pointer bg-slate-50">
                    <i class="fa-solid fa-cloud-arrow-up text-4xl text-slate-300 mb-4"></i>
                    <p class="text-slate-600 font-medium">Click or Drag & Drop your file here</p>
                    <p class="text-xs text-slate-400 mt-2">Required columns: MemberID, Amount, Date, Reference</p>
                    <input type="file" id="file-upload" class="hidden" accept=".xlsx, .xls, .csv">
                </div>
                <div id="upload-status" class="mt-6 hidden"></div>
            </div>
        </div>
    `,
    'admin-loans': async () => {
        const res = await fetch(`${API_URL}/admin/loans`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const loans = await res.json();
        return `
            <div class="fade-in space-y-6">
                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="p-6 border-b border-slate-100">
                        <h3 class="font-bold text-slate-800">Loan Approval Queue</h3>
                    </div>
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th class="px-6 py-3">Member</th>
                                <th class="px-6 py-3">Amount</th>
                                <th class="px-6 py-3">Type</th>
                                <th class="px-6 py-3">Status</th>
                                <th class="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${loans.map(loan => `
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="px-6 py-4 font-medium text-slate-700">${loan.user_name}</td>
                                    <td class="px-6 py-4">$${loan.principal_amount}</td>
                                    <td class="px-6 py-4">${loan.loan_type}</td>
                                    <td class="px-6 py-4">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(loan.status)}">${loan.status}</span>
                                    </td>
                                    <td class="px-6 py-4 space-x-2">
                                        <button onclick="updateLoanStatus(${loan.id}, 'approved')" class="text-emerald-600 hover:text-emerald-700 font-medium text-sm">Approve</button>
                                        <button onclick="updateLoanStatus(${loan.id}, 'rejected')" class="text-rose-600 hover:text-rose-700 font-medium text-sm">Reject</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};

function getStatusClass(status) {
    const maps = {
        'pending': 'bg-amber-100 text-amber-700',
        'approved': 'bg-emerald-100 text-emerald-700',
        'rejected': 'bg-rose-100 text-rose-700',
        'disbursed': 'bg-indigo-100 text-indigo-700',
        'paid': 'bg-slate-100 text-slate-700'
    };
    return maps[status.toLowerCase()] || 'bg-slate-100 text-slate-700';
}

// --- Core Logic ---

async function login(email, password) {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    try {
        const res = await fetch(`${API_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData)
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.detail || 'Invalid credentials');
        }
        return await res.json();
    } catch (e) {
        if (e.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Is the Python terminal running?');
        }
        throw e;
    }
}

async function fetchDashboard() {
    const res = await fetch(`${API_URL}/me/dashboard`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return await res.json();
}

async function applyLoan(type, amount, tenure) {
    const res = await fetch(`${API_URL}/loans/apply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ loan_type: type, principal_amount: amount, tenure_months: tenure })
    });
    return await res.json();
}

async function uploadExcel(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_URL}/admin/upload-contributions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
    });
    return await res.json();
}

async function updateLoanStatus(loanId, status) {
    const res = await fetch(`${API_URL}/admin/loans/${loanId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ status_update: status })
    });
    return await res.json();
}

async function showView(viewName) {
    const content = document.getElementById('main-content');
    const title = document.getElementById('view-title');

    // Update active nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`nav-${viewName}`).classList.add('active');

    let data = {};
    if (viewName === 'dashboard') {
        title.innerText = 'Dashboard';
        data = await fetchDashboard();
    } else if (viewName === 'loans') {
        title.innerText = 'Loan Applications';
    } else if (viewName === 'admin-upload') {
        title.innerText = 'Bulk Data Upload';
    } else if (viewName === 'admin-loans') {
        title.innerText = 'Loan Management';
    }

    content.innerHTML = await views[viewName](data);

    // Re-attach event listeners for new HTML
    if (viewName === 'loans') {
        document.getElementById('loan-app-form').onsubmit = async (e) => {
            e.preventDefault();
            const type = document.getElementById('loan-type').value;
            const amount = document.getElementById('loan-amount').value;
            const tenure = document.getElementById('loan-tenure').value;
            const res = await applyLoan(type, amount, tenure);
            alert(res.message);
        };
    }
    if (viewName === 'admin-upload') {
        const dz = document.getElementById('drop-zone');
        const input = document.getElementById('file-upload');
        dz.onclick = () => input.click();
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const statusDiv = document.getElementById('upload-status');
            statusDiv.classList.remove('hidden');
            statusDiv.innerHTML = '<p class="text-indigo-600 animate-pulse">Uploading and processing...</p>';
            const res = await uploadExcel(file);
            statusDiv.innerHTML = `
                <div class="p-4 rounded-lg ${res.errors.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}">
                    <p class="font-bold">${res.message}</p>
                    <p class="text-sm">Processed: ${res.processed} | Errors: ${res.errors.length}</p>
                    ${res.errors.length ? `<ul class="text-xs mt-2 list-disc pl-4">${res.errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
                </div>
            `;
        };
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
}

// --- Init ---

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const data = await login(email, password);

        authToken = data.access_token;
        localStorage.setItem('token', authToken);

        // Fetch user profile to set role
        const userRes = await fetch(`${API_URL}/me/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const userProfile = await userRes.json();
        currentUser = userProfile.user;
        localStorage.setItem('user', JSON.stringify(currentUser));

        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        document.getElementById('user-name').innerText = currentUser.full_name;

        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
            document.getElementById('admin-nav').classList.remove('hidden');
        }

        showView('dashboard');
    } catch (e) {
        alert('Login failed: ' + e.message);
    }
};

window.onload = () => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        document.getElementById('user-name').innerText = currentUser.full_name;
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
            document.getElementById('admin-nav').classList.remove('hidden');
        }
        showView('dashboard');
    }
};
