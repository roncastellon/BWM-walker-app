import requests
import sys
import json
from datetime import datetime, timedelta

class WagWalkAPITester:
    def __init__(self, base_url="https://pawplan.preview.emergentagent.com"):
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
            print(f"  • {test['test']}: {test.get('error', f'Expected {test.get(\"expected\")}, got {test.get(\"actual\")}')}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())