# 🏢 CoopManage | Professional Cooperative Society Platform

CoopManage is an enterprise-grade management system designed for Cooperative Societies. It streamlines the management of member contributions, loan applications, and administrative financial operations.

## ✨ Key Features

### 👥 Member Portal
- **Financial Dashboard**: Real-time view of total contributions and active loan balances.
- **Loan Management**: Apply for various loan types (Emergency, Business, Education, Personal) directly from the platform.
- **Transparency**: Track loan approval status and repayment deadlines.
- **Secure Access**: JWT-based authentication for secure account management.

### 🛠️ Admin Power Tools
- **Bulk Data Engine**: Upload Excel (`.xlsx`, `.xls`) or CSV files to update thousands of member contributions in seconds.
- **Loan Workflow**: A centralized queue to review, approve, or reject loan applications.
- **Financial Audit Trail**: Complete logs of all administrative actions and file uploads for security and compliance.
- **Member Management**: Full control over member profiles and roles.

## 🚀 Tech Stack

- **Backend**: Python / FastAPI (Serverless ready)
- **Frontend**: Vanilla JavaScript / Tailwind CSS (Modern FinTech UI)
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **Deployment**: Vercel (with `@vercel/python` runtime)

## 🛠️ Local Installation & Testing

### 1. Setup Backend
```bash
# Navigate to project folder
cd coop_final_app

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload
```

### 2. Launch Frontend
Simply open `index.html` in any modern web browser.

### 3. Create your first Admin User
Run this command in your terminal to set up your administrative account:
```bash
python -c "import sys; sys.path.append('.'); from main import app; from fastapi.testclient import TestClient; client = TestClient(app); client.post('/users/', json={'member_id': 'ADMIN01', 'full_name': 'Super Admin', 'email': 'admin@coop.com', 'password': 'password123', 'role': 'admin'}); print('✅ Admin created: admin@coop.com / password123')"
```

## ☁️ Deploying to Vercel

1. Push this folder to a **GitHub Repository**.
2. Import the repository into **Vercel**.
3. **Important**: Add a `DATABASE_URL` environment variable in Vercel (e.g., from Supabase) to ensure your data is saved permanently in the cloud.

---
*Developed with Claude Code - A Professional Financial Management Solution.*
