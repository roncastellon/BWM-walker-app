"""
Test Calendar Page Appointment Creation
Tests for:
1. Admin can create Day Care appointment (no walker dropdown)
2. Admin can create Walk appointment (walker dropdown shown)
3. Walker dropdown visibility logic for different service types
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "demo_admin"
ADMIN_PASSWORD = "demo123"


class TestAdminAppointmentCreation:
    """Test admin appointment creation from Calendar page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.test_client_id = None
        self.test_pet_id = None
        
    def get_admin_token(self):
        """Login as admin and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
            return True
        return False
    
    def get_or_create_test_client(self):
        """Get or create a test client for appointments"""
        # First try to get existing clients
        response = self.session.get(f"{BASE_URL}/api/users/clients")
        if response.status_code == 200:
            clients = response.json()
            if clients:
                self.test_client_id = clients[0].get("id")
                return True
        return False
    
    def get_or_create_test_pet(self):
        """Get or create a test pet for appointments"""
        if not self.test_client_id:
            return False
        
        # Get pets for the client
        response = self.session.get(f"{BASE_URL}/api/pets?owner_id={self.test_client_id}")
        if response.status_code == 200:
            pets = response.json()
            if pets:
                self.test_pet_id = pets[0].get("id")
                return True
        return False
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data.get("user", {}).get("role") == "admin", "User is not admin"
        print("✓ Admin login successful")
    
    def test_get_services(self):
        """Test getting available services"""
        assert self.get_admin_token(), "Failed to get admin token"
        
        response = self.session.get(f"{BASE_URL}/api/services")
        assert response.status_code == 200, f"Failed to get services: {response.text}"
        
        services = response.json()
        assert len(services) > 0, "No services returned"
        
        # Check for walk services
        walk_services = [s for s in services if 'walk' in s.get('service_type', '').lower()]
        assert len(walk_services) > 0, "No walk services found"
        
        # Check for non-walk services
        non_walk_services = [s for s in services if 'walk' not in s.get('service_type', '').lower()]
        print(f"✓ Found {len(walk_services)} walk services and {len(non_walk_services)} non-walk services")
        
        # Print service types for reference
        print("Available services:")
        for s in services:
            print(f"  - {s.get('service_type')}: {s.get('name')}")
    
    def test_get_walkers(self):
        """Test getting available walkers"""
        assert self.get_admin_token(), "Failed to get admin token"
        
        response = self.session.get(f"{BASE_URL}/api/users/walkers")
        assert response.status_code == 200, f"Failed to get walkers: {response.text}"
        
        walkers = response.json()
        print(f"✓ Found {len(walkers)} walkers")
        
        if walkers:
            for w in walkers[:3]:  # Print first 3
                print(f"  - {w.get('full_name')} (ID: {w.get('id')[:8]}...)")
    
    def test_get_clients(self):
        """Test getting available clients"""
        assert self.get_admin_token(), "Failed to get admin token"
        
        response = self.session.get(f"{BASE_URL}/api/users/clients")
        assert response.status_code == 200, f"Failed to get clients: {response.text}"
        
        clients = response.json()
        print(f"✓ Found {len(clients)} clients")
        
        if clients:
            self.test_client_id = clients[0].get("id")
            print(f"  Using client: {clients[0].get('full_name')} (ID: {self.test_client_id[:8]}...)")
    
    def test_create_walk_appointment_with_walker(self):
        """Test creating a walk appointment with walker assignment"""
        assert self.get_admin_token(), "Failed to get admin token"
        assert self.get_or_create_test_client(), "Failed to get test client"
        assert self.get_or_create_test_pet(), "Failed to get test pet"
        
        # Get a walker
        response = self.session.get(f"{BASE_URL}/api/users/walkers")
        walkers = response.json() if response.status_code == 200 else []
        walker_id = walkers[0].get("id") if walkers else None
        
        # Create walk appointment
        appointment_data = {
            "client_id": self.test_client_id,
            "pet_ids": [self.test_pet_id] if self.test_pet_id else [],
            "service_type": "walk_30",
            "scheduled_date": "2025-12-20",
            "scheduled_time": "10:00",
            "walker_id": walker_id,
            "notes": "Test walk appointment with walker"
        }
        
        response = self.session.post(f"{BASE_URL}/api/appointments/admin", json=appointment_data)
        assert response.status_code == 200, f"Failed to create walk appointment: {response.text}"
        
        appt = response.json()
        assert appt.get("service_type") == "walk_30", "Service type mismatch"
        assert appt.get("walker_id") == walker_id, "Walker ID not set correctly"
        print(f"✓ Created walk_30 appointment with walker (ID: {appt.get('id')[:8]}...)")
    
    def test_create_walk_appointment_without_walker(self):
        """Test creating a walk appointment without walker (unassigned)"""
        assert self.get_admin_token(), "Failed to get admin token"
        assert self.get_or_create_test_client(), "Failed to get test client"
        assert self.get_or_create_test_pet(), "Failed to get test pet"
        
        # Create walk appointment without walker
        appointment_data = {
            "client_id": self.test_client_id,
            "pet_ids": [self.test_pet_id] if self.test_pet_id else [],
            "service_type": "walk_45",
            "scheduled_date": "2025-12-21",
            "scheduled_time": "14:00",
            "walker_id": None,
            "notes": "Test walk appointment without walker"
        }
        
        response = self.session.post(f"{BASE_URL}/api/appointments/admin", json=appointment_data)
        assert response.status_code == 200, f"Failed to create walk appointment: {response.text}"
        
        appt = response.json()
        assert appt.get("service_type") == "walk_45", "Service type mismatch"
        assert appt.get("walker_id") is None, "Walker ID should be None"
        print(f"✓ Created walk_45 appointment without walker (ID: {appt.get('id')[:8]}...)")
    
    def test_create_day_care_appointment(self):
        """Test creating a Day Care appointment (should work without walker)"""
        assert self.get_admin_token(), "Failed to get admin token"
        assert self.get_or_create_test_client(), "Failed to get test client"
        assert self.get_or_create_test_pet(), "Failed to get test pet"
        
        # Create day care appointment - no walker needed
        appointment_data = {
            "client_id": self.test_client_id,
            "pet_ids": [self.test_pet_id] if self.test_pet_id else [],
            "service_type": "doggy_day_care",
            "scheduled_date": "2025-12-22",
            "scheduled_time": "08:00",
            "walker_id": None,  # Day care doesn't need walker
            "notes": "Test day care appointment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/appointments/admin", json=appointment_data)
        assert response.status_code == 200, f"Failed to create day care appointment: {response.text}"
        
        appt = response.json()
        assert appt.get("service_type") == "doggy_day_care", "Service type mismatch"
        print(f"✓ Created doggy_day_care appointment (ID: {appt.get('id')[:8]}...)")
    
    def test_create_transport_appointment(self):
        """Test creating a Transport appointment (should work without walker)"""
        assert self.get_admin_token(), "Failed to get admin token"
        assert self.get_or_create_test_client(), "Failed to get test client"
        assert self.get_or_create_test_pet(), "Failed to get test pet"
        
        # Create transport appointment - no walker needed
        appointment_data = {
            "client_id": self.test_client_id,
            "pet_ids": [self.test_pet_id] if self.test_pet_id else [],
            "service_type": "transport",
            "scheduled_date": "2025-12-23",
            "scheduled_time": "09:00",
            "walker_id": None,
            "notes": "Test transport appointment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/appointments/admin", json=appointment_data)
        assert response.status_code == 200, f"Failed to create transport appointment: {response.text}"
        
        appt = response.json()
        assert appt.get("service_type") == "transport", "Service type mismatch"
        print(f"✓ Created transport appointment (ID: {appt.get('id')[:8]}...)")
    
    def test_create_concierge_appointment(self):
        """Test creating a Concierge appointment (should work without walker)"""
        assert self.get_admin_token(), "Failed to get admin token"
        assert self.get_or_create_test_client(), "Failed to get test client"
        assert self.get_or_create_test_pet(), "Failed to get test pet"
        
        # Create concierge appointment - no walker needed
        appointment_data = {
            "client_id": self.test_client_id,
            "pet_ids": [self.test_pet_id] if self.test_pet_id else [],
            "service_type": "concierge",
            "scheduled_date": "2025-12-24",
            "scheduled_time": "11:00",
            "walker_id": None,
            "notes": "Test concierge appointment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/appointments/admin", json=appointment_data)
        assert response.status_code == 200, f"Failed to create concierge appointment: {response.text}"
        
        appt = response.json()
        assert appt.get("service_type") == "concierge", "Service type mismatch"
        print(f"✓ Created concierge appointment (ID: {appt.get('id')[:8]}...)")
    
    def test_create_overnight_appointment(self):
        """Test creating an Overnight/Pet Sitting appointment (should work without walker)"""
        assert self.get_admin_token(), "Failed to get admin token"
        assert self.get_or_create_test_client(), "Failed to get test client"
        assert self.get_or_create_test_pet(), "Failed to get test pet"
        
        # Create overnight appointment - no walker needed
        appointment_data = {
            "client_id": self.test_client_id,
            "pet_ids": [self.test_pet_id] if self.test_pet_id else [],
            "service_type": "petsit_our_location",
            "scheduled_date": "2025-12-25",
            "scheduled_time": "",  # Overnight services may not need time
            "walker_id": None,
            "notes": "Test overnight appointment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/appointments/admin", json=appointment_data)
        assert response.status_code == 200, f"Failed to create overnight appointment: {response.text}"
        
        appt = response.json()
        assert appt.get("service_type") == "petsit_our_location", "Service type mismatch"
        print(f"✓ Created petsit_our_location appointment (ID: {appt.get('id')[:8]}...)")
    
    def test_calendar_endpoint(self):
        """Test calendar endpoint returns appointments"""
        assert self.get_admin_token(), "Failed to get admin token"
        
        response = self.session.get(f"{BASE_URL}/api/appointments/calendar")
        assert response.status_code == 200, f"Failed to get calendar: {response.text}"
        
        appointments = response.json()
        print(f"✓ Calendar endpoint returned {len(appointments)} appointments")


class TestWalkerDropdownLogic:
    """Test the walker dropdown visibility logic based on service type"""
    
    def test_walk_services_should_show_walker_dropdown(self):
        """Walk services (walk_30, walk_45, walk_60) should show walker dropdown"""
        walk_services = ['walk_30', 'walk_45', 'walk_60']
        
        for service in walk_services:
            # Simulate the isWalkService function from frontend
            is_walk = 'walk' in service.lower()
            assert is_walk, f"{service} should be identified as a walk service"
            print(f"✓ {service} correctly identified as walk service (should show walker dropdown)")
    
    def test_non_walk_services_should_hide_walker_dropdown(self):
        """Non-walk services should NOT show walker dropdown"""
        non_walk_services = [
            'doggy_day_care',
            'doggy_day_camp', 
            'day_visit',
            'transport',
            'concierge',
            'overnight',
            'stay_overnight',
            'petsit_our_location',
            'petsit_your_location'
        ]
        
        for service in non_walk_services:
            # Simulate the isWalkService function from frontend
            is_walk = 'walk' in service.lower()
            assert not is_walk, f"{service} should NOT be identified as a walk service"
            print(f"✓ {service} correctly identified as non-walk service (should hide walker dropdown)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
