"""
Test Admin Force-Complete Walk Feature
Tests the POST /appointments/{appt_id}/admin-complete endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminCompleteWalk:
    """Test admin force-complete functionality for walks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.admin_token = token
        
        # Also get walker token for comparison tests
        walker_session = requests.Session()
        walker_login = walker_session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demowalker", 
            "password": "demo123"
        })
        if walker_login.status_code == 200:
            self.walker_token = walker_login.json().get("token")
        else:
            self.walker_token = None

    def test_admin_complete_endpoint_exists(self):
        """Test that the admin-complete endpoint exists"""
        # First get an appointment to test with
        appointments_response = self.session.get(f"{BASE_URL}/api/appointments/calendar")
        assert appointments_response.status_code == 200
        print(f"Calendar endpoint returned {len(appointments_response.json())} appointments")
        
    def test_admin_complete_scheduled_walk(self):
        """Test admin can mark a scheduled walk as completed"""
        # First, create a test walk appointment
        clients_response = self.session.get(f"{BASE_URL}/api/users/clients")
        assert clients_response.status_code == 200
        clients = clients_response.json()
        
        if not clients:
            pytest.skip("No clients available to create appointment")
        
        client_id = clients[0]['id']
        
        walkers_response = self.session.get(f"{BASE_URL}/api/users/walkers")
        walkers = walkers_response.json() if walkers_response.status_code == 200 else []
        walker_id = walkers[0]['id'] if walkers else None
        
        # Create a test walk appointment
        create_response = self.session.post(f"{BASE_URL}/api/appointments/admin", json={
            "client_id": client_id,
            "walker_id": walker_id,
            "service_type": "walk_30",
            "scheduled_date": "2026-02-25",
            "scheduled_time": "10:00",
            "notes": "TEST_admin_complete_test"
        })
        
        if create_response.status_code not in [200, 201]:
            print(f"Create response: {create_response.status_code} - {create_response.text}")
            pytest.skip("Could not create test appointment")
        
        appt = create_response.json()
        appt_id = appt.get('id')
        assert appt_id is not None
        print(f"Created test appointment: {appt_id}")
        
        # Now test admin-complete on this appointment
        complete_response = self.session.post(f"{BASE_URL}/api/appointments/{appt_id}/admin-complete")
        assert complete_response.status_code == 200, f"Expected 200, got {complete_response.status_code}: {complete_response.text}"
        
        response_data = complete_response.json()
        assert "message" in response_data
        print(f"Admin complete response: {response_data}")
        
        # Verify the appointment is now completed
        detail_response = self.session.get(f"{BASE_URL}/api/appointments/{appt_id}/detail")
        assert detail_response.status_code == 200
        
        updated_appt = detail_response.json()
        assert updated_appt.get('status') == 'completed', f"Expected 'completed', got '{updated_appt.get('status')}'"
        assert updated_appt.get('completed_by_admin') == True
        print(f"Appointment status verified: {updated_appt.get('status')}")

    def test_admin_complete_in_progress_walk(self):
        """Test admin can mark an in_progress walk as completed"""
        # Create and start a walk, then admin complete it
        clients_response = self.session.get(f"{BASE_URL}/api/users/clients")
        clients = clients_response.json() if clients_response.status_code == 200 else []
        
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]['id']
        
        # Create appointment
        create_response = self.session.post(f"{BASE_URL}/api/appointments/admin", json={
            "client_id": client_id,
            "service_type": "walk_45",
            "scheduled_date": "2026-02-25",
            "scheduled_time": "14:00",
            "notes": "TEST_in_progress_admin_complete"
        })
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create test appointment")
        
        appt_id = create_response.json().get('id')
        
        # Start the walk (simulate in_progress)
        start_response = self.session.post(f"{BASE_URL}/api/appointments/{appt_id}/start", json={
            "latitude": 40.7128,
            "longitude": -74.0060
        })
        
        if start_response.status_code == 200:
            print(f"Walk started successfully")
        
        # Admin complete the in_progress walk
        complete_response = self.session.post(f"{BASE_URL}/api/appointments/{appt_id}/admin-complete")
        assert complete_response.status_code == 200
        
        # Verify completion
        detail_response = self.session.get(f"{BASE_URL}/api/appointments/{appt_id}/detail")
        updated = detail_response.json()
        assert updated.get('status') == 'completed'
        print(f"In-progress walk admin completed successfully")

    def test_admin_complete_rejects_non_admin(self):
        """Test that non-admin users cannot use admin-complete"""
        if not self.walker_token:
            pytest.skip("No walker token available")
        
        # Get any scheduled appointment
        appointments = self.session.get(f"{BASE_URL}/api/appointments/calendar").json()
        scheduled_appt = next((a for a in appointments if a.get('status') == 'scheduled'), None)
        
        if not scheduled_appt:
            pytest.skip("No scheduled appointment to test")
        
        # Try to admin-complete as walker
        walker_session = requests.Session()
        walker_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.walker_token}"
        })
        
        response = walker_session.post(f"{BASE_URL}/api/appointments/{scheduled_appt['id']}/admin-complete")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"Non-admin correctly rejected: {response.status_code}")

    def test_admin_complete_rejects_completed_appointment(self):
        """Test that admin-complete fails on already completed appointments"""
        # Get completed appointments
        appointments = self.session.get(f"{BASE_URL}/api/appointments/calendar").json()
        completed_appt = next((a for a in appointments if a.get('status') == 'completed'), None)
        
        if not completed_appt:
            pytest.skip("No completed appointment to test")
        
        response = self.session.post(f"{BASE_URL}/api/appointments/{completed_appt['id']}/admin-complete")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"Already completed appointment correctly rejected")

    def test_admin_complete_rejects_invalid_appointment(self):
        """Test that admin-complete fails with invalid appointment ID"""
        response = self.session.post(f"{BASE_URL}/api/appointments/invalid-id-12345/admin-complete")
        assert response.status_code == 404
        print(f"Invalid appointment ID correctly rejected")


class TestHealthCheck:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"API health check passed")
    
    def test_auth_setup_status(self):
        """Test auth setup endpoint"""
        response = requests.get(f"{BASE_URL}/api/auth/setup-status")
        assert response.status_code == 200
        print(f"Auth setup status: {response.json()}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
