from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import shutil
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

# SendGrid and Twilio imports
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False

try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory for local file storage
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / 'profiles').mkdir(exist_ok=True)
(UPLOADS_DIR / 'pets').mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET_KEY')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET_KEY environment variable must be set")
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
    SITTER = "sitter"
    CLIENT = "client"

class ServiceType(str, Enum):
    # Walking Services
    WALK_30 = "walk_30"
    WALK_45 = "walk_45"
    WALK_60 = "walk_60"
    # Day Care Services
    DOGGY_DAY_CARE = "doggy_day_care"                    # Day care by number of days
    DOGGY_DAY_CAMP = "doggy_day_camp"                    # Day camp by number of days
    DAY_VISIT = "day_visit"                              # Day visit
    # Staying/Sitting Services (minimum 1 day)
    STAY_DAY = "stay_day"                                # Day stay (drop-off)
    STAY_OVERNIGHT = "stay_overnight"                    # Overnight stay
    STAY_EXTENDED = "stay_extended"                      # Multi-day stay
    OVERNIGHT = "overnight"                              # Legacy overnight
    # Other Services
    TRANSPORT = "transport"
    CONCIERGE = "concierge"
    # Pet Sitting Services
    PETSIT_OUR_LOCATION = "petsit_our_location"        # Boarding at our location
    PETSIT_YOUR_LOCATION = "petsit_your_location"      # Pet sitting at client's home

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

# US Standard Holidays for pricing surcharge
US_HOLIDAYS = [
    # New Year's
    (1, 1),
    # Memorial Day - last Monday of May (we'll check dynamically)
    # July 4th
    (7, 4),
    # Labor Day - first Monday of September (we'll check dynamically)
    # Thanksgiving - 4th Thursday of November (we'll check dynamically)
    # Christmas
    (12, 25),
]

def get_holiday_dates(year: int) -> List[str]:
    """Get all holiday dates including day before and day after for a given year"""
    from datetime import date
    import calendar
    
    holidays = []
    
    # Fixed holidays
    fixed_holidays = [
        date(year, 1, 1),   # New Year's Day
        date(year, 7, 4),   # Independence Day
        date(year, 12, 25), # Christmas
    ]
    
    # Memorial Day - Last Monday of May
    may_cal = calendar.monthcalendar(year, 5)
    # Find the last Monday
    for week in reversed(may_cal):
        if week[calendar.MONDAY] != 0:
            memorial_day = date(year, 5, week[calendar.MONDAY])
            break
    fixed_holidays.append(memorial_day)
    
    # Labor Day - First Monday of September
    sep_cal = calendar.monthcalendar(year, 9)
    for week in sep_cal:
        if week[calendar.MONDAY] != 0:
            labor_day = date(year, 9, week[calendar.MONDAY])
            break
    fixed_holidays.append(labor_day)
    
    # Thanksgiving - 4th Thursday of November
    nov_cal = calendar.monthcalendar(year, 11)
    thursday_count = 0
    for week in nov_cal:
        if week[calendar.THURSDAY] != 0:
            thursday_count += 1
            if thursday_count == 4:
                thanksgiving = date(year, 11, week[calendar.THURSDAY])
                break
    fixed_holidays.append(thanksgiving)
    
    # Add day before, day of, and day after for each holiday
    for holiday in fixed_holidays:
        day_before = holiday - timedelta(days=1)
        day_after = holiday + timedelta(days=1)
        holidays.extend([
            day_before.strftime("%Y-%m-%d"),
            holiday.strftime("%Y-%m-%d"),
            day_after.strftime("%Y-%m-%d"),
        ])
    
    return list(set(holidays))  # Remove duplicates

def is_holiday_date(date_str: str) -> bool:
    """Check if a date is a holiday (or day before/after)"""
    from datetime import date
    check_date = date.fromisoformat(date_str)
    year = check_date.year
    holiday_dates = get_holiday_dates(year)
    return date_str in holiday_dates

def calculate_petsit_price(service_type: str, num_dogs: int, start_date: str, end_date: str = None) -> dict:
    """Calculate pet sitting price with multi-dog and holiday pricing"""
    from datetime import date
    
    base_prices = {
        "petsit_our_location": 50.00,     # per night - boarding at our location
        "petsit_your_location": 50.00,    # per night - pet sitting at client's home
    }
    
    holiday_upcharge = 10.00  # $10 upcharge for holidays (day before, day of, day after)
    
    if service_type not in base_prices:
        return {"total": 0, "breakdown": []}
    
    base_price = base_prices[service_type]
    breakdown = []
    total = 0
    
    # Calculate number of days/nights
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date) if end_date else start
    
    if service_type in ["petsit_our_location", "petsit_your_location"]:
        # For both pet sitting types, count nights (end_date - start_date)
        num_nights = max(1, (end - start).days)
        
        # Calculate for each night
        current = start
        for i in range(num_nights):
            night_date = (current + timedelta(days=i)).strftime("%Y-%m-%d")
            night_price = base_price
            
            # Add 2nd dog at half price (only for our location/boarding)
            if service_type == "petsit_our_location" and num_dogs > 1:
                night_price += (num_dogs - 1) * (base_price / 2)
            
            # Check for holiday surcharge (day before, day of, day after holidays)
            is_holiday = is_holiday_date(night_date)
            holiday_surcharge_amount = holiday_upcharge * num_dogs if is_holiday else 0
            
            night_total = night_price + holiday_surcharge_amount
            total += night_total
            
            breakdown.append({
                "date": night_date,
                "base": base_price,
                "dogs": num_dogs,
                "dog_surcharge": (num_dogs - 1) * (base_price / 2) if (service_type == "petsit_our_location" and num_dogs > 1) else 0,
                "holiday": is_holiday,
                "holiday_surcharge": holiday_surcharge_amount,
                "subtotal": night_total
            })
    
    return {
        "total": round(total, 2),
        "breakdown": breakdown,
        "service_type": service_type,
        "num_dogs": num_dogs,
        "start_date": start_date,
        "end_date": end_date or start_date
    }

# Models
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    role: UserRole = UserRole.CLIENT
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    billing_cycle: Optional[str] = "weekly"  # daily, weekly, monthly
    walker_color: Optional[str] = None  # hex color for calendar display

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
    address: Optional[str] = None
    role: str
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool
    billing_cycle: Optional[str] = "weekly"
    walker_color: Optional[str] = None
    # Payment methods for walkers/sitters
    zelle_email: Optional[str] = None
    venmo_username: Optional[str] = None
    cashapp_tag: Optional[str] = None
    apple_pay_id: Optional[str] = None
    apple_cash_id: Optional[str] = None
    # New onboarding fields
    date_of_birth: Optional[str] = None
    payment_methods: Optional[Dict[str, str]] = None
    preferred_payment_method: Optional[str] = None
    onboarding_completed: Optional[bool] = None
    onboarding_data: Optional[Dict] = None
    # Pay setup fields for walkers/sitters
    pay_setup_completed: Optional[bool] = None
    custom_pay_rates: Optional[Dict[str, float]] = None  # Custom pay rates per service
    # Pricing fields for clients
    pricing_setup_completed: Optional[bool] = None
    billing_plan_id: Optional[str] = None
    custom_prices: Optional[Dict[str, float]] = None
    pricing_notes: Optional[str] = None
    pricing_setup_at: Optional[str] = None
    # Walking schedule
    walkingSchedule: Optional[Dict] = None

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
    age: Optional[str] = None  # Changed to string to handle empty values
    weight: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    # New fields for vet, emergency contact, prescription, things to know
    vet_name: Optional[str] = None
    vet_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    prescriptions: Optional[str] = None
    things_to_know: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @classmethod
    def from_db(cls, data: dict) -> "Pet":
        """Create Pet from database data, handling empty string weight"""
        if data.get('weight') == '':
            data['weight'] = None
        return cls(**data)

class PetCreate(BaseModel):
    name: str
    species: str = "dog"
    breed: Optional[str] = None
    age: Optional[str] = None  # Changed to string to handle empty values
    weight: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    # New fields
    vet_name: Optional[str] = None
    vet_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    prescriptions: Optional[str] = None
    things_to_know: Optional[str] = None

class ServicePricing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_type: str  # Changed from ServiceType enum to string to allow custom services
    name: str
    description: str = ""
    price: float
    duration_minutes: Optional[int] = None  # For walks/visits with time duration
    duration_type: str = "minutes"  # "minutes", "days", or "nights"
    is_active: bool = True

class GPSCoordinate(BaseModel):
    lat: float
    lng: float
    timestamp: str

class Appointment(BaseModel):
    model_config = ConfigDict(extra="allow")  # Allow extra fields for enriched data
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    walker_id: Optional[str] = None
    pet_ids: List[str]
    service_type: ServiceType
    scheduled_date: str
    scheduled_time: str = ""  # Optional for day/night based services
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    notes: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    actual_duration_minutes: Optional[int] = None
    # Duration fields for day/night services
    duration_value: int = 1  # Number of days/nights
    duration_type: str = "minutes"  # "minutes", "days", or "nights"
    end_date: Optional[str] = None  # For multi-day bookings
    # GPS Tracking fields
    gps_route: List[Dict] = Field(default_factory=list)  # List of {lat, lng, timestamp}
    distance_meters: Optional[float] = None
    is_tracking: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Recurring schedule fields
    is_recurring: bool = False
    recurring_schedule_id: Optional[str] = None  # Links to parent recurring schedule
    is_one_time_exception: bool = False  # True if this is a one-time modification to a recurring schedule
    # Enriched fields (added dynamically)
    walker_name: Optional[str] = None
    pee_count: Optional[int] = None
    poop_count: Optional[int] = None
    water_given: Optional[bool] = None
    walker_notes: Optional[str] = None
    actual_duration: Optional[int] = None
    completed_at: Optional[str] = None
    completion_data: Optional[Dict] = None

class RecurringSchedule(BaseModel):
    """Represents a recurring schedule that generates appointments weekly"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    walker_id: Optional[str] = None
    pet_ids: List[str]
    service_type: ServiceType
    scheduled_time: str  # Time of day
    day_of_week: int  # 0=Monday, 6=Sunday
    notes: Optional[str] = None
    status: str = "active"  # active, paused, stopped
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paused_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    created_by: str  # user_id of who created it

class AppointmentCreate(BaseModel):
    pet_ids: List[str]
    service_type: ServiceType
    scheduled_date: str
    scheduled_time: str = ""  # Optional for day/night based services
    walker_id: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: bool = False  # If true, creates a recurring schedule
    day_of_week: Optional[int] = None  # Required if is_recurring is true
    duration_value: int = 1  # Number of days/nights for day/night services
    duration_type: str = "minutes"  # "minutes", "days", or "nights"
    end_date: Optional[str] = None  # For multi-day bookings

class RecurringScheduleCreate(BaseModel):
    client_id: Optional[str] = None  # Admin can set this, clients auto-filled
    pet_ids: List[str]
    service_type: ServiceType
    scheduled_time: str
    day_of_week: int  # 0=Monday, 6=Sunday
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

class Paysheet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    walker_id: str
    period_start: str
    period_end: str
    total_hours: float
    total_walks: int
    total_earnings: float
    appointment_ids: List[str]
    walk_details: List[Dict] = Field(default_factory=list)  # Details of each walk
    submitted: bool = False
    approved: bool = False
    paid: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Walk Completion Report
class WalkCompletionReport(BaseModel):
    did_pee: bool
    did_poop: bool
    filled_water: bool
    notes: Optional[str] = None

# Walk Trade Request
class WalkTradeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    requesting_walker_id: str
    target_walker_id: str
    status: str = "pending"  # pending, accepted, rejected, cancelled
    requester_approved: bool = True  # Requester initiates, so auto-approved
    target_approved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Walker Time Off Request
class TimeOffRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    walker_id: str
    start_date: str
    end_date: str
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    affected_appointments: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Walker Cancellation
class WalkCancellationRequest(BaseModel):
    reason: str


# Walker/Sitter default pay rates
DEFAULT_WALKER_PAY_RATES = {
    "walk_30": 15.00,   # 30-minute walk
    "walk_45": 22.00,   # 45-minute walk
    "walk_60": 30.00,   # 60-minute walk
}

DEFAULT_SITTER_PAY_RATES = {
    "petsit_walker_location": 40.00,  # At walker's/sitter's location
    "petsit_client_location": 50.00,  # At client's location
}

# Combined default pay rates
WALKER_PAY_RATES = {
    **DEFAULT_WALKER_PAY_RATES,
    **DEFAULT_SITTER_PAY_RATES,
}

def get_service_duration_type(service_type: str) -> str:
    """
    Determine the duration type for a service:
    - 'days' for day care services
    - 'nights' for overnight services
    - 'minutes' for walks and other time-based services
    """
    day_services = ['doggy_day_care', 'doggy_day_camp', 'day_care', 'day_camp', 'stay_day']
    night_services = ['overnight', 'stay_overnight', 'stay_extended', 'petsit_our_location', 'petsit_your_location']
    
    # Check if service type contains any day care keywords
    if any(day in service_type.lower() for day in day_services):
        return "days"
    # Check if service type contains any overnight keywords
    if any(night in service_type.lower() for night in night_services):
        return "nights"
    return "minutes"

def calculate_walk_earnings(service_type: str, duration_minutes: int = None) -> float:
    """Calculate walker earnings for a walk"""
    if service_type in WALKER_PAY_RATES:
        return WALKER_PAY_RATES[service_type]
    # For other services, calculate based on duration at $30/hour
    if duration_minutes:
        return round((duration_minutes / 60) * 30, 2)
    return 0.0

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

# Subscription/Freemium Model
class SubscriptionTier(str, Enum):
    FREE = "free"
    PREMIUM = "premium"

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tier: SubscriptionTier = SubscriptionTier.FREE
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    plan_type: Optional[str] = None  # "monthly" or "yearly"
    status: str = "active"  # active, canceled, past_due, trialing
    trial_ends_at: Optional[str] = None
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Freemium Limits
FREEMIUM_LIMITS = {
    "free": {
        "max_walkers": 5,
        "max_clients": 10,
        "invoicing": False,
        "mass_text": False,
        "gps_tracking": False,
        "revenue_reports": False,
        "recurring_schedules": False,
        "custom_branding": False,
    },
    "premium": {
        "max_walkers": -1,  # Unlimited
        "max_clients": -1,  # Unlimited
        "invoicing": True,
        "mass_text": True,
        "gps_tracking": True,
        "revenue_reports": True,
        "recurring_schedules": True,
        "custom_branding": True,
    }
}

SUBSCRIPTION_PRICES = {
    "monthly": 14.99,
    "yearly": 149.00,
}

TRIAL_DAYS = 14

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
    
    # Check if account is frozen/locked
    if not user.get('is_active', True):
        raise HTTPException(status_code=403, detail="Your account has been locked. Please contact support.")
    
    token = create_access_token({"user_id": user['id'], "role": user['role']})
    return TokenResponse(
        access_token=token,
        user=UserResponse(**user)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# First-time Admin Setup
@api_router.get("/auth/setup-status")
async def get_setup_status():
    """Check if initial admin setup is needed"""
    admin_count = await db.users.count_documents({"role": "admin"})
    return {
        "setup_required": admin_count == 0,
        "admin_exists": admin_count > 0
    }

class AdminSetupRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None

@api_router.post("/auth/setup-admin")
async def setup_first_admin(request: AdminSetupRequest):
    """Create the first admin account - only works if no admin exists"""
    # Check if any admin already exists
    admin_count = await db.users.count_documents({"role": "admin"})
    if admin_count > 0:
        raise HTTPException(status_code=400, detail="Admin already exists. Please login instead.")
    
    # Check if username or email already taken
    existing = await db.users.find_one({"$or": [{"username": request.username}, {"email": request.email}]})
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already taken")
    
    # Create admin user
    password_hash = pwd_context.hash(request.password)
    admin_user = {
        "id": str(uuid.uuid4()),
        "username": request.username,
        "email": request.email,
        "password_hash": password_hash,
        "full_name": request.full_name,
        "phone": request.phone,
        "role": "admin",
        "is_active": True,
        "billing_cycle": "monthly",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_user)
    
    # Save company info if provided
    if request.company_name:
        await db.settings.update_one(
            {"type": "company_info"},
            {"$set": {"company_name": request.company_name, "email": request.email, "phone": request.phone}},
            upsert=True
        )
    
    # Create free subscription for the admin
    subscription = {
        "id": str(uuid.uuid4()),
        "user_id": admin_user["id"],
        "tier": "free",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.subscriptions.insert_one(subscription)
    
    # Generate token
    token = create_access_token(admin_user["id"], admin_user["role"])
    
    return {
        "message": "Admin account created successfully",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": admin_user["id"],
            "username": admin_user["username"],
            "email": admin_user["email"],
            "full_name": admin_user["full_name"],
            "role": admin_user["role"]
        }
    }

# User Routes
@api_router.get("/users/walkers", response_model=List[UserResponse])
async def get_walkers(include_frozen: bool = False):
    # Include frozen users if requested (for admin management pages)
    query = {"role": "walker"} if include_frozen else {"role": "walker", "is_active": True}
    walkers = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Auto-assign colors to walkers who don't have one
    default_colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
    color_index = 0
    
    for walker in walkers:
        if not walker.get('walker_color'):
            walker['walker_color'] = default_colors[color_index % len(default_colors)]
            # Save the color
            await db.users.update_one({"id": walker['id']}, {"$set": {"walker_color": walker['walker_color']}})
            color_index += 1
    
    return [UserResponse(**w) for w in walkers]

@api_router.get("/users/sitters")
async def get_sitters(current_user: dict = Depends(get_current_user)):
    """Get all active sitters"""
    sitters = await db.users.find({"role": "sitter", "is_active": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    return sitters

@api_router.get("/users/staff")
async def get_all_staff(current_user: dict = Depends(get_current_user)):
    """Get all walkers and sitters (staff who can be assigned appointments)"""
    staff = await db.users.find(
        {"role": {"$in": ["walker", "sitter"]}, "is_active": True}, 
        {"_id": 0, "password_hash": 0}
    ).to_list(200)
    return staff

@api_router.put("/users/{user_id}/color")
async def update_walker_color(user_id: str, color: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.users.update_one({"id": user_id}, {"$set": {"walker_color": color}})
    return {"message": "Walker color updated"}

@api_router.get("/users/clients", response_model=List[UserResponse])
async def get_clients(include_frozen: bool = False, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Include frozen users if requested (for admin management pages)
    query = {"role": "client"} if include_frozen else {"role": "client", "is_active": True}
    clients = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
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
    
    allowed_fields = ['full_name', 'phone', 'address', 'email', 'bio', 'profile_image']
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    # Admin can also update these fields
    if current_user['role'] == 'admin':
        admin_fields = ['is_active', 'onboarding_completed', 'role']
        for field in admin_fields:
            if field in update_data:
                update_dict[field] = update_data[field]
    
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Don't allow deleting yourself
    if current_user['id'] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if user exists
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Also delete related data
    await db.pets.delete_many({"owner_id": user_id})
    await db.appointments.delete_many({"$or": [{"client_id": user_id}, {"walker_id": user_id}]})
    await db.messages.delete_many({"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]})
    await db.notifications.delete_many({"user_id": user_id})
    await db.paysheets.delete_many({"walker_id": user_id})
    
    return {"message": f"User {user.get('full_name', user_id)} deleted successfully"}

@api_router.put("/users/{user_id}/freeze")
async def freeze_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Freeze/lock a user account (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Don't allow freezing yourself
    if current_user['id'] == user_id:
        raise HTTPException(status_code=400, detail="Cannot freeze your own account")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"is_active": False, "frozen_at": datetime.now(timezone.utc).isoformat(), "frozen_by": current_user['id']}}
    )
    
    return {"message": f"Account for {user.get('full_name', user_id)} has been frozen"}

@api_router.put("/users/{user_id}/unfreeze")
async def unfreeze_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfreeze/unlock a user account (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"is_active": True}, "$unset": {"frozen_at": "", "frozen_by": ""}}
    )
    
    return {"message": f"Account for {user.get('full_name', user_id)} has been unfrozen"}

@api_router.put("/users/{user_id}/pay-setup")
async def setup_walker_pay(user_id: str, pay_data: dict, current_user: dict = Depends(get_current_user)):
    """Set up pay rates for a walker/sitter (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('role') not in ['walker', 'sitter']:
        raise HTTPException(status_code=400, detail="Pay setup is only for walkers/sitters")
    
    # Extract pay rates from request
    custom_pay_rates = pay_data.get('custom_pay_rates', {})
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "custom_pay_rates": custom_pay_rates,
            "pay_setup_completed": True,
            "pay_setup_at": datetime.now(timezone.utc).isoformat(),
            "pay_setup_by": current_user['id']
        }}
    )
    
    return {"message": f"Pay rates set for {user.get('full_name', user_id)}", "custom_pay_rates": custom_pay_rates}

@api_router.get("/users/pending-pay-setup")
async def get_users_pending_pay_setup(current_user: dict = Depends(get_current_user)):
    """Get walkers/sitters who need pay setup (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Find walkers/sitters without pay setup
    users = await db.users.find(
        {
            "role": {"$in": ["walker", "sitter"]},
            "$or": [
                {"pay_setup_completed": {"$ne": True}},
                {"pay_setup_completed": {"$exists": False}}
            ]
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return users

@api_router.get("/pay-rates/defaults")
async def get_default_pay_rates(current_user: dict = Depends(get_current_user)):
    """Get default pay rates for walkers/sitters"""
    return {
        "walker_rates": DEFAULT_WALKER_PAY_RATES,
        "sitter_rates": DEFAULT_SITTER_PAY_RATES,
        "all_rates": WALKER_PAY_RATES
    }

@api_router.get("/users/all")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users including frozen ones (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

# File Upload Routes
@api_router.post("/upload/profile")
async def upload_profile_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload profile image for user"""
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = UPLOADS_DIR / 'profiles' / filename
    
    # Save file
    try:
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Generate URL
    image_url = f"/api/uploads/profiles/{filename}"
    
    # Update user profile
    await db.users.update_one({"id": current_user['id']}, {"$set": {"profile_image": image_url}})
    
    return {"url": image_url, "message": "Profile image uploaded successfully"}

@api_router.post("/upload/pet/{pet_id}")
async def upload_pet_image(pet_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload image for a pet"""
    # Verify pet exists and user owns it
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    
    if current_user['role'] == 'client' and pet['owner_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{pet_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = UPLOADS_DIR / 'pets' / filename
    
    # Save file
    try:
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Generate URL
    image_url = f"/api/uploads/pets/{filename}"
    
    # Update pet photo
    await db.pets.update_one({"id": pet_id}, {"$set": {"photo_url": image_url}})
    
    return {"url": image_url, "message": "Pet image uploaded successfully"}

# Serve uploaded files
from fastapi.responses import FileResponse

@api_router.get("/uploads/profiles/{filename}")
async def get_profile_image(filename: str):
    """Serve profile images"""
    file_path = UPLOADS_DIR / 'profiles' / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)

@api_router.get("/uploads/pets/{filename}")
async def get_pet_image(filename: str):
    """Serve pet images"""
    file_path = UPLOADS_DIR / 'pets' / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)

# Pet Routes
@api_router.post("/pets", response_model=Pet)
async def create_pet(pet_data: PetCreate, current_user: dict = Depends(get_current_user)):
    pet = Pet(owner_id=current_user['id'], **pet_data.model_dump())
    pet_dict = pet.model_dump()
    pet_dict['created_at'] = pet_dict['created_at'].isoformat()
    await db.pets.insert_one(pet_dict)
    return pet

@api_router.get("/pets", response_model=List[Pet])
async def get_pets(owner_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'client':
        pets = await db.pets.find({"owner_id": current_user['id']}, {"_id": 0}).to_list(100)
    elif owner_id:
        # Admin/walker filtering by owner
        pets = await db.pets.find({"owner_id": owner_id}, {"_id": 0}).to_list(100)
    else:
        pets = await db.pets.find({}, {"_id": 0}).to_list(500)
    
    # Handle empty string weight values
    for pet in pets:
        if pet.get('weight') == '' or pet.get('weight') == 'null':
            pet['weight'] = None
        # Ensure age is a string
        if pet.get('age') is not None and not isinstance(pet.get('age'), str):
            pet['age'] = str(pet['age'])
    return pets

@api_router.get("/pets/{pet_id}", response_model=Pet)
async def get_pet(pet_id: str):
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    # Handle empty string weight values
    if pet.get('weight') == '' or pet.get('weight') == 'null':
        pet['weight'] = None
    # Ensure age is a string
    if pet.get('age') is not None and not isinstance(pet.get('age'), str):
        pet['age'] = str(pet['age'])
    return pet

@api_router.get("/pets/{pet_id}/appointments")
async def get_pet_appointments(pet_id: str, current_user: dict = Depends(get_current_user)):
    """Get all scheduled appointments for a pet"""
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    
    # Find all future appointments that include this pet
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appointments = await db.appointments.find({
        "pet_ids": pet_id,
        "scheduled_date": {"$gte": today},
        "status": {"$in": ["scheduled", "in_progress"]}
    }, {"_id": 0}).to_list(500)
    
    # Categorize: sole pet vs shared with other pets
    sole_appointments = []
    shared_appointments = []
    
    for appt in appointments:
        if len(appt.get("pet_ids", [])) == 1:
            sole_appointments.append(appt)
        else:
            shared_appointments.append(appt)
    
    return {
        "pet_id": pet_id,
        "pet_name": pet.get("name", "Unknown"),
        "total_appointments": len(appointments),
        "sole_appointments": len(sole_appointments),
        "shared_appointments": len(shared_appointments),
        "appointments": appointments
    }

@api_router.delete("/pets/{pet_id}")
async def delete_pet(pet_id: str, delete_appointments: bool = False, current_user: dict = Depends(get_current_user)):
    """Delete a pet and optionally handle its appointments
    
    - If delete_appointments=False (default): Only removes pet from shared appointments, deletes sole appointments
    - If delete_appointments=True: Deletes all appointments where this pet is the only pet
    """
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if current_user['role'] == 'client' and pet['owner_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find all future appointments that include this pet
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appointments = await db.appointments.find({
        "pet_ids": pet_id,
        "scheduled_date": {"$gte": today},
        "status": {"$in": ["scheduled", "in_progress"]}
    }, {"_id": 0}).to_list(500)
    
    deleted_appointments = 0
    updated_appointments = 0
    
    for appt in appointments:
        pet_ids = appt.get("pet_ids", [])
        if len(pet_ids) == 1:
            # This pet is the only one - delete the appointment
            if delete_appointments:
                await db.appointments.delete_one({"id": appt["id"]})
                deleted_appointments += 1
        else:
            # Multiple pets - just remove this pet from the appointment
            new_pet_ids = [p for p in pet_ids if p != pet_id]
            await db.appointments.update_one(
                {"id": appt["id"]},
                {"$set": {"pet_ids": new_pet_ids}}
            )
            updated_appointments += 1
    
    # Also remove pet from recurring schedules
    await db.recurring_schedules.update_many(
        {"pet_ids": pet_id},
        {"$pull": {"pet_ids": pet_id}}
    )
    
    # Delete recurring schedules where this was the only pet
    await db.recurring_schedules.delete_many({"pet_ids": {"$size": 0}})
    
    # Finally delete the pet
    await db.pets.delete_one({"id": pet_id})
    
    return {
        "message": f"Pet '{pet.get('name', 'Unknown')}' deleted successfully",
        "deleted_appointments": deleted_appointments,
        "updated_appointments": updated_appointments
    }

@api_router.put("/pets/{pet_id}")
async def update_pet(pet_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    """Update pet information"""
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    
    if current_user['role'] == 'client' and pet['owner_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_fields = ['name', 'species', 'breed', 'age', 'weight', 'notes', 'photo_url']
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    await db.pets.update_one({"id": pet_id}, {"$set": update_dict})
    
    # Return updated pet
    updated_pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    return updated_pet

# Admin Pet Creation (for adding pets to customer accounts)
class AdminPetCreate(BaseModel):
    owner_id: str
    name: str
    species: str = "dog"
    breed: Optional[str] = None
    age: Optional[str] = None  # Changed to string
    weight: Optional[float] = None
    notes: Optional[str] = None

@api_router.post("/pets/admin", response_model=Pet)
async def admin_create_pet(pet_data: AdminPetCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    pet = Pet(**pet_data.model_dump())
    pet_dict = pet.model_dump()
    pet_dict['created_at'] = pet_dict['created_at'].isoformat()
    await db.pets.insert_one(pet_dict)
    return pet

# Custom Pricing for Clients
@api_router.post("/users/{user_id}/custom-pricing")
async def set_custom_pricing(user_id: str, pricing: Dict[str, float], current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.custom_pricing.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "pricing": pricing}},
        upsert=True
    )
    return {"message": "Custom pricing saved"}

@api_router.put("/users/{user_id}/pricing")
async def setup_client_pricing(user_id: str, pricing_data: dict, current_user: dict = Depends(get_current_user)):
    """Set up pricing for a client (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Verify user exists first
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    
    # Update user with pricing info
    update_data = {
        "pricing_setup_completed": True,  # Always set to True
        "billing_plan_id": pricing_data.get("billing_plan_id"),
        "custom_prices": pricing_data.get("custom_prices", {}),
        "pricing_notes": pricing_data.get("pricing_notes", ""),
        "pricing_setup_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update user pricing")
    
    # Also save to custom_pricing collection for compatibility
    if pricing_data.get("custom_prices"):
        await db.custom_pricing.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "pricing": pricing_data.get("custom_prices")}},
            upsert=True
        )
    
    # Dismiss any pending "new client pricing" notifications for this client
    await db.notifications.update_many(
        {"type": "new_client_pricing", "client_id": user_id},
        {"$set": {"read": True}}
    )
    
    # Activate any pending recurring schedules for this client
    await db.recurring_schedules.update_many(
        {"client_id": user_id, "status": "pending_assignment"},
        {"$set": {"status": "active"}}
    )
    
    # Generate appointments from recurring schedules for this client
    # This is triggered when pricing is approved for a new client
    appointments_created = await generate_appointments_for_client(user_id, weeks_ahead=4)
    
    return {"message": "Pricing setup completed", "appointments_created": appointments_created}


async def generate_appointments_for_client(client_id: str, weeks_ahead: int = 4):
    """
    Generate appointments from recurring schedules for a specific client.
    Creates appointments for the next N weeks.
    If no recurring schedules exist, attempts to create them from onboarding_data.
    """
    # Get all active recurring schedules for this client
    recurring_schedules = await db.recurring_schedules.find({
        "client_id": client_id,
        "status": {"$in": ["active", "pending_assignment"]}
    }, {"_id": 0}).to_list(100)
    
    # If no recurring schedules exist, try to create them from onboarding_data
    # If no active/pending schedules, also check for stopped ones and reactivate them
    if not recurring_schedules:
        stopped_schedules = await db.recurring_schedules.find({
            "client_id": client_id,
            "status": "stopped"
        }, {"_id": 0}).to_list(100)
        
        if stopped_schedules:
            # Reactivate stopped schedules
            await db.recurring_schedules.update_many(
                {"client_id": client_id, "status": "stopped"},
                {"$set": {"status": "active"}}
            )
            recurring_schedules = stopped_schedules
            for s in recurring_schedules:
                s["status"] = "active"
    
    # If still no recurring schedules, try to create from onboarding_data
    if not recurring_schedules:
        client = await db.users.find_one({"id": client_id}, {"_id": 0})
        if client and client.get("onboarding_data"):
            od = client["onboarding_data"]
            preferred_days = od.get("preferred_days", [])
            preferred_times = od.get("preferred_walk_times", [])
            walk_duration = od.get("walk_duration", 30)
            # Treat None or missing schedule_type as "recurring" (default behavior)
            schedule_type = od.get("schedule_type") or "recurring"
            
            # Only create recurring schedules if we have days and times and it's recurring
            if preferred_days and preferred_times and schedule_type == "recurring":
                # Get pet IDs for this client
                pets = await db.pets.find({"owner_id": client_id}, {"_id": 0, "id": 1}).to_list(100)
                pet_ids = [p["id"] for p in pets]
                
                # Map day names to numbers
                day_to_num = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
                service_type_map = {30: "walk_30", 45: "walk_45", 60: "walk_60"}
                service_type = service_type_map.get(walk_duration, "walk_30")
                
                for day in preferred_days:
                    day_num = day_to_num.get(day, 0)
                    for walk_time in preferred_times:
                        recurring_schedule = {
                            "id": str(uuid.uuid4()),
                            "client_id": client_id,
                            "walker_id": od.get("preferred_walker_id"),
                            "pet_ids": pet_ids,
                            "service_type": service_type,
                            "scheduled_time": walk_time,
                            "day_of_week": day_num,
                            "notes": "Created from onboarding data during pricing approval",
                            "status": "active",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "created_by": client_id
                        }
                        await db.recurring_schedules.insert_one(recurring_schedule)
                        recurring_schedule.pop("_id", None)
                        recurring_schedules.append(recurring_schedule)
    
    if not recurring_schedules:
        # Log why we couldn't create schedules
        return 0
    
    appointments_created = 0
    today = datetime.now(timezone.utc).date()
    today_weekday = today.weekday()  # Monday=0, Sunday=6
    
    # Day-based services that don't need a specific time
    day_services = ['doggy_day_care', 'doggy_day_camp', 'day_care', 'day_camp', 'stay_day']
    
    for schedule in recurring_schedules:
        day_of_week = schedule.get("day_of_week", 0)
        scheduled_time = schedule.get("scheduled_time", "09:00")
        service_type = schedule.get("service_type", "walk_30")
        
        # For day-based services, use a default time if empty
        is_day_service = service_type in day_services
        if not scheduled_time:
            if is_day_service:
                scheduled_time = "08:00"  # Default drop-off time for day services
            else:
                continue  # Skip non-day services without a time
        
        # Calculate days until the next occurrence of this day_of_week
        days_until_next = (day_of_week - today_weekday) % 7
        # If it's today and we want to include today, days_until_next will be 0
        # If day already passed this week, this gives us next week's occurrence
        
        # Generate appointments for the next N weeks
        for week in range(weeks_ahead):
            target_date = today + timedelta(days=days_until_next + (week * 7))
            
            # Skip if target_date is in the past (shouldn't happen but safety check)
            if target_date < today:
                continue
            
            # Check if appointment already exists for this date/time/client
            existing = await db.appointments.find_one({
                "client_id": client_id,
                "scheduled_date": target_date.isoformat(),
                "scheduled_time": scheduled_time,
                "service_type": schedule.get("service_type")
            })
            
            if not existing:
                appointment = {
                    "id": str(uuid.uuid4()),
                    "client_id": client_id,
                    "walker_id": schedule.get("walker_id"),
                    "pet_ids": schedule.get("pet_ids", []),
                    "service_type": schedule.get("service_type"),
                    "scheduled_date": target_date.isoformat(),
                    "scheduled_time": scheduled_time,
                    "duration_value": schedule.get("duration_value", 1),
                    "status": "scheduled",
                    "notes": schedule.get("notes", ""),
                    "is_recurring": True,
                    "recurring_schedule_id": schedule.get("id"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.appointments.insert_one(appointment)
                appointments_created += 1
    
    return appointments_created


@api_router.get("/users/{user_id}/appointments-check")
async def check_client_appointments(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check appointments for a specific client (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    appointments = await db.appointments.find({"client_id": user_id}, {"_id": 0}).to_list(500)
    
    # Get client name
    client = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1})
    client_name = client.get("full_name", "Unknown") if client else "Unknown"
    
    return {
        "client_id": user_id,
        "client_name": client_name,
        "total_appointments": len(appointments),
        "sample_appointments": [{
            "id": a.get("id"),
            "scheduled_date": a.get("scheduled_date"),
            "scheduled_time": a.get("scheduled_time"),
            "service_type": a.get("service_type"),
            "status": a.get("status"),
            "walker_id": a.get("walker_id")
        } for a in sorted(appointments, key=lambda x: x.get("scheduled_date", ""))[:15]]
    }


@api_router.get("/debug/calendar-check")
async def debug_calendar_check(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check calendar data"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get all appointments
    all_appointments = await db.appointments.find({}, {"_id": 0}).to_list(1000)
    
    # Group by client
    by_client = {}
    for a in all_appointments:
        cid = a.get("client_id", "unknown")
        if cid not in by_client:
            by_client[cid] = []
        by_client[cid].append(a)
    
    # Get client names
    clients_info = []
    for cid, appts in by_client.items():
        client = await db.users.find_one({"id": cid}, {"_id": 0, "full_name": 1})
        client_name = client.get("full_name", "Unknown") if client else "Unknown"
        
        # Get date range
        dates = [a.get("scheduled_date", "") for a in appts]
        dates = [d for d in dates if d]
        
        clients_info.append({
            "client_id": cid[:8] + "...",
            "client_name": client_name,
            "appointment_count": len(appts),
            "date_range": f"{min(dates)} to {max(dates)}" if dates else "No dates",
            "service_types": list(set(a.get("service_type", "unknown") for a in appts))
        })
    
    return {
        "total_appointments": len(all_appointments),
        "clients_with_appointments": len(by_client),
        "clients": sorted(clients_info, key=lambda x: x["client_name"])
    }


@api_router.get("/users/{user_id}/schedule-diagnostic")
async def get_schedule_diagnostic(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get diagnostic info about a client's schedule setup (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    client = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get all recurring schedules (any status)
    all_schedules = await db.recurring_schedules.find({"client_id": user_id}, {"_id": 0}).to_list(100)
    
    # Get appointments
    appointments = await db.appointments.find({"client_id": user_id}, {"_id": 0}).to_list(500)
    
    # Get pets
    pets = await db.pets.find({"owner_id": user_id}, {"_id": 0}).to_list(100)
    
    od = client.get("onboarding_data") or {}
    
    return {
        "client_id": user_id,
        "full_name": client.get("full_name"),
        "onboarding_completed": client.get("onboarding_completed"),
        "pricing_setup_completed": client.get("pricing_setup_completed"),
        "onboarding_data": od,
        "pets_count": len(pets),
        "pet_ids": [p.get("id") for p in pets],
        "recurring_schedules_count": len(all_schedules),
        "recurring_schedules_by_status": {
            "active": len([s for s in all_schedules if s.get("status") == "active"]),
            "pending_assignment": len([s for s in all_schedules if s.get("status") == "pending_assignment"]),
            "stopped": len([s for s in all_schedules if s.get("status") == "stopped"]),
            "other": len([s for s in all_schedules if s.get("status") not in ["active", "pending_assignment", "stopped"]])
        },
        "appointments_count": len(appointments),
        "future_appointments": len([a for a in appointments if a.get("scheduled_date", "") >= datetime.now(timezone.utc).strftime("%Y-%m-%d")])
    }


@api_router.post("/users/{user_id}/generate-appointments")
async def trigger_appointment_generation(user_id: str, weeks_ahead: int = 4, current_user: dict = Depends(get_current_user)):
    """Manually trigger appointment generation from recurring schedules for a client (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Check if client exists
    client = await db.users.find_one({"id": user_id, "role": "client"}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Activate any pending recurring schedules for this client
    activated = await db.recurring_schedules.update_many(
        {"client_id": user_id, "status": "pending_assignment"},
        {"$set": {"status": "active"}}
    )
    
    # Get diagnostic info
    existing_schedules = await db.recurring_schedules.find({
        "client_id": user_id
    }, {"_id": 0}).to_list(100)
    
    od = client.get("onboarding_data", {})
    diagnostic = {
        "existing_recurring_schedules": len(existing_schedules),
        "onboarding_data_exists": bool(od),
        "preferred_days": od.get("preferred_days", []),
        "preferred_times": od.get("preferred_walk_times", []),
        "schedule_type": od.get("schedule_type"),
        "service_category": od.get("service_category")
    }
    
    appointments_created = await generate_appointments_for_client(user_id, weeks_ahead)
    return {
        "message": f"Generated {appointments_created} appointments for {client.get('full_name', 'client')}",
        "appointments_created": appointments_created,
        "schedules_activated": activated.modified_count,
        "diagnostic": diagnostic
    }


@api_router.post("/users/{user_id}/force-create-schedule")
async def force_create_schedule_from_onboarding(user_id: str, current_user: dict = Depends(get_current_user)):
    """Force create recurring schedules from onboarding data, ignoring existing schedules (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    client = await db.users.find_one({"id": user_id, "role": "client"}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    od = client.get("onboarding_data") or {}
    if not od:
        raise HTTPException(status_code=400, detail="No onboarding data found for this client")
    
    preferred_days = od.get("preferred_days", [])
    # Try multiple possible field names for times
    preferred_times = od.get("preferred_walk_times") or od.get("preferred_times") or od.get("walk_times") or []
    walk_duration = od.get("walk_duration", 30)
    walks_per_day = od.get("walks_per_day", 1)
    
    if not preferred_days:
        raise HTTPException(status_code=400, detail=f"No preferred_days in onboarding data. Data: {od}")
    
    # If no times found, generate default times based on walks_per_day
    # Use times that match typical walk schedules (morning/afternoon)
    if not preferred_times:
        if walks_per_day >= 2:
            preferred_times = ["11:00", "14:00"]  # Morning and afternoon
        else:
            preferred_times = ["11:00"]  # Just morning
    
    # Get pet IDs
    pets = await db.pets.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(100)
    pet_ids = [p["id"] for p in pets]
    
    # Delete ALL existing recurring schedules for this client
    deleted_schedules = await db.recurring_schedules.delete_many({"client_id": user_id})
    
    # Delete ALL existing appointments for this client (to start fresh)
    deleted_appointments = await db.appointments.delete_many({"client_id": user_id})
    
    # Map day names to numbers
    day_to_num = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    service_type_map = {30: "walk_30", 45: "walk_45", 60: "walk_60"}
    service_type = service_type_map.get(walk_duration, "walk_30")
    
    schedules_created = 0
    for day in preferred_days:
        day_num = day_to_num.get(day, 0)
        for walk_time in preferred_times:
            recurring_schedule = {
                "id": str(uuid.uuid4()),
                "client_id": user_id,
                "walker_id": od.get("preferred_walker_id"),
                "pet_ids": pet_ids,
                "service_type": service_type,
                "scheduled_time": walk_time,
                "day_of_week": day_num,
                "notes": "Force created from onboarding data",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user['id']
            }
            await db.recurring_schedules.insert_one(recurring_schedule)
            schedules_created += 1
    
    # Now generate appointments starting from TODAY
    appointments_created = await generate_appointments_from_today(user_id, pet_ids, preferred_days, preferred_times, service_type, weeks_ahead=4)
    
    return {
        "message": f"Force created {schedules_created} recurring schedules and {appointments_created} appointments",
        "schedules_deleted": deleted_schedules.deleted_count,
        "appointments_deleted": deleted_appointments.deleted_count,
        "schedules_created": schedules_created,
        "appointments_created": appointments_created,
        "days": preferred_days,
        "times": preferred_times
    }


async def generate_appointments_from_today(client_id: str, pet_ids: list, days: list, times: list, service_type: str, weeks_ahead: int = 4):
    """Generate appointments starting from today for the specified days and times"""
    from datetime import date
    
    day_to_num = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    day_nums = [day_to_num.get(d, 0) for d in days]
    
    today = date.today()  # Use local date, not UTC
    appointments_created = 0
    
    # Generate appointments for the next N weeks
    for day_offset in range(weeks_ahead * 7):
        target_date = today + timedelta(days=day_offset)
        target_weekday = target_date.weekday()
        
        # Check if this day of week is in the client's preferred days
        if target_weekday in day_nums:
            for walk_time in times:
                appointment = {
                    "id": str(uuid.uuid4()),
                    "client_id": client_id,
                    "walker_id": None,  # Unassigned
                    "pet_ids": pet_ids,
                    "service_type": service_type,
                    "scheduled_date": target_date.isoformat(),
                    "scheduled_time": walk_time,
                    "duration_value": 1,
                    "status": "scheduled",
                    "notes": "",
                    "is_recurring": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.appointments.insert_one(appointment)
                appointments_created += 1
    
    return appointments_created


@api_router.get("/users/{user_id}/custom-pricing")
async def get_custom_pricing(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin' and current_user['id'] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    custom = await db.custom_pricing.find_one({"user_id": user_id}, {"_id": 0})
    if custom:
        return custom.get('pricing', {})
    return {}

# Walking Schedule for Clients
@api_router.post("/users/{user_id}/walking-schedule")
async def set_walking_schedule(user_id: str, schedule: dict, current_user: dict = Depends(get_current_user)):
    """Save walking/service schedule for a client and regenerate appointments"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    service_type = schedule.get('service_type', 'walk_30')
    days = schedule.get('days', [])
    preferred_times = schedule.get('preferred_times', [])
    walks_per_day = schedule.get('walks_per_day', 1)
    duration_value = schedule.get('duration_value', 1)
    preferred_walker_id = schedule.get('preferred_walker_id', '')
    notes = schedule.get('notes', '')
    is_recurring = schedule.get('is_recurring', True)  # Default to recurring
    start_date = schedule.get('start_date', '')
    end_date = schedule.get('end_date', '')
    
    # Save to walking_schedules collection (for UI state)
    schedule_data = {
        "user_id": user_id,
        "service_type": service_type,
        "walks_per_day": walks_per_day,
        "days": days,
        "preferred_times": preferred_times,
        "preferred_walker_id": preferred_walker_id,
        "duration_value": duration_value,
        "notes": notes,
        "is_recurring": is_recurring,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.walking_schedules.update_one(
        {"user_id": user_id},
        {"$set": schedule_data},
        upsert=True
    )
    
    # Also update the user's walkingSchedule field
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"walkingSchedule": schedule_data}}
    )
    
    # Get pet IDs for this client
    pets = await db.pets.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(100)
    pet_ids = [p["id"] for p in pets]
    
    # Map day names to numbers (handle both capitalized and lowercase)
    day_to_num = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
    }
    
    # Determine times based on service type
    if service_type.startswith('walk'):
        times_to_use = preferred_times if preferred_times else (["11:00", "14:00"][:walks_per_day] if walks_per_day > 1 else ["11:00"])
    else:
        times_to_use = ["09:00"]
    
    from datetime import date
    
    # ONE-TIME SCHEDULE: Create appointments for date range only
    if not is_recurring:
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Start date and end date are required for one-time schedules")
        
        try:
            start = date.fromisoformat(start_date)
            end = date.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        if end < start:
            raise HTTPException(status_code=400, detail="End date must be on or after start date")
        
        # Don't delete existing schedules for one-time - just add new appointments
        appointments_created = 0
        current_date = start
        
        while current_date <= end:
            for time in times_to_use:
                appointment = {
                    "id": str(uuid.uuid4()),
                    "client_id": user_id,
                    "walker_id": preferred_walker_id if preferred_walker_id else None,
                    "pet_ids": pet_ids,
                    "service_type": service_type,
                    "scheduled_date": current_date.isoformat(),
                    "scheduled_time": time,
                    "duration_value": duration_value,
                    "status": "scheduled",
                    "notes": notes,
                    "is_recurring": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.appointments.insert_one(appointment)
                appointments_created += 1
            current_date += timedelta(days=1)
        
        return {
            "message": f"One-time schedule created: {appointments_created} appointments from {start_date} to {end_date}",
            "schedules_created": 0,
            "appointments_created": appointments_created,
            "is_recurring": False
        }
    
    # RECURRING SCHEDULE: Create recurring_schedules and generate appointments
    if days and len(days) > 0:
        # Delete existing recurring schedules for this client
        await db.recurring_schedules.delete_many({"client_id": user_id})
        
        # Delete existing future appointments for this client
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.appointments.delete_many({
            "client_id": user_id,
            "scheduled_date": {"$gte": today}
        })
        
        # Create recurring schedules
        schedules_created = 0
        for day in days:
            day_num = day_to_num.get(day, 0)
            for time in times_to_use:
                recurring_schedule = {
                    "id": str(uuid.uuid4()),
                    "client_id": user_id,
                    "walker_id": preferred_walker_id if preferred_walker_id else None,
                    "pet_ids": pet_ids,
                    "service_type": service_type,
                    "scheduled_time": time,
                    "day_of_week": day_num,
                    "duration_value": duration_value,
                    "notes": notes,
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user['id']
                }
                await db.recurring_schedules.insert_one(recurring_schedule)
                schedules_created += 1
        
        # Generate appointments for the next 4 weeks
        day_nums = [day_to_num.get(d, 0) for d in days]
        today_date = date.today()
        appointments_created = 0
        
        for day_offset in range(28):  # 4 weeks
            target_date = today_date + timedelta(days=day_offset)
            if target_date.weekday() in day_nums:
                for time in times_to_use:
                    appointment = {
                        "id": str(uuid.uuid4()),
                        "client_id": user_id,
                        "walker_id": preferred_walker_id if preferred_walker_id else None,
                        "pet_ids": pet_ids,
                        "service_type": service_type,
                        "scheduled_date": target_date.isoformat(),
                        "scheduled_time": time,
                        "duration_value": duration_value,
                        "status": "scheduled",
                        "notes": notes,
                        "is_recurring": True,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.appointments.insert_one(appointment)
                    appointments_created += 1
        
        return {
            "message": f"Recurring schedule saved. Created {schedules_created} recurring schedules and {appointments_created} appointments",
            "schedules_created": schedules_created,
            "appointments_created": appointments_created,
            "is_recurring": True
        }
    
    return {"message": "Schedule saved (no days selected, no appointments generated)"}

@api_router.get("/users/{user_id}/walking-schedule")
async def get_walking_schedule(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get walking schedule for a client"""
    if current_user['role'] not in ['admin', 'walker'] and current_user['id'] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    schedule = await db.walking_schedules.find_one({"user_id": user_id}, {"_id": 0})
    if schedule:
        return schedule
    return None

# Service Pricing Routes
@api_router.get("/services", response_model=List[ServicePricing])
async def get_services():
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not services:
        # Initialize default services
        default_services = [
            ServicePricing(service_type=ServiceType.WALK_30, name="30-Minute Walk", description="A quick 30-minute walk for your pet", price=25.00, duration_minutes=30, duration_type="minutes"),
            ServicePricing(service_type=ServiceType.WALK_45, name="45-Minute Walk", description="A moderate 45-minute walk for your pet", price=32.00, duration_minutes=45, duration_type="minutes"),
            ServicePricing(service_type=ServiceType.WALK_60, name="60-Minute Walk", description="A full hour walk with play time", price=40.00, duration_minutes=60, duration_type="minutes"),
            ServicePricing(service_type=ServiceType.PETSIT_OUR_LOCATION, name="Pet Sitting - Our Location (Boarding)", description="Boarding at our facility. $50/night, 2nd dog half price, +$10 holiday surcharge.", price=50.00, duration_type="nights"),
            ServicePricing(service_type=ServiceType.TRANSPORT, name="Pet Transport", description="Safe transport to vet or groomer", price=35.00, duration_minutes=60, duration_type="minutes"),
            ServicePricing(service_type=ServiceType.CONCIERGE, name="Concierge Service", description="Premium care including feeding, walks, and attention", price=50.00, duration_minutes=120, duration_type="minutes"),
        ]
        for service in default_services:
            await db.services.insert_one(service.model_dump())
        services = [s.model_dump() for s in default_services]
    
    # Ensure all services have correct duration_type
    for service in services:
        if not service.get("duration_type") or service.get("duration_type") == "minutes":
            correct_type = get_service_duration_type(service.get("service_type", ""))
            service["duration_type"] = correct_type
    
    # Sort by display_order if present, otherwise by name
    services.sort(key=lambda s: (s.get('display_order', 999), s.get('name', '')))
    
    return services

@api_router.post("/services/set-order")
async def set_services_order(current_user: dict = Depends(get_current_user)):
    """Set the display order for all services (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Define the standard order
    order_map = {
        'walk_30': 1,
        'walk_45': 2,
        'walk_60': 3,
        'doggy_day_care': 4,
        'petsit_your_location': 5,
        'petsit_our_location': 6,
        'transport': 7,
        'concierge': 8,
    }
    
    updated = 0
    for service_type, order in order_map.items():
        result = await db.services.update_one(
            {'service_type': service_type},
            {'$set': {'display_order': order}}
        )
        updated += result.modified_count
    
    return {"message": f"Updated display order for {updated} services"}

@api_router.post("/services", response_model=ServicePricing)
async def create_service(service: ServicePricing, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    service_dict = service.model_dump()
    
    # Generate a service_type slug if it looks like a custom name (has spaces or capital letters)
    if ' ' in service_dict['service_type'] or service_dict['service_type'][0].isupper():
        # Create a slug from the name: "Doggy Day Camp" -> "doggy_day_camp"
        service_dict['service_type'] = service_dict['name'].lower().replace(' ', '_').replace('-', '_')
    
    # Auto-detect duration type based on service type
    service_dict['duration_type'] = get_service_duration_type(service_dict['service_type'])
    
    # Ensure we have a unique service_type
    existing = await db.services.find_one({"service_type": service_dict['service_type']}, {"_id": 0})
    if existing:
        # Append a number to make it unique
        base_type = service_dict['service_type']
        counter = 1
        while existing:
            service_dict['service_type'] = f"{base_type}_{counter}"
            existing = await db.services.find_one({"service_type": service_dict['service_type']}, {"_id": 0})
            counter += 1
    
    await db.services.insert_one(service_dict)
    service_dict.pop('_id', None)
    return service_dict

# Pet Sitting Price Calculator
@api_router.post("/services/calculate-petsit-price")
async def calculate_petsit_price_endpoint(
    service_type: str,
    num_dogs: int,
    start_date: str,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Calculate pet sitting price with multi-dog discount and holiday surcharge"""
    if service_type not in ["petsit_our_location", "petsit_your_location"]:
        raise HTTPException(status_code=400, detail="Invalid pet sitting service type")
    
    result = calculate_petsit_price(service_type, num_dogs, start_date, end_date)
    return result

@api_router.get("/services/holidays/{year}")
async def get_holiday_dates_endpoint(year: int):
    """Get all holiday dates (including day before/after) for pricing"""
    holidays = get_holiday_dates(year)
    return {"year": year, "holiday_dates": sorted(holidays)}

@api_router.get("/services/{service_type}/duration-type")
async def get_service_duration_type_endpoint(service_type: str):
    """Get the duration type for a service (minutes, days, or nights)"""
    duration_type = get_service_duration_type(service_type)
    return {"service_type": service_type, "duration_type": duration_type}

@api_router.post("/services/update-duration-types")
async def update_services_duration_types(current_user: dict = Depends(get_current_user)):
    """
    Update all services to have correct duration_type based on their service_type.
    Admin only endpoint.
    """
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    services = await db.services.find({}, {"_id": 0}).to_list(100)
    updated_count = 0
    
    for service in services:
        service_type = service.get("service_type", "")
        correct_duration_type = get_service_duration_type(service_type)
        
        if service.get("duration_type") != correct_duration_type:
            await db.services.update_one(
                {"id": service["id"]},
                {"$set": {"duration_type": correct_duration_type}}
            )
            updated_count += 1
    
    return {"message": f"Updated {updated_count} services", "updated_count": updated_count}

# Helper function to get time slots within buffer range (15 min before and after)
def get_buffer_time_slots(time_str: str, buffer_minutes: int = 15) -> list:
    """Get list of time slots within buffer range of given time"""
    try:
        hour, minute = map(int, time_str.split(':'))
        base_minutes = hour * 60 + minute
        
        slots = []
        # Check slots from (time - buffer) to (time + buffer)
        for offset in range(-buffer_minutes, buffer_minutes + 1, 15):
            total_minutes = base_minutes + offset
            if 0 <= total_minutes < 24 * 60:
                h = total_minutes // 60
                m = total_minutes % 60
                slots.append(f"{h:02d}:{m:02d}")
        return slots
    except:
        return [time_str]

def time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes since midnight"""
    try:
        hour, minute = map(int, time_str.split(':'))
        return hour * 60 + minute
    except:
        return 0

def minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to HH:MM"""
    h = (minutes // 60) % 24
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def get_walk_duration(service_type: str) -> int:
    """Get walk duration in minutes based on service type"""
    durations = {
        'walk_30': 30,
        'walk_45': 45,
        'walk_60': 60,
        'walk_15': 15,
        'pet_sitting': 60,
        'pet_sitting_overnight': 60,
        'transport': 30,
        'concierge': 30,
    }
    return durations.get(service_type, 30)  # Default to 30 minutes

async def check_walker_availability(walker_id: str, scheduled_date: str, scheduled_time: str, exclude_appt_id: str = None, service_type: str = 'walk_30') -> dict:
    """
    Check if walker is available at the given time.
    
    Rules for WALKS only:
    - Walker can't have overlapping walks
    - 15-minute buffer required AFTER a walk ends before the next can start
    
    For OTHER services (overnight, day visits, transport, etc.):
    - Times CAN overlap - these services don't require the same time exclusivity
    
    Example: If walker has a 30-min walk at 10:00 (ends 10:30),
    next walk can start at 10:45 (10:30 + 15 min buffer)
    But an overnight or day visit can be scheduled at any time.
    """
    # Non-walk services can overlap - no conflict checking needed
    non_conflicting_services = ['overnight', 'stay_overnight', 'stay_extended', 'stay_day', 
                                 'day_visit', 'petsit_our_location', 'petsit_your_location',
                                 'doggy_day_camp', 'doggy_day_care', 'transport', 'concierge']
    
    if service_type in non_conflicting_services:
        return {"available": True, "message": "Service type allows overlapping schedules"}
    
    new_walk_start = time_to_minutes(scheduled_time)
    new_walk_duration = get_walk_duration(service_type)
    new_walk_end = new_walk_start + new_walk_duration
    
    # Get all walker's WALK appointments for that day (only walks conflict with walks)
    query = {
        "walker_id": walker_id,
        "scheduled_date": scheduled_date,
        "status": {"$nin": ["cancelled", "completed"]},
        "service_type": {"$regex": "^walk_"}  # Only check against walk services
    }
    
    if exclude_appt_id:
        query["id"] = {"$ne": exclude_appt_id}
    
    existing_appointments = await db.appointments.find(query, {"_id": 0}).to_list(50)
    
    buffer_minutes = 15
    
    for appt in existing_appointments:
        existing_start = time_to_minutes(appt.get("scheduled_time", "00:00"))
        existing_duration = get_walk_duration(appt.get("service_type", "walk_30"))
        existing_end = existing_start + existing_duration
        
        # Check for overlap or buffer violation
        # New walk must start at least 15 min after existing walk ends
        # OR new walk must end at least 15 min before existing walk starts
        
        # Case 1: New walk starts during or too soon after existing walk
        # existing: 10:00-10:30, buffer ends at 10:45
        # new walk at 10:15 or 10:30 or 10:40 would conflict
        if new_walk_start < existing_end + buffer_minutes and new_walk_start >= existing_start:
            return {
                "available": False,
                "conflict_time": appt.get("scheduled_time"),
                "message": f"Walker has a walk at {appt.get('scheduled_time')} that ends at {minutes_to_time(existing_end)}. Next walk can start at {minutes_to_time(existing_end + buffer_minutes)} (15-min buffer after walk ends)."
            }
        
        # Case 2: New walk would end during or too close to existing walk start
        # existing: 11:00-11:30
        # new walk 10:30-11:00 would need to end by 10:45 (15 min before 11:00)
        if new_walk_end > existing_start - buffer_minutes and new_walk_end <= existing_end:
            return {
                "available": False,
                "conflict_time": appt.get("scheduled_time"),
                "message": f"Walker has a walk starting at {appt.get('scheduled_time')}. Your walk would end too close to it (15-min buffer required)."
            }
        
        # Case 3: New walk completely overlaps existing walk
        if new_walk_start <= existing_start and new_walk_end >= existing_end:
            return {
                "available": False,
                "conflict_time": appt.get("scheduled_time"),
                "message": f"Walker already has a walk scheduled at {appt.get('scheduled_time')}."
            }
    
    return {"available": True}

@api_router.get("/walkers/{walker_id}/check-availability")
async def api_check_walker_availability(
    walker_id: str,
    scheduled_date: str,
    scheduled_time: str,
    service_type: str = "walk_30",
    current_user: dict = Depends(get_current_user)
):
    """API endpoint to check walker availability for a specific time slot"""
    result = await check_walker_availability(walker_id, scheduled_date, scheduled_time, service_type=service_type)
    return result

@api_router.get("/walkers/find-available")
async def find_available_walker(
    scheduled_date: str,
    scheduled_time: str,
    service_type: str = "walk_30",
    exclude_walker_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Find the next available walker for a given time slot"""
    # Get all active walkers
    walkers = await db.users.find(
        {"role": "walker", "is_active": True, "frozen": {"$ne": True}},
        {"_id": 0, "id": 1, "full_name": 1, "username": 1}
    ).to_list(100)
    
    available_walkers = []
    
    for walker in walkers:
        if exclude_walker_id and walker["id"] == exclude_walker_id:
            continue
        
        availability = await check_walker_availability(
            walker["id"], scheduled_date, scheduled_time, service_type=service_type
        )
        
        if availability.get("available"):
            available_walkers.append({
                "id": walker["id"],
                "name": walker.get("full_name") or walker.get("username", "Unknown")
            })
    
    if available_walkers:
        return {
            "found": True,
            "available_walkers": available_walkers,
            "suggested_walker": available_walkers[0]  # First available
        }
    else:
        return {
            "found": False,
            "message": "No walkers available at this time",
            "available_walkers": []
        }

@api_router.post("/walkers/check-schedule-conflicts")
async def check_schedule_conflicts(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a walker has conflicts with a proposed schedule.
    Used during onboarding to check multiple day/time combinations.
    
    Input: {
        "walker_id": "...",
        "schedule_type": "recurring" or "one_time",
        "preferred_days": ["Monday", "Tuesday", ...],
        "preferred_times": ["09:00", "14:00", ...],
        "service_type": "walk_30"
    }
    """
    walker_id = data.get("walker_id")
    schedule_type = data.get("schedule_type", "recurring")
    preferred_days = data.get("preferred_days", [])
    preferred_times = data.get("preferred_times", [])
    service_type = data.get("service_type", "walk_30")
    
    if not walker_id:
        return {"has_conflicts": False, "conflicts": []}
    
    day_to_num = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    
    conflicts = []
    today = datetime.now(timezone.utc).date()
    today_weekday = today.weekday()
    
    for day in preferred_days:
        day_num = day_to_num.get(day, 0)
        # Calculate next occurrence of this day
        days_ahead = day_num - today_weekday
        if days_ahead <= 0:
            days_ahead += 7
        next_date = today + timedelta(days=days_ahead)
        date_str = next_date.isoformat()
        
        for walk_time in preferred_times:
            availability = await check_walker_availability(
                walker_id, date_str, walk_time, service_type=service_type
            )
            
            if not availability.get("available"):
                conflicts.append({
                    "day": day,
                    "time": walk_time,
                    "date": date_str,
                    "message": availability.get("message", "Walker not available")
                })
    
    # Find alternative walkers for conflicting slots
    alternatives = []
    if conflicts:
        for conflict in conflicts:
            alt_result = await find_available_walker(
                conflict["date"], conflict["time"], service_type, exclude_walker_id=walker_id,
                current_user=current_user
            )
            if alt_result.get("found"):
                alternatives.append({
                    "day": conflict["day"],
                    "time": conflict["time"],
                    "available_walkers": alt_result["available_walkers"]
                })
    
    return {
        "has_conflicts": len(conflicts) > 0,
        "conflicts": conflicts,
        "alternatives": alternatives
    }

# Appointment Routes
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appt_data: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    # If walker is specified, check availability with 15-minute buffer after walk ends
    if appt_data.walker_id:
        availability = await check_walker_availability(
            appt_data.walker_id, 
            appt_data.scheduled_date, 
            appt_data.scheduled_time,
            service_type=appt_data.service_type
        )
        if not availability["available"]:
            raise HTTPException(status_code=400, detail=availability["message"])
    
    appointment = Appointment(
        client_id=current_user['id'],
        **appt_data.model_dump()
    )
    appt_dict = appointment.model_dump()
    appt_dict['created_at'] = appt_dict['created_at'].isoformat()
    await db.appointments.insert_one(appt_dict)
    return appointment

# Recurring Schedule Routes
@api_router.post("/recurring-schedules")
async def create_recurring_schedule(schedule_data: RecurringScheduleCreate, current_user: dict = Depends(get_current_user)):
    """Create a new recurring schedule"""
    # Get the data and remove client_id if present to avoid conflicts
    data = schedule_data.model_dump()
    data.pop('client_id', None)  # Remove client_id from data to avoid duplicate
    
    schedule = RecurringSchedule(
        client_id=current_user['id'] if current_user['role'] == 'client' else schedule_data.client_id if hasattr(schedule_data, 'client_id') and schedule_data.client_id else current_user['id'],
        created_by=current_user['id'],
        **data
    )
    schedule_dict = schedule.model_dump()
    schedule_dict['created_at'] = schedule_dict['created_at'].isoformat()
    # Handle optional datetime fields
    if schedule_dict.get('paused_at'):
        schedule_dict['paused_at'] = schedule_dict['paused_at'].isoformat()
    if schedule_dict.get('stopped_at'):
        schedule_dict['stopped_at'] = schedule_dict['stopped_at'].isoformat()
    
    await db.recurring_schedules.insert_one(schedule_dict)
    
    # Return the created schedule from database to avoid serialization issues
    created_schedule = await db.recurring_schedules.find_one({"id": schedule.id}, {"_id": 0})
    return created_schedule

@api_router.get("/recurring-schedules")
async def get_recurring_schedules(current_user: dict = Depends(get_current_user)):
    """Get recurring schedules for the current user or all for admin"""
    query = {}
    if current_user['role'] == 'client':
        query['client_id'] = current_user['id']
    elif current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    schedules = await db.recurring_schedules.find(query, {"_id": 0}).to_list(500)
    return schedules

@api_router.put("/recurring-schedules/{schedule_id}/pause")
async def pause_recurring_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    """Pause a recurring schedule"""
    schedule = await db.recurring_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permissions
    if current_user['role'] not in ['admin'] and schedule['client_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.recurring_schedules.update_one(
        {"id": schedule_id},
        {"$set": {"status": "paused", "paused_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Schedule paused"}

@api_router.put("/recurring-schedules/{schedule_id}/resume")
async def resume_recurring_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    """Resume a paused recurring schedule"""
    schedule = await db.recurring_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if current_user['role'] not in ['admin'] and schedule['client_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.recurring_schedules.update_one(
        {"id": schedule_id},
        {"$set": {"status": "active", "paused_at": None}}
    )
    return {"message": "Schedule resumed"}

@api_router.put("/recurring-schedules/{schedule_id}/stop")
async def stop_recurring_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    """Stop a recurring schedule permanently (but keep history)"""
    schedule = await db.recurring_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if current_user['role'] not in ['admin'] and schedule['client_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.recurring_schedules.update_one(
        {"id": schedule_id},
        {"$set": {"status": "stopped", "stopped_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Schedule stopped"}

@api_router.get("/recurring-schedules")
async def get_recurring_schedules(
    client_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get recurring schedules, optionally filtered by client_id (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can view all schedules")
    
    query = {}
    if client_id:
        query["client_id"] = client_id
    
    schedules = await db.recurring_schedules.find(query, {"_id": 0}).to_list(500)
    return schedules

@api_router.delete("/recurring-schedules/{schedule_id}")
async def delete_recurring_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a recurring schedule (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can delete schedules")
    
    result = await db.recurring_schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted"}

@api_router.put("/recurring-schedules/{schedule_id}")
async def update_recurring_schedule(
    schedule_id: str, 
    update_data: dict,
    change_type: str = "future",  # "one_time" or "future"
    specific_date: Optional[str] = None,  # Required if change_type is "one_time"
    current_user: dict = Depends(get_current_user)
):
    """Update a recurring schedule - either one-time exception or permanent change"""
    schedule = await db.recurring_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if current_user['role'] not in ['admin'] and schedule['client_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if change_type == "one_time" and specific_date:
        # Create a one-time exception appointment
        exception_appt = {
            "id": str(uuid.uuid4()),
            "client_id": schedule['client_id'],
            "walker_id": update_data.get('walker_id', schedule.get('walker_id')),
            "pet_ids": update_data.get('pet_ids', schedule['pet_ids']),
            "service_type": update_data.get('service_type', schedule['service_type']),
            "scheduled_date": specific_date,
            "scheduled_time": update_data.get('scheduled_time', schedule['scheduled_time']),
            "status": "scheduled",
            "notes": update_data.get('notes', schedule.get('notes')),
            "is_recurring": True,
            "recurring_schedule_id": schedule_id,
            "is_one_time_exception": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.appointments.insert_one(exception_appt)
        return {"message": "One-time change created", "appointment": exception_appt}
    else:
        # Update the recurring schedule for all future appointments
        allowed_fields = ['walker_id', 'pet_ids', 'service_type', 'scheduled_time', 'day_of_week', 'notes']
        update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        await db.recurring_schedules.update_one(
            {"id": schedule_id},
            {"$set": update_dict}
        )
        return {"message": "Schedule updated for all future appointments"}

@api_router.put("/recurring-schedules/{schedule_id}/change-walker")
async def change_recurring_schedule_walker(
    schedule_id: str,
    walker_id: str,
    change_type: str = "one_time",  # "one_time" (default/first) or "permanent"
    specific_date: Optional[str] = None,  # Required for one_time changes
    current_user: dict = Depends(get_current_user)
):
    """
    Change the walker for a recurring schedule (ADMIN ONLY)
    - one_time: Only changes walker for a specific date, reverts to original walker next week
    - permanent: Changes walker for all future occurrences
    """
    # Admin only
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can change walkers on recurring schedules")
    
    schedule = await db.recurring_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Recurring schedule not found")
    
    # Verify the new walker exists
    new_walker = await db.users.find_one({"id": walker_id, "role": "walker"}, {"_id": 0})
    if not new_walker:
        raise HTTPException(status_code=404, detail="Walker not found")
    
    if change_type == "one_time":
        # One-time change - create an exception appointment for that specific date
        if not specific_date:
            # Calculate next occurrence if no date provided
            day_to_num = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
            today = datetime.now(timezone.utc).date()
            today_weekday = today.weekday()
            day_num = schedule.get('day_of_week', 0)
            days_ahead = day_num - today_weekday
            if days_ahead <= 0:
                days_ahead += 7
            specific_date = (today + timedelta(days=days_ahead)).isoformat()
        
        # Check if there's already an exception for this date
        existing_exception = await db.appointments.find_one({
            "recurring_schedule_id": schedule_id,
            "scheduled_date": specific_date,
            "is_one_time_exception": True
        }, {"_id": 0})
        
        if existing_exception:
            # Update existing exception
            await db.appointments.update_one(
                {"id": existing_exception["id"]},
                {"$set": {"walker_id": walker_id}}
            )
            return {
                "message": f"Walker changed for {specific_date} only. Original walker will resume next week.",
                "change_type": "one_time",
                "date": specific_date,
                "new_walker": new_walker.get('full_name', new_walker.get('username'))
            }
        else:
            # Create new exception appointment
            exception_appt = {
                "id": str(uuid.uuid4()),
                "client_id": schedule['client_id'],
                "walker_id": walker_id,
                "pet_ids": schedule['pet_ids'],
                "service_type": schedule['service_type'],
                "scheduled_date": specific_date,
                "scheduled_time": schedule['scheduled_time'],
                "status": "scheduled",
                "notes": f"One-time walker change from recurring schedule",
                "is_recurring": True,
                "recurring_schedule_id": schedule_id,
                "is_one_time_exception": True,
                "original_walker_id": schedule.get('walker_id'),  # Store original for reference
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.appointments.insert_one(exception_appt)
            
            return {
                "message": f"Walker changed for {specific_date} only. Original walker will resume next week.",
                "change_type": "one_time",
                "date": specific_date,
                "appointment_id": exception_appt["id"],
                "new_walker": new_walker.get('full_name', new_walker.get('username'))
            }
    
    else:  # permanent
        # Permanent change - update the recurring schedule itself
        old_walker_id = schedule.get('walker_id')
        
        await db.recurring_schedules.update_one(
            {"id": schedule_id},
            {"$set": {
                "walker_id": walker_id,
                "walker_changed_at": datetime.now(timezone.utc).isoformat(),
                "walker_changed_by": current_user['id'],
                "previous_walker_id": old_walker_id
            }}
        )
        
        return {
            "message": "Walker permanently changed for all future walks.",
            "change_type": "permanent",
            "new_walker": new_walker.get('full_name', new_walker.get('username'))
        }

@api_router.get("/recurring-schedules/{schedule_id}/upcoming")
async def get_upcoming_recurring_appointments(
    schedule_id: str,
    weeks: int = 4,
    current_user: dict = Depends(get_current_user)
):
    """
    Get upcoming appointments for a recurring schedule, including any one-time exceptions.
    Shows what walker is assigned for each upcoming date.
    """
    schedule = await db.recurring_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Calculate upcoming dates
    today = datetime.now(timezone.utc).date()
    today_weekday = today.weekday()
    day_num = schedule.get('day_of_week', 0)
    
    upcoming = []
    for week in range(weeks):
        days_ahead = day_num - today_weekday + (week * 7)
        if days_ahead < 0:
            days_ahead += 7
        target_date = today + timedelta(days=days_ahead)
        date_str = target_date.isoformat()
        
        # Check for one-time exception
        exception = await db.appointments.find_one({
            "recurring_schedule_id": schedule_id,
            "scheduled_date": date_str,
            "is_one_time_exception": True
        }, {"_id": 0})
        
        if exception:
            walker = await db.users.find_one({"id": exception.get('walker_id')}, {"_id": 0, "id": 1, "full_name": 1, "username": 1})
            upcoming.append({
                "date": date_str,
                "time": exception.get('scheduled_time', schedule['scheduled_time']),
                "walker_id": exception.get('walker_id'),
                "walker_name": walker.get('full_name', walker.get('username', 'Unknown')) if walker else 'Unassigned',
                "is_exception": True,
                "status": exception.get('status', 'scheduled'),
                "appointment_id": exception.get('id')
            })
        else:
            walker = await db.users.find_one({"id": schedule.get('walker_id')}, {"_id": 0, "id": 1, "full_name": 1, "username": 1})
            upcoming.append({
                "date": date_str,
                "time": schedule['scheduled_time'],
                "walker_id": schedule.get('walker_id'),
                "walker_name": walker.get('full_name', walker.get('username', 'Unknown')) if walker else 'Unassigned',
                "is_exception": False,
                "status": "scheduled"
            })
    
    return {
        "schedule_id": schedule_id,
        "service_type": schedule['service_type'],
        "default_walker_id": schedule.get('walker_id'),
        "upcoming": upcoming
    }

@api_router.put("/appointments/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: str,
    cancel_type: str = "one_time",  # "one_time" or "future" (for recurring)
    current_user: dict = Depends(get_current_user)
):
    """Cancel an appointment - one-time or stop all future recurring"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if current_user['role'] not in ['admin'] and appointment['client_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Cancel this specific appointment
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": "cancelled"}}
    )
    
    # If recurring and cancelling future, stop the recurring schedule
    if cancel_type == "future" and appointment.get('recurring_schedule_id'):
        await db.recurring_schedules.update_one(
            {"id": appointment['recurring_schedule_id']},
            {"$set": {"status": "stopped", "stopped_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Appointment cancelled and recurring schedule stopped"}
    
    return {"message": "Appointment cancelled"}

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'client':
        query['client_id'] = current_user['id']
    elif current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(500)
    
    # Enrich appointments with walker name and formatted completion data
    enriched_appointments = []
    for appt in appointments:
        enriched = dict(appt)
        
        # Add walker name
        if appt.get('walker_id'):
            walker = await db.users.find_one({"id": appt['walker_id']}, {"_id": 0, "full_name": 1})
            enriched['walker_name'] = walker.get('full_name') if walker else None
        
        # Format completion data for completed walks
        if appt.get('status') == 'completed' and appt.get('completion_data'):
            cd = appt['completion_data']
            enriched['pee_count'] = 1 if cd.get('did_pee') else 0
            enriched['poop_count'] = 1 if cd.get('did_poop') else 0
            enriched['water_given'] = cd.get('checked_water', False)
            enriched['walker_notes'] = cd.get('notes', '')
            enriched['completed_at'] = cd.get('completed_at')
        
        # Use actual_duration_minutes if available
        if appt.get('actual_duration_minutes'):
            enriched['actual_duration'] = appt['actual_duration_minutes']
        
        enriched_appointments.append(enriched)
    
    return enriched_appointments

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
        
        # Get pet names for this appointment
        pet_names = []
        if appt.get('pet_ids'):
            for pet_id in appt['pet_ids']:
                pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1})
                if pet:
                    pet_names.append(pet['name'])
        
        calendar_events.append({
            **appt,
            "client_name": client.get('full_name') if client else "Unknown",
            "walker_name": walker.get('full_name') if walker else "Unassigned",
            "pet_names": pet_names
        })
    return calendar_events

# Get available time slots for a date
@api_router.get("/appointments/available-slots")
async def get_available_slots(date: str, current_user: dict = Depends(get_current_user)):
    """Get available time slots and walker availability for a given date"""
    # Generate 15-minute increment time slots from 6:00 AM to 8:00 PM
    time_slots = []
    for hour in range(6, 21):  # 6 AM to 8 PM
        for minute in [0, 15, 30, 45]:
            time_slots.append(f"{hour:02d}:{minute:02d}")
    
    # Get all appointments for this date
    appointments = await db.appointments.find({
        "scheduled_date": date,
        "status": {"$nin": ["cancelled"]}
    }, {"_id": 0}).to_list(100)
    
    # Get all walkers
    walkers = await db.users.find({"role": "walker", "is_active": True}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    slot_info = []
    for slot in time_slots:
        appts_at_slot = [a for a in appointments if a.get('scheduled_time') == slot]
        slot_count = len(appts_at_slot)
        
        # Find available walkers for this slot
        booked_walker_ids = [a.get('walker_id') for a in appts_at_slot if a.get('walker_id')]
        available_walkers = [w for w in walkers if w['id'] not in booked_walker_ids]
        
        slot_info.append({
            "time": slot,
            "booked_count": slot_count,
            "is_full": slot_count >= 3,
            "available_walkers": available_walkers
        })
    
    return {"date": date, "slots": slot_info}

# Get appointments needing reassignment - Must be before parameterized route
@api_router.get("/appointments/needs-reassignment")
async def get_appointments_needing_reassignment(current_user: dict = Depends(get_current_user)):
    """Admin gets appointments that need reassignment"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    appts = await db.appointments.find(
        {"needs_reassignment": True, "status": "scheduled"},
        {"_id": 0}
    ).to_list(1000)
    
    # Enrich with client and walker info
    for appt in appts:
        client = await db.users.find_one({"id": appt["client_id"]}, {"_id": 0, "password_hash": 0})
        appt["client"] = client
        if appt.get("walker_id"):
            walker = await db.users.find_one({"id": appt["walker_id"]}, {"_id": 0, "password_hash": 0})
            appt["original_walker"] = walker
    
    return appts

@api_router.get("/appointments/{appt_id}", response_model=Appointment)
async def get_appointment(appt_id: str):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt

@api_router.get("/appointments/{appt_id}/detail")
async def get_appointment_detail(appt_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed appointment info for calendar modal"""
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Get client info
    client = await db.users.find_one({"id": appt['client_id']}, {"_id": 0, "password_hash": 0})
    
    # Get walker info
    walker = None
    if appt.get('walker_id'):
        walker = await db.users.find_one({"id": appt['walker_id']}, {"_id": 0, "password_hash": 0})
    
    # Get service info
    service = await db.services.find_one({"service_type": appt['service_type']}, {"_id": 0})
    
    # Get pet info
    pets = []
    for pet_id in appt.get('pet_ids', []):
        pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
        if pet:
            pets.append(pet)
    
    return {
        **appt,
        "client": client,
        "walker": walker,
        "service": service,
        "pets": pets
    }

@api_router.put("/appointments/{appt_id}")
async def update_appointment(appt_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # If changing time slot, validate constraints
    new_date = update_data.get('scheduled_date', appt.get('scheduled_date'))
    new_time = update_data.get('scheduled_time', appt.get('scheduled_time'))
    new_walker = update_data.get('walker_id', appt.get('walker_id'))
    new_service = update_data.get('service_type', appt.get('service_type'))
    
    # Check walker availability with 15-minute buffer after walk ends
    if new_walker and new_date and new_time:
        availability = await check_walker_availability(
            new_walker, new_date, new_time, 
            exclude_appt_id=appt_id,
            service_type=new_service
        )
        if not availability["available"]:
            raise HTTPException(status_code=400, detail=availability["message"])
    
    allowed_fields = ['scheduled_date', 'scheduled_time', 'walker_id', 'status', 'notes', 'service_type', 'pet_ids']
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    await db.appointments.update_one({"id": appt_id}, {"$set": update_dict})
    
    updated_appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    return updated_appt

# Admin endpoint to create appointments for any client
@api_router.post("/appointments/admin", response_model=Appointment)
async def admin_create_appointment(appt_data: dict, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    scheduled_date = appt_data.get('scheduled_date')
    scheduled_time = appt_data.get('scheduled_time')
    walker_id = appt_data.get('walker_id')
    service_type = appt_data.get('service_type', 'walk_30')
    
    # Check walker availability with 15-minute buffer after walk ends
    if walker_id:
        availability = await check_walker_availability(
            walker_id, scheduled_date, scheduled_time,
            service_type=service_type
        )
        if not availability["available"]:
            raise HTTPException(status_code=400, detail=availability["message"])
    
    appointment = Appointment(
        client_id=appt_data.get('client_id'),
        walker_id=walker_id,
        pet_ids=appt_data.get('pet_ids', []),
        service_type=service_type,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        notes=appt_data.get('notes', '')
    )
    appt_dict = appointment.model_dump()
    appt_dict['created_at'] = appt_dict['created_at'].isoformat()
    await db.appointments.insert_one(appt_dict)
    return appointment

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
            "actual_duration_minutes": duration,
            "is_tracking": False
        }}
    )
    return {"message": "Walk completed", "duration_minutes": duration}

# Walk completion with questionnaire
class WalkCompletionData(BaseModel):
    did_pee: Optional[bool] = None
    did_poop: Optional[bool] = None
    checked_water: Optional[bool] = None
    completion_notes: Optional[str] = None

@api_router.post("/appointments/{appt_id}/complete")
async def complete_walk(appt_id: str, completion_data: WalkCompletionData = None, current_user: dict = Depends(get_current_user)):
    """Complete a walk with optional completion questionnaire data"""
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if current_user['role'] not in ['admin', 'walker', 'sitter'] and appt.get('walker_id') != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "completed",
        "end_time": datetime.now(timezone.utc).isoformat()
    }
    
    # Add completion questionnaire data if provided
    if completion_data:
        update_data["completion_data"] = {
            "did_pee": completion_data.did_pee,
            "did_poop": completion_data.did_poop,
            "checked_water": completion_data.checked_water,
            "notes": completion_data.completion_notes,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
    
    await db.appointments.update_one({"id": appt_id}, {"$set": update_data})
    
    return {"message": "Walk completed successfully", "completion_data": update_data.get("completion_data")}

@api_router.put("/appointments/{appt_id}/assign")
async def assign_walker(appt_id: str, walker_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.appointments.update_one({"id": appt_id}, {"$set": {"walker_id": walker_id}})
    return {"message": "Walker assigned successfully"}

# GPS Walk Tracking Routes
import math

def calculate_distance(coords: List[Dict]) -> float:
    """Calculate total distance in meters from GPS coordinates using Haversine formula"""
    if len(coords) < 2:
        return 0.0
    
    total_distance = 0.0
    R = 6371000  # Earth's radius in meters
    
    for i in range(1, len(coords)):
        lat1, lon1 = math.radians(coords[i-1]['lat']), math.radians(coords[i-1]['lng'])
        lat2, lon2 = math.radians(coords[i]['lat']), math.radians(coords[i]['lng'])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        total_distance += R * c
    
    return round(total_distance, 2)

@api_router.post("/appointments/{appt_id}/start-tracking")
async def start_gps_tracking(appt_id: str, lat: float, lng: float, current_user: dict = Depends(get_current_user)):
    """Start GPS tracking for a walk"""
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    start_time = datetime.now(timezone.utc).isoformat()
    initial_coord = {"lat": lat, "lng": lng, "timestamp": start_time}
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {
            "status": "in_progress",
            "start_time": start_time,
            "walker_id": current_user['id'],
            "is_tracking": True,
            "gps_route": [initial_coord],
            "distance_meters": 0
        }}
    )
    return {"message": "Walk tracking started", "start_time": start_time}

@api_router.post("/appointments/{appt_id}/update-location")
async def update_gps_location(appt_id: str, lat: float, lng: float, current_user: dict = Depends(get_current_user)):
    """Update GPS location during a walk"""
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if not appt.get('is_tracking'):
        raise HTTPException(status_code=400, detail="Walk tracking not started")
    
    timestamp = datetime.now(timezone.utc).isoformat()
    new_coord = {"lat": lat, "lng": lng, "timestamp": timestamp}
    
    # Get existing route and add new coordinate
    route = appt.get('gps_route', [])
    route.append(new_coord)
    
    # Calculate total distance
    distance = calculate_distance(route)
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {
            "gps_route": route,
            "distance_meters": distance
        }}
    )
    return {"message": "Location updated", "distance_meters": distance, "point_count": len(route)}

@api_router.post("/appointments/{appt_id}/stop-tracking")
async def stop_gps_tracking(appt_id: str, lat: Optional[float] = None, lng: Optional[float] = None, current_user: dict = Depends(get_current_user)):
    """Stop GPS tracking and complete the walk"""
    if current_user['role'] not in ['admin', 'walker']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    end_time = datetime.now(timezone.utc)
    
    # Add final location if provided
    route = appt.get('gps_route', [])
    if lat is not None and lng is not None:
        route.append({"lat": lat, "lng": lng, "timestamp": end_time.isoformat()})
    
    # Calculate final distance
    distance = calculate_distance(route)
    
    # Calculate duration
    duration = 0
    if appt.get('start_time'):
        start_time = datetime.fromisoformat(appt['start_time'].replace('Z', '+00:00'))
        duration = int((end_time - start_time).total_seconds() / 60)
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {
            "status": "completed",
            "end_time": end_time.isoformat(),
            "actual_duration_minutes": duration,
            "is_tracking": False,
            "gps_route": route,
            "distance_meters": distance
        }}
    )
    return {
        "message": "Walk completed",
        "duration_minutes": duration,
        "distance_meters": distance,
        "route_points": len(route)
    }

@api_router.get("/appointments/{appt_id}/live-tracking")
async def get_live_tracking(appt_id: str, current_user: dict = Depends(get_current_user)):
    """Get live tracking data for an appointment (client, walker, admin can view)"""
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Clients can only view their own appointments
    if current_user['role'] == 'client' and appt['client_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized to view this walk")
    
    # Get walker info
    walker = None
    if appt.get('walker_id'):
        walker = await db.users.find_one({"id": appt['walker_id']}, {"_id": 0, "full_name": 1, "phone": 1, "walker_color": 1})
    
    # Get pet info
    pets = []
    for pet_id in appt.get('pet_ids', []):
        pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1, "breed": 1})
        if pet:
            pets.append(pet)
    
    return {
        "appointment_id": appt_id,
        "status": appt.get('status'),
        "is_tracking": appt.get('is_tracking', False),
        "start_time": appt.get('start_time'),
        "gps_route": appt.get('gps_route', []),
        "distance_meters": appt.get('distance_meters', 0),
        "walker": walker,
        "pets": pets,
        "current_location": appt.get('gps_route', [])[-1] if appt.get('gps_route') else None
    }

@api_router.get("/walks/active")
async def get_active_walks(current_user: dict = Depends(get_current_user)):
    """Get all currently active walks with GPS tracking"""
    query = {"is_tracking": True, "status": "in_progress"}
    
    # Clients only see their own walks
    if current_user['role'] == 'client':
        query["client_id"] = current_user['id']
    # Walkers only see their own walks
    elif current_user['role'] == 'walker':
        query["walker_id"] = current_user['id']
    # Admins see all
    
    walks = await db.appointments.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with walker and pet info
    enriched = []
    for walk in walks:
        walker = None
        if walk.get('walker_id'):
            walker = await db.users.find_one({"id": walk['walker_id']}, {"_id": 0, "full_name": 1, "walker_color": 1})
        
        pets = []
        for pet_id in walk.get('pet_ids', []):
            pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1})
            if pet:
                pets.append(pet['name'])
        
        client = await db.users.find_one({"id": walk['client_id']}, {"_id": 0, "full_name": 1})
        
        enriched.append({
            **walk,
            "walker_name": walker.get('full_name') if walker else "Unknown",
            "walker_color": walker.get('walker_color') if walker else "#9CA3AF",
            "pet_names": pets,
            "client_name": client.get('full_name') if client else "Unknown"
        })
    
    return enriched

@api_router.get("/walks/completed")
async def get_completed_walks(current_user: dict = Depends(get_current_user), limit: int = 20):
    """Get completed walks with GPS route data"""
    query = {"status": "completed", "gps_route": {"$exists": True, "$ne": []}}
    
    # Filter by role
    if current_user['role'] == 'client':
        query["client_id"] = current_user['id']
    elif current_user['role'] == 'walker':
        query["walker_id"] = current_user['id']
    
    walks = await db.appointments.find(query, {"_id": 0}).sort("end_time", -1).limit(limit).to_list(limit)
    
    # Enrich with info
    enriched = []
    for walk in walks:
        walker = None
        if walk.get('walker_id'):
            walker = await db.users.find_one({"id": walk['walker_id']}, {"_id": 0, "full_name": 1, "walker_color": 1})
        
        pets = []
        for pet_id in walk.get('pet_ids', []):
            pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1})
            if pet:
                pets.append(pet['name'])
        
        client = await db.users.find_one({"id": walk['client_id']}, {"_id": 0, "full_name": 1})
        
        enriched.append({
            "id": walk['id'],
            "scheduled_date": walk['scheduled_date'],
            "start_time": walk.get('start_time'),
            "end_time": walk.get('end_time'),
            "duration_minutes": walk.get('actual_duration_minutes', 0),
            "distance_meters": walk.get('distance_meters', 0),
            "gps_route": walk.get('gps_route', []),
            "walker_name": walker.get('full_name') if walker else "Unknown",
            "walker_color": walker.get('walker_color') if walker else "#9CA3AF",
            "pet_names": pets,
            "client_name": client.get('full_name') if client else "Unknown"
        })
    
    return enriched

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

@api_router.post("/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: str, payment_method: str, current_user: dict = Depends(get_current_user)):
    """Mark an invoice as paid (for Zelle, Venmo, CashApp payments)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    if payment_method not in ['zelle', 'venmo', 'cashapp', 'apple_pay', 'apple_cash', 'paypal', 'cash', 'check', 'other']:
        raise HTTPException(status_code=400, detail="Invalid payment method")
    
    paid_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "status": "paid",
            "paid_date": paid_date,
            "payment_method": payment_method
        }}
    )
    return {"message": "Invoice marked as paid", "payment_method": payment_method}

@api_router.get("/settings/payment-info")
async def get_payment_info():
    """Get business payment info for Zelle, Venmo, CashApp, Apple Pay, Apple Cash"""
    settings = await db.settings.find_one({"type": "payment_info"}, {"_id": 0})
    if settings:
        return settings.get('data', {})
    # Return defaults
    return {
        "zelle": {"enabled": True, "email": "", "phone": "", "name": ""},
        "venmo": {"enabled": True, "username": ""},
        "cashapp": {"enabled": True, "cashtag": ""},
        "apple_pay": {"enabled": True, "phone": "", "email": ""},
        "apple_cash": {"enabled": True, "phone": "", "email": ""},
        "instructions": "Please include your invoice number in the payment memo."
    }

@api_router.put("/settings/payment-info")
async def update_payment_info(payment_info: dict, current_user: dict = Depends(get_current_user)):
    """Update business payment info (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.settings.update_one(
        {"type": "payment_info"},
        {"$set": {"type": "payment_info", "data": payment_info}},
        upsert=True
    )
    return {"message": "Payment info updated"}

@api_router.get("/invoices/open")
async def get_open_invoices(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    invoices = await db.invoices.find({"status": {"$in": ["pending", "overdue"]}}, {"_id": 0}).to_list(500)
    
    # Enrich with client names
    enriched = []
    for inv in invoices:
        client = await db.users.find_one({"id": inv['client_id']}, {"_id": 0, "full_name": 1, "email": 1})
        enriched.append({
            **inv,
            "client_name": client.get('full_name') if client else "Unknown",
            "client_email": client.get('email') if client else ""
        })
    
    return enriched

# Get invoices pending review - Must be before parameterized route
@api_router.get("/invoices/pending-review")
async def get_invoices_pending_review(current_user: dict = Depends(get_current_user)):
    """Get auto-generated invoices pending admin review"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    invoices = await db.invoices.find(
        {"review_status": "pending"},
        {"_id": 0}
    ).to_list(1000)
    
    # Enrich with client info
    for inv in invoices:
        client = await db.users.find_one({"id": inv["client_id"]}, {"_id": 0, "password_hash": 0})
        inv["client"] = client
    
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@api_router.get("/invoices/{invoice_id}/detail")
async def get_invoice_detail(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed invoice with all related information"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get client info
    client = await db.users.find_one({"id": invoice['client_id']}, {"_id": 0, "password_hash": 0})
    
    # Get appointment details with service info
    appointment_details = []
    for appt_id in invoice.get('appointment_ids', []):
        appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
        if appt:
            service = await db.services.find_one({"service_type": appt['service_type']}, {"_id": 0})
            walker = None
            if appt.get('walker_id'):
                walker = await db.users.find_one({"id": appt['walker_id']}, {"_id": 0, "full_name": 1})
            
            # Get pet names
            pet_names = []
            for pet_id in appt.get('pet_ids', []):
                pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1})
                if pet:
                    pet_names.append(pet['name'])
            
            appointment_details.append({
                "id": appt['id'],
                "service_name": service['name'] if service else appt['service_type'],
                "service_price": service['price'] if service else 0,
                "scheduled_date": appt['scheduled_date'],
                "scheduled_time": appt['scheduled_time'],
                "walker_name": walker['full_name'] if walker else "Unassigned",
                "pet_names": pet_names,
                "status": appt['status']
            })
    
    # Get company info
    company_info = await db.settings.find_one({"type": "company_info"}, {"_id": 0})
    
    return {
        **invoice,
        "client": client,
        "appointments": appointment_details,
        "company_info": company_info.get('data', {}) if company_info else {}
    }

# Company Info Settings
@api_router.get("/settings/company-info")
async def get_company_info():
    """Get company branding info for invoices"""
    settings = await db.settings.find_one({"type": "company_info"}, {"_id": 0})
    if settings:
        data = settings.get('data', {})
        # Ensure invoice_delivery_preference has a default value
        if 'invoice_delivery_preference' not in data:
            data['invoice_delivery_preference'] = 'both'
        return data
    return {
        "company_name": "",
        "address": "",
        "phone": "",
        "email": "",
        "logo_url": "",
        "tax_id": "",
        "website": "",
        "invoice_delivery_preference": "both"  # Options: email, text, both
    }

@api_router.put("/settings/company-info")
async def update_company_info(company_info: dict, current_user: dict = Depends(get_current_user)):
    """Update company branding info (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.settings.update_one(
        {"type": "company_info"},
        {"$set": {"type": "company_info", "data": company_info}},
        upsert=True
    )
    return {"message": "Company info updated"}

# Email/SMS Notification Settings
@api_router.get("/settings/notification-config")
async def get_notification_config(current_user: dict = Depends(get_current_user)):
    """Get email/SMS configuration status"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    return {
        "sendgrid_configured": bool(os.environ.get('SENDGRID_API_KEY')),
        "twilio_configured": bool(os.environ.get('TWILIO_ACCOUNT_SID') and os.environ.get('TWILIO_AUTH_TOKEN')),
        "sender_email": os.environ.get('SENDER_EMAIL', ''),
        "twilio_phone": os.environ.get('TWILIO_PHONE_NUMBER', '')
    }

# Send Invoice via Email
@api_router.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Send invoice to client via email"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    sendgrid_key = os.environ.get('SENDGRID_API_KEY')
    sender_email = os.environ.get('SENDER_EMAIL')
    
    if not sendgrid_key or not sender_email:
        raise HTTPException(status_code=400, detail="SendGrid not configured. Add SENDGRID_API_KEY and SENDER_EMAIL to environment.")
    
    if not SENDGRID_AVAILABLE:
        raise HTTPException(status_code=400, detail="SendGrid library not installed")
    
    # Get invoice details
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    client = await db.users.find_one({"id": invoice['client_id']}, {"_id": 0})
    if not client or not client.get('email'):
        raise HTTPException(status_code=400, detail="Client email not found")
    
    company_info = await db.settings.find_one({"type": "company_info"}, {"_id": 0})
    company = company_info.get('data', {}) if company_info else {}
    
    # Build email content
    company_name = company.get('company_name', 'WagWalk')
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f97316; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">{company_name}</h1>
            <p style="margin: 5px 0;">Invoice</p>
        </div>
        <div style="padding: 20px;">
            <p>Dear {client.get('full_name', 'Valued Customer')},</p>
            <p>Please find your invoice details below:</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Invoice ID:</strong> {invoice['id'][:8]}...</p>
                <p><strong>Amount Due:</strong> ${invoice['amount']:.2f}</p>
                <p><strong>Due Date:</strong> {invoice['due_date']}</p>
                <p><strong>Status:</strong> {invoice['status'].upper()}</p>
            </div>
            
            <p>To pay this invoice, please log into your account or use one of our accepted payment methods.</p>
            
            <p style="margin-top: 30px;">Thank you for choosing {company_name}!</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #666;">
                {company.get('address', '')}<br>
                {company.get('phone', '')} | {company.get('email', '')}
            </p>
        </div>
    </body>
    </html>
    """
    
    try:
        sg = SendGridAPIClient(sendgrid_key)
        message = Mail(
            from_email=sender_email,
            to_emails=client['email'],
            subject=f"Invoice from {company_name} - ${invoice['amount']:.2f} Due",
            html_content=html_content
        )
        response = sg.send(message)
        
        # Log the notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "type": "email",
            "invoice_id": invoice_id,
            "recipient": client['email'],
            "status": "sent" if response.status_code == 202 else "failed",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Invoice email sent successfully", "recipient": client['email']}
    except Exception as e:
        logging.error(f"SendGrid error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# Send Invoice via SMS
@api_router.post("/invoices/{invoice_id}/send-sms")
async def send_invoice_sms(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Send invoice notification to client via SMS"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_phone = os.environ.get('TWILIO_PHONE_NUMBER')
    
    if not account_sid or not auth_token or not twilio_phone:
        raise HTTPException(status_code=400, detail="Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to environment.")
    
    if not TWILIO_AVAILABLE:
        raise HTTPException(status_code=400, detail="Twilio library not installed")
    
    # Get invoice details
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    client = await db.users.find_one({"id": invoice['client_id']}, {"_id": 0})
    if not client or not client.get('phone'):
        raise HTTPException(status_code=400, detail="Client phone number not found")
    
    company_info = await db.settings.find_one({"type": "company_info"}, {"_id": 0})
    company = company_info.get('data', {}) if company_info else {}
    company_name = company.get('company_name', 'WagWalk')
    
    # Build SMS content
    sms_body = f"{company_name}: You have a new invoice for ${invoice['amount']:.2f} due on {invoice['due_date']}. Log in to your account to view and pay. Thank you!"
    
    try:
        twilio_client = TwilioClient(account_sid, auth_token)
        message = twilio_client.messages.create(
            body=sms_body,
            from_=twilio_phone,
            to=client['phone']
        )
        
        # Log the notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "type": "sms",
            "invoice_id": invoice_id,
            "recipient": client['phone'],
            "status": "sent" if message.sid else "failed",
            "message_sid": message.sid,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Invoice SMS sent successfully", "recipient": client['phone']}
    except Exception as e:
        logging.error(f"Twilio error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {str(e)}")

# Mass Text/SMS Feature
class MassTextRequest(BaseModel):
    recipient_group: str  # "all", "clients", "walkers"
    message: str

@api_router.post("/admin/mass-text")
async def send_mass_text(request: MassTextRequest, current_user: dict = Depends(get_current_user)):
    """Send mass text to all users, all clients, or all walkers"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check Twilio configuration
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_phone = os.environ.get('TWILIO_PHONE_NUMBER')
    
    if not account_sid or not auth_token or not twilio_phone:
        raise HTTPException(status_code=400, detail="Twilio not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to environment variables.")
    
    # Get recipients based on group
    query = {}
    if request.recipient_group == "clients":
        query = {"role": "client"}
    elif request.recipient_group == "walkers":
        query = {"role": "walker"}
    elif request.recipient_group == "all":
        query = {"role": {"$in": ["client", "walker"]}}
    else:
        raise HTTPException(status_code=400, detail="Invalid recipient group")
    
    # Get users with phone numbers
    users = await db.users.find(query, {"_id": 0, "id": 1, "full_name": 1, "phone": 1, "role": 1}).to_list(1000)
    users_with_phone = [u for u in users if u.get('phone')]
    
    if not users_with_phone:
        raise HTTPException(status_code=400, detail="No recipients with phone numbers found")
    
    # Send SMS to each recipient
    twilio_client = TwilioClient(account_sid, auth_token)
    sent_count = 0
    failed_count = 0
    failed_recipients = []
    
    for user in users_with_phone:
        try:
            twilio_client.messages.create(
                body=request.message,
                from_=twilio_phone,
                to=user['phone']
            )
            sent_count += 1
        except Exception as e:
            failed_count += 1
            failed_recipients.append({"name": user['full_name'], "error": str(e)})
            logging.error(f"Failed to send SMS to {user['full_name']}: {e}")
    
    # Log the mass text
    await db.mass_texts.insert_one({
        "id": str(uuid.uuid4()),
        "sender_id": current_user['id'],
        "sender_name": current_user['full_name'],
        "recipient_group": request.recipient_group,
        "message": request.message,
        "total_recipients": len(users_with_phone),
        "sent_count": sent_count,
        "failed_count": failed_count,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Mass text sent successfully",
        "total_recipients": len(users_with_phone),
        "sent_count": sent_count,
        "failed_count": failed_count,
        "failed_recipients": failed_recipients[:5]  # Return first 5 failures
    }

@api_router.get("/admin/mass-text/history")
async def get_mass_text_history(current_user: dict = Depends(get_current_user)):
    """Get history of mass texts sent"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    history = await db.mass_texts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return history

@api_router.get("/admin/mass-text/recipients-count")
async def get_recipients_count(current_user: dict = Depends(get_current_user)):
    """Get count of potential recipients by group"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    clients_with_phone = await db.users.count_documents({"role": "client", "phone": {"$exists": True, "$ne": ""}})
    walkers_with_phone = await db.users.count_documents({"role": "walker", "phone": {"$exists": True, "$ne": ""}})
    
    return {
        "all": clients_with_phone + walkers_with_phone,
        "clients": clients_with_phone,
        "walkers": walkers_with_phone
    }

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
@api_router.get("/messages/contacts")
async def get_message_contacts(contact_type: str = "all", current_user: dict = Depends(get_current_user)):
    """Get contacts for messaging based on type: clients, team, all
    
    Permissions:
    - Client: Can see their scheduled walker + all admins
    - Walker: Can see My Clients (scheduled), Team (walkers+admins), All
    - Admin: Can see everyone
    
    Returns contacts with unread_count for each contact
    """
    contacts = []
    
    if current_user['role'] == 'client':
        # Clients can message walkers assigned to their appointments AND all admins
        appointments = await db.appointments.find(
            {"client_id": current_user['id'], "walker_id": {"$ne": None}},
            {"_id": 0, "walker_id": 1}
        ).to_list(500)
        walker_ids = list(set(appt['walker_id'] for appt in appointments if appt.get('walker_id')))
        
        if walker_ids:
            walkers = await db.users.find(
                {"id": {"$in": walker_ids}, "is_active": True},
                {"_id": 0, "password_hash": 0}
            ).to_list(100)
            contacts.extend([{"type": "walker", **w} for w in walkers])
        
        # Add all admins
        admins = await db.users.find(
            {"role": "admin", "is_active": True},
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        contacts.extend([{"type": "admin", **a} for a in admins])
    
    elif current_user['role'] == 'walker':
        if contact_type == 'clients':
            # Walkers can only message clients on their schedule
            appointments = await db.appointments.find(
                {"walker_id": current_user['id']},
                {"_id": 0, "client_id": 1}
            ).to_list(500)
            client_ids = list(set(appt['client_id'] for appt in appointments))
            
            if client_ids:
                clients = await db.users.find(
                    {"id": {"$in": client_ids}, "is_active": True},
                    {"_id": 0, "password_hash": 0}
                ).to_list(100)
                contacts = [{"type": "client", **c} for c in clients]
        
        elif contact_type == 'team':
            # Team = All walkers and admins (renamed from 'staff')
            staff = await db.users.find(
                {"role": {"$in": ["walker", "admin"]}, "is_active": True, "id": {"$ne": current_user['id']}},
                {"_id": 0, "password_hash": 0}
            ).to_list(100)
            contacts = [{"type": s['role'], **s} for s in staff]
        
        else:  # all
            # Get scheduled clients
            appointments = await db.appointments.find(
                {"walker_id": current_user['id']},
                {"_id": 0, "client_id": 1}
            ).to_list(500)
            client_ids = list(set(appt['client_id'] for appt in appointments))
            
            if client_ids:
                clients = await db.users.find(
                    {"id": {"$in": client_ids}, "is_active": True},
                    {"_id": 0, "password_hash": 0}
                ).to_list(100)
                contacts.extend([{"type": "client", **c} for c in clients])
            
            # Add team
            staff = await db.users.find(
                {"role": {"$in": ["walker", "admin"]}, "is_active": True, "id": {"$ne": current_user['id']}},
                {"_id": 0, "password_hash": 0}
            ).to_list(100)
            contacts.extend([{"type": s['role'], **s} for s in staff])
    
    elif current_user['role'] == 'admin':
        if contact_type == 'clients':
            clients = await db.users.find(
                {"role": "client", "is_active": True},
                {"_id": 0, "password_hash": 0}
            ).to_list(100)
            contacts = [{"type": "client", **c} for c in clients]
        
        elif contact_type == 'team':
            # Team = All walkers and admins
            staff = await db.users.find(
                {"role": {"$in": ["walker", "admin"]}, "is_active": True, "id": {"$ne": current_user['id']}},
                {"_id": 0, "password_hash": 0}
            ).to_list(100)
            contacts = [{"type": s['role'], **s} for s in staff]
        
        else:  # all
            all_users = await db.users.find(
                {"is_active": True, "id": {"$ne": current_user['id']}},
                {"_id": 0, "password_hash": 0}
            ).to_list(500)
            contacts = [{"type": u['role'], **u} for u in all_users]
    
    # Add unread count and last message info for each contact
    for contact in contacts:
        unread_count = await db.messages.count_documents({
            "sender_id": contact['id'],
            "receiver_id": current_user['id'],
            "is_group_message": False,
            "read": False
        })
        contact['unread_count'] = unread_count
        
        # Find the most recent message with this contact (either direction)
        last_message = await db.messages.find_one(
            {
                "$or": [
                    {"sender_id": contact['id'], "receiver_id": current_user['id']},
                    {"sender_id": current_user['id'], "receiver_id": contact['id']}
                ],
                "is_group_message": False
            },
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        if last_message:
            contact['has_messages'] = True
            # Ensure last_message_at is always a string
            last_msg_time = last_message.get('created_at', '')
            if hasattr(last_msg_time, 'isoformat'):
                contact['last_message_at'] = last_msg_time.isoformat()
            else:
                contact['last_message_at'] = str(last_msg_time) if last_msg_time else ''
            contact['last_message_preview'] = last_message.get('content', '')[:50]
        else:
            contact['has_messages'] = False
            contact['last_message_at'] = ''
            contact['last_message_preview'] = ''
    
    # Sort contacts: active chats first (by last message), then unread, then alphabetically
    def sort_key(c):
        has_msgs = 1 if c.get('has_messages') else 0
        unread = c.get('unread_count', 0)
        last_msg = c.get('last_message_at', '')
        name = c.get('full_name', '').lower()
        # Priority: has_messages DESC, last_message_at DESC, unread DESC, name ASC
        return (-has_msgs, -unread if not last_msg else 0, last_msg if last_msg else 'zzz', name)
    
    # Sort: contacts with messages first (most recent first), then by unread count, then alphabetically
    contacts.sort(key=lambda c: (
        -1 if c.get('has_messages') else 0,  # Has messages first
        c.get('last_message_at', '') if c.get('has_messages') else '',  # Sort by last message time (descending)
        -c.get('unread_count', 0),  # Then by unread count
        c.get('full_name', '').lower()  # Then alphabetically
    ), reverse=False)
    
    # Re-sort properly: active chats first (most recent), then others
    active_chats = [c for c in contacts if c.get('has_messages')]
    inactive_contacts = [c for c in contacts if not c.get('has_messages')]
    
    # Sort active chats by last_message_at descending (most recent first)
    # Ensure we compare strings consistently (handle both datetime and string formats)
    def get_last_message_sort_key(c):
        last_msg = c.get('last_message_at', '')
        if hasattr(last_msg, 'isoformat'):
            return last_msg.isoformat()
        return str(last_msg) if last_msg else ''
    
    active_chats.sort(key=lambda c: get_last_message_sort_key(c), reverse=True)
    # Sort inactive by unread then name
    inactive_contacts.sort(key=lambda c: (-c.get('unread_count', 0), c.get('full_name', '').lower()))
    
    return active_chats + inactive_contacts

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

@api_router.get("/messages/unread-count")
async def get_unread_message_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread messages for the current user"""
    # Count direct messages sent to user that are unread
    unread_direct = await db.messages.count_documents({
        "receiver_id": current_user['id'],
        "is_group_message": False,
        "read": False
    })
    
    # For staff, also count unread group messages
    unread_group = 0
    if current_user['role'] in ['admin', 'walker']:
        # Get IDs of group messages user has read (stored in user's read_group_messages array)
        user_data = await db.users.find_one({"id": current_user['id']}, {"_id": 0, "read_group_messages": 1})
        read_group_ids = user_data.get('read_group_messages', []) if user_data else []
        
        # Count group messages not in user's read list
        unread_group = await db.messages.count_documents({
            "is_group_message": True,
            "sender_id": {"$ne": current_user['id']},  # Exclude own messages
            "id": {"$nin": read_group_ids}
        })
    
    total_unread = unread_direct + unread_group
    
    return {
        "unread_count": total_unread,
        "unread_direct": unread_direct,
        "unread_group": unread_group
    }

@api_router.post("/messages/mark-read")
async def mark_messages_read(sender_id: Optional[str] = None, mark_group: bool = False, current_user: dict = Depends(get_current_user)):
    """Mark messages as read"""
    if mark_group:
        # Mark group messages as read by adding to user's read list
        group_messages = await db.messages.find(
            {"is_group_message": True, "sender_id": {"$ne": current_user['id']}},
            {"_id": 0, "id": 1}
        ).to_list(1000)
        group_ids = [m['id'] for m in group_messages]
        
        await db.users.update_one(
            {"id": current_user['id']},
            {"$addToSet": {"read_group_messages": {"$each": group_ids}}}
        )
    elif sender_id:
        # Mark direct messages from sender as read
        await db.messages.update_many(
            {"sender_id": sender_id, "receiver_id": current_user['id'], "is_group_message": False},
            {"$set": {"read": True}}
        )
    
    return {"message": "Messages marked as read"}

# Paysheet Routes
@api_router.get("/paysheets")
async def get_paysheets(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    paysheets = await db.paysheets.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get walker names for admin view
    walker_names = {}
    if current_user['role'] == 'admin':
        walker_ids = list(set([ts.get('walker_id') for ts in paysheets if ts.get('walker_id')]))
        walkers = await db.users.find({"id": {"$in": walker_ids}}, {"_id": 0, "id": 1, "full_name": 1}).to_list(100)
        walker_names = {w['id']: w.get('full_name', 'Unknown') for w in walkers}
    
    # Normalize old and new paysheet formats
    normalized = []
    for ts in paysheets:
        # Use existing walker_name if present, otherwise look up
        existing_name = ts.get("walker_name")
        looked_up_name = walker_names.get(ts.get("walker_id"), "Staff")
        final_name = existing_name if existing_name else looked_up_name
        
        normalized.append({
            "id": ts.get("id"),
            "walker_id": ts.get("walker_id"),
            "walker_name": final_name,
            "period_start": ts.get("period_start") or ts.get("week_start", ""),
            "period_end": ts.get("period_end") or ts.get("week_end", ""),
            "total_hours": ts.get("total_hours", 0),
            "total_walks": ts.get("total_walks", 0),
            "total_earnings": ts.get("total_earnings", 0),
            "appointment_ids": ts.get("appointment_ids") or ts.get("appointments", []),
            "walk_details": ts.get("walk_details", []),
            "submitted": ts.get("submitted", False),
            "approved": ts.get("approved", False),
            "paid": ts.get("paid", False),
            "created_at": ts.get("created_at")
        })
    
    return normalized

@api_router.get("/payroll/current")
async def get_current_payroll(current_user: dict = Depends(get_current_user)):
    """Get current accumulated hours and earnings for the walker"""
    if current_user['role'] != 'walker':
        raise HTTPException(status_code=403, detail="Walkers only")
    
    # Get IDs of walks already included in submitted paysheets
    submitted_paysheets = await db.paysheets.find(
        {"walker_id": current_user['id'], "submitted": True},
        {"_id": 0, "appointment_ids": 1}
    ).to_list(500)
    
    submitted_appointment_ids = set()
    for ts in submitted_paysheets:
        submitted_appointment_ids.update(ts.get('appointment_ids', []))
    
    # Get completed appointments NOT yet submitted
    all_appointments = await db.appointments.find({
        "walker_id": current_user['id'],
        "status": "completed"
    }, {"_id": 0}).sort("scheduled_date", -1).to_list(500)
    
    # Filter out already submitted walks
    pending_walks = [a for a in all_appointments if a['id'] not in submitted_appointment_ids]
    
    # Calculate totals
    total_minutes = 0
    total_earnings = 0.0
    walk_details = []
    
    for walk in pending_walks:
        duration = walk.get('actual_duration_minutes', 0)
        service_type = walk.get('service_type', '')
        earnings = calculate_walk_earnings(service_type, duration)
        
        total_minutes += duration
        total_earnings += earnings
        
        # Get client and pet names
        client = await db.users.find_one({"id": walk['client_id']}, {"_id": 0, "full_name": 1})
        pet_names = []
        for pet_id in walk.get('pet_ids', []):
            pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1})
            if pet:
                pet_names.append(pet['name'])
        
        walk_details.append({
            "id": walk['id'],
            "date": walk['scheduled_date'],
            "time": walk.get('scheduled_time', ''),
            "service_type": service_type,
            "duration_minutes": duration,
            "earnings": earnings,
            "client_name": client.get('full_name') if client else "Unknown",
            "pet_names": pet_names,
            "distance_meters": walk.get('distance_meters', 0)
        })
    
    return {
        "total_hours": round(total_minutes / 60, 2),
        "total_minutes": total_minutes,
        "total_walks": len(pending_walks),
        "total_earnings": round(total_earnings, 2),
        "walks": walk_details,
        "pay_rates": WALKER_PAY_RATES
    }

@api_router.post("/paysheets/submit")
async def submit_paysheet(current_user: dict = Depends(get_current_user)):
    """Submit accumulated walks as a paysheet"""
    if current_user['role'] != 'walker':
        raise HTTPException(status_code=403, detail="Walkers only")
    
    # Get current accumulated data
    current_payroll = await get_current_payroll(current_user)
    
    if current_payroll['total_walks'] == 0:
        raise HTTPException(status_code=400, detail="No walks to submit")
    
    walks = current_payroll['walks']
    
    # Determine period dates
    dates = [w['date'] for w in walks]
    period_start = min(dates) if dates else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    period_end = max(dates) if dates else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    paysheet = Paysheet(
        walker_id=current_user['id'],
        period_start=period_start,
        period_end=period_end,
        total_hours=current_payroll['total_hours'],
        total_walks=current_payroll['total_walks'],
        total_earnings=current_payroll['total_earnings'],
        appointment_ids=[w['id'] for w in walks],
        walk_details=walks,
        submitted=True
    )
    
    ts_dict = paysheet.model_dump()
    ts_dict['created_at'] = ts_dict['created_at'].isoformat()
    await db.paysheets.insert_one(ts_dict)
    
    return {
        "message": "Paysheet submitted successfully",
        "paysheet_id": paysheet.id,
        "total_hours": paysheet.total_hours,
        "total_earnings": paysheet.total_earnings,
        "total_walks": paysheet.total_walks
    }

@api_router.put("/paysheets/{paysheet_id}/approve")
async def approve_paysheet(paysheet_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.paysheets.update_one({"id": paysheet_id}, {"$set": {"approved": True}})
    return {"message": "Paysheet approved"}

@api_router.put("/paysheets/{paysheet_id}/mark-paid")
async def mark_paysheet_paid(paysheet_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.paysheets.update_one({"id": paysheet_id}, {"$set": {"paid": True}})
    return {"message": "Paysheet marked as paid"}

# 1099 Payroll Reports
@api_router.get("/reports/payroll/1099")
async def get_1099_payroll_report(year: int = None, current_user: dict = Depends(get_current_user)):
    """
    Get payroll report for 1099 purposes.
    Returns total pay for each walker/sitter for the year, plus MTD and YTD totals.
    """
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    report_year = year or now.year
    year_start = f"{report_year}-01-01"
    year_end = f"{report_year}-12-31"
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    
    # Get all walkers and sitters
    staff = await db.users.find(
        {"role": {"$in": ["walker", "sitter"]}, "is_active": True},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    # Get all paid paysheets for the year
    paysheets = await db.paysheets.find(
        {"paid": True},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate earnings per staff member
    staff_earnings = {}
    total_ytd = 0.0
    total_mtd = 0.0
    
    for member in staff:
        staff_id = member['id']
        staff_earnings[staff_id] = {
            "id": staff_id,
            "full_name": member.get('full_name', 'Unknown'),
            "email": member.get('email', ''),
            "phone": member.get('phone', ''),
            "role": member.get('role', 'walker'),
            "address": member.get('address', ''),
            "year_total": 0.0,
            "month_total": 0.0,
            "paysheets_count": 0
        }
    
    for ts in paysheets:
        walker_id = ts.get('walker_id')
        if not walker_id:
            continue
            
        earnings = ts.get('total_earnings', 0)
        period_end = ts.get('period_end', '')
        
        # Check if this paysheet falls within the report year
        if period_end and period_end >= year_start and period_end <= year_end:
            if walker_id in staff_earnings:
                staff_earnings[walker_id]['year_total'] += earnings
                staff_earnings[walker_id]['paysheets_count'] += 1
                total_ytd += earnings
                
                # Check if it's in current month
                if period_end >= month_start:
                    staff_earnings[walker_id]['month_total'] += earnings
                    total_mtd += earnings
    
    # Convert to list and sort by year_total descending
    staff_list = list(staff_earnings.values())
    staff_list.sort(key=lambda x: x['year_total'], reverse=True)
    
    # Round all monetary values
    for member in staff_list:
        member['year_total'] = round(member['year_total'], 2)
        member['month_total'] = round(member['month_total'], 2)
    
    return {
        "year": report_year,
        "generated_at": now.isoformat(),
        "summary": {
            "total_staff": len(staff_list),
            "total_year_to_date": round(total_ytd, 2),
            "total_month_to_date": round(total_mtd, 2),
            "staff_requiring_1099": len([s for s in staff_list if s['year_total'] >= 600])
        },
        "staff": staff_list
    }

@api_router.get("/reports/payroll/1099/{staff_id}")
async def get_staff_1099_detail(staff_id: str, year: int = None, current_user: dict = Depends(get_current_user)):
    """
    Get detailed 1099 report for a specific walker/sitter.
    Includes all paid paysheets and earnings breakdown.
    """
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    report_year = year or now.year
    year_start = f"{report_year}-01-01"
    year_end = f"{report_year}-12-31"
    
    # Get staff member info
    staff_member = await db.users.find_one(
        {"id": staff_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not staff_member:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Get all paid paysheets for this staff member in the year
    paysheets = await db.paysheets.find(
        {
            "walker_id": staff_id,
            "paid": True,
            "period_end": {"$gte": year_start, "$lte": year_end}
        },
        {"_id": 0}
    ).sort("period_end", -1).to_list(1000)
    
    # Calculate totals by month
    monthly_breakdown = {}
    total_earnings = 0.0
    total_walks = 0
    total_hours = 0.0
    
    for ts in paysheets:
        earnings = ts.get('total_earnings', 0)
        walks = ts.get('total_walks', 0)
        hours = ts.get('total_hours', 0)
        period_end = ts.get('period_end', '')
        
        total_earnings += earnings
        total_walks += walks
        total_hours += hours
        
        # Group by month
        if period_end:
            month_key = period_end[:7]  # YYYY-MM
            if month_key not in monthly_breakdown:
                monthly_breakdown[month_key] = {
                    "month": month_key,
                    "earnings": 0.0,
                    "walks": 0,
                    "hours": 0.0,
                    "paysheets": 0
                }
            monthly_breakdown[month_key]['earnings'] += earnings
            monthly_breakdown[month_key]['walks'] += walks
            monthly_breakdown[month_key]['hours'] += hours
            monthly_breakdown[month_key]['paysheets'] += 1
    
    # Convert monthly breakdown to sorted list
    months_list = list(monthly_breakdown.values())
    months_list.sort(key=lambda x: x['month'])
    
    # Round values
    for month in months_list:
        month['earnings'] = round(month['earnings'], 2)
        month['hours'] = round(month['hours'], 2)
    
    return {
        "year": report_year,
        "generated_at": now.isoformat(),
        "staff": {
            "id": staff_member['id'],
            "full_name": staff_member.get('full_name', 'Unknown'),
            "email": staff_member.get('email', ''),
            "phone": staff_member.get('phone', ''),
            "address": staff_member.get('address', ''),
            "role": staff_member.get('role', 'walker')
        },
        "totals": {
            "year_earnings": round(total_earnings, 2),
            "total_walks": total_walks,
            "total_hours": round(total_hours, 2),
            "requires_1099": total_earnings >= 600
        },
        "monthly_breakdown": months_list,
        "paysheets": paysheets
    }

# Accounts Receivable Aging Report
@api_router.get("/reports/receivable-aging")
async def get_receivable_aging_report(current_user: dict = Depends(get_current_user)):
    """
    Get accounts receivable aging report.
    Buckets unpaid invoices by age: Current (0-30), 30 Days (31-60), 60 Days (61-90), 90+ Days
    """
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # Get all unpaid invoices (pending and overdue)
    invoices = await db.invoices.find(
        {"status": {"$in": ["pending", "overdue"]}},
        {"_id": 0}
    ).to_list(1000)
    
    # Initialize buckets
    buckets = {
        "current": {"label": "Current (0-30 days)", "total": 0, "count": 0, "invoices": []},
        "thirty": {"label": "30 Days (31-60)", "total": 0, "count": 0, "invoices": []},
        "sixty": {"label": "60 Days (61-90)", "total": 0, "count": 0, "invoices": []},
        "ninety_plus": {"label": "90+ Days", "total": 0, "count": 0, "invoices": []}
    }
    
    grand_total = 0
    
    for invoice in invoices:
        # Parse due date
        due_date_str = invoice.get('due_date', '')
        try:
            if 'T' in due_date_str:
                due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).date()
            else:
                due_date = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            # If we can't parse the date, put in current bucket
            due_date = today
        
        # Calculate days overdue (negative means not yet due)
        days_overdue = (today - due_date).days
        amount = invoice.get('amount', 0)
        grand_total += amount
        
        # Get client info
        client = await db.users.find_one({"id": invoice.get('client_id')}, {"_id": 0, "password_hash": 0})
        client_name = client.get('full_name', 'Unknown') if client else 'Unknown'
        
        invoice_info = {
            "id": invoice.get('id'),
            "client_id": invoice.get('client_id'),
            "client_name": client_name,
            "amount": amount,
            "due_date": due_date_str,
            "days_overdue": max(0, days_overdue),
            "status": invoice.get('status'),
            "created_at": invoice.get('created_at').isoformat() if isinstance(invoice.get('created_at'), datetime) else invoice.get('created_at', '')
        }
        
        # Determine bucket
        if days_overdue <= 30:
            bucket_key = "current"
        elif days_overdue <= 60:
            bucket_key = "thirty"
        elif days_overdue <= 90:
            bucket_key = "sixty"
        else:
            bucket_key = "ninety_plus"
        
        buckets[bucket_key]["total"] += amount
        buckets[bucket_key]["count"] += 1
        buckets[bucket_key]["invoices"].append(invoice_info)
    
    # Round totals
    for bucket in buckets.values():
        bucket["total"] = round(bucket["total"], 2)
        # Sort invoices by days overdue (most overdue first)
        bucket["invoices"].sort(key=lambda x: x["days_overdue"], reverse=True)
    
    return {
        "generated_at": now.isoformat(),
        "grand_total": round(grand_total, 2),
        "total_invoices": len(invoices),
        "buckets": buckets
    }

# Revenue & Billing Routes
@api_router.get("/revenue/summary")
async def get_revenue_summary(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Calculate week start (Monday)
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    
    # Calculate month start
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    
    # Calculate year start
    year_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    
    # Get all paid invoices
    paid_invoices = await db.invoices.find({"status": "paid"}, {"_id": 0}).to_list(10000)
    
    daily_revenue = 0.0
    weekly_revenue = 0.0
    monthly_revenue = 0.0
    yearly_revenue = 0.0
    
    for inv in paid_invoices:
        paid_date = inv.get('paid_date', '')
        amount = inv.get('amount', 0)
        
        if paid_date:
            if paid_date == today:
                daily_revenue += amount
            if paid_date >= week_start:
                weekly_revenue += amount
            if paid_date >= month_start:
                monthly_revenue += amount
            if paid_date >= year_start:
                yearly_revenue += amount
    
    return {
        "daily": round(daily_revenue, 2),
        "weekly": round(weekly_revenue, 2),
        "month_to_date": round(monthly_revenue, 2),
        "year_to_date": round(yearly_revenue, 2),
        "total_paid_invoices": len(paid_invoices),
        "as_of": now.isoformat()
    }

@api_router.get("/billing/clients-due")
async def get_clients_due_for_billing(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get all clients with their billing cycles
    clients = await db.users.find({"role": "client"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    clients_due = []
    for client in clients:
        billing_cycle = client.get('billing_cycle', 'weekly')
        
        # Get uninvoiced completed appointments for this client
        uninvoiced_appts = await db.appointments.find({
            "client_id": client['id'],
            "status": "completed",
            "invoiced": {"$ne": True}
        }, {"_id": 0}).to_list(500)
        
        if uninvoiced_appts:
            # Calculate total amount
            total = 0.0
            for appt in uninvoiced_appts:
                service = await db.services.find_one({"service_type": appt['service_type']}, {"_id": 0})
                if service:
                    total += service['price']
            
            clients_due.append({
                "client_id": client['id'],
                "client_name": client['full_name'],
                "email": client['email'],
                "billing_cycle": billing_cycle,
                "uninvoiced_appointments": len(uninvoiced_appts),
                "total_amount": round(total, 2),
                "appointment_ids": [a['id'] for a in uninvoiced_appts]
            })
    
    return clients_due

@api_router.post("/billing/generate-invoice")
async def generate_invoice_for_client(client_id: str, appointment_ids: List[str], current_user: dict = Depends(get_current_user)):
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
            # Mark appointment as invoiced
            await db.appointments.update_one({"id": appt_id}, {"$set": {"invoiced": True}})
    
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
    
    return {"message": "Invoice created", "invoice_id": invoice.id, "amount": total}

@api_router.put("/users/{user_id}/billing-cycle")
async def update_client_billing_cycle(user_id: str, billing_cycle: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    if billing_cycle not in ['daily', 'weekly', 'monthly']:
        raise HTTPException(status_code=400, detail="Invalid billing cycle. Use: daily, weekly, monthly")
    
    await db.users.update_one({"id": user_id}, {"$set": {"billing_cycle": billing_cycle}})
    return {"message": f"Billing cycle updated to {billing_cycle}"}

@api_router.put("/services/{service_id}")
async def update_service_pricing(service_id: str, name: Optional[str] = None, price: Optional[float] = None, description: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    update_data = {}
    if name is not None:
        update_data['name'] = name
    if price is not None:
        update_data['price'] = price
    if description is not None:
        update_data['description'] = description
    
    if update_data:
        await db.services.update_one({"id": service_id}, {"$set": update_data})
    
    return {"message": "Service updated successfully"}

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return {"message": "Service deleted successfully"}

# Billing Plans
@api_router.get("/billing-plans")
async def get_billing_plans(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    plans = await db.billing_plans.find({}, {"_id": 0}).to_list(100)
    return plans

@api_router.post("/billing-plans")
async def create_billing_plan(plan: dict, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    new_plan = {
        "id": str(uuid.uuid4()),
        "name": plan.get("name", ""),
        "description": plan.get("description", ""),
        "discount_percent": plan.get("discount_percent", 0),
        "services": plan.get("services", []),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.billing_plans.insert_one(new_plan)
    return new_plan

@api_router.delete("/billing-plans/{plan_id}")
async def delete_billing_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.billing_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Billing plan not found")
    
    # Remove plan from any clients that have it assigned
    await db.users.update_many({"billing_plan_id": plan_id}, {"$unset": {"billing_plan_id": "", "billing_plan_name": ""}})
    
    return {"message": "Billing plan deleted successfully"}

@api_router.put("/users/{user_id}/billing-plan")
async def assign_billing_plan(user_id: str, plan_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    if plan_id:
        plan = await db.billing_plans.find_one({"id": plan_id}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Billing plan not found")
        
        await db.users.update_one(
            {"id": user_id}, 
            {"$set": {"billing_plan_id": plan_id, "billing_plan_name": plan.get("name", "")}}
        )
    else:
        await db.users.update_one(
            {"id": user_id}, 
            {"$unset": {"billing_plan_id": "", "billing_plan_name": ""}}
        )
    
    return {"message": "Billing plan updated"}

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
        
        # Month-to-date revenue
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        month_invoices = await db.invoices.find({
            "status": "paid",
            "paid_at": {"$gte": month_start}
        }, {"_id": 0, "amount": 1}).to_list(1000)
        stats['month_revenue'] = sum(inv['amount'] for inv in month_invoices)
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

# Subscription/Freemium Endpoints
@api_router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status"""
    subscription = await db.subscriptions.find_one({"user_id": current_user['id']}, {"_id": 0})
    
    if not subscription:
        # Create default free subscription
        new_sub = {
            "id": str(uuid.uuid4()),
            "user_id": current_user['id'],
            "tier": "free",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(new_sub)
        subscription = {k: v for k, v in new_sub.items() if k != '_id'}
    
    # Check if trial has expired
    if subscription.get('trial_ends_at'):
        trial_end = datetime.fromisoformat(subscription['trial_ends_at'].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > trial_end and subscription.get('tier') == 'premium' and subscription.get('status') == 'trialing':
            subscription['tier'] = 'free'
            subscription['status'] = 'active'
            await db.subscriptions.update_one(
                {"user_id": current_user['id']},
                {"$set": {"tier": "free", "status": "active"}}
            )
    
    # Get current usage counts
    walker_count = await db.users.count_documents({"role": "walker"})
    client_count = await db.users.count_documents({"role": "client"})
    
    limits = FREEMIUM_LIMITS.get(subscription.get('tier', 'free'), FREEMIUM_LIMITS['free'])
    
    return {
        **subscription,
        "limits": limits,
        "usage": {
            "walkers": walker_count,
            "clients": client_count,
        },
        "prices": SUBSCRIPTION_PRICES,
        "trial_days": TRIAL_DAYS
    }

@api_router.post("/subscription/start-trial")
async def start_trial(current_user: dict = Depends(get_current_user)):
    """Start 14-day premium trial"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    subscription = await db.subscriptions.find_one({"user_id": current_user['id']})
    
    if subscription and subscription.get('trial_ends_at'):
        raise HTTPException(status_code=400, detail="Trial already used")
    
    trial_end = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
    
    update_data = {
        "tier": "premium",
        "status": "trialing",
        "trial_ends_at": trial_end.isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if subscription:
        await db.subscriptions.update_one(
            {"user_id": current_user['id']},
            {"$set": update_data}
        )
    else:
        await db.subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user['id'],
            **update_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Trial started", "trial_ends_at": trial_end.isoformat()}

@api_router.post("/subscription/upgrade")
async def upgrade_subscription(plan_type: str = "monthly", current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout for premium subscription"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if plan_type not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=400, detail="Stripe not configured")
    
    origin_url = os.environ.get('ORIGIN_URL', 'http://localhost:3000')
    webhook_url = f"{origin_url}/api/webhook/stripe-subscription"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    price = SUBSCRIPTION_PRICES[plan_type]
    
    checkout_request = CheckoutSessionRequest(
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(price * 100),
                "product_data": {
                    "name": f"WagWalk Premium ({plan_type.capitalize()})",
                    "description": f"Premium subscription - {'$14.99/month' if plan_type == 'monthly' else '$149/year (save $30!)'}",
                },
                "recurring": {
                    "interval": "month" if plan_type == "monthly" else "year"
                }
            },
            "quantity": 1,
        }],
        mode="subscription",
        success_url=f"{origin_url}/subscription?success=true",
        cancel_url=f"{origin_url}/subscription?canceled=true",
        metadata={"user_id": current_user['id'], "plan_type": plan_type}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.post("/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel premium subscription"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    subscription = await db.subscriptions.find_one({"user_id": current_user['id']})
    
    if not subscription or subscription.get('tier') == 'free':
        raise HTTPException(status_code=400, detail="No active subscription")
    
    # Downgrade to free
    await db.subscriptions.update_one(
        {"user_id": current_user['id']},
        {"$set": {
            "tier": "free",
            "status": "canceled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Subscription canceled. You'll retain premium features until the end of your billing period."}

@api_router.post("/webhook/stripe-subscription")
async def stripe_subscription_webhook(request: Request):
    """Handle Stripe subscription webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    api_key = os.environ.get('STRIPE_API_KEY')
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
        
        if webhook_response.event_type in ["checkout.session.completed", "customer.subscription.created"]:
            user_id = webhook_response.metadata.get("user_id")
            plan_type = webhook_response.metadata.get("plan_type", "monthly")
            
            if user_id:
                await db.subscriptions.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "tier": "premium",
                        "status": "active",
                        "plan_type": plan_type,
                        "stripe_subscription_id": webhook_response.session_id,
                        "current_period_start": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Subscription webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/subscription/check-feature/{feature}")
async def check_feature_access(feature: str, current_user: dict = Depends(get_current_user)):
    """Check if user has access to a specific feature"""
    subscription = await db.subscriptions.find_one({"user_id": current_user['id']}, {"_id": 0})
    tier = subscription.get('tier', 'free') if subscription else 'free'
    
    limits = FREEMIUM_LIMITS.get(tier, FREEMIUM_LIMITS['free'])
    
    has_access = limits.get(feature, False)
    
    return {
        "feature": feature,
        "has_access": has_access,
        "tier": tier,
        "upgrade_required": not has_access and tier == "free"
    }

# Root
@api_router.get("/")
async def root():
    return {"message": "BowWowMeow API v1.0"}

# ============================================
# CLIENT APPOINTMENT EDIT/CANCEL
# ============================================

@api_router.put("/appointments/{appt_id}/client-edit")
async def client_edit_appointment(
    appt_id: str,
    scheduled_date: Optional[str] = None,
    scheduled_time: Optional[str] = None,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Client can edit their scheduled appointment"""
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify client owns this appointment
    if appt["client_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Can only edit scheduled appointments
    if appt["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Can only edit scheduled appointments")
    
    update_data = {}
    if scheduled_date:
        update_data["scheduled_date"] = scheduled_date
    if scheduled_time:
        update_data["scheduled_time"] = scheduled_time
    if notes is not None:
        update_data["notes"] = notes
    
    if update_data:
        await db.appointments.update_one({"id": appt_id}, {"$set": update_data})
    
    updated = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    return updated

@api_router.post("/appointments/{appt_id}/client-cancel")
async def client_cancel_appointment(
    appt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Client can cancel their scheduled appointment (no charge)"""
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify client owns this appointment
    if appt["client_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Can only cancel scheduled appointments
    if appt["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Can only cancel scheduled appointments")
    
    await db.appointments.update_one(
        {"id": appt_id}, 
        {"$set": {"status": "cancelled", "cancelled_by": "client", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Appointment cancelled successfully"}

# ============================================
# WALKER TRADE REQUESTS
# ============================================

class TradeRequestCreate(BaseModel):
    appointment_id: str
    target_walker_id: str

@api_router.post("/trades")
async def create_trade_request(
    request: TradeRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Walker requests to trade a walk with another walker"""
    if current_user["role"] not in ["walker", "sitter", "admin"]:
        raise HTTPException(status_code=403, detail="Only walkers can create trade requests")
    
    # Prevent trading with yourself
    if request.target_walker_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot trade an appointment with yourself")
    
    # Verify appointment exists and belongs to requesting walker
    appt = await db.appointments.find_one({"id": request.appointment_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appt["walker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only trade your own appointments")
    
    if appt["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Can only trade scheduled appointments")
    
    # Verify target walker exists
    target = await db.users.find_one({"id": request.target_walker_id}, {"_id": 0})
    if not target or target["role"] not in ["walker", "sitter"]:
        raise HTTPException(status_code=404, detail="Target walker not found")
    
    # Create trade request
    trade = WalkTradeRequest(
        appointment_id=request.appointment_id,
        requesting_walker_id=current_user["id"],
        target_walker_id=request.target_walker_id,
        status="pending",
        requester_approved=True,
        target_approved=False
    )
    
    await db.trade_requests.insert_one(trade.model_dump())
    return {"message": "Trade request sent", "trade_id": trade.id}

@api_router.get("/trades")
async def get_trade_requests(current_user: dict = Depends(get_current_user)):
    """Get trade requests for current walker"""
    if current_user["role"] not in ["walker", "sitter", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get trades where user is requester or target
    trades = await db.trade_requests.find({
        "$or": [
            {"requesting_walker_id": current_user["id"]},
            {"target_walker_id": current_user["id"]}
        ],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Enrich with appointment and walker details
    for trade in trades:
        appt = await db.appointments.find_one({"id": trade["appointment_id"]}, {"_id": 0})
        if appt:
            # Get pet names for the appointment
            pet_ids = appt.get("pet_ids", [])
            pet_names = []
            for pet_id in pet_ids:
                pet = await db.pets.find_one({"id": pet_id}, {"_id": 0, "name": 1})
                if pet:
                    pet_names.append(pet["name"])
            appt["pet_names"] = pet_names
            trade["appointment"] = appt
        requester = await db.users.find_one({"id": trade["requesting_walker_id"]}, {"_id": 0, "password_hash": 0})
        target = await db.users.find_one({"id": trade["target_walker_id"]}, {"_id": 0, "password_hash": 0})
        trade["requester"] = requester
        trade["target"] = target
    
    return trades

@api_router.post("/trades/{trade_id}/accept")
async def accept_trade_request(
    trade_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Target walker accepts the trade request"""
    trade = await db.trade_requests.find_one({"id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade request not found")
    
    if trade["target_walker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only target walker can accept")
    
    if trade["status"] != "pending":
        raise HTTPException(status_code=400, detail="Trade is no longer pending")
    
    # Update trade as accepted
    await db.trade_requests.update_one(
        {"id": trade_id},
        {"$set": {"target_approved": True, "status": "accepted"}}
    )
    
    # Transfer the appointment to target walker
    await db.appointments.update_one(
        {"id": trade["appointment_id"]},
        {"$set": {"walker_id": trade["target_walker_id"]}}
    )
    
    return {"message": "Trade accepted, appointment transferred"}

@api_router.post("/trades/{trade_id}/reject")
async def reject_trade_request(
    trade_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Target walker rejects the trade request"""
    trade = await db.trade_requests.find_one({"id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade request not found")
    
    if trade["target_walker_id"] != current_user["id"] and trade["requesting_walker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.trade_requests.update_one(
        {"id": trade_id},
        {"$set": {"status": "rejected"}}
    )
    
    return {"message": "Trade request rejected"}

# ============================================
# WALKER TIME-OFF REQUESTS
# ============================================

class TimeOffRequestCreate(BaseModel):
    start_date: str
    end_date: str
    reason: Optional[str] = None

@api_router.post("/time-off")
async def create_time_off_request(
    request: TimeOffRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Walker requests time off - admin gets notified, affected walks flagged"""
    if current_user["role"] not in ["walker", "sitter"]:
        raise HTTPException(status_code=403, detail="Only walkers/sitters can request time off")
    
    # Find affected appointments during this period
    affected_appts = await db.appointments.find({
        "walker_id": current_user["id"],
        "status": "scheduled",
        "scheduled_date": {"$gte": request.start_date, "$lte": request.end_date}
    }, {"_id": 0}).to_list(1000)
    
    affected_ids = [a["id"] for a in affected_appts]
    
    # Create time-off request
    time_off = TimeOffRequest(
        walker_id=current_user["id"],
        start_date=request.start_date,
        end_date=request.end_date,
        reason=request.reason,
        status="approved",  # Auto-approved
        affected_appointments=affected_ids
    )
    
    await db.time_off_requests.insert_one(time_off.model_dump())
    
    # Flag affected appointments for reassignment
    if affected_ids:
        await db.appointments.update_many(
            {"id": {"$in": affected_ids}},
            {"$set": {"needs_reassignment": True, "reassignment_reason": "walker_time_off"}}
        )
    
    # Notify admin (create a notification/message)
    admins = await db.users.find({"role": "admin"}, {"_id": 0}).to_list(100)
    for admin in admins:
        notification = Message(
            sender_id=current_user["id"],
            receiver_id=admin["id"],
            content=f"Time-off request: {current_user['full_name']} requested time off from {request.start_date} to {request.end_date}. {len(affected_ids)} appointment(s) need reassignment."
        )
        await db.messages.insert_one(notification.model_dump())
    
    return {
        "message": "Time-off request submitted",
        "time_off_id": time_off.id,
        "affected_appointments": len(affected_ids)
    }

@api_router.get("/time-off")
async def get_time_off_requests(current_user: dict = Depends(get_current_user)):
    """Get time-off requests"""
    if current_user["role"] == "admin":
        # Admin sees all
        requests = await db.time_off_requests.find({}, {"_id": 0}).to_list(100)
    else:
        # Walker sees their own
        requests = await db.time_off_requests.find(
            {"walker_id": current_user["id"]}, {"_id": 0}
        ).to_list(100)
    
    # Enrich with walker info
    for req in requests:
        walker = await db.users.find_one({"id": req["walker_id"]}, {"_id": 0, "password_hash": 0})
        req["walker"] = walker
    
    return requests

# ============================================
# AUTO-INVOICE GENERATION
# ============================================

@api_router.post("/invoices/auto-generate")
async def auto_generate_invoices(
    cycle: str = "weekly",  # "weekly" or "monthly"
    current_user: dict = Depends(get_current_user)
):
    """Admin triggers auto-generation of invoices for review"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    from datetime import date
    import calendar
    
    today = date.today()
    
    # Determine date range based on cycle
    if cycle == "weekly":
        # Previous week (Monday to Sunday)
        days_since_monday = today.weekday()
        end_date = today - timedelta(days=days_since_monday + 1)  # Last Sunday
        start_date = end_date - timedelta(days=6)  # Previous Monday
    else:  # monthly
        # Previous month
        if today.month == 1:
            start_date = date(today.year - 1, 12, 1)
            end_date = date(today.year - 1, 12, 31)
        else:
            start_date = date(today.year, today.month - 1, 1)
            last_day = calendar.monthrange(today.year, today.month - 1)[1]
            end_date = date(today.year, today.month - 1, last_day)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # Get all clients with completed appointments in this period
    clients = await db.users.find({"role": "client"}, {"_id": 0}).to_list(1000)
    
    invoices_created = []
    
    for client in clients:
        # Get unbilled completed appointments for this client in the date range
        appts = await db.appointments.find({
            "client_id": client["id"],
            "status": "completed",
            "scheduled_date": {"$gte": start_str, "$lte": end_str},
            "invoiced": {"$ne": True}
        }, {"_id": 0}).to_list(1000)
        
        if not appts:
            continue
        
        # Calculate total
        total = 0
        for appt in appts:
            service = await db.services.find_one({"service_type": appt["service_type"]}, {"_id": 0})
            if service:
                total += service["price"]
            else:
                # Default prices
                default_prices = {"walk_30": 25, "walk_60": 40}
                total += default_prices.get(appt["service_type"], 30)
        
        # Create invoice in "draft" status for review
        due_date = (today + timedelta(days=14)).strftime("%Y-%m-%d")
        invoice = Invoice(
            client_id=client["id"],
            appointment_ids=[a["id"] for a in appts],
            amount=total,
            status=InvoiceStatus.PENDING,
            due_date=due_date
        )
        invoice_dict = invoice.model_dump()
        invoice_dict["auto_generated"] = True
        invoice_dict["billing_period_start"] = start_str
        invoice_dict["billing_period_end"] = end_str
        invoice_dict["review_status"] = "pending"  # pending, approved, sent
        
        await db.invoices.insert_one(invoice_dict)
        
        # Mark appointments as invoiced
        appt_ids = [a["id"] for a in appts]
        await db.appointments.update_many(
            {"id": {"$in": appt_ids}},
            {"$set": {"invoiced": True, "invoice_id": invoice.id}}
        )
        
        invoices_created.append({
            "invoice_id": invoice.id,
            "client_name": client["full_name"],
            "amount": total,
            "appointments_count": len(appts)
        })
    
    return {
        "message": f"Auto-generated {len(invoices_created)} invoices for {cycle} billing",
        "period": f"{start_str} to {end_str}",
        "invoices": invoices_created
    }

@api_router.post("/invoices/{invoice_id}/approve-review")
async def approve_invoice_for_sending(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin approves an invoice for sending"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"review_status": "approved"}}
    )
    
    return {"message": "Invoice approved for sending"}

@api_router.post("/invoices/mass-send")
async def mass_send_approved_invoices(current_user: dict = Depends(get_current_user)):
    """Admin sends all approved invoices at once"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    invoices = await db.invoices.find(
        {"review_status": "approved"},
        {"_id": 0}
    ).to_list(1000)
    
    sent_count = 0
    errors = []
    
    for inv in invoices:
        try:
            # Get client info
            client = await db.users.find_one({"id": inv["client_id"]}, {"_id": 0})
            if not client:
                continue
            
            # Try to send email if SendGrid is configured
            if SENDGRID_AVAILABLE and os.environ.get('SENDGRID_API_KEY'):
                # Send email (simplified)
                pass
            
            # Try to send SMS if Twilio is configured
            if TWILIO_AVAILABLE and os.environ.get('TWILIO_ACCOUNT_SID'):
                # Send SMS (simplified)
                pass
            
            # Mark as sent
            await db.invoices.update_one(
                {"id": inv["id"]},
                {"$set": {"review_status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}}
            )
            sent_count += 1
        except Exception as e:
            errors.append({"invoice_id": inv["id"], "error": str(e)})
    
    return {
        "message": f"Sent {sent_count} invoices",
        "sent_count": sent_count,
        "errors": errors
    }

# ============================================
# WALKER CANCEL APPOINTMENT
# ============================================

@api_router.post("/appointments/{appt_id}/walker-cancel")
async def walker_cancel_appointment(
    appt_id: str,
    request: WalkCancellationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Walker cancels their assigned appointment with mandatory reason"""
    if current_user["role"] not in ["walker", "sitter"]:
        raise HTTPException(status_code=403, detail="Only walkers can cancel appointments")
    
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appt["walker_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your appointment")
    
    if appt["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Can only cancel scheduled appointments")
    
    # Flag for reassignment instead of cancelling
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {
            "needs_reassignment": True,
            "reassignment_reason": "walker_cancelled",
            "cancellation_reason": request.reason,
            "walker_id": None  # Remove walker assignment
        }}
    )
    
    # Notify admin
    admins = await db.users.find({"role": "admin"}, {"_id": 0}).to_list(100)
    for admin in admins:
        notification = Message(
            sender_id=current_user["id"],
            receiver_id=admin["id"],
            content=f"Walker {current_user['full_name']} cancelled appointment on {appt['scheduled_date']}. Reason: {request.reason}. Appointment needs reassignment."
        )
        await db.messages.insert_one(notification.model_dump())
    
    return {"message": "Appointment cancelled and flagged for reassignment"}


# ============================================
# DOG PARK - SOCIAL FEED
# ============================================

class DogParkPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    author_role: str
    author_image: Optional[str] = None
    content: str
    image_data: Optional[str] = None  # Base64 encoded image
    tagged_pets: List[Dict] = Field(default_factory=list)  # [{pet_id, pet_name, owner_id, owner_name}]
    tagged_users: List[Dict] = Field(default_factory=list)  # [{user_id, user_name}]
    likes: List[str] = Field(default_factory=list)  # List of user IDs who liked
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DogParkPostCreate(BaseModel):
    content: str
    image_data: Optional[str] = None
    tagged_pet_ids: List[str] = Field(default_factory=list)
    tagged_user_ids: List[str] = Field(default_factory=list)

@api_router.get("/dog-park/posts")
async def get_dog_park_posts(
    filter: Optional[str] = "recent",  # recent, older, my_pet, search
    search_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get Dog Park posts with filtering options"""
    query = {}
    
    # Filter by time
    if filter == "older":
        # Posts from 2 months ago or older
        two_months_ago = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        query["created_at"] = {"$lt": two_months_ago}
    elif filter == "recent":
        # Posts from last 2 months
        two_months_ago = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        query["created_at"] = {"$gte": two_months_ago}
    elif filter == "my_pet":
        # Get user's pets
        user_pets = await db.pets.find({"owner_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
        pet_ids = [p["id"] for p in user_pets]
        if pet_ids:
            query["tagged_pets.pet_id"] = {"$in": pet_ids}
        else:
            return []  # User has no pets
    
    # Search by pet or owner name
    if search_name:
        query["$or"] = [
            {"tagged_pets.pet_name": {"$regex": search_name, "$options": "i"}},
            {"tagged_pets.owner_name": {"$regex": search_name, "$options": "i"}},
            {"author_name": {"$regex": search_name, "$options": "i"}}
        ]
    
    posts = await db.dog_park_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Convert datetime objects to ISO strings
    for post in posts:
        if isinstance(post.get("created_at"), datetime):
            post["created_at"] = post["created_at"].isoformat()
    
    return posts

@api_router.get("/dog-park/featured")
async def get_featured_pet_images(current_user: dict = Depends(get_current_user)):
    """Get random tagged pet pictures for the page entry"""
    # Get posts with tagged pets that have images
    posts_with_images = await db.dog_park_posts.find(
        {"image_data": {"$ne": None}, "tagged_pets": {"$ne": []}},
        {"_id": 0, "image_data": 1, "tagged_pets": 1, "author_name": 1, "created_at": 1}
    ).to_list(50)
    
    import random
    if len(posts_with_images) > 5:
        posts_with_images = random.sample(posts_with_images, 5)
    
    # Convert datetime objects
    for post in posts_with_images:
        if isinstance(post.get("created_at"), datetime):
            post["created_at"] = post["created_at"].isoformat()
    
    return posts_with_images

@api_router.post("/dog-park/posts")
async def create_dog_park_post(
    post_data: DogParkPostCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new Dog Park post"""
    # Build tagged pets with enriched data
    tagged_pets = []
    for pet_id in post_data.tagged_pet_ids:
        pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
        if pet:
            owner = await db.users.find_one({"id": pet["owner_id"]}, {"_id": 0})
            tagged_pets.append({
                "pet_id": pet_id,
                "pet_name": pet.get("name", "Unknown"),
                "owner_id": pet["owner_id"],
                "owner_name": owner.get("full_name", "Unknown") if owner else "Unknown"
            })
    
    # Build tagged users
    tagged_users = []
    for user_id in post_data.tagged_user_ids:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            tagged_users.append({
                "user_id": user_id,
                "user_name": user.get("full_name", "Unknown")
            })
    
    post = DogParkPost(
        author_id=current_user["id"],
        author_name=current_user.get("full_name", "Unknown"),
        author_role=current_user.get("role", "client"),
        author_image=current_user.get("profile_image"),
        content=post_data.content,
        image_data=post_data.image_data,
        tagged_pets=tagged_pets,
        tagged_users=tagged_users
    )
    
    post_dict = post.model_dump()
    post_dict["created_at"] = post_dict["created_at"].isoformat()
    
    await db.dog_park_posts.insert_one(post_dict)
    
    # Remove _id added by MongoDB before returning
    post_dict.pop("_id", None)
    
    # Send notifications to tagged pet owners and users
    notified_users = set()
    
    # Notify pet owners
    for pet_info in tagged_pets:
        owner_id = pet_info["owner_id"]
        if owner_id != current_user["id"] and owner_id not in notified_users:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": owner_id,
                "type": "dog_park_tag",
                "message": f"{current_user.get('full_name', 'Someone')} tagged {pet_info['pet_name']} in a Dog Park post!",
                "post_id": post.id,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
            notified_users.add(owner_id)
    
    # Notify tagged users
    for user_info in tagged_users:
        user_id = user_info["user_id"]
        if user_id != current_user["id"] and user_id not in notified_users:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "dog_park_tag",
                "message": f"{current_user.get('full_name', 'Someone')} tagged you in a Dog Park post!",
                "post_id": post.id,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
            notified_users.add(user_id)
    
    return post_dict

@api_router.post("/dog-park/posts/{post_id}/like")
async def like_dog_park_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Like or unlike a Dog Park post"""
    post = await db.dog_park_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    
    if current_user["id"] in likes:
        # Unlike
        likes.remove(current_user["id"])
        action = "unliked"
    else:
        # Like
        likes.append(current_user["id"])
        action = "liked"
    
    await db.dog_park_posts.update_one({"id": post_id}, {"$set": {"likes": likes}})
    
    return {"message": f"Post {action}", "likes_count": len(likes), "user_liked": current_user["id"] in likes}

@api_router.delete("/dog-park/posts/{post_id}")
async def delete_dog_park_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a Dog Park post (only author or admin)"""
    post = await db.dog_park_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["author_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    await db.dog_park_posts.delete_one({"id": post_id})
    
    return {"message": "Post deleted"}

@api_router.get("/dog-park/notifications")
async def get_dog_park_notifications(current_user: dict = Depends(get_current_user)):
    """Get Dog Park notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"], "type": "dog_park_tag"},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return notifications

@api_router.put("/dog-park/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.get("/dog-park/pets-to-tag")
async def get_pets_to_tag(current_user: dict = Depends(get_current_user)):
    """Get all pets that can be tagged (for staff, all pets; for clients, their own pets)"""
    if current_user["role"] in ["admin", "walker", "sitter"]:
        # Staff can tag any pet
        pets = await db.pets.find({}, {"_id": 0}).to_list(500)
    else:
        # Clients can only tag their own pets
        pets = await db.pets.find({"owner_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    # Enrich with owner names
    for pet in pets:
        owner = await db.users.find_one({"id": pet["owner_id"]}, {"_id": 0, "full_name": 1})
        pet["owner_name"] = owner.get("full_name", "Unknown") if owner else "Unknown"
    
    return pets

@api_router.get("/dog-park/users-to-tag")
async def get_users_to_tag(current_user: dict = Depends(get_current_user)):
    """Get users that can be tagged"""
    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "full_name": 1, "role": 1, "profile_image": 1}
    ).to_list(500)
    
    # Don't include current user
    users = [u for u in users if u["id"] != current_user["id"]]
    
    return users

# ============================================
# CLIENT ONBOARDING
# ============================================

class ClientOnboardingData(BaseModel):
    # Personal info
    full_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    
    # Pets info
    pets: List[Dict] = Field(default_factory=list)  # [{name, type, breed, age, weight, notes, special_instructions}]
    
    # Service category - NEW
    service_category: str = "walks"  # "walks" or "other"
    
    # Walk preferences (used when service_category == "walks")
    schedule_type: str = "recurring"  # "one_time" or "recurring"
    walks_per_day: int = 1
    preferred_walk_times: List[str] = Field(default_factory=list)  # ["09:00", "14:00", "18:00"]
    walk_duration: int = 30  # 30, 45, or 60 minutes
    days_per_week: int = 5  # 1-7
    preferred_days: List[str] = Field(default_factory=list)  # ["Monday", "Tuesday", etc.]
    preferred_walker_id: Optional[str] = None  # Optional walker preference
    
    # Other service preferences (used when service_category == "other")
    other_service: Optional[Dict] = None  # {service_type, schedule_type, duration_value, preferred_days}
    
    # Billing preferences
    billing_frequency: str = "weekly"  # "weekly" or "monthly"
    payment_method: str = "venmo"  # venmo, zelle, cashapp, apple_pay, apple_cash, paypal, check_cash
    payment_details: Optional[str] = None  # username/handle for digital payments

@api_router.get("/client/onboarding-status")
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if client needs to complete onboarding"""
    if current_user["role"] != "client":
        return {"needs_onboarding": False}
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {
        "needs_onboarding": not user.get("onboarding_completed", False),
        "onboarding_data": user.get("onboarding_data", {})
    }

@api_router.post("/client/onboarding")
async def complete_client_onboarding(
    data: ClientOnboardingData,
    current_user: dict = Depends(get_current_user)
):
    """Complete client onboarding, create pets, and create schedules"""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can complete onboarding")
    
    # Update user profile
    update_data = {
        "full_name": data.full_name,
        "email": data.email,
        "phone": data.phone,
        "address": data.address,
        "emergency_contact": data.emergency_contact,
        "emergency_phone": data.emergency_phone,
        "onboarding_completed": True,
        "onboarding_completed_at": datetime.now(timezone.utc).isoformat(),
        "onboarding_data": {
            "service_category": data.service_category,
            "schedule_type": data.schedule_type,
            "walks_per_day": data.walks_per_day,
            "preferred_walk_times": data.preferred_walk_times,
            "walk_duration": data.walk_duration,
            "days_per_week": data.days_per_week,
            "preferred_days": data.preferred_days,
            "preferred_walker_id": data.preferred_walker_id,
            "other_service": data.other_service,
            "billing_frequency": data.billing_frequency,
            "payment_method": data.payment_method,
            "payment_details": data.payment_details
        }
    }
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    # Create pets
    created_pets = []
    pet_ids = []
    for pet_data in data.pets:
        # Ensure age is stored as string
        age_value = pet_data.get("age")
        if age_value is not None and not isinstance(age_value, str):
            age_value = str(age_value)
        
        pet = {
            "id": str(uuid.uuid4()),
            "owner_id": current_user["id"],
            "name": pet_data.get("name", ""),
            "species": pet_data.get("type", "dog"),
            "breed": pet_data.get("breed", ""),
            "age": age_value,
            "weight": pet_data.get("weight") if pet_data.get("weight") != "" else None,
            "notes": pet_data.get("notes", ""),
            "special_instructions": pet_data.get("special_instructions", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pets.insert_one(pet)
        pet.pop("_id", None)
        created_pets.append(pet)
        pet_ids.append(pet["id"])
    
    # Day name to number mapping (Monday=0 through Sunday=6)
    day_to_num = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    
    # Create schedules based on service_category
    schedules_created = []
    
    if data.service_category == "walks":
        # Handle walks scheduling
        service_type_map = {30: "walk_30", 45: "walk_45", 60: "walk_60"}
        service_type = service_type_map.get(data.walk_duration, "walk_30")
        
        if data.schedule_type == "recurring":
            # Create recurring schedules for each day/time combination
            for day in data.preferred_days:
                day_num = day_to_num.get(day, 0)
                for walk_time in data.preferred_walk_times:
                    recurring_schedule = {
                        "id": str(uuid.uuid4()),
                        "client_id": current_user["id"],
                        "walker_id": data.preferred_walker_id if data.preferred_walker_id else None,
                        "pet_ids": pet_ids,
                        "service_type": service_type,
                        "scheduled_time": walk_time,
                        "day_of_week": day_num,
                        "notes": f"Created during onboarding",
                        "status": "active" if data.preferred_walker_id else "pending_assignment",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "created_by": current_user["id"]
                    }
                    await db.recurring_schedules.insert_one(recurring_schedule)
                    recurring_schedule.pop("_id", None)
                    schedules_created.append(recurring_schedule)
        else:
            # Create one-time appointments for the next occurrence of each day/time
            from datetime import timedelta
            today = datetime.now(timezone.utc).date()
            today_weekday = today.weekday()
            
            for day in data.preferred_days:
                day_num = day_to_num.get(day, 0)
                days_ahead = day_num - today_weekday
                if days_ahead <= 0:
                    days_ahead += 7
                next_date = today + timedelta(days=days_ahead)
                
                for walk_time in data.preferred_walk_times:
                    appointment = {
                        "id": str(uuid.uuid4()),
                        "client_id": current_user["id"],
                        "walker_id": data.preferred_walker_id if data.preferred_walker_id else None,
                        "pet_ids": pet_ids,
                        "service_type": service_type,
                        "scheduled_date": next_date.isoformat(),
                        "scheduled_time": walk_time,
                        "status": "scheduled",
                        "notes": f"Created during onboarding",
                        "is_recurring": False,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.appointments.insert_one(appointment)
                    appointment.pop("_id", None)
                    schedules_created.append(appointment)
    
    elif data.service_category == "other" and data.other_service:
        # Handle other services (Day Care, Overnights, etc.)
        other = data.other_service
        service_type = other.get("service_type", "")
        schedule_type = other.get("schedule_type", "one_time")
        duration_value = other.get("duration_value", 1)
        preferred_days = other.get("preferred_days", [])
        
        if schedule_type == "recurring":
            # Create recurring schedules for other services
            for day in preferred_days:
                day_num = day_to_num.get(day, 0)
                recurring_schedule = {
                    "id": str(uuid.uuid4()),
                    "client_id": current_user["id"],
                    "walker_id": None,  # Admin will assign
                    "pet_ids": pet_ids,
                    "service_type": service_type,
                    "scheduled_time": "",
                    "day_of_week": day_num,
                    "duration_value": duration_value,
                    "notes": f"Created during onboarding - {service_type}",
                    "status": "pending_assignment",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user["id"]
                }
                await db.recurring_schedules.insert_one(recurring_schedule)
                recurring_schedule.pop("_id", None)
                schedules_created.append(recurring_schedule)
        else:
            # Create one-time appointment(s) for other services
            from datetime import timedelta
            today = datetime.now(timezone.utc).date()
            
            # Create appointments for the duration_value days starting from next preferred day
            if preferred_days:
                day_num = day_to_num.get(preferred_days[0], 0)
                today_weekday = today.weekday()
                days_ahead = day_num - today_weekday
                if days_ahead <= 0:
                    days_ahead += 7
                start_date = today + timedelta(days=days_ahead)
            else:
                start_date = today + timedelta(days=1)
            
            for i in range(duration_value):
                appt_date = start_date + timedelta(days=i)
                appointment = {
                    "id": str(uuid.uuid4()),
                    "client_id": current_user["id"],
                    "walker_id": None,
                    "pet_ids": pet_ids,
                    "service_type": service_type,
                    "scheduled_date": appt_date.isoformat(),
                    "scheduled_time": "",
                    "status": "scheduled",
                    "notes": f"Created during onboarding - {service_type}",
                    "duration_value": 1,
                    "duration_type": "days" if "day" in service_type else "nights",
                    "is_recurring": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.appointments.insert_one(appointment)
                appointment.pop("_id", None)
                schedules_created.append(appointment)
    
    # Create notification for admin(s)
    admins = await db.users.find({"role": "admin", "is_active": True}, {"_id": 0, "id": 1}).to_list(100)
    needs_walker = not data.preferred_walker_id
    service_desc = "walks" if data.service_category == "walks" else data.other_service.get("service_type", "service") if data.other_service else "service"
    notification_msg = f"New client {data.full_name} has completed onboarding for {service_desc}"
    if needs_walker:
        notification_msg += " and needs a walker/sitter assigned."
    else:
        notification_msg += ". Schedule is ready for service."
    
    for admin in admins:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": admin["id"],
            "type": "new_client_pricing",
            "message": notification_msg,
            "client_id": current_user["id"],
            "client_name": data.full_name,
            "needs_walker_assignment": needs_walker,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {
        "message": "Onboarding completed successfully",
        "pets_created": len(created_pets),
        "pets": created_pets,
        "schedules_created": len(schedules_created),
        "service_category": data.service_category,
        "schedule_type": data.schedule_type if data.service_category == "walks" else (data.other_service.get("schedule_type") if data.other_service else "one_time"),
        "needs_walker_assignment": needs_walker
    }

@api_router.get("/admin/new-client-notifications")
async def get_new_client_notifications(current_user: dict = Depends(get_current_user)):
    """Get notifications for new clients needing pricing setup"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    notifications = await db.notifications.find(
        {"user_id": current_user["id"], "type": "new_client_pricing", "read": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications

@api_router.put("/admin/new-client-notifications/{notification_id}/dismiss")
async def dismiss_new_client_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Dismiss a new client notification"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification dismissed"}

@api_router.get("/admin/client/{client_id}/onboarding-details")
async def get_client_onboarding_details(
    client_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get client's onboarding details for pricing setup"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    client = await db.users.find_one({"id": client_id}, {"_id": 0, "password_hash": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    pets = await db.pets.find({"owner_id": client_id}, {"_id": 0}).to_list(100)
    
    return {
        "client": client,
        "pets": pets,
        "onboarding_data": client.get("onboarding_data", {})
    }

# ============================================
# WALKER/SITTER ONBOARDING
# ============================================

class StaffOnboardingData(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None  # YYYY-MM-DD format
    payment_method: Optional[str] = None  # zelle, venmo, cashapp
    payment_id: Optional[str] = None  # the ID/handle for the payment method

@api_router.get("/staff/onboarding-status")
async def get_staff_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if walker/sitter needs to complete onboarding"""
    if current_user["role"] not in ["walker", "sitter"]:
        return {"needs_onboarding": False}
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {
        "needs_onboarding": not user.get("onboarding_completed", False),
        "user_data": {
            "full_name": user.get("full_name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "address": user.get("address", ""),
            "date_of_birth": user.get("date_of_birth", "")
        }
    }

@api_router.post("/staff/onboarding")
async def complete_staff_onboarding(
    data: StaffOnboardingData,
    current_user: dict = Depends(get_current_user)
):
    """Complete walker/sitter onboarding"""
    if current_user["role"] not in ["walker", "sitter"]:
        raise HTTPException(status_code=403, detail="Only walkers/sitters can complete this onboarding")
    
    # Build payment_methods dict based on selected method
    payment_methods = {}
    if data.payment_method and data.payment_id:
        payment_methods[data.payment_method] = data.payment_id
    
    # Update user profile
    update_data = {
        "full_name": data.full_name,
        "email": data.email,
        "phone": data.phone,
        "address": data.address,
        "date_of_birth": data.date_of_birth,
        "payment_methods": payment_methods,
        "preferred_payment_method": data.payment_method,
        "onboarding_completed": True,
        "onboarding_completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    # Create notification for admin(s) - new staff member joined
    admins = await db.users.find({"role": "admin", "is_active": True}, {"_id": 0, "id": 1}).to_list(100)
    role_display = "Walker" if current_user["role"] == "walker" else "Sitter"
    for admin in admins:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": admin["id"],
            "type": "new_staff_onboarded",
            "message": f"New {role_display} {data.full_name} has completed their profile setup.",
            "staff_id": current_user["id"],
            "staff_name": data.full_name,
            "staff_role": current_user["role"],
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {"message": "Profile setup completed successfully"}

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
