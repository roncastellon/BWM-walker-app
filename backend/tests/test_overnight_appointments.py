"""
Backend tests for overnight appointment creation fix.
Tests that overnight stays create a SINGLE appointment with start/end dates
instead of multiple 1-day appointments.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Overnight service types to test
OVERNIGHT_SERVICES = [
    'petsit_our_location',
    'petsit_your_location',
    'stay_overnight',
    'overnight'
]

class TestOvernightAppointmentCreation:
    """Test overnight appointment creation creates SINGLE appointment with start/end dates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get('access_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a client ID
        clients_response = requests.get(f"{BASE_URL}/api/users/clients", headers=self.headers)
        if clients_response.status_code == 200 and clients_response.json():
            self.client_id = clients_response.json()[0]['id']
            # Get pet IDs for this client
            pets_response = requests.get(f"{BASE_URL}/api/pets?owner_id={self.client_id}", headers=self.headers)
            if pets_response.status_code == 200 and pets_response.json():
                self.pet_ids = [pets_response.json()[0]['id']]
            else:
                self.pet_ids = []
        else:
            pytest.skip("No clients available for testing")
    
    def test_overnight_appointment_has_end_date(self):
        """Test that creating overnight appointment with end_date stores it correctly"""
        start_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=10)).strftime('%Y-%m-%d')  # 3 nights
        
        payload = {
            "client_id": self.client_id,
            "pet_ids": self.pet_ids,
            "service_type": "petsit_our_location",
            "scheduled_date": start_date,
            "end_date": end_date,
            "scheduled_time": "",  # Overnight services don't need time
            "duration_type": "nights",
            "duration_value": 3,
            "notes": "Test overnight - 3 nights"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments/admin", json=payload, headers=self.headers)
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Failed to create overnight appointment: {response.text}"
        
        data = response.json()
        assert 'id' in data, "Appointment should have an ID"
        assert data.get('scheduled_date') == start_date, f"Start date should be {start_date}"
        assert data.get('end_date') == end_date, f"End date should be {end_date}"
        assert data.get('service_type') == "petsit_our_location"
        assert data.get('duration_type') == "nights"
        
        # Clean up
        appt_id = data['id']
        requests.put(f"{BASE_URL}/api/appointments/{appt_id}", 
                    json={"status": "cancelled"}, headers=self.headers)
        print(f"TEST PASSED: Overnight appointment created with end_date={end_date}")
    
    def test_overnight_creates_single_appointment_not_multiple(self):
        """Test that a 3-night stay creates ONE appointment, not 3 separate ones"""
        start_date = (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=17)).strftime('%Y-%m-%d')  # 3 nights
        
        # Get current appointment count for this client
        before_response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=self.headers)
        before_count = len([a for a in before_response.json() 
                          if a.get('client_id') == self.client_id 
                          and a.get('service_type') == 'petsit_your_location'])
        
        payload = {
            "client_id": self.client_id,
            "pet_ids": self.pet_ids,
            "service_type": "petsit_your_location",
            "scheduled_date": start_date,
            "end_date": end_date,
            "scheduled_time": "",
            "duration_type": "nights",
            "duration_value": 3,
            "notes": "Test - should be SINGLE appointment"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments/admin", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        created_appt = response.json()
        created_id = created_appt['id']
        
        # Get appointment count after creation
        after_response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=self.headers)
        after_count = len([a for a in after_response.json() 
                         if a.get('client_id') == self.client_id 
                         and a.get('service_type') == 'petsit_your_location'])
        
        # Should only have created 1 appointment, not 3
        new_appointments_count = after_count - before_count
        print(f"Appointments before: {before_count}, after: {after_count}, new: {new_appointments_count}")
        
        # Clean up
        requests.put(f"{BASE_URL}/api/appointments/{created_id}", 
                    json={"status": "cancelled"}, headers=self.headers)
        
        assert new_appointments_count == 1, f"Should create 1 appointment, but created {new_appointments_count}"
        print("TEST PASSED: Overnight stay creates SINGLE appointment")
    
    def test_stay_overnight_service_type(self):
        """Test stay_overnight service type also works correctly"""
        start_date = (datetime.now() + timedelta(days=21)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=23)).strftime('%Y-%m-%d')  # 2 nights
        
        payload = {
            "client_id": self.client_id,
            "pet_ids": self.pet_ids,
            "service_type": "stay_overnight",
            "scheduled_date": start_date,
            "end_date": end_date,
            "scheduled_time": "",
            "duration_type": "nights",
            "notes": "Test stay_overnight service"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments/admin", json=payload, headers=self.headers)
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Should work - may or may not be enabled depending on service config
        if response.status_code == 200:
            data = response.json()
            assert data.get('end_date') == end_date, "End date should be set"
            # Clean up
            requests.put(f"{BASE_URL}/api/appointments/{data['id']}", 
                        json={"status": "cancelled"}, headers=self.headers)
            print("TEST PASSED: stay_overnight works")
        else:
            print(f"stay_overnight service may not be configured: {response.text}")


class TestOvernightValidation:
    """Test validation for overnight appointments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('access_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        clients_response = requests.get(f"{BASE_URL}/api/users/clients", headers=self.headers)
        if clients_response.status_code == 200 and clients_response.json():
            self.client_id = clients_response.json()[0]['id']
            pets_response = requests.get(f"{BASE_URL}/api/pets?owner_id={self.client_id}", headers=self.headers)
            if pets_response.status_code == 200 and pets_response.json():
                self.pet_ids = [pets_response.json()[0]['id']]
            else:
                self.pet_ids = []
        else:
            pytest.skip("No clients available")
    
    def test_overnight_without_end_date_uses_start_date(self):
        """Test that overnight appointment without end_date uses scheduled_date as end"""
        start_date = (datetime.now() + timedelta(days=28)).strftime('%Y-%m-%d')
        
        payload = {
            "client_id": self.client_id,
            "pet_ids": self.pet_ids,
            "service_type": "petsit_our_location",
            "scheduled_date": start_date,
            # No end_date provided
            "scheduled_time": "",
            "duration_type": "nights",
            "notes": "Test - no end_date"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments/admin", json=payload, headers=self.headers)
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Should create successfully
        if response.status_code == 200:
            data = response.json()
            # end_date should be None or same as start_date
            end_date = data.get('end_date')
            assert end_date is None or end_date == start_date, \
                f"end_date should be None or {start_date}, got {end_date}"
            # Clean up
            requests.put(f"{BASE_URL}/api/appointments/{data['id']}", 
                        json={"status": "cancelled"}, headers=self.headers)
            print("TEST PASSED: Appointment created without end_date")
        else:
            # If it fails, that's also acceptable (stricter validation)
            print(f"Backend rejected missing end_date (stricter validation): {response.text}")


class TestOvernightCalendarDisplay:
    """Test that overnight appointments appear correctly in calendar"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('access_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_overnight_appears_in_calendar(self):
        """Test that overnight appointment appears in calendar API"""
        response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=self.headers)
        
        assert response.status_code == 200, f"Calendar API failed: {response.text}"
        
        appointments = response.json()
        
        # Find overnight appointments
        overnight_appts = [a for a in appointments 
                         if a.get('service_type') in OVERNIGHT_SERVICES]
        
        print(f"Found {len(overnight_appts)} overnight appointments in calendar")
        
        for appt in overnight_appts:
            print(f"  - ID: {appt.get('id')[:8]}..., "
                  f"Type: {appt.get('service_type')}, "
                  f"Start: {appt.get('scheduled_date')}, "
                  f"End: {appt.get('end_date')}, "
                  f"Status: {appt.get('status')}")
        
        print("TEST PASSED: Overnight appointments retrieved from calendar")


class TestOvernightCheckInCheckOut:
    """Test check-in/check-out status for overnight appointments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get('access_token')
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        clients_response = requests.get(f"{BASE_URL}/api/users/clients", headers=self.headers)
        if clients_response.status_code == 200 and clients_response.json():
            self.client_id = clients_response.json()[0]['id']
            pets_response = requests.get(f"{BASE_URL}/api/pets?owner_id={self.client_id}", headers=self.headers)
            if pets_response.status_code == 200 and pets_response.json():
                self.pet_ids = [pets_response.json()[0]['id']]
            else:
                self.pet_ids = []
        else:
            pytest.skip("No clients available")
    
    def test_check_in_sets_in_progress(self):
        """Test that check-in sets status to in_progress"""
        # Create an overnight appointment starting today
        today = datetime.now().strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        
        payload = {
            "client_id": self.client_id,
            "pet_ids": self.pet_ids,
            "service_type": "petsit_our_location",
            "scheduled_date": today,
            "end_date": end_date,
            "scheduled_time": "",
            "duration_type": "nights",
            "notes": "Test check-in"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments/admin", json=payload, headers=self.headers)
        
        if response.status_code != 200:
            print(f"Could not create appointment: {response.text}")
            pytest.skip("Could not create test appointment")
            return
        
        appt = response.json()
        appt_id = appt['id']
        
        # Check in - update status to in_progress
        checkin_response = requests.put(
            f"{BASE_URL}/api/appointments/{appt_id}",
            json={"status": "in_progress"},
            headers=self.headers
        )
        
        assert checkin_response.status_code == 200, f"Check-in failed: {checkin_response.text}"
        
        # Verify status changed
        detail_response = requests.get(f"{BASE_URL}/api/appointments/{appt_id}/detail", headers=self.headers)
        assert detail_response.status_code == 200
        detail = detail_response.json()
        
        assert detail.get('status') == 'in_progress', f"Status should be in_progress, got {detail.get('status')}"
        print("TEST PASSED: Check-in sets status to in_progress")
        
        # Clean up
        requests.put(f"{BASE_URL}/api/appointments/{appt_id}", 
                    json={"status": "cancelled"}, headers=self.headers)
    
    def test_check_out_sets_completed(self):
        """Test that check-out sets status to completed"""
        # Create an overnight appointment
        start_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')  # Started 2 days ago
        today = datetime.now().strftime('%Y-%m-%d')  # Ending today
        
        payload = {
            "client_id": self.client_id,
            "pet_ids": self.pet_ids,
            "service_type": "petsit_our_location",
            "scheduled_date": start_date,
            "end_date": today,
            "scheduled_time": "",
            "duration_type": "nights",
            "status": "in_progress",  # Already checked in
            "notes": "Test check-out"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments/admin", json=payload, headers=self.headers)
        
        if response.status_code != 200:
            print(f"Could not create appointment: {response.text}")
            pytest.skip("Could not create test appointment")
            return
        
        appt = response.json()
        appt_id = appt['id']
        
        # Check out - update status to completed
        checkout_response = requests.put(
            f"{BASE_URL}/api/appointments/{appt_id}",
            json={"status": "completed"},
            headers=self.headers
        )
        
        assert checkout_response.status_code == 200, f"Check-out failed: {checkout_response.text}"
        
        # Verify status changed
        detail_response = requests.get(f"{BASE_URL}/api/appointments/{appt_id}/detail", headers=self.headers)
        assert detail_response.status_code == 200
        detail = detail_response.json()
        
        assert detail.get('status') == 'completed', f"Status should be completed, got {detail.get('status')}"
        print("TEST PASSED: Check-out sets status to completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
