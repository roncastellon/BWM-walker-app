# WagWalk - Dog Walker & Pet Sitting App PRD

## Problem Statement
Build a dog walker/pet sitting app with scheduling, shared calendar, client list with invoicing and bill pay. Features a client portal for viewing/paying bills, scheduling walks, overnight stays, transport, and concierge services. Backend includes walker profiles, schedules, walk timers, payroll submission, and team communication.

## User Choices
- **Authentication**: JWT-based with username/password
- **Payments**: Stripe integration
- **Chat**: Polling-based messaging

## Architecture

### Tech Stack
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS, Shadcn UI
- **Database**: MongoDB (motor async driver)
- **Payments**: Stripe via emergentintegrations

### User Roles
1. **Client** - Pet owners who book services
2. **Walker** - Dog walkers who perform services
3. **Admin** - Manages clients, walkers, and business operations

### MongoDB Collections
- `users` - User accounts with roles
- `pets` - Client pets
- `services` - Service pricing
- `appointments` - Booked services
- `invoices` - Client invoices
- `payment_transactions` - Stripe payment records
- `messages` - Chat messages
- `timesheets` - Walker payroll submissions

## What's Been Implemented (December 2025 - January 2026)

### Backend API (/api)
- ✅ User registration/login with JWT
- ✅ Role-based access control
- ✅ Pet CRUD operations
- ✅ Service pricing management
- ✅ Appointment booking and management
- ✅ Walk timer (start/end with duration tracking)
- ✅ Invoice generation and management
- ✅ Stripe payment integration
- ✅ Messaging system (individual + group chat)
- ✅ Timesheet/payroll submission
- ✅ Dashboard statistics per role
- ✅ Calendar endpoints
- ✅ GET `/api/users/sitters` - List sitters for overnight bookings

### Frontend Pages
- ✅ Auth Page (Login/Register with role selection)
- ✅ Client Dashboard (stats, appointments, bills, pets)
- ✅ Walker Dashboard (schedule, active walk timer, stats)
- ✅ Admin Dashboard (business overview, management tools)
- ✅ Schedule/Booking Page (service selection, date/time, walker preference)
- ✅ Billing Page (invoices, Stripe checkout)
- ✅ Pets Management Page
- ✅ Messages Page (individual + group chat)
- ✅ Calendar Page (appointment overview, walker assignment)
- ✅ Payroll Page (weekly timesheet, submission)
- ✅ Walker Profile Page
- ✅ Admin Clients Page
- ✅ Admin Walkers Page
- ✅ Admin Invoices Page

### Recent Updates (January 2026)
- ✅ Admin Client Details: Added "Schedule" button to header
- ✅ Mobile-responsive tabs (stack vertically on mobile)
- ✅ Conditional Walker/Sitter selection:
  - Walk services: Show "Assign Walker" dropdown
  - Overnight services: Show "Assign Sitter (Optional)" dropdown
  - Day Care/Transport/Concierge: No walker/sitter dropdown
- ✅ Day Care appointments working from Calendar page

### Design
- Theme: "Playful Trust" - Warm orange (#F97316) + Park green (#3D8B5D)
- Fonts: Nunito (headings), Manrope (body)
- Responsive layout with sidebar navigation
- Shadcn UI components throughout

## Prioritized Backlog

### P0 (Critical)
- ✅ All core features implemented
- ✅ UI improvements for admin client management (Jan 2026)

### P1 (High Priority - Next Phase)
- Overhaul "Add Appointment" dialog on Calendar Page (add one-time vs. recurring toggle, consistent with admin client editor)
- Push notifications for appointments
- SMS reminders via Twilio
- Real-time WebSocket chat (upgrade from polling)
- GPS tracking during walks
- Photo sharing during walks
- Email invoices

### P2 (Medium Priority)
- Client pet profiles with medical records
- Walker reviews/ratings system
- ✅ Recurring appointment scheduling (COMPLETED Jan 2026)
- ✅ One-time date range scheduling for overnights/stays (COMPLETED Jan 2026)
- Multi-pet discounts
- Walker availability calendar
- Admin analytics dashboard
- Verify appointments visibility for clients with 0 pets
- Refactor `AdminClientsPage.js` (critically oversized - needs component breakdown)
- Refactor `server.py` into smaller routers

### P3 (Future)
- Mobile app (React Native)
- Walker background check integration
- Insurance verification
- Referral program
- Gift cards

## API Endpoints Summary

### Auth
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - User login
- GET `/api/auth/me` - Get current user

### Users
- GET `/api/users/walkers` - List walkers
- GET `/api/users/clients` - List clients (admin/walker only)
- GET `/api/users/{id}` - Get user profile
- PUT `/api/users/{id}` - Update user

### Pets
- POST `/api/pets` - Create pet
- GET `/api/pets` - List pets
- DELETE `/api/pets/{id}` - Delete pet

### Services
- GET `/api/services` - List service pricing

### Appointments
- POST `/api/appointments` - Book appointment
- GET `/api/appointments` - List appointments
- GET `/api/appointments/calendar` - Calendar view
- POST `/api/appointments/{id}/start` - Start walk timer
- POST `/api/appointments/{id}/end` - End walk timer
- PUT `/api/appointments/{id}/assign` - Assign walker

### Scheduling (Admin)
- POST `/api/users/{user_id}/walking-schedule` - Create schedule (supports both recurring and one-time)
  - `is_recurring: true` - Creates recurring_schedules and generates appointments weekly
  - `is_recurring: false` - Creates one-time appointments for date range (start_date to end_date)
- GET `/api/users/{user_id}/walking-schedule` - Get client's schedule
- GET `/api/recurring-schedules` - List recurring schedules
- DELETE `/api/recurring-schedules/{id}` - Delete recurring schedule

### Invoices & Payments
- POST `/api/invoices` - Create invoice
- GET `/api/invoices` - List invoices
- POST `/api/payments/checkout` - Create Stripe checkout
- GET `/api/payments/status/{session_id}` - Check payment status

### Messages
- POST `/api/messages` - Send message
- GET `/api/messages` - Get messages
- GET `/api/messages/conversations` - Get conversations

### Timesheets
- GET `/api/timesheets` - List timesheets
- POST `/api/timesheets/submit` - Submit timesheet

### Dashboard
- GET `/api/dashboard/stats` - Get role-specific stats

## Environment Variables
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `JWT_SECRET_KEY` - JWT signing secret
- `STRIPE_API_KEY` - Stripe API key
- `CORS_ORIGINS` - Allowed CORS origins
