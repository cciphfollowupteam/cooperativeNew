import os
from datetime import datetime
from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class UserRole(str, Enum):
    MEMBER = "member"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class LoanStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISBURSED = "disbursed"
    PAID = "paid"

class LoanType(str, Enum):
    EMERGENCY = "emergency"
    BUSINESS = "business"
    EDUCATION = "education"
    PERSONAL = "personal"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(String, unique=True, index=True, nullable=False) # Official Coop ID
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String)
    password_hash = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.MEMBER)
    is_active = Column(Boolean, default=True)
    joined_date = Column(DateTime, default=datetime.utcnow)
    address = Column(String)
    profile_picture = Column(String, nullable=True)

    contributions = relationship("Contribution", back_populates="user")
    loans = relationship("Loan", back_populates="user")

class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String) # e.g., Bank Transfer, Cash, Check
    transaction_ref = Column(String, unique=True) # Reference from bank/excel
    upload_batch_id = Column(String) # To track which excel upload this came from
    notes = Column(String)

    user = relationship("User", back_populates="contributions")

class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    loan_type = Column(SQLEnum(LoanType), default=LoanType.PERSONAL)
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False) # Percentage
    total_repayable = Column(Float, nullable=False)
    balance_remaining = Column(Float, nullable=False)
    tenure_months = Column(Integer, nullable=False) # Total months to repay
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(SQLEnum(LoanStatus), default=LoanStatus.PENDING)
    application_date = Column(DateTime, default=datetime.utcnow)
    approval_date = Column(DateTime, nullable=True)
    rejected_reason = Column(String, nullable=True)

    user = relationship("User", back_populates="loans")
    repayments = relationship("LoanRepayment", back_populates="loan")

class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    transaction_ref = Column(String)

    loan = relationship("Loan", back_populates="repayments")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String, nullable=False) # e.g., "UPLOAD_CONTRIBUTIONS"
    details = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    file_name = Column(String)
