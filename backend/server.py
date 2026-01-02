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
    # Pet Sitting Services
    PETSIT_YOUR_LOCATION_3 = "petsit_your_location_3"  # At client's home, 3 visits/day
    PETSIT_YOUR_LOCATION_4 = "petsit_your_location_4"  # At client's home, 4 visits/day
    PETSIT_OUR_LOCATION = "petsit_our_location"        # Boarding at our location

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
        "petsit_your_location_3": 50.00,  # 3 visits/day
        "petsit_your_location_4": 75.00,  # 4 visits/day
        "petsit_our_location": 50.00,     # per night
    }
    
    if service_type not in base_prices:
        return {"total": 0, "breakdown": []}
    
    base_price = base_prices[service_type]
    breakdown = []
    total = 0
    
    # Calculate number of days/nights
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date) if end_date else start
    
    if service_type == "petsit_our_location":
        # For boarding, count nights (end_date - start_date)
        num_nights = max(1, (end - start).days)
        
        # Calculate for each night
        current = start
        for i in range(num_nights):
            night_date = (current + timedelta(days=i)).strftime("%Y-%m-%d")
            night_price = base_price
            
            # Add 2nd dog at half price
            if num_dogs > 1:
                night_price += (num_dogs - 1) * (base_price / 2)
            
            # Check for holiday surcharge
            is_holiday = is_holiday_date(night_date)
            holiday_surcharge = 10.00 * num_dogs if is_holiday else 0
            
            night_total = night_price + holiday_surcharge
            total += night_total
            
            breakdown.append({
                "date": night_date,
                "base": base_price,
                "dogs": num_dogs,
                "dog_surcharge": (num_dogs - 1) * (base_price / 2) if num_dogs > 1 else 0,
                "holiday": is_holiday,
                "holiday_surcharge": holiday_surcharge,
                "subtotal": night_total
            })
    else:
        # For at-your-location, count days (any part counts as full day)
        num_days = max(1, (end - start).days + 1)
        
        for i in range(num_days):
            day_date = (start + timedelta(days=i)).strftime("%Y-%m-%d")
            day_price = base_price
            
            # No multi-dog discount for visits (each dog same price)
            day_price = base_price * num_dogs
            
            # Check for holiday surcharge
            is_holiday = is_holiday_date(day_date)
            holiday_surcharge = 10.00 * num_dogs if is_holiday else 0
            
            day_total = day_price + holiday_surcharge
            total += day_total
            
            breakdown.append({
                "date": day_date,
                "base": base_price,
                "dogs": num_dogs,
                "holiday": is_holiday,
                "holiday_surcharge": holiday_surcharge,
                "subtotal": day_total
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

class GPSCoordinate(BaseModel):
    lat: float
    lng: float
    timestamp: str

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
    # GPS Tracking fields
    gps_route: List[Dict] = Field(default_factory=list)  # List of {lat, lng, timestamp}
    distance_meters: Optional[float] = None
    is_tracking: bool = False
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

# Walker pay rates
WALKER_PAY_RATES = {
    "walk_30": 15.00,  # 30-minute walk
    "walk_60": 30.00,  # 60-minute walk
}

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

@api_router.put("/users/{user_id}/color")
async def update_walker_color(user_id: str, color: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.users.update_one({"id": user_id}, {"$set": {"walker_color": color}})
    return {"message": "Walker color updated"}

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
    
    allowed_fields = ['full_name', 'phone', 'address', 'email', 'bio', 'profile_image']
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

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
    age: Optional[int] = None
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
    """Save walking schedule for a client"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    schedule_data = {
        "user_id": user_id,
        "walks_per_day": schedule.get('walks_per_day', 1),
        "days": schedule.get('days', []),
        "preferred_times": schedule.get('preferred_times', []),
        "preferred_walker_id": schedule.get('preferred_walker_id', ''),
        "notes": schedule.get('notes', ''),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.walking_schedules.update_one(
        {"user_id": user_id},
        {"$set": schedule_data},
        upsert=True
    )
    return {"message": "Walking schedule saved"}

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
            ServicePricing(service_type=ServiceType.WALK_30, name="30-Minute Walk", description="A quick 30-minute walk for your pet", price=25.00, duration_minutes=30),
            ServicePricing(service_type=ServiceType.WALK_60, name="60-Minute Walk", description="A full hour walk with play time", price=40.00, duration_minutes=60),
            ServicePricing(service_type=ServiceType.PETSIT_YOUR_LOCATION_3, name="Pet Sitting - Your Location (3 visits)", description="3 visits per day at your home. Any part of day counts as full day.", price=50.00, duration_minutes=480),
            ServicePricing(service_type=ServiceType.PETSIT_YOUR_LOCATION_4, name="Pet Sitting - Your Location (4 visits)", description="4 visits per day at your home. Any part of day counts as full day.", price=75.00, duration_minutes=480),
            ServicePricing(service_type=ServiceType.PETSIT_OUR_LOCATION, name="Pet Sitting - Our Location (Boarding)", description="Boarding at our facility. $50/night, 2nd dog half price, +$10 holiday surcharge.", price=50.00, duration_minutes=1440),
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
    if service_type not in ["petsit_your_location_3", "petsit_your_location_4", "petsit_our_location"]:
        raise HTTPException(status_code=400, detail="Invalid pet sitting service type")
    
    result = calculate_petsit_price(service_type, num_dogs, start_date, end_date)
    return result

@api_router.get("/services/holidays/{year}")
async def get_holiday_dates_endpoint(year: int):
    """Get all holiday dates (including day before/after) for pricing"""
    holidays = get_holiday_dates(year)
    return {"year": year, "holiday_dates": sorted(holidays)}

# Appointment Routes
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appt_data: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    # Check for time slot limits (max 3 appointments per time slot)
    if appt_data.scheduled_time:
        existing_at_time = await db.appointments.count_documents({
            "scheduled_date": appt_data.scheduled_date,
            "scheduled_time": appt_data.scheduled_time,
            "status": {"$nin": ["cancelled"]}
        })
        if existing_at_time >= 3:
            raise HTTPException(status_code=400, detail="This time slot is full (maximum 3 appointments). Please select another time.")
    
    # If walker is specified, check they don't already have an appointment at this time
    if appt_data.walker_id:
        walker_busy = await db.appointments.find_one({
            "walker_id": appt_data.walker_id,
            "scheduled_date": appt_data.scheduled_date,
            "scheduled_time": appt_data.scheduled_time,
            "status": {"$nin": ["cancelled"]}
        })
        if walker_busy:
            raise HTTPException(status_code=400, detail="This walker is already booked at this time. Please select another walker or time.")
    
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
    
    # Check time slot limit (max 3 per slot) - exclude current appointment
    if new_date and new_time:
        existing_at_time = await db.appointments.count_documents({
            "id": {"$ne": appt_id},
            "scheduled_date": new_date,
            "scheduled_time": new_time,
            "status": {"$nin": ["cancelled"]}
        })
        if existing_at_time >= 3:
            raise HTTPException(status_code=400, detail="This time slot is full (maximum 3 appointments). Please select another time.")
    
    # Check walker availability - exclude current appointment
    if new_walker and new_date and new_time:
        walker_busy = await db.appointments.find_one({
            "id": {"$ne": appt_id},
            "walker_id": new_walker,
            "scheduled_date": new_date,
            "scheduled_time": new_time,
            "status": {"$nin": ["cancelled"]}
        })
        if walker_busy:
            raise HTTPException(status_code=400, detail="This walker is already booked at this time.")
    
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
    
    # Check time slot limit
    if scheduled_time:
        existing_at_time = await db.appointments.count_documents({
            "scheduled_date": scheduled_date,
            "scheduled_time": scheduled_time,
            "status": {"$nin": ["cancelled"]}
        })
        if existing_at_time >= 3:
            raise HTTPException(status_code=400, detail="This time slot is full (maximum 3 appointments).")
    
    # Check walker availability
    if walker_id:
        walker_busy = await db.appointments.find_one({
            "walker_id": walker_id,
            "scheduled_date": scheduled_date,
            "scheduled_time": scheduled_time,
            "status": {"$nin": ["cancelled"]}
        })
        if walker_busy:
            raise HTTPException(status_code=400, detail="This walker is already booked at this time.")
    
    appointment = Appointment(
        client_id=appt_data.get('client_id'),
        walker_id=walker_id,
        pet_ids=appt_data.get('pet_ids', []),
        service_type=appt_data.get('service_type'),
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

# Alias for /end endpoint
@api_router.post("/appointments/{appt_id}/complete")
async def complete_walk(appt_id: str, current_user: dict = Depends(get_current_user)):
    return await end_walk(appt_id, current_user)

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
    
    if payment_method not in ['zelle', 'venmo', 'cashapp', 'cash', 'check', 'other']:
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
    """Get business payment info for Zelle, Venmo, CashApp"""
    settings = await db.settings.find_one({"type": "payment_info"}, {"_id": 0})
    if settings:
        return settings.get('data', {})
    # Return defaults
    return {
        "zelle": {"enabled": True, "email": "", "phone": "", "name": ""},
        "venmo": {"enabled": True, "username": ""},
        "cashapp": {"enabled": True, "cashtag": ""},
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
        return settings.get('data', {})
    return {
        "company_name": "",
        "address": "",
        "phone": "",
        "email": "",
        "logo_url": "",
        "tax_id": "",
        "website": ""
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
            contact['last_message_at'] = last_message.get('created_at', '')
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
    active_chats.sort(key=lambda c: c.get('last_message_at', ''), reverse=True)
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

# Timesheet Routes
@api_router.get("/timesheets")
async def get_timesheets(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] == 'walker':
        query['walker_id'] = current_user['id']
    
    timesheets = await db.timesheets.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Normalize old and new timesheet formats
    normalized = []
    for ts in timesheets:
        normalized.append({
            "id": ts.get("id"),
            "walker_id": ts.get("walker_id"),
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
    
    # Get IDs of walks already included in submitted timesheets
    submitted_timesheets = await db.timesheets.find(
        {"walker_id": current_user['id'], "submitted": True},
        {"_id": 0, "appointment_ids": 1}
    ).to_list(500)
    
    submitted_appointment_ids = set()
    for ts in submitted_timesheets:
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

@api_router.post("/timesheets/submit")
async def submit_timesheet(current_user: dict = Depends(get_current_user)):
    """Submit accumulated walks as a timesheet"""
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
    
    timesheet = Timesheet(
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
    
    ts_dict = timesheet.model_dump()
    ts_dict['created_at'] = ts_dict['created_at'].isoformat()
    await db.timesheets.insert_one(ts_dict)
    
    return {
        "message": "Timesheet submitted successfully",
        "timesheet_id": timesheet.id,
        "total_hours": timesheet.total_hours,
        "total_earnings": timesheet.total_earnings,
        "total_walks": timesheet.total_walks
    }

@api_router.put("/timesheets/{timesheet_id}/approve")
async def approve_timesheet(timesheet_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.timesheets.update_one({"id": timesheet_id}, {"$set": {"approved": True}})
    return {"message": "Timesheet approved"}

@api_router.put("/timesheets/{timesheet_id}/mark-paid")
async def mark_timesheet_paid(timesheet_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.timesheets.update_one({"id": timesheet_id}, {"$set": {"paid": True}})
    return {"message": "Timesheet marked as paid"}

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
