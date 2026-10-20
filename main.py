import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
import pandas as pd
import uuid

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from typing import List

from .models import Base, User, Contribution, Loan, LoanRepayment, AuditLog, UserRole, LoanStatus, LoanType

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-coop-key-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

# Database setup
# Priority: Use environment variable for production (PostgreSQL), fallback to SQLite for local dev
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./coop_society.db")

if "postgresql" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Cooperative Society Management API")

# --- CORS SETTINGS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SERVE FRONTEND FILES ---
# Mount the current directory to serve static files (CSS, JS)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def read_index():
    return FileResponse("index.html")

# --- Pydantic Schemas ---
class UserCreate(BaseModel):
    member_id: str
    full_name: str
    email: EmailStr
    password: str
    phone_number: Optional[str] = None
    role: UserRole = UserRole.MEMBER

class UserOut(BaseModel):
    id: int
    member_id: str
    full_name: str
    email: EmailStr
    role: UserRole

class Token(BaseModel):
    access_token: str
    token_type: str

class LoanApplication(BaseModel):
    loan_type: str
    principal_amount: float
    tenure_months: int

# --- Dependencies ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Administrative access required")
    return current_user

# --- Auth Endpoints ---
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires
    to_encode = {"exp": expire, "sub": str(user.id)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return {"access_token": encoded_jwt, "token_type": "bearer"}

@app.post("/users/", response_model=UserOut)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pw = pwd_context.hash(user.password)
    db_user = User(
        member_id=user.member_id,
        full_name=user.full_name,
        email=user.email,
        password_hash=hashed_pw,
        phone_number=user.phone_number,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Member Endpoints ---
@app.get("/me/dashboard")
def get_member_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Calculate total contributions
    total_contributions = db.query(func.sum(Contribution.amount)).filter(Contribution.user_id == current_user.id).scalar() or 0.0

    # Get active loans
    active_loans = db.query(Loan).filter(Loan.user_id == current_user.id, Loan.status != LoanStatus.PAID).all()

    loan_summary = []
    for loan in active_loans:
        loan_summary.append({
            "loan_id": loan.id,
            "type": loan.loan_type,
            "principal": loan.principal_amount,
            "remaining": loan.balance_remaining,
            "status": loan.status,
            "end_date": loan.end_date
        })

    return {
        "user": current_user,
        "total_contributions": total_contributions,
        "active_loans": loan_summary
    }

@app.post("/loans/apply")
def apply_for_loan(application: LoanApplication, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Basic logic: Calculate total repayable (simple 5% interest for demo)
    interest_rate = 5.0
    total_repayable = application.principal_amount * (1 + (interest_rate/100))

    new_loan = Loan(
        user_id=current_user.id,
        loan_type=application.loan_type,
        principal_amount=application.principal_amount,
        interest_rate=interest_rate,
        total_repayable=total_repayable,
        balance_remaining=total_repayable,
        tenure_months=application.tenure_months,
        status=LoanStatus.PENDING
    )
    db.add(new_loan)
    db.commit()
    return {"message": "Loan application submitted successfully", "loan_id": new_loan.id}

# --- Admin Endpoints ---
@app.post("/admin/upload-contributions")
async def upload_contributions(
    file: UploadFile = File(...),
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel or CSV file.")

    try:
        # Read file into pandas dataframe
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file.file)
        else:
            df = pd.read_excel(file.file)

        # Expected columns: MemberID, Amount, Date, Reference
        required_columns = {'MemberID', 'Amount', 'Date', 'Reference'}
        if not required_columns.issubset(df.columns):
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns. The file must contain: {', '.join(required_columns)}"
            )

        batch_id = str(uuid.uuid4())
        processed_count = 0
        errors = []

        # Process rows in a transaction
        for index, row in df.iterrows():
            try:
                member_id = str(row['MemberID']).strip()
                amount = float(row['Amount'])
                date_str = str(row['Date'])
                ref = str(row['Reference']).strip()

                # Find user by member_id
                user = db.query(User).filter(User.member_id == member_id).first()
                if not user:
                    errors.append(f"Row {index+1}: Member ID {member_id} not found")
                    continue

                # Create contribution
                contribution = Contribution(
                    user_id=user.id,
                    amount=amount,
                    transaction_ref=ref,
                    upload_batch_id=batch_id,
                    payment_method="Excel Upload"
                )
                db.add(contribution)
                processed_count += 1

            except Exception as e:
                errors.append(f"Row {index+1}: {str(e)}")

        # Log the admin action
        audit = AuditLog(
            admin_id=current_user.id,
            action="UPLOAD_CONTRIBUTIONS",
            details=f"Processed {processed_count} contributions. Errors: {len(errors)}",
            file_name=file.filename
        )
        db.add(audit)

        db.commit()

        return {
            "message": "Upload completed",
            "processed": processed_count,
            "errors": errors,
            "batch_id": batch_id
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.patch("/admin/loans/{loan_id}/status")
async def update_loan_status(
    loan_id: int,
    status_update: LoanStatus,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    loan = db.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    loan.status = status_update

    # If approved, set the start date to today
    if status_update == LoanStatus.APPROVED:
        loan.start_date = datetime.utcnow()
        # Logic for end_date based on tenure_months
        loan.end_date = datetime.utcnow() + timedelta(days=loan.tenure_months * 30)

    db.commit()
    return {"message": f"Loan status updated to {status_update}"}
