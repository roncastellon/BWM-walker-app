import requests
import sys
import json
import io
from datetime import datetime, timedelta

class WagWalkAPITester:
    def __init__(self, base_url="https://wagmate-app.preview.emergentagent.com"):
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

    def test_client_profile_update(self):
        """Test client profile update functionality"""
        print("\n🔍 Testing Client Profile Update...")
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping profile update test - no demo client token")
            return
        
        user_id = self.users['demo_client']['id']
        
        # Test profile update with new data
        update_data = {
            "full_name": "Sarah Johnson Updated",
            "phone": "555-0199",
            "address": "456 Oak Street, Springfield, IL 62701",
            "email": "sarah.updated@example.com",
            "bio": "Dog lover and outdoor enthusiast. Looking forward to professional pet care services."
        }
        
        success, response = self.run_test(
            "Update Client Profile", "PUT", f"users/{user_id}", 200,
            data=update_data, token=self.tokens['demo_client'],
            description="Update client profile with new personal information"
        )
        
        if success:
            # Verify the response contains updated data
            if response.get('full_name') == update_data['full_name']:
                print("✅ Profile update verified - full_name updated correctly")
            else:
                print("⚠️  Profile update verification failed - full_name not updated")
            
            if response.get('address') == update_data['address']:
                print("✅ Profile update verified - address updated correctly")
            else:
                print("⚠️  Profile update verification failed - address not updated")

    def test_profile_image_upload(self):
        """Test profile image upload functionality"""
        print("\n🔍 Testing Profile Image Upload...")
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping profile image upload test - no demo client token")
            return
        
        # Create a test image file (1x1 pixel PNG)
        test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x12IDATx\x9cc```bPPP\x00\x02\xac\xea\x05\x1b\x00\x00\x00\x00IEND\xaeB`\x82'
        
        url = f"{self.base_url}/api/upload/profile"
        headers = {'Authorization': f'Bearer {self.tokens["demo_client"]}'}
        
        files = {'file': ('test_profile.png', io.BytesIO(test_image_data), 'image/png')}
        
        self.tests_run += 1
        print(f"\n🔍 Testing Profile Image Upload...")
        print(f"   Upload profile image for demo client")
        
        try:
            response = requests.post(url, files=files, headers=headers, timeout=30)
            
            success = response.status_code == 200
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result = response.json()
                    if 'url' in result:
                        print(f"✅ Image URL returned: {result['url']}")
                        return True, result
                    else:
                        print("⚠️  No URL in response")
                        return False, {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": "Profile Image Upload",
                    "expected": 200,
                    "actual": response.status_code,
                    "endpoint": "upload/profile"
                })
                return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "Profile Image Upload",
                "error": str(e),
                "endpoint": "upload/profile"
            })
            return False, {}

    def test_pet_update(self):
        """Test pet update functionality"""
        print("\n🔍 Testing Pet Update...")
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping pet update test - no demo client token")
            return
        
        # First get the list of pets to find a pet ID
        success, pets_response = self.run_test(
            "Get Client Pets for Update", "GET", "pets", 200,
            token=self.tokens['demo_client'], description="Get client's pets to find one to update"
        )
        
        if not success or not pets_response:
            print("⚠️  No pets found for update test")
            return
        
        pet_id = pets_response[0]['id']
        
        # Test pet update with new data
        update_data = {
            "name": "Buddy Updated",
            "breed": "Golden Retriever Mix",
            "age": 4,
            "weight": 68.5,
            "notes": "Very friendly dog, loves treats and belly rubs. Updated information."
        }
        
        success, response = self.run_test(
            "Update Pet", "PUT", f"pets/{pet_id}", 200,
            data=update_data, token=self.tokens['demo_client'],
            description="Update pet with new information"
        )
        
        if success:
            # Verify the response contains updated data
            if response.get('name') == update_data['name']:
                print("✅ Pet update verified - name updated correctly")
            else:
                print("⚠️  Pet update verification failed - name not updated")
            
            if response.get('weight') == update_data['weight']:
                print("✅ Pet update verified - weight updated correctly")
            else:
                print("⚠️  Pet update verification failed - weight not updated")
            
            # Store the pet ID for image upload test
            self.pets['updated_pet_id'] = pet_id

    def test_pet_image_upload(self):
        """Test pet image upload functionality"""
        print("\n🔍 Testing Pet Image Upload...")
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping pet image upload test - no demo client token")
            return
        
        # Use the pet ID from the update test, or get pets if not available
        pet_id = self.pets.get('updated_pet_id')
        if not pet_id:
            # Get pets to find a pet ID
            success, pets_response = self.run_test(
                "Get Pets for Image Upload", "GET", "pets", 200,
                token=self.tokens['demo_client'], description="Get pets to find one for image upload"
            )
            if success and pets_response:
                pet_id = pets_response[0]['id']
            else:
                print("⚠️  No pets found for image upload test")
                return
        
        # Create a test image file (1x1 pixel PNG)
        test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x12IDATx\x9cc```bPPP\x00\x02\xac\xea\x05\x1b\x00\x00\x00\x00IEND\xaeB`\x82'
        
        url = f"{self.base_url}/api/upload/pet/{pet_id}"
        headers = {'Authorization': f'Bearer {self.tokens["demo_client"]}'}
        
        files = {'file': ('test_pet.png', io.BytesIO(test_image_data), 'image/png')}
        
        self.tests_run += 1
        print(f"\n🔍 Testing Pet Image Upload...")
        print(f"   Upload image for pet {pet_id}")
        
        try:
            response = requests.post(url, files=files, headers=headers, timeout=30)
            
            success = response.status_code == 200
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result = response.json()
                    if 'url' in result:
                        print(f"✅ Pet image URL returned: {result['url']}")
                        self.pets['uploaded_image_url'] = result['url']
                        return True, result
                    else:
                        print("⚠️  No URL in response")
                        return False, {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": "Pet Image Upload",
                    "expected": 200,
                    "actual": response.status_code,
                    "endpoint": f"upload/pet/{pet_id}"
                })
                return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "Pet Image Upload",
                "error": str(e),
                "endpoint": f"upload/pet/{pet_id}"
            })
            return False, {}

    def test_serve_uploaded_images(self):
        """Test serving uploaded images"""
        print("\n🔍 Testing Serve Uploaded Images...")
        
        # Test serving a profile image (we'll test with a known filename pattern)
        # Since we uploaded images, let's try to access them
        
        # Test profile image endpoint (even if file doesn't exist, should return 404 not 500)
        success, response = self.run_test(
            "Serve Profile Image", "GET", "uploads/profiles/test_profile.png", 404,
            description="Test profile image serving endpoint (expecting 404 for non-existent file)"
        )
        
        # Test pet image endpoint (even if file doesn't exist, should return 404 not 500)
        success, response = self.run_test(
            "Serve Pet Image", "GET", "uploads/pets/test_pet.png", 404,
            description="Test pet image serving endpoint (expecting 404 for non-existent file)"
        )
        
        # If we have an uploaded image URL, test accessing it
        if self.pets.get('uploaded_image_url'):
            # Extract filename from URL
            image_url = self.pets['uploaded_image_url']
            if '/api/uploads/pets/' in image_url:
                filename = image_url.split('/api/uploads/pets/')[-1]
                success, response = self.run_test(
                    "Serve Uploaded Pet Image", "GET", f"uploads/pets/{filename}", 200,
                    description="Test accessing uploaded pet image"
                )

    def test_appointment_time_slot_limits(self):
        """Test appointment creation with time slot limits (max 3 per slot)"""
        print("\n🔍 Testing Appointment Time Slot Limits...")
        
        if not self.tokens.get('demo_client') or not self.pets.get('buddy'):
            print("⚠️  Skipping time slot limit test - missing demo client token or pet")
            return
        
        # Use tomorrow's date for testing
        test_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        test_time = "14:00"  # 2 PM
        
        # Create 3 appointments at the same time slot (should succeed)
        created_appointments = []
        for i in range(3):
            appt_data = {
                "pet_ids": [self.pets['buddy']['id']],
                "service_type": "walk_30",
                "scheduled_date": test_date,
                "scheduled_time": test_time,
                "notes": f"Test appointment {i+1} for time slot limit"
            }
            success, response = self.run_test(
                f"Create Appointment {i+1}/3", "POST", "appointments", 200,
                data=appt_data, token=self.tokens['demo_client'],
                description=f"Create appointment {i+1} at {test_time} (should succeed)"
            )
            if success:
                created_appointments.append(response['id'])
        
        # Try to create a 4th appointment at the same time slot (should fail)
        appt_data = {
            "pet_ids": [self.pets['buddy']['id']],
            "service_type": "walk_30",
            "scheduled_date": test_date,
            "scheduled_time": test_time,
            "notes": "4th appointment - should fail due to time slot limit"
        }
        success, response = self.run_test(
            "Create 4th Appointment (Should Fail)", "POST", "appointments", 400,
            data=appt_data, token=self.tokens['demo_client'],
            description="Try to create 4th appointment at same time slot (should fail with 'time slot is full' error)"
        )
        
        # Store created appointments for cleanup
        self.appointments['time_slot_test'] = created_appointments

    def test_appointment_walker_conflicts(self):
        """Test appointment creation with walker conflicts (1 walker per slot)"""
        print("\n🔍 Testing Appointment Walker Conflicts...")
        
        if not self.tokens.get('demo_admin') or not self.pets.get('buddy'):
            print("⚠️  Skipping walker conflict test - missing demo admin token or pet")
            return
        
        # Get available walkers
        success, walkers = self.run_test(
            "Get Walkers for Conflict Test", "GET", "users/walkers", 200,
            token=self.tokens['demo_admin'], description="Get available walkers"
        )
        
        if not success or not walkers:
            print("⚠️  No walkers available for conflict test")
            return
        
        walker_id = walkers[0]['id']
        test_date = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        test_time = "15:00"  # 3 PM
        
        # Create first appointment with walker assigned
        appt_data = {
            "client_id": self.users['demo_client']['id'],
            "pet_ids": [self.pets['buddy']['id']],
            "service_type": "walk_30",
            "scheduled_date": test_date,
            "scheduled_time": test_time,
            "walker_id": walker_id,
            "notes": "First appointment with walker assigned"
        }
        success, response = self.run_test(
            "Create Appointment with Walker", "POST", "appointments/admin", 200,
            data=appt_data, token=self.tokens['demo_admin'],
            description="Create appointment with walker assigned (should succeed)"
        )
        
        if success:
            first_appt_id = response['id']
            
            # Try to create second appointment with same walker at same time (should fail)
            appt_data2 = {
                "client_id": self.users['demo_client']['id'],
                "pet_ids": [self.pets['buddy']['id']],
                "service_type": "walk_60",
                "scheduled_date": test_date,
                "scheduled_time": test_time,
                "walker_id": walker_id,
                "notes": "Second appointment - should fail due to walker conflict"
            }
            success, response = self.run_test(
                "Create Conflicting Appointment (Should Fail)", "POST", "appointments/admin", 400,
                data=appt_data2, token=self.tokens['demo_admin'],
                description="Try to assign same walker to same time slot (should fail with 'walker already booked' error)"
            )
            
            # Store for cleanup
            self.appointments['walker_conflict_test'] = first_appt_id

    def test_admin_create_appointment(self):
        """Test admin creating appointments for clients"""
        print("\n🔍 Testing Admin Create Appointment...")
        
        if not self.tokens.get('demo_admin') or not self.pets.get('buddy'):
            print("⚠️  Skipping admin create appointment test - missing demo admin token or pet")
            return
        
        # Get available walkers
        success, walkers = self.run_test(
            "Get Walkers for Admin Test", "GET", "users/walkers", 200,
            token=self.tokens['demo_admin'], description="Get available walkers"
        )
        
        if not success or not walkers:
            print("⚠️  No walkers available for admin appointment test")
            return
        
        walker_id = walkers[0]['id']
        test_date = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')
        test_time = "16:00"  # 4 PM
        
        # Admin creates appointment for client
        appt_data = {
            "client_id": self.users['demo_client']['id'],
            "pet_ids": [self.pets['buddy']['id']],
            "service_type": "walk_60",
            "scheduled_date": test_date,
            "scheduled_time": test_time,
            "walker_id": walker_id,
            "notes": "Admin-created appointment for client"
        }
        success, response = self.run_test(
            "Admin Create Appointment", "POST", "appointments/admin", 200,
            data=appt_data, token=self.tokens['demo_admin'],
            description="Admin creates appointment for client with walker assigned"
        )
        
        if success:
            # Verify the appointment was created with correct client_id
            if response.get('client_id') == self.users['demo_client']['id']:
                print("✅ Admin appointment creation verified - correct client_id")
            else:
                print("⚠️  Admin appointment creation failed - incorrect client_id")
            
            self.appointments['admin_created'] = response['id']

    def test_admin_update_appointment(self):
        """Test admin updating appointments"""
        print("\n🔍 Testing Admin Update Appointment...")
        
        if not self.tokens.get('demo_admin'):
            print("⚠️  Skipping admin update appointment test - missing demo admin token")
            return
        
        # Use the admin-created appointment if available
        appt_id = self.appointments.get('admin_created')
        if not appt_id:
            print("⚠️  No appointment available for admin update test")
            return
        
        # Get available walkers for reassignment
        success, walkers = self.run_test(
            "Get Walkers for Update Test", "GET", "users/walkers", 200,
            token=self.tokens['demo_admin'], description="Get available walkers for reassignment"
        )
        
        if not success or len(walkers) < 2:
            print("⚠️  Need at least 2 walkers for update test")
            return
        
        new_walker_id = walkers[1]['id']  # Use second walker
        new_date = (datetime.now() + timedelta(days=4)).strftime('%Y-%m-%d')
        new_time = "17:00"  # 5 PM
        
        # Update appointment details
        update_data = {
            "walker_id": new_walker_id,
            "scheduled_date": new_date,
            "scheduled_time": new_time,
            "status": "scheduled",
            "notes": "Updated by admin - new walker and time"
        }
        success, response = self.run_test(
            "Admin Update Appointment", "PUT", f"appointments/{appt_id}", 200,
            data=update_data, token=self.tokens['demo_admin'],
            description="Admin updates appointment walker, time, and notes"
        )
        
        if success:
            # Verify the updates
            if response.get('walker_id') == new_walker_id:
                print("✅ Appointment update verified - walker_id updated correctly")
            else:
                print("⚠️  Appointment update failed - walker_id not updated")
            
            if response.get('scheduled_time') == new_time:
                print("✅ Appointment update verified - scheduled_time updated correctly")
            else:
                print("⚠️  Appointment update failed - scheduled_time not updated")

    def test_available_slots_endpoint(self):
        """Test available time slots endpoint"""
        print("\n🔍 Testing Available Slots Endpoint...")
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping available slots test - missing demo client token")
            return
        
        # Test getting available slots for a future date
        test_date = "2026-01-02"  # Use the date from the review request
        
        success, response = self.run_test(
            "Get Available Slots", "GET", f"appointments/available-slots?date={test_date}", 200,
            token=self.tokens['demo_client'],
            description=f"Get available time slots and walker availability for {test_date}"
        )
        
        if success:
            # Verify response structure
            if 'date' in response and 'slots' in response:
                print("✅ Available slots response has correct structure")
                
                # Check if slots have required fields
                slots = response.get('slots', [])
                if slots:
                    first_slot = slots[0]
                    required_fields = ['time', 'booked_count', 'is_full', 'available_walkers']
                    missing_fields = [field for field in required_fields if field not in first_slot]
                    if missing_fields:
                        print(f"⚠️  Missing fields in slot data: {missing_fields}")
                    else:
                        print("✅ Slot data contains all required fields")
                        print(f"   Example slot: {first_slot['time']} - Booked: {first_slot['booked_count']}, Available walkers: {len(first_slot['available_walkers'])}")
                else:
                    print("⚠️  No slots returned in response")
            else:
                print("⚠️  Available slots response missing required fields")

    def test_services_list_pet_sitting(self):
        """Test services list includes pet sitting service"""
        print("\n🔍 Testing Services List for Pet Sitting...")
        
        success, response = self.run_test(
            "Get Services List", "GET", "services", 200,
            description="Get services list and verify pet sitting service is included"
        )
        
        if success:
            services = response if isinstance(response, list) else []
            
            # Look for pet sitting service at our location (boarding)
            pet_sitting_service = None
            for service in services:
                if service.get('service_type') == 'petsit_our_location':
                    pet_sitting_service = service
                    break
            
            if pet_sitting_service:
                print("✅ Pet Sitting - Our Location (Boarding) service found")
                
                # Verify price is $50.00
                if pet_sitting_service.get('price') == 50.00:
                    print("✅ Pet sitting service price verified - $50.00")
                else:
                    print(f"⚠️  Pet sitting service price incorrect - Expected $50.00, got ${pet_sitting_service.get('price', 'N/A')}")
                
                # Verify name contains expected text
                service_name = pet_sitting_service.get('name', '')
                if 'Pet Sitting - Our Location' in service_name and 'Boarding' in service_name:
                    print("✅ Pet sitting service name verified")
                else:
                    print(f"⚠️  Pet sitting service name unexpected: {service_name}")
            else:
                print("❌ Pet Sitting - Our Location (Boarding) service not found in services list")
                print("   Available services:")
                for service in services:
                    print(f"   - {service.get('name', 'Unknown')} ({service.get('service_type', 'Unknown')}): ${service.get('price', 'N/A')}")

    def test_appointment_scheduling_functionality(self):
        """Test all appointment/scheduling functionality requested in review"""
        print("\n" + "=" * 70)
        print("🗓️  TESTING APPOINTMENT/SCHEDULING FUNCTIONALITY")
        print("=" * 70)
        
        # Run all appointment scheduling tests
        self.test_appointment_time_slot_limits()
        self.test_appointment_walker_conflicts()
        self.test_admin_create_appointment()
        self.test_admin_update_appointment()
        self.test_available_slots_endpoint()
        self.test_services_list_pet_sitting()

    def test_client_appointment_edit_cancel(self):
        """Test client appointment edit and cancel functionality"""
        print("\n🔍 Testing Client Appointment Edit/Cancel...")
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping client appointment edit/cancel test - no demo client token")
            return
        
        # First create an appointment to edit/cancel
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        appt_data = {
            "pet_ids": [self.pets.get('buddy', {}).get('id', 'test-pet-id')],
            "service_type": "walk_30",
            "scheduled_date": tomorrow,
            "scheduled_time": "11:00",
            "notes": "Test appointment for edit/cancel"
        }
        
        success, response = self.run_test(
            "Create Appointment for Edit Test", "POST", "appointments", 200,
            data=appt_data, token=self.tokens['demo_client'],
            description="Create appointment to test edit/cancel functionality"
        )
        
        if not success:
            print("⚠️  Could not create appointment for edit/cancel test")
            return
        
        appt_id = response['id']
        
        # Test client edit appointment
        edit_data = {
            "scheduled_date": tomorrow,
            "scheduled_time": "12:00",
            "notes": "Updated appointment time and notes"
        }
        
        success, edit_response = self.run_test(
            "Client Edit Appointment", "PUT", f"appointments/{appt_id}/client-edit", 200,
            data=edit_data, token=self.tokens['demo_client'],
            description="Client edits appointment date, time, and notes"
        )
        
        if success:
            print("✅ Client appointment edit successful")
        
        # Test client cancel appointment
        success, cancel_response = self.run_test(
            "Client Cancel Appointment", "POST", f"appointments/{appt_id}/client-cancel", 200,
            token=self.tokens['demo_client'],
            description="Client cancels appointment (no charge)"
        )
        
        if success:
            print("✅ Client appointment cancel successful")

    def test_walker_trade_requests(self):
        """Test walker trade request functionality"""
        print("\n🔍 Testing Walker Trade Requests...")
        
        if not self.tokens.get('demo_walker'):
            print("⚠️  Skipping walker trade test - no demo walker token")
            return
        
        # Get walkers to find target walker
        success, walkers = self.run_test(
            "Get Walkers for Trade Test", "GET", "users/walkers", 200,
            token=self.tokens['demo_walker'], description="Get available walkers for trade"
        )
        
        if not success or len(walkers) < 2:
            print("⚠️  Need at least 2 walkers for trade test")
            return
        
        # Find a different walker for trade
        target_walker_id = None
        for walker in walkers:
            if walker['id'] != self.users.get('demo_walker', {}).get('id'):
                target_walker_id = walker['id']
                break
        
        if not target_walker_id:
            print("⚠️  Could not find target walker for trade")
            return
        
        # Get walker's appointments to find one to trade
        success, appointments = self.run_test(
            "Get Walker Appointments", "GET", "appointments", 200,
            token=self.tokens['demo_walker'], description="Get walker appointments for trade"
        )
        
        if not success or not appointments:
            print("⚠️  No appointments available for trade test")
            return
        
        appointment_id = appointments[0]['id']
        
        # Test create trade request
        trade_data = {
            "appointment_id": appointment_id,
            "target_walker_id": target_walker_id
        }
        
        success, trade_response = self.run_test(
            "Create Trade Request", "POST", "trades", 200,
            data=trade_data, token=self.tokens['demo_walker'],
            description="Walker creates trade request with target walker"
        )
        
        if success:
            trade_id = trade_response.get('id')
            print("✅ Trade request created successfully")
            
            # Test get trade requests
            success, trades = self.run_test(
                "Get Trade Requests", "GET", "trades", 200,
                token=self.tokens['demo_walker'],
                description="Get pending trade requests"
            )
            
            if success:
                print("✅ Get trade requests successful")
            
            # Test reject trade (as requesting walker)
            if trade_id:
                success, reject_response = self.run_test(
                    "Reject Trade Request", "POST", f"trades/{trade_id}/reject", 200,
                    token=self.tokens['demo_walker'],
                    description="Reject trade request"
                )
                
                if success:
                    print("✅ Trade request rejection successful")

    def test_walker_time_off_requests(self):
        """Test walker time-off request functionality"""
        print("\n🔍 Testing Walker Time-Off Requests...")
        
        if not self.tokens.get('demo_walker'):
            print("⚠️  Skipping time-off test - no demo walker token")
            return
        
        # Test create time-off request
        start_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=9)).strftime('%Y-%m-%d')
        
        time_off_data = {
            "start_date": start_date,
            "end_date": end_date,
            "reason": "Personal vacation time"
        }
        
        success, time_off_response = self.run_test(
            "Create Time-Off Request", "POST", "time-off", 200,
            data=time_off_data, token=self.tokens['demo_walker'],
            description="Walker requests time off with date range and reason"
        )
        
        if success:
            print("✅ Time-off request created successfully")
        
        # Test get time-off requests
        success, time_off_list = self.run_test(
            "Get Time-Off Requests", "GET", "time-off", 200,
            token=self.tokens['demo_walker'],
            description="Get walker's time-off requests"
        )
        
        if success:
            print("✅ Get time-off requests successful")
        
        # Test get appointments needing reassignment (admin endpoint)
        if self.tokens.get('demo_admin'):
            success, flagged_appointments = self.run_test(
                "Get Appointments Needing Reassignment", "GET", "appointments/needs-reassignment", 200,
                token=self.tokens['demo_admin'],
                description="Get appointments flagged for reassignment due to time-off"
            )
            
            if success:
                print("✅ Get flagged appointments successful")

    def test_walker_cancel_appointment(self):
        """Test walker cancel appointment functionality"""
        print("\n🔍 Testing Walker Cancel Appointment...")
        
        if not self.tokens.get('demo_walker'):
            print("⚠️  Skipping walker cancel test - no demo walker token")
            return
        
        # Get walker's appointments
        success, appointments = self.run_test(
            "Get Walker Appointments for Cancel", "GET", "appointments", 200,
            token=self.tokens['demo_walker'], description="Get walker appointments for cancel test"
        )
        
        if not success or not appointments:
            print("⚠️  No appointments available for walker cancel test")
            return
        
        # Find a scheduled appointment
        scheduled_appt = None
        for appt in appointments:
            if appt.get('status') == 'scheduled':
                scheduled_appt = appt
                break
        
        if not scheduled_appt:
            print("⚠️  No scheduled appointments available for cancel test")
            return
        
        appt_id = scheduled_appt['id']
        
        # Test walker cancel with mandatory reason
        cancel_data = {
            "reason": "Emergency - unable to complete walk due to illness"
        }
        
        success, cancel_response = self.run_test(
            "Walker Cancel Appointment", "POST", f"appointments/{appt_id}/walker-cancel", 200,
            data=cancel_data, token=self.tokens['demo_walker'],
            description="Walker cancels appointment with mandatory reason"
        )
        
        if success:
            print("✅ Walker appointment cancellation successful")

    def test_auto_invoice_generation(self):
        """Test auto-invoice generation functionality"""
        print("\n🔍 Testing Auto-Invoice Generation...")
        
        if not self.tokens.get('demo_admin'):
            print("⚠️  Skipping auto-invoice test - no demo admin token")
            return
        
        # Test weekly invoice generation
        success, weekly_response = self.run_test(
            "Generate Weekly Invoices", "POST", "invoices/auto-generate?cycle=weekly", 200,
            token=self.tokens['demo_admin'],
            description="Generate weekly invoices for all clients"
        )
        
        if success:
            print("✅ Weekly invoice generation successful")
        
        # Test monthly invoice generation
        success, monthly_response = self.run_test(
            "Generate Monthly Invoices", "POST", "invoices/auto-generate?cycle=monthly", 200,
            token=self.tokens['demo_admin'],
            description="Generate monthly invoices for all clients"
        )
        
        if success:
            print("✅ Monthly invoice generation successful")
        
        # Test get pending review invoices
        success, pending_invoices = self.run_test(
            "Get Pending Review Invoices", "GET", "invoices/pending-review", 200,
            token=self.tokens['demo_admin'],
            description="Get invoices pending admin review"
        )
        
        if success:
            print("✅ Get pending review invoices successful")
            
            # If there are pending invoices, test approval
            if pending_invoices:
                invoice_id = pending_invoices[0]['id']
                
                success, approve_response = self.run_test(
                    "Approve Invoice Review", "POST", f"invoices/{invoice_id}/approve-review", 200,
                    token=self.tokens['demo_admin'],
                    description="Approve invoice for sending"
                )
                
                if success:
                    print("✅ Invoice approval successful")
        
        # Test mass send invoices
        success, mass_send_response = self.run_test(
            "Mass Send Invoices", "POST", "invoices/mass-send", 200,
            token=self.tokens['demo_admin'],
            description="Send all approved invoices to clients"
        )
        
        if success:
            print("✅ Mass send invoices successful")

    def test_invoice_delivery_preference_setting(self):
        """Test invoice delivery preference setting functionality"""
        print("\n🔍 Testing Invoice Delivery Preference Setting...")
        
        if not self.tokens.get('demo_admin'):
            print("⚠️  Skipping invoice delivery preference test - no demo admin token")
            return
        
        # Test GET company info to check default invoice_delivery_preference
        success, company_info = self.run_test(
            "Get Company Info (Check Default Preference)", "GET", "settings/company-info", 200,
            token=self.tokens['demo_admin'], 
            description="Get company info and check default invoice_delivery_preference is 'both'"
        )
        
        if success:
            # Check if invoice_delivery_preference field exists and has default value "both"
            preference = company_info.get('invoice_delivery_preference')
            if preference == 'both':
                print("✅ Default invoice_delivery_preference verified - 'both'")
            elif preference is None:
                print("⚠️  invoice_delivery_preference field not found in response")
            else:
                print(f"⚠️  Unexpected default invoice_delivery_preference: {preference}")
        
        # Test updating invoice_delivery_preference to "email"
        update_data = {
            "invoice_delivery_preference": "email"
        }
        
        success, response = self.run_test(
            "Update Preference to Email", "PUT", "settings/company-info", 200,
            data=update_data, token=self.tokens['demo_admin'],
            description="Update invoice_delivery_preference to 'email'"
        )
        
        if success:
            print("✅ Invoice delivery preference update to 'email' successful")
        
        # Test updating invoice_delivery_preference to "text"
        update_data = {
            "invoice_delivery_preference": "text"
        }
        
        success, response = self.run_test(
            "Update Preference to Text", "PUT", "settings/company-info", 200,
            data=update_data, token=self.tokens['demo_admin'],
            description="Update invoice_delivery_preference to 'text'"
        )
        
        if success:
            print("✅ Invoice delivery preference update to 'text' successful")
        
        # Test updating invoice_delivery_preference to "both"
        update_data = {
            "invoice_delivery_preference": "both"
        }
        
        success, response = self.run_test(
            "Update Preference to Both", "PUT", "settings/company-info", 200,
            data=update_data, token=self.tokens['demo_admin'],
            description="Update invoice_delivery_preference to 'both'"
        )
        
        if success:
            print("✅ Invoice delivery preference update to 'both' successful")
        
        # Verify the setting persists after update
        success, updated_info = self.run_test(
            "Verify Preference Persistence", "GET", "settings/company-info", 200,
            token=self.tokens['demo_admin'], 
            description="Verify invoice_delivery_preference persists after update"
        )
        
        if success:
            final_preference = updated_info.get('invoice_delivery_preference')
            if final_preference == 'both':
                print("✅ Invoice delivery preference persistence verified - 'both'")
            else:
                print(f"⚠️  Preference persistence failed - Expected 'both', got '{final_preference}'")

    def test_accounts_receivable_aging_report(self):
        """Test accounts receivable aging report endpoint"""
        print("\n🔍 Testing Accounts Receivable Aging Report...")
        
        if not self.tokens.get('demo_admin'):
            print("⚠️  Skipping receivable aging report test - no demo admin token")
            return
        
        # Test GET /api/reports/receivable-aging
        success, response = self.run_test(
            "Get Receivable Aging Report", "GET", "reports/receivable-aging", 200,
            token=self.tokens['demo_admin'],
            description="Get accounts receivable aging report (admin only)"
        )
        
        if success:
            # Verify response structure
            required_fields = ['generated_at', 'grand_total', 'total_invoices', 'buckets']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"⚠️  Missing fields in aging report: {missing_fields}")
            else:
                print("✅ Aging report contains all required fields")
                
                # Verify buckets structure
                buckets = response.get('buckets', {})
                expected_buckets = ['current', 'thirty', 'sixty', 'ninety_plus']
                missing_buckets = [bucket for bucket in expected_buckets if bucket not in buckets]
                
                if missing_buckets:
                    print(f"⚠️  Missing buckets in aging report: {missing_buckets}")
                else:
                    print("✅ All aging buckets present")
                    
                    # Verify bucket structure
                    for bucket_name, bucket_data in buckets.items():
                        bucket_fields = ['label', 'total', 'count', 'invoices']
                        missing_bucket_fields = [field for field in bucket_fields if field not in bucket_data]
                        if missing_bucket_fields:
                            print(f"⚠️  Missing fields in {bucket_name} bucket: {missing_bucket_fields}")
                        else:
                            print(f"✅ {bucket_name} bucket structure correct")
                
                # Display summary
                print(f"   Grand Total: ${response.get('grand_total', 0)}")
                print(f"   Total Invoices: {response.get('total_invoices', 0)}")
                
                # Display bucket summaries
                for bucket_name, bucket_data in buckets.items():
                    label = bucket_data.get('label', bucket_name)
                    total = bucket_data.get('total', 0)
                    count = bucket_data.get('count', 0)
                    print(f"   {label}: ${total} ({count} invoices)")
        
        # Test non-admin access (should fail)
        if self.tokens.get('demo_client'):
            success, response = self.run_test(
                "Non-Admin Access (Should Fail)", "GET", "reports/receivable-aging", 403,
                token=self.tokens['demo_client'],
                description="Test that non-admin users cannot access aging report"
            )
            
            if success:
                print("✅ Non-admin access properly blocked")

    def test_freeze_unfreeze_user_functionality(self):
        """Test freeze/unfreeze user functionality with include_frozen parameter"""
        print("\n🔍 Testing Freeze/Unfreeze User Functionality...")
        
        if not self.tokens.get('demo_admin'):
            print("⚠️  Skipping freeze/unfreeze test - no demo admin token")
            return
        
        # Test 1: Get walkers without include_frozen (should only show active)
        success, active_walkers = self.run_test(
            "Get Active Walkers Only", "GET", "users/walkers", 200,
            token=self.tokens['demo_admin'],
            description="Get walkers without include_frozen parameter (active only)"
        )
        
        if success:
            print(f"✅ Active walkers retrieved: {len(active_walkers)} walkers")
        
        # Test 2: Get walkers with include_frozen=true (should show all including frozen)
        success, all_walkers = self.run_test(
            "Get All Walkers Including Frozen", "GET", "users/walkers?include_frozen=true", 200,
            token=self.tokens['demo_admin'],
            description="Get walkers with include_frozen=true (all walkers)"
        )
        
        if success:
            print(f"✅ All walkers retrieved: {len(all_walkers)} walkers")
            
            # Check if we have more walkers when including frozen
            if len(all_walkers) >= len(active_walkers):
                print("✅ include_frozen=true returns same or more walkers than active-only")
            else:
                print("⚠️  include_frozen=true returned fewer walkers than active-only")
        
        # Test 3: Get clients without include_frozen (should only show active)
        success, active_clients = self.run_test(
            "Get Active Clients Only", "GET", "users/clients", 200,
            token=self.tokens['demo_admin'],
            description="Get clients without include_frozen parameter (active only)"
        )
        
        if success:
            print(f"✅ Active clients retrieved: {len(active_clients)} clients")
        
        # Test 4: Get clients with include_frozen=true (should show all including frozen)
        success, all_clients = self.run_test(
            "Get All Clients Including Frozen", "GET", "users/clients?include_frozen=true", 200,
            token=self.tokens['demo_admin'],
            description="Get clients with include_frozen=true (all clients)"
        )
        
        if success:
            print(f"✅ All clients retrieved: {len(all_clients)} clients")
            
            # Check if we have more clients when including frozen
            if len(all_clients) >= len(active_clients):
                print("✅ include_frozen=true returns same or more clients than active-only")
            else:
                print("⚠️  include_frozen=true returned fewer clients than active-only")
        
        # Test 5: Test freeze/unfreeze functionality if we have users to test with
        if all_walkers:
            # Find a walker that is currently active to test freezing
            active_walker = None
            for walker in all_walkers:
                if walker.get('is_active', True):
                    active_walker = walker
                    break
            
            if active_walker:
                walker_id = active_walker['id']
                walker_name = active_walker.get('full_name', 'Unknown')
                
                # Test freezing the walker
                success, freeze_response = self.run_test(
                    "Freeze Walker", "PUT", f"users/{walker_id}/freeze", 200,
                    token=self.tokens['demo_admin'],
                    description=f"Freeze walker {walker_name}"
                )
                
                if success:
                    print(f"✅ Walker {walker_name} frozen successfully")
                    
                    # Verify frozen walker appears in include_frozen=true but not in active-only
                    success, active_after_freeze = self.run_test(
                        "Verify Frozen Walker Not in Active List", "GET", "users/walkers", 200,
                        token=self.tokens['demo_admin'],
                        description="Verify frozen walker not in active-only list"
                    )
                    
                    success, all_after_freeze = self.run_test(
                        "Verify Frozen Walker in All List", "GET", "users/walkers?include_frozen=true", 200,
                        token=self.tokens['demo_admin'],
                        description="Verify frozen walker appears in include_frozen=true list"
                    )
                    
                    if success:
                        # Check if frozen walker is in all list but not active list
                        frozen_in_all = any(w['id'] == walker_id and not w.get('is_active', True) for w in all_after_freeze)
                        frozen_in_active = any(w['id'] == walker_id for w in active_after_freeze)
                        
                        if frozen_in_all and not frozen_in_active:
                            print("✅ Frozen walker correctly appears only in include_frozen=true list")
                        else:
                            print("⚠️  Frozen walker visibility issue")
                    
                    # Test unfreezing the walker
                    success, unfreeze_response = self.run_test(
                        "Unfreeze Walker", "PUT", f"users/{walker_id}/unfreeze", 200,
                        token=self.tokens['demo_admin'],
                        description=f"Unfreeze walker {walker_name}"
                    )
                    
                    if success:
                        print(f"✅ Walker {walker_name} unfrozen successfully")
                        
                        # Verify unfrozen walker appears in active list again
                        success, active_after_unfreeze = self.run_test(
                            "Verify Unfrozen Walker in Active List", "GET", "users/walkers", 200,
                            token=self.tokens['demo_admin'],
                            description="Verify unfrozen walker appears in active list"
                        )
                        
                        if success:
                            unfrozen_in_active = any(w['id'] == walker_id and w.get('is_active', True) for w in active_after_unfreeze)
                            if unfrozen_in_active:
                                print("✅ Unfrozen walker correctly appears in active list")
                            else:
                                print("⚠️  Unfrozen walker not appearing in active list")

    def test_walker_trade_self_validation_bug_fix(self):
        """Test walker trade self-validation bug fix"""
        print("\n🔍 Testing Walker Trade Self-Validation Bug Fix...")
        
        if not self.tokens.get('demo_walker'):
            print("⚠️  Skipping walker trade self-validation test - no demo walker token")
            return
        
        # Get walker's user ID
        walker_user_id = self.users.get('demo_walker', {}).get('id')
        if not walker_user_id:
            print("⚠️  Could not get walker user ID")
            return
        
        print(f"   Walker ID: {walker_user_id}")
        
        # Get walker's appointments to find a scheduled one
        success, appointments = self.run_test(
            "Get Walker Appointments for Self-Trade Test", "GET", "appointments", 200,
            token=self.tokens['demo_walker'], 
            description="Get walker appointments to find one for self-trade test"
        )
        
        if not success or not appointments:
            print("⚠️  No appointments available for self-trade test")
            return
        
        # Find a scheduled appointment
        scheduled_appt = None
        for appt in appointments:
            if appt.get('status') == 'scheduled':
                scheduled_appt = appt
                break
        
        if not scheduled_appt:
            print("⚠️  No scheduled appointments available for self-trade test")
            return
        
        appointment_id = scheduled_appt['id']
        
        # Test attempting to trade with self (should fail with 400 error)
        trade_data = {
            "appointment_id": appointment_id,
            "target_walker_id": walker_user_id  # Same as requesting walker
        }
        
        success, trade_response = self.run_test(
            "Attempt Self-Trade (Should Fail)", "POST", "trades", 400,
            data=trade_data, token=self.tokens['demo_walker'],
            description="Attempt to trade appointment with self (should fail with validation error)"
        )
        
        if success:
            print("✅ Self-trade validation working - correctly rejected with 400 error")
            # Check if the error message is correct
            if isinstance(trade_response, dict) and 'detail' in trade_response:
                error_message = trade_response['detail']
                if 'cannot trade' in error_message.lower() and 'yourself' in error_message.lower():
                    print("✅ Correct error message returned")
                else:
                    print(f"⚠️  Unexpected error message: {error_message}")
        
        # Test trading with a different walker (should work)
        # Get other walkers
        success, walkers = self.run_test(
            "Get Walkers for Valid Trade Test", "GET", "users/walkers", 200,
            token=self.tokens['demo_walker'], description="Get walkers for valid trade test"
        )
        
        if success and walkers:
            # Find a different walker
            target_walker_id = None
            for walker in walkers:
                if walker['id'] != walker_user_id:
                    target_walker_id = walker['id']
                    break
            
            if target_walker_id:
                # Test valid trade with different walker
                valid_trade_data = {
                    "appointment_id": appointment_id,
                    "target_walker_id": target_walker_id
                }
                
                success, valid_trade_response = self.run_test(
                    "Valid Trade with Different Walker", "POST", "trades", 200,
                    data=valid_trade_data, token=self.tokens['demo_walker'],
                    description="Trade appointment with different walker (should succeed)"
                )
                
                if success:
                    print("✅ Valid trade with different walker successful")
                    # Clean up - reject the trade
                    trade_id = valid_trade_response.get('id')
                    if trade_id:
                        self.run_test(
                            "Cleanup - Reject Trade", "POST", f"trades/{trade_id}/reject", 200,
                            token=self.tokens['demo_walker'],
                            description="Clean up by rejecting the test trade"
                        )

    def test_bowwowmeow_new_features(self):
        """Test the two new BowWowMeow features from the review request"""
        print("\n" + "=" * 70)
        print("🆕 TESTING BOWWOWMEOW NEW FEATURES")
        print("=" * 70)
        
        # Test 1: Accounts Receivable Aging Report
        self.test_accounts_receivable_aging_report()
        
        # Test 2: Freeze/Unfreeze User Functionality Fix
        self.test_freeze_unfreeze_user_functionality()
        
        # Test 3: Walker Trade Self-Validation Bug Fix (already implemented)
        self.test_walker_trade_self_validation_bug_fix()
        print(f"   Using appointment ID: {appointment_id}")
        
        # Test creating trade request with walker's own ID as target (should fail)
        trade_data = {
            "appointment_id": appointment_id,
            "target_walker_id": walker_user_id  # Same as requesting walker
        }
        
        success, response = self.run_test(
            "Create Self-Trade Request (Should Fail)", "POST", "trades", 400,
            data=trade_data, token=self.tokens['demo_walker'],
            description="Attempt to create trade request with walker's own ID as target (should return 400 error)"
        )
        
        if success:
            print("✅ Self-trade validation working - request correctly rejected with 400 status")
            
            # Check if the error message is correct
            if isinstance(response, dict) and 'detail' in response:
                error_message = response['detail']
                if "You cannot trade an appointment with yourself" in error_message:
                    print("✅ Correct error message returned: 'You cannot trade an appointment with yourself'")
                else:
                    print(f"⚠️  Unexpected error message: {error_message}")
            else:
                print("⚠️  No error message found in response")
        else:
            print("❌ Self-trade validation failed - request was not rejected")
        
        # Test trading with a different valid walker (should work)
        # Get other walkers
        success, walkers = self.run_test(
            "Get Other Walkers for Valid Trade Test", "GET", "users/walkers", 200,
            token=self.tokens['demo_walker'], 
            description="Get other walkers for valid trade test"
        )
        
        if success and walkers:
            # Find a different walker
            target_walker_id = None
            for walker in walkers:
                if walker['id'] != walker_user_id:
                    target_walker_id = walker['id']
                    break
            
            if target_walker_id:
                print(f"   Testing valid trade with walker ID: {target_walker_id}")
                
                # Test creating trade request with different walker (should succeed)
                valid_trade_data = {
                    "appointment_id": appointment_id,
                    "target_walker_id": target_walker_id
                }
                
                success, valid_response = self.run_test(
                    "Create Valid Trade Request", "POST", "trades", 200,
                    data=valid_trade_data, token=self.tokens['demo_walker'],
                    description="Create trade request with different valid walker (should succeed)"
                )
                
                if success:
                    print("✅ Valid trade request creation successful")
                    
                    # Clean up - reject the trade request
                    trade_id = valid_response.get('id')
                    if trade_id:
                        self.run_test(
                            "Cleanup - Reject Valid Trade", "POST", f"trades/{trade_id}/reject", 200,
                            token=self.tokens['demo_walker'],
                            description="Clean up by rejecting the valid trade request"
                        )
                else:
                    print("⚠️  Valid trade request creation failed")
            else:
                print("⚠️  Could not find different walker for valid trade test")
        else:
            print("⚠️  Could not get walkers for valid trade test")

    def test_bowwowmeow_new_features(self):
        """Test all new BowWowMeow features"""
        print("\n" + "=" * 70)
        print("🆕 TESTING NEW BOWWOWMEOW FEATURES")
        print("=" * 70)
        
        # Run all new feature tests
        self.test_client_appointment_edit_cancel()
        self.test_walker_trade_requests()
        self.test_walker_time_off_requests()
        self.test_walker_cancel_appointment()
        self.test_auto_invoice_generation()
        
        # Test the specific new features from the review request
        self.test_invoice_delivery_preference_setting()
        self.test_walker_trade_self_validation_bug_fix()

    def test_client_profile_and_pet_management_features(self):
        """Test all new client profile and pet management features"""
        print("\n" + "=" * 60)
        print("🆕 TESTING CLIENT PROFILE & PET MANAGEMENT FEATURES")
        print("=" * 60)
        
        # Run all the new feature tests
        self.test_client_profile_update()
        self.test_profile_image_upload()
        self.test_pet_update()
        self.test_pet_image_upload()
        self.test_serve_uploaded_images()

    def test_dog_park_social_feed(self):
        """Test Dog Park social feed functionality"""
        print("\n" + "=" * 70)
        print("🐕 TESTING DOG PARK SOCIAL FEED FUNCTIONALITY")
        print("=" * 70)
        
        # Test with demo credentials
        self.test_demo_user_login()
        
        if not self.tokens.get('demo_client'):
            print("⚠️  Skipping Dog Park tests - no demo client token")
            return
        
        # Test GET /api/dog-park/posts with filters
        self.test_dog_park_get_posts()
        
        # Test POST /api/dog-park/posts - create new post
        self.test_dog_park_create_post()
        
        # Test POST /api/dog-park/posts/{post_id}/like - like/unlike
        self.test_dog_park_like_post()
        
        # Test DELETE /api/dog-park/posts/{post_id} - delete post
        self.test_dog_park_delete_post()
        
        # Test GET /api/dog-park/featured - get featured pet images
        self.test_dog_park_featured_images()
        
        # Test GET /api/dog-park/pets-to-tag - get available pets to tag
        self.test_dog_park_pets_to_tag()
        
        # Test GET /api/dog-park/users-to-tag - get available users to tag
        self.test_dog_park_users_to_tag()
        
        # Test GET /api/dog-park/notifications - get tag notifications
        self.test_dog_park_notifications()

    def test_dog_park_get_posts(self):
        """Test GET /api/dog-park/posts with different filters"""
        print("\n🔍 Testing Dog Park Get Posts with Filters...")
        
        # Test filter=recent (posts from last 2 months)
        success, response = self.run_test(
            "Get Recent Posts", "GET", "dog-park/posts?filter=recent", 200,
            token=self.tokens['demo_client'],
            description="Get posts from last 2 months"
        )
        
        # Test filter=older (posts 2+ months old)
        success, response = self.run_test(
            "Get Older Posts", "GET", "dog-park/posts?filter=older", 200,
            token=self.tokens['demo_client'],
            description="Get posts 2+ months old"
        )
        
        # Test filter=my_pet (posts with user's pets tagged)
        success, response = self.run_test(
            "Get My Pet Posts", "GET", "dog-park/posts?filter=my_pet", 200,
            token=self.tokens['demo_client'],
            description="Get posts with user's pets tagged"
        )
        
        # Test search_name parameter (search by pet/owner name)
        success, response = self.run_test(
            "Search Posts by Name", "GET", "dog-park/posts?search_name=buddy", 200,
            token=self.tokens['demo_client'],
            description="Search posts by pet/owner name"
        )
        
        # Test getting all posts (no filter)
        success, response = self.run_test(
            "Get All Posts", "GET", "dog-park/posts", 200,
            token=self.tokens['demo_client'],
            description="Get all dog park posts"
        )

    def test_dog_park_create_post(self):
        """Test POST /api/dog-park/posts - create new post"""
        print("\n🔍 Testing Dog Park Create Post...")
        
        # Test creating post with just content
        post_data = {
            "content": "Beautiful day at the dog park! My pup is having so much fun playing with other dogs. 🐕"
        }
        
        success, response = self.run_test(
            "Create Post (Content Only)", "POST", "dog-park/posts", 200,
            data=post_data, token=self.tokens['demo_client'],
            description="Create post with just content"
        )
        
        if success:
            self.dog_park_post_id = response.get('id')
            print(f"✅ Post created with ID: {self.dog_park_post_id}")
        
        # Get user's pets for tagging
        success, pets = self.run_test(
            "Get Pets for Tagging", "GET", "pets", 200,
            token=self.tokens['demo_client'],
            description="Get user's pets for post tagging"
        )
        
        pet_ids = []
        if success and pets:
            pet_ids = [pet['id'] for pet in pets[:2]]  # Use first 2 pets
        
        # Get users for tagging
        success, users = self.run_test(
            "Get Users for Tagging", "GET", "dog-park/users-to-tag", 200,
            token=self.tokens['demo_client'],
            description="Get available users for tagging"
        )
        
        user_ids = []
        if success and users:
            user_ids = [user['id'] for user in users[:1]]  # Use first user
        
        # Test creating post with content and tagged pets
        post_data_with_pets = {
            "content": "Look at these adorable pups playing together! 🐾",
            "tagged_pet_ids": pet_ids
        }
        
        success, response = self.run_test(
            "Create Post (With Pet Tags)", "POST", "dog-park/posts", 200,
            data=post_data_with_pets, token=self.tokens['demo_client'],
            description="Create post with content and tagged pets"
        )
        
        if success:
            self.dog_park_post_with_pets_id = response.get('id')
            print(f"✅ Post with pet tags created with ID: {self.dog_park_post_with_pets_id}")
        
        # Test creating post with content, tagged pets, and tagged users
        post_data_full = {
            "content": "Great meetup at the dog park today! Thanks everyone for coming out. 🎾",
            "tagged_pet_ids": pet_ids,
            "tagged_user_ids": user_ids
        }
        
        success, response = self.run_test(
            "Create Post (With Pet & User Tags)", "POST", "dog-park/posts", 200,
            data=post_data_full, token=self.tokens['demo_client'],
            description="Create post with content, tagged pets, and tagged users"
        )
        
        if success:
            self.dog_park_post_full_id = response.get('id')
            print(f"✅ Post with full tags created with ID: {self.dog_park_post_full_id}")

    def test_dog_park_like_post(self):
        """Test POST /api/dog-park/posts/{post_id}/like - like/unlike post"""
        print("\n🔍 Testing Dog Park Like/Unlike Post...")
        
        if not hasattr(self, 'dog_park_post_id') or not self.dog_park_post_id:
            print("⚠️  No post ID available for like test")
            return
        
        # Test liking a post
        success, response = self.run_test(
            "Like Post", "POST", f"dog-park/posts/{self.dog_park_post_id}/like", 200,
            token=self.tokens['demo_client'],
            description="Like a dog park post"
        )
        
        if success:
            print("✅ Post liked successfully")
        
        # Test unliking (toggling like off)
        success, response = self.run_test(
            "Unlike Post", "POST", f"dog-park/posts/{self.dog_park_post_id}/like", 200,
            token=self.tokens['demo_client'],
            description="Unlike a dog park post (toggle off)"
        )
        
        if success:
            print("✅ Post unliked successfully")

    def test_dog_park_delete_post(self):
        """Test DELETE /api/dog-park/posts/{post_id} - delete post"""
        print("\n🔍 Testing Dog Park Delete Post...")
        
        if not hasattr(self, 'dog_park_post_id') or not self.dog_park_post_id:
            print("⚠️  No post ID available for delete test")
            return
        
        # Test author can delete their own post
        success, response = self.run_test(
            "Delete Own Post", "DELETE", f"dog-park/posts/{self.dog_park_post_id}", 200,
            token=self.tokens['demo_client'],
            description="Author deletes their own post"
        )
        
        if success:
            print("✅ Post deleted by author successfully")
        
        # Test admin can delete any post (if we have another post)
        if hasattr(self, 'dog_park_post_with_pets_id') and self.dog_park_post_with_pets_id and self.tokens.get('demo_admin'):
            success, response = self.run_test(
                "Admin Delete Post", "DELETE", f"dog-park/posts/{self.dog_park_post_with_pets_id}", 200,
                token=self.tokens['demo_admin'],
                description="Admin deletes any post"
            )
            
            if success:
                print("✅ Post deleted by admin successfully")
        
        # Test non-author non-admin cannot delete (use walker token if available)
        if hasattr(self, 'dog_park_post_full_id') and self.dog_park_post_full_id and self.tokens.get('demo_walker'):
            success, response = self.run_test(
                "Non-Author Delete Post (Should Fail)", "DELETE", f"dog-park/posts/{self.dog_park_post_full_id}", 403,
                token=self.tokens['demo_walker'],
                description="Non-author non-admin tries to delete post (should fail)"
            )
            
            if success:
                print("✅ Non-author delete properly blocked")

    def test_dog_park_featured_images(self):
        """Test GET /api/dog-park/featured - get random featured pet images"""
        print("\n🔍 Testing Dog Park Featured Images...")
        
        success, response = self.run_test(
            "Get Featured Pet Images", "GET", "dog-park/featured", 200,
            token=self.tokens['demo_client'],
            description="Get random featured pet images for dog park"
        )
        
        if success:
            if isinstance(response, list):
                print(f"✅ Featured images returned: {len(response)} images")
            else:
                print("✅ Featured images endpoint working")

    def test_dog_park_pets_to_tag(self):
        """Test GET /api/dog-park/pets-to-tag - get available pets to tag"""
        print("\n🔍 Testing Dog Park Pets to Tag...")
        
        # Test as client (should only see own pets)
        success, response = self.run_test(
            "Get Pets to Tag (Client)", "GET", "dog-park/pets-to-tag", 200,
            token=self.tokens['demo_client'],
            description="Client gets available pets to tag (should only see own pets)"
        )
        
        if success:
            print(f"✅ Client pets to tag: {len(response) if isinstance(response, list) else 'N/A'} pets")
        
        # Test as walker/admin (should see all pets)
        if self.tokens.get('demo_walker'):
            success, response = self.run_test(
                "Get Pets to Tag (Walker)", "GET", "dog-park/pets-to-tag", 200,
                token=self.tokens['demo_walker'],
                description="Walker gets available pets to tag (should see all pets)"
            )
            
            if success:
                print(f"✅ Walker pets to tag: {len(response) if isinstance(response, list) else 'N/A'} pets")
        
        if self.tokens.get('demo_admin'):
            success, response = self.run_test(
                "Get Pets to Tag (Admin)", "GET", "dog-park/pets-to-tag", 200,
                token=self.tokens['demo_admin'],
                description="Admin gets available pets to tag (should see all pets)"
            )
            
            if success:
                print(f"✅ Admin pets to tag: {len(response) if isinstance(response, list) else 'N/A'} pets")

    def test_dog_park_users_to_tag(self):
        """Test GET /api/dog-park/users-to-tag - get available users to tag"""
        print("\n🔍 Testing Dog Park Users to Tag...")
        
        success, response = self.run_test(
            "Get Users to Tag", "GET", "dog-park/users-to-tag", 200,
            token=self.tokens['demo_client'],
            description="Get available users to tag in posts"
        )
        
        if success:
            if isinstance(response, list):
                print(f"✅ Users to tag returned: {len(response)} users")
                # Check if response contains expected user fields
                if response and 'id' in response[0] and 'full_name' in response[0]:
                    print("✅ User data contains required fields (id, full_name)")
            else:
                print("✅ Users to tag endpoint working")

    def test_dog_park_notifications(self):
        """Test GET /api/dog-park/notifications - get tag notifications"""
        print("\n🔍 Testing Dog Park Notifications...")
        
        success, response = self.run_test(
            "Get Tag Notifications", "GET", "dog-park/notifications", 200,
            token=self.tokens['demo_client'],
            description="Get notifications when pets/users are tagged in posts"
        )
        
        if success:
            if isinstance(response, list):
                print(f"✅ Tag notifications returned: {len(response)} notifications")
            else:
                print("✅ Tag notifications endpoint working")

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
        
        # CLIENT PROFILE & PET MANAGEMENT FEATURES
        print("\n" + "=" * 60)
        print("🆕 TESTING CLIENT PROFILE & PET MANAGEMENT FEATURES")
        print("=" * 60)
        
        tester.test_client_profile_update()
        tester.test_profile_image_upload()
        tester.test_pet_update()
        tester.test_pet_image_upload()
        tester.test_serve_uploaded_images()
        
        # APPOINTMENT/SCHEDULING FUNCTIONALITY TESTS
        tester.test_appointment_scheduling_functionality()
        
        # NEW BOWWOWMEOW FEATURES TESTS
        tester.test_bowwowmeow_new_features()
        
        # DOG PARK SOCIAL FEED TESTS
        print("\n" + "=" * 70)
        print("🐕 TESTING DOG PARK SOCIAL FEED FUNCTIONALITY")
        print("=" * 70)
        tester.test_dog_park_social_feed()
        
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