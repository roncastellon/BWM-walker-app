from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'default_secret_key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI(title="WagWalk API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    WALKER = "walker"
    CLIENT = "client"

class ServiceType(str, Enum):
    WALK_30 = "walk_30"
    WALK_60 = "walk_60"
    OVERNIGHT = "overnight"
    TRANSPORT = "transport"
    CONCIERGE = "concierge"

class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class InvoiceStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class BillingCycle(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

# Models
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.CLIENT
    bio: Optional[str] = None
    profile_image: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.CLIENT

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class Pet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    name: str
    species: str = "dog"
    breed: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PetCreate(BaseModel):
    name: str
    species: str = "dog"
    breed: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None

class ServicePricing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_type: ServiceType
    name: str
    description: str
    price: float
    duration_minutes: int
    is_active: bool = True

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    walker_id: Optional[str] = None
    pet_ids: List[str]
    service_type: ServiceType
    scheduled_date: str
    scheduled_time: str
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    notes: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    actual_duration_minutes: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentCreate(BaseModel):
    pet_ids: List[str]
    service_type: ServiceType
    scheduled_date: str
    scheduled_time: str
    walker_id: Optional[str] = None
    notes: Optional[str] = None

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    appointment_ids: List[str]
    amount: float
    status: InvoiceStatus = InvoiceStatus.PENDING
    due_date: str
    paid_date: Optional[str] = None
    stripe_session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    receiver_id: Optional[str] = None
    is_group_message: bool = False
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False

class MessageCreate(BaseModel):
    receiver_id: Optional[str] = None
    is_group_message: bool = False
    content: str

class Timesheet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    walker_id: str
    week_start: str
    week_end: str
    total_hours: float
    total_walks: int
    appointments: List[str]
    submitted: bool = False
    approved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str
    client_id: str
    amount: float
    currency: str = "usd"
    session_id: Optional[str] = None
    payment_status: str = "pending"
    metadata: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload.get("user_id")}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role
    )
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    token = create_access_token({"user_id": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserResponse(**user_dict)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": user['id'], "role": user['role']})
    return TokenResponse(
        access_token=token,
        user=UserResponse(**user)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# User Routes
@api_router.get("/users/walkers", response_model=List[UserResponse])
async def get_walkers():
    walkers = await db.users.find({"role": "walker", "is_active": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(**w) for w in walkers]

@api_router.get("/users/clients", response_model=List[UserResponse])
async def get_clients(current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    clients = await db.users.find({"role": "client", "is_active": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(**c) for c in clients]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    if current_user['id'] != user_id and current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_fields = ['full_name', 'phone', 'bio', 'profile_image']
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    return {"message": "User updated successfully"}

# Pet Routes
@api_router.post("/pets", response_model=Pet)
async def create_pet(pet_data: PetCreate, current_user: dict = Depends(get_current_user)):
    pet = Pet(owner_id=current_user['id'], **pet_data.model_dump())
    pet_dict = pet.model_dump()
    pet_dict['created_at'] = pet_dict['created_at'].isoformat()
    await db.pets.insert_one(pet_dict)
    return pet

@api_router.get("/pets", response_model=List[Pet])
async def get_pets(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'client':
        pets = await db.pets.find({"owner_id": current_user['id']}, {"_id": 0}).to_list(100)
    else:
        pets = await db.pets.find({}, {"_id": 0}).to_list(500)
    return pets

@api_router.get("/pets/{pet_id}", response_model=Pet)
async def get_pet(pet_id: str):
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return pet

@api_router.delete("/pets/{pet_id}")
async def delete_pet(pet_id: str, current_user: dict = Depends(get_current_user)):
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if current_user['role'] == 'client' and pet['owner_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.pets.delete_one({"id": pet_id})
    return {"message": "Pet deleted successfully"}

# Service Pricing Routes
@api_router.get("/services", response_model=List[ServicePricing])
async def get_services():
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not services:
        # Initialize default services
        default_services = [
            ServicePricing(service_type=ServiceType.WALK_30, name="30-Minute Walk", description="A quick 30-minute walk for your pet", price=25.00, duration_minutes=30),
            ServicePricing(service_type=ServiceType.WALK_60, name="60-Minute Walk", description="A full hour walk with play time", price=40.00, duration_minutes=60),
            ServicePricing(service_type=ServiceType.OVERNIGHT, name="Overnight Pet Sitting", description="24-hour in-home pet care", price=75.00, duration_minutes=1440),
            ServicePricing(service_type=ServiceType.TRANSPORT, name="Pet Transport", description="Safe transport to vet or groomer", price=35.00, duration_minutes=60),
            ServicePricing(service_type=ServiceType.CONCIERGE, name="Concierge Service", description="Premium care including feeding, walks, and attention", price=50.00, duration_minutes=120),
        ]
        for service in default_services:
            await db.services.insert_one(service.model_dump())
        services = [s.model_dump() for s in default_services]
    return services

@api_router.post("/services", response_model=ServicePricing)
async def create_service(service: ServicePricing, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    await db.services.insert_one(service.model_dump())
    return service

# Appointment Routes
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appt_data: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    appointment = Appointment(
        client_id=current_user['id'],
        **appt_data.model_dump()
    )
    appt_dict = appointment.model_dump()
    appt_dict['created_at'] = appt_dict['created_at'].isoformat()
    await db.appointments.insert_one(appt_dict)
    return appointment

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'client':
        query['client_id'] = current_user['id']
    elif current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(500)
    return appointments

@api_router.get("/appointments/calendar")
async def get_calendar_appointments(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'client':
        query['client_id'] = current_user['id']
    elif current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(500)
    
    # Format for calendar view
    calendar_events = []
    for appt in appointments:
        client = await db.users.find_one({"id": appt['client_id']}, {"_id": 0, "full_name": 1})
        walker = None
        if appt.get('walker_id'):
            walker = await db.users.find_one({"id": appt['walker_id']}, {"_id": 0, "full_name": 1})
        
        calendar_events.append({
            **appt,
            "client_name": client.get('full_name') if client else "Unknown",
            "walker_name": walker.get('full_name') if walker else "Unassigned"
        })
    return calendar_events

@api_router.get("/appointments/{appt_id}", response_model=Appointment)
async def get_appointment(appt_id: str):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt

@api_router.put("/appointments/{appt_id}")
async def update_appointment(appt_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one({"id": appt_id}, {"$set": update_data})
    return {"message": "Appointment updated successfully"}

@api_router.post("/appointments/{appt_id}/start")
async def start_walk(appt_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    start_time = datetime.now(timezone.utc).isoformat()
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {"status": "in_progress", "start_time": start_time, "walker_id": current_user['id']}}
    )
    return {"message": "Walk started", "start_time": start_time}

@api_router.post("/appointments/{appt_id}/end")
async def end_walk(appt_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt or not appt.get('start_time'):
        raise HTTPException(status_code=400, detail="Walk not started")
    
    end_time = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(appt['start_time'].replace('Z', '+00:00'))
    duration = int((end_time - start_time).total_seconds() / 60)
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {
            "status": "completed",
            "end_time": end_time.isoformat(),
            "actual_duration_minutes": duration
        }}
    )
    return {"message": "Walk completed", "duration_minutes": duration}

@api_router.put("/appointments/{appt_id}/assign")
async def assign_walker(appt_id: str, walker_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.appointments.update_one({"id": appt_id}, {"$set": {"walker_id": walker_id}})
    return {"message": "Walker assigned successfully"}

# Invoice Routes
@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(client_id: str, appointment_ids: List[str], current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Calculate total from appointments
    total = 0.0
    for appt_id in appointment_ids:
        appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
        if appt:
            service = await db.services.find_one({"service_type": appt['service_type']}, {"_id": 0})
            if service:
                total += service['price']
    
    due_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    invoice = Invoice(
        client_id=client_id,
        appointment_ids=appointment_ids,
        amount=total,
        due_date=due_date
    )
    invoice_dict = invoice.model_dump()
    invoice_dict['created_at'] = invoice_dict['created_at'].isoformat()
    await db.invoices.insert_one(invoice_dict)
    return invoice

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'client':
        query['client_id'] = current_user['id']
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(500)
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

# Payment Routes
@api_router.post("/payments/checkout")
async def create_checkout_session(invoice_id: str, origin_url: str, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    api_key = os.environ.get('STRIPE_API_KEY')
    webhook_url = f"{origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{origin_url}/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/billing"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(invoice['amount']),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "invoice_id": invoice_id,
            "client_id": current_user['id']
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction = PaymentTransaction(
        invoice_id=invoice_id,
        client_id=current_user['id'],
        amount=float(invoice['amount']),
        session_id=session.session_id,
        payment_status="pending",
        metadata={"invoice_id": invoice_id}
    )
    trans_dict = transaction.model_dump()
    trans_dict['created_at'] = trans_dict['created_at'].isoformat()
    await db.payment_transactions.insert_one(trans_dict)
    
    # Update invoice with session ID
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"stripe_session_id": session.session_id}})
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get('STRIPE_API_KEY')
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction and invoice if paid
    if status.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if transaction and transaction['payment_status'] != 'paid':
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            await db.invoices.update_one(
                {"stripe_session_id": session_id},
                {"$set": {"status": "paid", "paid_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}}
            )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    api_key = os.environ.get('STRIPE_API_KEY')
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid"}}
            )
            await db.invoices.update_one(
                {"stripe_session_id": webhook_response.session_id},
                {"$set": {"status": "paid", "paid_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}}
            )
        
        return {"received": True}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"received": False}

# Message Routes
@api_router.post("/messages", response_model=Message)
async def send_message(msg_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    message = Message(
        sender_id=current_user['id'],
        receiver_id=msg_data.receiver_id,
        is_group_message=msg_data.is_group_message,
        content=msg_data.content
    )
    msg_dict = message.model_dump()
    msg_dict['created_at'] = msg_dict['created_at'].isoformat()
    await db.messages.insert_one(msg_dict)
    return message

@api_router.get("/messages", response_model=List[Message])
async def get_messages(receiver_id: Optional[str] = None, group: bool = False, current_user: dict = Depends(get_current_user)):
    if group:
        # Staff group chat
        if current_user['role'] == 'client':
            raise HTTPException(status_code=403, detail="Not authorized")
        messages = await db.messages.find({"is_group_message": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    elif receiver_id:
        # Direct messages between two users
        messages = await db.messages.find({
            "$or": [
                {"sender_id": current_user['id'], "receiver_id": receiver_id},
                {"sender_id": receiver_id, "receiver_id": current_user['id']}
            ],
            "is_group_message": False
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        # All messages for current user
        messages = await db.messages.find({
            "$or": [
                {"sender_id": current_user['id']},
                {"receiver_id": current_user['id']}
            ]
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return messages

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    # Get unique conversation partners
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user['id']},
            {"receiver_id": current_user['id']}
        ],
        "is_group_message": False
    }, {"_id": 0}).to_list(1000)
    
    partners = set()
    for msg in messages:
        if msg['sender_id'] != current_user['id']:
            partners.add(msg['sender_id'])
        if msg.get('receiver_id') and msg['receiver_id'] != current_user['id']:
            partners.add(msg['receiver_id'])
    
    conversations = []
    for partner_id in partners:
        partner = await db.users.find_one({"id": partner_id}, {"_id": 0, "password_hash": 0})
        if partner:
            last_msg = await db.messages.find_one({
                "$or": [
                    {"sender_id": current_user['id'], "receiver_id": partner_id},
                    {"sender_id": partner_id, "receiver_id": current_user['id']}
                ]
            }, {"_id": 0}, sort=[("created_at", -1)])
            conversations.append({
                "partner": UserResponse(**partner).model_dump(),
                "last_message": last_msg
            })
    
    return conversations

# Timesheet Routes
@api_router.get("/timesheets", response_model=List[Timesheet])
async def get_timesheets(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    timesheets = await db.timesheets.find(query, {"_id": 0}).to_list(100)
    return timesheets

@api_router.post("/timesheets/submit")
async def submit_timesheet(week_start: str, week_end: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'walker':
        raise HTTPException(status_code=403, detail="Walkers only")
    
    # Get completed appointments for the week
    appointments = await db.appointments.find({
        "walker_id": current_user['id'],
        "status": "completed",
        "scheduled_date": {"$gte": week_start, "$lte": week_end}
    }, {"_id": 0}).to_list(500)
    
    total_minutes = sum(appt.get('actual_duration_minutes', 0) for appt in appointments)
    
    timesheet = Timesheet(
        walker_id=current_user['id'],
        week_start=week_start,
        week_end=week_end,
        total_hours=round(total_minutes / 60, 2),
        total_walks=len(appointments),
        appointments=[appt['id'] for appt in appointments],
        submitted=True
    )
    ts_dict = timesheet.model_dump()
    ts_dict['created_at'] = ts_dict['created_at'].isoformat()
    await db.timesheets.insert_one(ts_dict)
    return {"message": "Timesheet submitted", "timesheet": timesheet}

@api_router.put("/timesheets/{timesheet_id}/approve")
async def approve_timesheet(timesheet_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.timesheets.update_one({"id": timesheet_id}, {"$set": {"approved": True}})
    return {"message": "Timesheet approved"}

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    stats = {}
    
    if current_user['role'] == 'admin':
        stats['total_clients'] = await db.users.count_documents({"role": "client"})
        stats['total_walkers'] = await db.users.count_documents({"role": "walker"})
        stats['total_appointments'] = await db.appointments.count_documents({})
        stats['pending_invoices'] = await db.invoices.count_documents({"status": "pending"})
        stats['total_revenue'] = 0
        paid_invoices = await db.invoices.find({"status": "paid"}, {"_id": 0, "amount": 1}).to_list(1000)
        stats['total_revenue'] = sum(inv['amount'] for inv in paid_invoices)
    elif current_user['role'] == 'walker':
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        stats['todays_appointments'] = await db.appointments.count_documents({
            "walker_id": current_user['id'],
            "scheduled_date": today
        })
        stats['completed_walks'] = await db.appointments.count_documents({
            "walker_id": current_user['id'],
            "status": "completed"
        })
        stats['pending_appointments'] = await db.appointments.count_documents({
            "walker_id": current_user['id'],
            "status": "scheduled"
        })
    else:
        stats['total_pets'] = await db.pets.count_documents({"owner_id": current_user['id']})
        stats['upcoming_appointments'] = await db.appointments.count_documents({
            "client_id": current_user['id'],
            "status": "scheduled"
        })
        stats['pending_invoices'] = await db.invoices.count_documents({
            "client_id": current_user['id'],
            "status": "pending"
        })
    
    return stats

# Root
@api_router.get("/")
async def root():
    return {"message": "WagWalk API v1.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
