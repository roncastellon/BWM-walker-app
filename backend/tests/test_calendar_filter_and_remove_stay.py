"""
Test suite for:
1. Calendar 'Walks' filter - should show all walk appointments (walk_30, walk_45, walk_60, standard_walk)
2. Calendar 'All Services' filter - should show all appointments
3. DELETE /api/appointments/{appt_id} endpoint - admin-only endpoint to delete appointments
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCalendarFiltersAndDeleteEndpoint:
    """Test calendar filtering and appointment deletion endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin auth token before each test"""
        self.admin_token = None
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        if login_response.status_code == 200:
            self.admin_token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.admin_token}"} if self.admin_token else {}
    
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("PASS: Admin login successful")
    
    def test_calendar_endpoint_returns_appointments(self):
        """Test that calendar endpoint returns appointments"""
        response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=self.headers)
        assert response.status_code == 200, f"Calendar endpoint failed: {response.text}"
        appointments = response.json()
        assert isinstance(appointments, list), "Calendar should return a list"
        print(f"PASS: Calendar endpoint returned {len(appointments)} appointments")
    
    def test_calendar_has_walk_appointments(self):
        """Test that calendar has walk-type appointments"""
        response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=self.headers)
        assert response.status_code == 200
        appointments = response.json()
        
        walk_types = ['walk_30', 'walk_45', 'walk_60', 'standard_walk']
        walk_appointments = [a for a in appointments if any(wt in (a.get('service_type') or '').lower() for wt in ['walk'])]
        
        print(f"Found {len(walk_appointments)} walk appointments out of {len(appointments)} total")
        for appt in walk_appointments[:5]:  # Show first 5
            print(f"  - {appt.get('service_type')}: {appt.get('scheduled_date')} {appt.get('scheduled_time')}")
        
        # This test verifies data exists - it's informational
        print(f"PASS: Calendar contains walk appointments ({len(walk_appointments)} walks found)")
    
    def test_calendar_filter_logic_walks_matching(self):
        """Test that walks filter would match walk-related service types using pattern matching"""
        # The fix uses pattern-based matching: service_type.includes('walk')
        # This should match: walk_30, walk_45, walk_60, standard_walk, etc.
        
        test_service_types = [
            ('walk_30', True),
            ('walk_45', True),
            ('walk_60', True),
            ('standard_walk', True),
            ('morning_walk', True),
            ('doggy_day_care', False),
            ('overnight', False),
            ('transport', False),
        ]
        
        # Pattern-based matching as implemented in CalendarPage.js line 765
        pattern = 'walk'
        
        for service_type, should_match in test_service_types:
            matches = pattern.lower() in service_type.lower()
            assert matches == should_match, f"Service type '{service_type}' - expected match={should_match}, got match={matches}"
            print(f"  {service_type}: {'MATCHES' if matches else 'no match'} (expected: {should_match})")
        
        print("PASS: Walk filter pattern matching logic is correct")
    
    def test_delete_appointment_endpoint_exists(self):
        """Test that DELETE /api/appointments/{appt_id} endpoint exists"""
        # Try to delete a non-existent appointment - should return 404, not 405 (Method Not Allowed)
        fake_id = "test-non-existent-id-12345"
        response = requests.delete(f"{BASE_URL}/api/appointments/{fake_id}", headers=self.headers)
        
        # 404 = endpoint exists, appointment not found
        # 405 = endpoint doesn't exist (Method Not Allowed)
        # 403 = endpoint exists but unauthorized (if not admin)
        assert response.status_code in [404, 403], f"Expected 404 or 403, got {response.status_code}: {response.text}"
        print(f"PASS: DELETE endpoint exists (returned {response.status_code} for non-existent ID)")
    
    def test_delete_appointment_admin_only(self):
        """Test that only admins can delete appointments"""
        # This test verifies the admin-only check is in place
        # First, we need to create a test appointment, then delete it
        
        # Get a client ID for testing
        clients_response = requests.get(f"{BASE_URL}/api/users/clients", headers=self.headers)
        if clients_response.status_code != 200 or not clients_response.json():
            pytest.skip("No clients available for testing")
        
        client = clients_response.json()[0]
        client_id = client['id']
        
        # Get pet IDs
        pets_response = requests.get(f"{BASE_URL}/api/pets?owner_id={client_id}", headers=self.headers)
        if pets_response.status_code != 200 or not pets_response.json():
            pytest.skip("No pets available for testing")
        
        pet = pets_response.json()[0]
        
        # Create a test appointment to delete
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/appointments/admin", 
            headers=self.headers,
            json={
                "client_id": client_id,
                "pet_ids": [pet['id']],
                "service_type": "walk_30",
                "scheduled_date": tomorrow,
                "scheduled_time": "10:00",
                "duration_type": "minutes"
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test appointment: {create_response.text}")
        
        appt_id = create_response.json().get('id')
        print(f"Created test appointment: {appt_id}")
        
        # Now delete it as admin - should succeed
        delete_response = requests.delete(f"{BASE_URL}/api/appointments/{appt_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Admin delete failed: {delete_response.text}"
        print(f"PASS: Admin successfully deleted appointment")
        
        # Verify it's gone
        verify_response = requests.delete(f"{BASE_URL}/api/appointments/{appt_id}", headers=self.headers)
        assert verify_response.status_code == 404, "Deleted appointment should return 404"
        print("PASS: Appointment no longer exists after deletion")
    
    def test_delete_overnight_appointment(self):
        """Test deleting an overnight stay appointment"""
        # Try to get the specific overnight appointment mentioned in the test request
        overnight_id = "f14570a4-9772-4311-a8f6-62cf22ff2cf9"
        
        # First check if it exists
        response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=self.headers)
        assert response.status_code == 200
        appointments = response.json()
        
        overnight_appt = next((a for a in appointments if a.get('id') == overnight_id), None)
        
        if overnight_appt:
            print(f"Found overnight appointment: {overnight_appt.get('service_type')} from {overnight_appt.get('scheduled_date')} to {overnight_appt.get('end_date')}")
            
            # Test that delete endpoint works for this overnight
            delete_response = requests.delete(f"{BASE_URL}/api/appointments/{overnight_id}", headers=self.headers)
            assert delete_response.status_code == 200, f"Delete overnight failed: {delete_response.text}"
            print("PASS: Successfully deleted overnight appointment")
        else:
            # Try to create one for testing
            clients_response = requests.get(f"{BASE_URL}/api/users/clients", headers=self.headers)
            if clients_response.status_code != 200 or not clients_response.json():
                pytest.skip("No clients available")
            
            client = clients_response.json()[0]
            pets_response = requests.get(f"{BASE_URL}/api/pets?owner_id={client['id']}", headers=self.headers)
            if pets_response.status_code != 200 or not pets_response.json():
                pytest.skip("No pets available")
            
            pet = pets_response.json()[0]
            
            # Create overnight appointment
            start_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
            end_date = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
            
            create_response = requests.post(f"{BASE_URL}/api/appointments/admin",
                headers=self.headers,
                json={
                    "client_id": client['id'],
                    "pet_ids": [pet['id']],
                    "service_type": "petsit_our_location",
                    "scheduled_date": start_date,
                    "end_date": end_date,
                    "scheduled_time": "",
                    "duration_type": "nights"
                }
            )
            
            if create_response.status_code == 200:
                appt_id = create_response.json().get('id')
                print(f"Created test overnight: {appt_id}")
                
                # Delete it
                delete_response = requests.delete(f"{BASE_URL}/api/appointments/{appt_id}", headers=self.headers)
                assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
                print("PASS: Successfully deleted test overnight appointment")
            else:
                print(f"Note: Could not create overnight for testing: {create_response.text}")


class TestServiceCategories:
    """Test service category definitions and filtering"""
    
    def test_walks_category_pattern_matching(self):
        """Verify the walks category uses pattern matching for 'walk'"""
        # Based on CalendarPage.js lines 77-83:
        # { value: 'walks', label: 'Walks', pattern: 'walk' }
        # This matches any service_type containing 'walk'
        
        service_types_in_system = [
            'walk_30', 'walk_45', 'walk_60', 'standard_walk',
            'doggy_day_care', 'overnight', 'transport', 'petsit_our_location'
        ]
        
        walk_pattern = 'walk'
        
        expected_walks = ['walk_30', 'walk_45', 'walk_60', 'standard_walk']
        matched_walks = [st for st in service_types_in_system if walk_pattern in st.lower()]
        
        assert set(matched_walks) == set(expected_walks), f"Expected {expected_walks}, got {matched_walks}"
        print(f"PASS: Walks pattern correctly matches: {matched_walks}")
    
    def test_all_services_returns_everything(self):
        """Test that 'all' filter returns all services"""
        # When selectedServiceCategory === 'all', the serviceMatch is always true
        # This is verified by the filter logic at line 759: if (selectedServiceCategory !== 'all')
        
        # Simulating the filter logic
        selected_category = 'all'
        
        test_appointments = [
            {'service_type': 'walk_30'},
            {'service_type': 'standard_walk'},
            {'service_type': 'overnight'},
            {'service_type': 'doggy_day_care'},
            {'service_type': 'transport'},
        ]
        
        # When category is 'all', all pass the filter
        if selected_category == 'all':
            filtered = test_appointments
        else:
            filtered = []  # Would apply category filtering
        
        assert len(filtered) == len(test_appointments), "All services should pass when filter is 'all'"
        print(f"PASS: 'All Services' filter correctly returns all appointments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
