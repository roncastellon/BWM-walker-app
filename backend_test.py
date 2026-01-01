import requests
import sys
import json
from datetime import datetime, timedelta

class WagWalkAPITester:
    def __init__(self, base_url="https://petbuddy-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.pets = {}    # Store pet data
        self.appointments = {}  # Store appointment data
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200, description="Check if API is accessible")

    def test_user_registration(self):
        """Test user registration for all roles"""
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Test client registration
        client_data = {
            "username": f"testclient_{timestamp}",
            "email": f"client_{timestamp}@test.com",
            "password": "TestPass123!",
            "full_name": "Test Client",
            "phone": "555-0101",
            "role": "client"
        }
        success, response = self.run_test(
            "Client Registration", "POST", "auth/register", 200, 
            data=client_data, description="Register new client user"
        )
        if success:
            self.tokens['client'] = response.get('access_token')
            self.users['client'] = response.get('user')

        # Test walker registration
        walker_data = {
            "username": f"testwalker_{timestamp}",
            "email": f"walker_{timestamp}@test.com",
            "password": "TestPass123!",
            "full_name": "Test Walker",
            "phone": "555-0102",
            "role": "walker"
        }
        success, response = self.run_test(
            "Walker Registration", "POST", "auth/register", 200,
            data=walker_data, description="Register new walker user"
        )
        if success:
            self.tokens['walker'] = response.get('access_token')
            self.users['walker'] = response.get('user')

        # Test admin registration
        admin_data = {
            "username": f"testadmin_{timestamp}",
            "email": f"admin_{timestamp}@test.com",
            "password": "TestPass123!",
            "full_name": "Test Admin",
            "phone": "555-0103",
            "role": "admin"
        }
        success, response = self.run_test(
            "Admin Registration", "POST", "auth/register", 200,
            data=admin_data, description="Register new admin user"
        )
        if success:
            self.tokens['admin'] = response.get('access_token')
            self.users['admin'] = response.get('user')

    def test_user_login(self):
        """Test user login"""
        if not self.users.get('client'):
            print("⚠️  Skipping login test - no registered users")
            return

        # Test client login
        login_data = {
            "username": self.users['client']['username'],
            "password": "TestPass123!"
        }
        success, response = self.run_test(
            "Client Login", "POST", "auth/login", 200,
            data=login_data, description="Login with client credentials"
        )

    def test_auth_me(self):
        """Test getting current user info"""
        if self.tokens.get('client'):
            self.run_test(
                "Get Current User", "GET", "auth/me", 200,
                token=self.tokens['client'], description="Get authenticated user info"
            )

    def test_pet_management(self):
        """Test pet CRUD operations"""
        if not self.tokens.get('client'):
            print("⚠️  Skipping pet tests - no client token")
            return

        # Create pet
        pet_data = {
            "name": "Buddy",
            "species": "dog",
            "breed": "Golden Retriever",
            "age": 3,
            "weight": 65.5,
            "notes": "Very friendly, loves treats"
        }
        success, response = self.run_test(
            "Create Pet", "POST", "pets", 200,
            data=pet_data, token=self.tokens['client'],
            description="Create a new pet for client"
        )
        if success:
            self.pets['buddy'] = response

        # Get pets
        self.run_test(
            "Get Pets", "GET", "pets", 200,
            token=self.tokens['client'], description="Get client's pets"
        )

        # Get specific pet
        if self.pets.get('buddy'):
            pet_id = self.pets['buddy']['id']
            self.run_test(
                "Get Pet by ID", "GET", f"pets/{pet_id}", 200,
                description=f"Get pet details for {pet_id}"
            )

    def test_services(self):
        """Test service pricing endpoints"""
        self.run_test(
            "Get Services", "GET", "services", 200,
            description="Get available service pricing"
        )

    def test_appointments(self):
        """Test appointment management"""
        if not self.tokens.get('client') or not self.pets.get('buddy'):
            print("⚠️  Skipping appointment tests - missing client token or pet")
            return

        # Create appointment
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        appt_data = {
            "pet_ids": [self.pets['buddy']['id']],
            "service_type": "walk_30",
            "scheduled_date": tomorrow,
            "scheduled_time": "10:00",
            "notes": "First walk for Buddy"
        }
        success, response = self.run_test(
            "Create Appointment", "POST", "appointments", 200,
            data=appt_data, token=self.tokens['client'],
            description="Book a 30-minute walk"
        )
        if success:
            self.appointments['walk'] = response

        # Get appointments
        self.run_test(
            "Get Appointments", "GET", "appointments", 200,
            token=self.tokens['client'], description="Get client appointments"
        )

        # Get calendar appointments
        self.run_test(
            "Get Calendar", "GET", "appointments/calendar", 200,
            token=self.tokens['client'], description="Get calendar view"
        )

    def test_walker_functionality(self):
        """Test walker-specific features"""
        if not self.tokens.get('walker'):
            print("⚠️  Skipping walker tests - no walker token")
            return

        # Get walker appointments
        self.run_test(
            "Walker Appointments", "GET", "appointments", 200,
            token=self.tokens['walker'], description="Get walker's assigned appointments"
        )

        # Test start/end walk (if appointment exists)
        if self.appointments.get('walk'):
            appt_id = self.appointments['walk']['id']
            
            # Start walk
            success, response = self.run_test(
                "Start Walk", "POST", f"appointments/{appt_id}/start", 200,
                token=self.tokens['walker'], description="Start a walk timer"
            )
            
            if success:
                # End walk
                self.run_test(
                    "End Walk", "POST", f"appointments/{appt_id}/end", 200,
                    token=self.tokens['walker'], description="End walk and record duration"
                )

    def test_admin_functionality(self):
        """Test admin-specific features"""
        if not self.tokens.get('admin'):
            print("⚠️  Skipping admin tests - no admin token")
            return

        # Get users
        self.run_test(
            "Get Walkers", "GET", "users/walkers", 200,
            token=self.tokens['admin'], description="Get all walkers"
        )

        self.run_test(
            "Get Clients", "GET", "users/clients", 200,
            token=self.tokens['admin'], description="Get all clients"
        )

    def test_dashboard_stats(self):
        """Test dashboard statistics for all roles"""
        for role in ['client', 'walker', 'admin']:
            if self.tokens.get(role):
                self.run_test(
                    f"{role.title()} Dashboard Stats", "GET", "dashboard/stats", 200,
                    token=self.tokens[role], description=f"Get {role} dashboard statistics"
                )

    def test_messages(self):
        """Test messaging functionality"""
        if not self.tokens.get('client') or not self.tokens.get('walker'):
            print("⚠️  Skipping message tests - missing tokens")
            return

        # Send message from client to walker
        if self.users.get('walker'):
            msg_data = {
                "receiver_id": self.users['walker']['id'],
                "content": "Hi! Looking forward to the walk with Buddy.",
                "is_group_message": False
            }
            self.run_test(
                "Send Message", "POST", "messages", 200,
                data=msg_data, token=self.tokens['client'],
                description="Send direct message from client to walker"
            )

        # Get messages
        self.run_test(
            "Get Messages", "GET", "messages", 200,
            token=self.tokens['client'], description="Get client messages"
        )

        # Get conversations
        self.run_test(
            "Get Conversations", "GET", "messages/conversations", 200,
            token=self.tokens['client'], description="Get conversation list"
        )

    def test_invoices(self):
        """Test invoice functionality"""
        if not self.tokens.get('client'):
            print("⚠️  Skipping invoice tests - no client token")
            return

        # Get invoices
        self.run_test(
            "Get Invoices", "GET", "invoices", 200,
            token=self.tokens['client'], description="Get client invoices"
        )

    def test_chat_contacts_endpoint(self):
        """Test chat contacts endpoint with different filters"""
        print("\n🔍 Testing Chat Contacts Endpoint...")
        
        # Test as walker - should support all, clients, team filters
        if self.tokens.get('walker'):
            # Test all contacts
            self.run_test(
                "Walker - All Contacts", "GET", "messages/contacts?contact_type=all", 200,
                token=self.tokens['walker'], description="Walker getting all contacts"
            )
            
            # Test clients filter (My Clients)
            self.run_test(
                "Walker - My Clients", "GET", "messages/contacts?contact_type=clients", 200,
                token=self.tokens['walker'], description="Walker getting client contacts"
            )
            
            # Test team filter
            self.run_test(
                "Walker - Team", "GET", "messages/contacts?contact_type=team", 200,
                token=self.tokens['walker'], description="Walker getting team contacts"
            )
        
        # Test as admin - should support all, clients, team filters
        if self.tokens.get('admin'):
            # Test all contacts
            self.run_test(
                "Admin - All Contacts", "GET", "messages/contacts?contact_type=all", 200,
                token=self.tokens['admin'], description="Admin getting all contacts"
            )
            
            # Test clients filter
            self.run_test(
                "Admin - Clients", "GET", "messages/contacts?contact_type=clients", 200,
                token=self.tokens['admin'], description="Admin getting client contacts"
            )
            
            # Test team filter
            self.run_test(
                "Admin - Team", "GET", "messages/contacts?contact_type=team", 200,
                token=self.tokens['admin'], description="Admin getting team contacts"
            )
        
        # Test as client - should only see assigned walker and admins
        if self.tokens.get('client'):
            self.run_test(
                "Client - Contacts", "GET", "messages/contacts", 200,
                token=self.tokens['client'], description="Client getting available contacts"
            )

    def test_appointment_detail_endpoint(self):
        """Test appointment detail endpoint"""
        print("\n🔍 Testing Appointment Detail Endpoint...")
        
        if not self.appointments.get('walk'):
            print("⚠️  Skipping appointment detail test - no appointment created")
            return
            
        appt_id = self.appointments['walk']['id']
        
        # Test getting appointment detail
        success, response = self.run_test(
            "Appointment Detail", "GET", f"appointments/{appt_id}/detail", 200,
            token=self.tokens['client'], description="Get detailed appointment info with client, walker, service, pets"
        )
        
        if success:
            # Verify response contains expected fields
            required_fields = ['client', 'service', 'pets']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"⚠️  Missing fields in appointment detail: {missing_fields}")
            else:
                print("✅ Appointment detail contains all required fields")

    def test_invoice_detail_endpoint(self):
        """Test invoice detail endpoint"""
        print("\n🔍 Testing Invoice Detail Endpoint...")
        
        if not self.tokens.get('admin'):
            print("⚠️  Skipping invoice detail test - no admin token")
            return
        
        # First, get open invoices to find an invoice ID
        success, invoices = self.run_test(
            "Get Open Invoices", "GET", "invoices/open", 200,
            token=self.tokens['admin'], description="Get open invoices for testing"
        )
        
        if success and invoices:
            invoice_id = invoices[0]['id']
            
            # Test getting invoice detail
            success, response = self.run_test(
                "Invoice Detail", "GET", f"invoices/{invoice_id}/detail", 200,
                token=self.tokens['admin'], description="Get detailed invoice with client, appointments, company info"
            )
            
            if success:
                # Verify response contains expected fields
                required_fields = ['client', 'appointments', 'company_info']
                missing_fields = [field for field in required_fields if field not in response]
                if missing_fields:
                    print(f"⚠️  Missing fields in invoice detail: {missing_fields}")
                else:
                    print("✅ Invoice detail contains all required fields")
        else:
            print("⚠️  No invoices available for detail testing")

    def test_company_info_endpoints(self):
        """Test company info settings endpoints"""
        print("\n🔍 Testing Company Info Endpoints...")
        
        if not self.tokens.get('admin'):
            print("⚠️  Skipping company info tests - no admin token")
            return
        
        # Test GET company info
        success, company_info = self.run_test(
            "Get Company Info", "GET", "settings/company-info", 200,
            token=self.tokens['admin'], description="Get company branding information"
        )
        
        # Test PUT company info
        test_company_data = {
            "company_name": "WagWalk Pet Services Test",
            "address": "123 Test Street, Test City, TC 12345",
            "phone": "555-TEST-123",
            "email": "test@wagwalk.com",
            "logo_url": "https://example.com/logo.png",
            "tax_id": "12-3456789",
            "website": "https://wagwalk.com"
        }
        
        self.run_test(
            "Update Company Info", "PUT", "settings/company-info", 200,
            data=test_company_data, token=self.tokens['admin'],
            description="Update company branding information (admin only)"
        )
        
        # Verify the update worked
        success, updated_info = self.run_test(
            "Verify Company Info Update", "GET", "settings/company-info", 200,
            token=self.tokens['admin'], description="Verify company info was updated"
        )
        
        if success and updated_info.get('company_name') == test_company_data['company_name']:
            print("✅ Company info update verified")
        else:
            print("⚠️  Company info update verification failed")

    def test_notification_config_endpoint(self):
        """Test notification configuration endpoint"""
        print("\n🔍 Testing Notification Config Endpoint...")
        
        if not self.tokens.get('admin'):
            print("⚠️  Skipping notification config test - no admin token")
            return
        
        success, config = self.run_test(
            "Notification Config", "GET", "settings/notification-config", 200,
            token=self.tokens['admin'], description="Get SendGrid/Twilio configuration status"
        )
        
        if success:
            # Verify expected fields are present
            expected_fields = ['sendgrid_configured', 'twilio_configured']
            missing_fields = [field for field in expected_fields if field not in config]
            if missing_fields:
                print(f"⚠️  Missing fields in notification config: {missing_fields}")
            else:
                print("✅ Notification config contains all required fields")
                print(f"   SendGrid configured: {config.get('sendgrid_configured', False)}")
                print(f"   Twilio configured: {config.get('twilio_configured', False)}")

    def test_send_invoice_email_sms(self):
        """Test send invoice email/SMS endpoints (should return errors since not configured)"""
        print("\n🔍 Testing Send Invoice Email/SMS Endpoints...")
        
        if not self.tokens.get('admin'):
            print("⚠️  Skipping send invoice tests - no admin token")
            return
        
        # First, get an invoice ID
        success, invoices = self.run_test(
            "Get Invoices for Email/SMS Test", "GET", "invoices/open", 200,
            token=self.tokens['admin'], description="Get invoices for email/SMS testing"
        )
        
        if success and invoices:
            invoice_id = invoices[0]['id']
            
            # Test send email (should fail since SendGrid not configured)
            self.run_test(
                "Send Invoice Email", "POST", f"invoices/{invoice_id}/send-email", 400,
                token=self.tokens['admin'], description="Send invoice email (should fail - SendGrid not configured)"
            )
            
            # Test send SMS (should fail since Twilio not configured)
            self.run_test(
                "Send Invoice SMS", "POST", f"invoices/{invoice_id}/send-sms", 400,
                token=self.tokens['admin'], description="Send invoice SMS (should fail - Twilio not configured)"
            )
        else:
            print("⚠️  No invoices available for email/SMS testing")

    def test_demo_user_login(self):
        """Test login with demo credentials"""
        print("\n🔍 Testing Demo User Login...")
        
        # Test demo admin login
        admin_login = {
            "username": "demo_admin",
            "password": "demo123"
        }
        success, response = self.run_test(
            "Demo Admin Login", "POST", "auth/login", 200,
            data=admin_login, description="Login with demo admin credentials"
        )
        if success:
            self.tokens['demo_admin'] = response.get('access_token')
            self.users['demo_admin'] = response.get('user')
        
        # Test demo walker login
        walker_login = {
            "username": "demo_walker",
            "password": "demo123"
        }
        success, response = self.run_test(
            "Demo Walker Login", "POST", "auth/login", 200,
            data=walker_login, description="Login with demo walker credentials"
        )
        if success:
            self.tokens['demo_walker'] = response.get('access_token')
            self.users['demo_walker'] = response.get('user')
        
        # Test demo client login
        client_login = {
            "username": "demo_client",
            "password": "demo123"
        }
        success, response = self.run_test(
            "Demo Client Login", "POST", "auth/login", 200,
            data=client_login, description="Login with demo client credentials"
        )
        if success:
            self.tokens['demo_client'] = response.get('access_token')
            self.users['demo_client'] = response.get('user')

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        # Test without token
        self.run_test(
            "Unauthorized Access", "GET", "auth/me", 401,
            description="Access protected endpoint without token"
        )

        # Test client accessing admin endpoint
        if self.tokens.get('client'):
            self.run_test(
                "Client Admin Access", "GET", "users/clients", 403,
                token=self.tokens['client'], description="Client trying to access admin endpoint"
            )

def main():
    print("🐕 Starting WagWalk API Tests...")
    print("=" * 50)
    
    tester = WagWalkAPITester()
    
    # Run all tests
    try:
        tester.test_root_endpoint()
        
        # Test demo user login first
        tester.test_demo_user_login()
        
        # Original tests
        tester.test_user_registration()
        tester.test_user_login()
        tester.test_auth_me()
        tester.test_services()
        tester.test_pet_management()
        tester.test_appointments()
        tester.test_walker_functionality()
        tester.test_admin_functionality()
        tester.test_dashboard_stats()
        tester.test_messages()
        tester.test_invoices()
        
        # NEW FEATURE TESTS
        print("\n" + "=" * 50)
        print("🆕 TESTING NEW FEATURES")
        print("=" * 50)
        
        tester.test_chat_contacts_endpoint()
        tester.test_appointment_detail_endpoint()
        tester.test_invoice_detail_endpoint()
        tester.test_company_info_endpoints()
        tester.test_notification_config_endpoint()
        tester.test_send_invoice_email_sms()
        
        # Security tests
        tester.test_unauthorized_access()
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")

    # Print results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {len(tester.failed_tests)}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for test in tester.failed_tests:
            error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
            print(f"  • {test['test']}: {error_msg}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())