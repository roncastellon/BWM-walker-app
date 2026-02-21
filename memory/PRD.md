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

### Recent Updates (February 2026)
- ✅ **Overnight Appointment Fix (Feb 21, 2026)**: Fixed overnight stays to create a SINGLE appointment instead of multiple 1-day appointments
  - Selecting overnight service now shows "Start Date" and "End Date" fields
  - End date is required for overnight/daycare services (validation error if missing)
  - Creates ONE appointment with `scheduled_date` (start) and `end_date` (end)
  - Check-in only shows on start date, check-out prompt only on end date
  - Removed fallback code that was creating multiple 1-day appointments
  - Note: Legacy "bad" data (multiple 1-day appointments) may still exist in database
- ✅ **Admin Force-Complete Walk (Feb 21, 2026)**: Admins can mark missed/unclosed walks as completed
  - New "Mark as Complete" button in appointment detail modal (CalendarPage.js)
  - Button only appears for walk services (walk_30, walk_45, walk_60) when status is scheduled/in_progress
  - Not shown for overnight/daycare services (which use "End Stay Early" instead)
  - Calls POST `/appointments/{appt_id}/admin-complete` endpoint
  - Sets status to "completed", records admin completion metadata
  - Useful for resolving missed walks without proper completion by walker
- ✅ **10 PM Schedule Rollover (Feb 21, 2026)**: Daily schedule shows today until 10 PM, then shows tomorrow
  - AdminDashboard.js: `getEffectiveScheduleDate()` helper determines which day to show
  - WalkerDashboard.js: Same logic applied to walker's "Today's Walks" section
  - Title dynamically changes from "Today's Schedule" to "Tomorrow's Schedule" after 10 PM
  - Provides better end-of-day experience for late-night workers
- ✅ **Admin Dashboard Tabbed Redesign (Feb 19, 2026)**: Schedule section now has 3 sub-tabs
  - **Walks tab**: Shows walk, transport, and concierge appointments with Pending/Completed/Cancelled filters
  - **Overnights tab**: Shows overnight stays with Check In/Staying/Check Out summary cards
  - **Daycare tab**: Shows daycare appointments with Expected/Here Now/Picked Up summary cards
  - Each tab shows count badge with total appointments for that service type
  - Empty states with links to respective calendar pages
- ✅ **Overnight Calendar UX Enhancement (Feb 19, 2026)**: Improved status labels
  - "Check in to start" on start date for scheduled stays (amber)
  - "Awaiting check-in" on intermediate dates for scheduled stays
  - "Checked In" on all dates for in-progress stays (blue)
  - "Check out to end" on end date for in-progress stays (orange)
  - "Completed" for completed stays (green)

### Recent Updates (January 2026)
- ✅ Admin Client Details: Added "Schedule" button to header
- ✅ Mobile-responsive tabs (stack vertically on mobile)
- ✅ Conditional Walker/Sitter selection:
  - Walk services: Show "Assign Walker" dropdown
  - Overnight services: Show "Assign Sitter (Optional)" dropdown
  - Day Care/Transport/Concierge: No walker/sitter dropdown
- ✅ Day Care appointments working from Calendar page
- ✅ **Quick Actions Context Menu**: Right-click on calendar appointments for:
  - Change Status (Scheduled/In Progress/Completed/Cancelled)
  - Reassign Walker (for walk services only)
  - Reschedule
  - View Details
  - Cancel Appointment
- ✅ **Flat-Rate Payroll System**: Walker earnings calculated by flat rate per service (not duration)
- ✅ **Admin Walker Management**: Full edit UI for walker profiles, username, password, and custom pay rates
- ✅ **Admin Client Management**: Full edit UI for client profiles, username, password
- ✅ **12-Hour Clock Format**: All times across app display in AM/PM format
- ✅ **Auto-Select Pets**: All client pets auto-selected when scheduling
- ✅ **Admin Walk Review**: Admins can view completed walk details including GPS routes and notes
- ✅ **Password Change Bug Fix (Jan 10, 2026)**: Fixed bcrypt 5.0.0/passlib incompatibility by downgrading to bcrypt 4.2.0
- ✅ **Payroll Review Flow (Feb 7, 2026)**: Walkers must review & confirm before submitting paysheet
  - "Submit for Pay" button opens review modal
  - Shows service breakdown by type with individual earnings
  - "Submit to Admin" confirms final submission
  - Only completed services can be submitted
- ✅ **Admin Payroll Management (Feb 7, 2026)**: Full admin control over walker payroll
  - New "Staff Payroll" page accessible from admin sidebar
  - Three-tab workflow: Pending Review → Ready to Pay → Paid
  - View detailed breakdown of each submission
  - Edit paysheet (adjust earnings, remove services, add notes)
  - Approve submissions and mark as paid
  - Summary cards show totals for each status
- ✅ **Pet-Centric Client View (Feb 7, 2026)**: Clients page reorganized by pet
  - Pets displayed first, sorted alphabetically by name
  - Owner name shown below each pet card
  - Color-coded icons (orange=dog, purple=cat)
  - Search by pet name or owner name
  - Mobile-first responsive design
- ✅ **Mobile Hamburger Menu (Feb 7, 2026)**: Full mobile navigation
  - Hamburger icon appears on screens < 1024px
  - Slide-in sidebar with all navigation items
  - Dog Park quick link at top
  - User info and logout at bottom
  - Semi-transparent overlay backdrop
  - Smaller header and touch-friendly buttons
- ✅ **Overnights Calendar (Feb 18, 2026)**: Dedicated calendar for overnight stays
  - Week view showing overnight boardings
  - Check-in on arrival day, Check-out on departure
  - "Stays Ending Today" alert after 6 PM with extend/complete options
  - Extend stay by 1-7 nights
  - "Currently Staying" summary section
- ✅ **Daycare Calendar Bug Fix (Feb 18, 2026)**: Fixed daycare appointments not showing
  - Changed API endpoint from `/appointments` to `/appointments/calendar`
  - Broadened daycare filter to include all daycare service types
  - Summary: "Currently Here" and "Awaiting Check-in" counts
  - Quick Check-in/Pick-up buttons
  - Pickup notes for end-of-day handoff
  - Week view with status badges (Expected, Here, Done)
- ✅ **Walker Dashboard Pet Names Fix (Feb 18, 2026)**: "Up Next" banner now shows pet names
  - Updated `/appointments` endpoint to include `pet_names` and `client_name`
  - Walker can now see which pet(s) they're walking at a glance
- ✅ **Service Pricing Edit Fix (Feb 18, 2026)**: Fixed pricing edit not working in live
  - Backend PUT /services/{id} now accepts JSON body instead of query params
  - Added ServiceUpdate Pydantic model for validation
  - Frontend sends updates as JSON body
- ✅ **Billing Type Selection (Feb 18, 2026)**: Create/edit services with billing type
  - Three options: Per Visit (with time), Per Day, Per Night
  - Services list displays billing type badge (per day/per night)
  - User-provided duration_type is respected when creating services
- ✅ **Admin Dual-Role Walker (Feb 18, 2026)**: Admins can also function as walkers
  - Added `is_walker` field to users - admins can enable walker mode
  - PUT `/users/{id}/toggle-walker` endpoint to enable/disable walker status
  - Admins with is_walker=true appear in the walkers dropdown for assignment
  - GET `/appointments/my-walks` returns walks assigned to admin
  - Admin dashboard shows "Up Next" banner with pet names and "Start Walk" button
  - Full walk completion flow available (pee/poop/water questions, notes)
- ✅ **Staff Management Overhaul (Feb 18, 2026)**: Full staff management for all roles
  - Renamed "Walkers" page to "Staff" page
  - GET `/users/staff` returns all staff (Admin, Walker, Sitter)
  - Can create staff with any role: Admin, Walker, Sitter
  - Admin role can have additional capabilities: is_walker, is_sitter
  - Walker/Sitter roles can have combo capabilities
  - Staff cards show role badges (Admin=purple, Walker=orange, Sitter=blue)
  - Edit staff to change roles and add/remove capabilities
  - Auto-assigns walker_color when enabling walker/sitter capabilities

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
- Improve Walker "Start Walk" UX (currently navigates to confusing separate page)
- Admin Service Management (create/edit/delete services, not just pay rates)
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
- POST `/api/appointments/{id}/admin-complete` - Admin force-complete walk (admin only)

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
