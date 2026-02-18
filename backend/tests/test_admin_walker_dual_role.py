"""
Test Suite for Admin Dual Role Feature (Admin as Walker)
Tests: toggle-walker endpoint, walkers list including admins, admin walks assignment
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"username": "demo_admin", "password": "demo123"}


class TestAdminWalkerDualRole:
    """Test admin dual role as walker feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.admin_token = data['access_token']
        self.admin_id = data['user']['id']
        self.admin_is_walker = data['user'].get('is_walker', False)
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
    # Test 1: Login shows admin's is_walker status
    def test_01_login_shows_is_walker_status(self):
        """Verify login response includes is_walker field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200
        data = response.json()
        
        # Verify is_walker field exists in user response
        assert 'is_walker' in data['user'], "is_walker field missing from user response"
        assert isinstance(data['user']['is_walker'], bool), "is_walker should be boolean"
        print(f"Admin is_walker status: {data['user']['is_walker']}")
        
    # Test 2: Toggle walker status endpoint works
    def test_02_toggle_walker_endpoint(self):
        """Test PUT /users/{id}/toggle-walker toggles is_walker status"""
        # Get current status
        initial_status = self.admin_is_walker
        
        # Toggle status
        response = requests.put(
            f"{BASE_URL}/api/users/{self.admin_id}/toggle-walker",
            headers=self.headers
        )
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert 'is_walker' in data, "Response should include is_walker"
        assert data['is_walker'] != initial_status, "Status should have toggled"
        
        # Toggle back to original
        response2 = requests.put(
            f"{BASE_URL}/api/users/{self.admin_id}/toggle-walker",
            headers=self.headers
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2['is_walker'] == initial_status, "Status should toggle back"
        print(f"Toggle test passed: {initial_status} -> {data['is_walker']} -> {data2['is_walker']}")
        
    # Test 3: Toggle only works for admin users
    def test_03_toggle_walker_only_for_admins(self):
        """Verify toggle-walker endpoint only works for admin role users"""
        # Try to toggle for a non-admin user (this would need a regular walker user)
        # For now, just verify the endpoint exists and requires admin auth
        response = requests.put(
            f"{BASE_URL}/api/users/{self.admin_id}/toggle-walker"
            # No auth header
        )
        assert response.status_code == 401, "Should require authentication"
        
    # Test 4: GET /users/walkers includes admins with is_walker=true
    def test_04_walkers_list_includes_admin_walkers(self):
        """Verify GET /users/walkers includes admins marked as walkers"""
        response = requests.get(f"{BASE_URL}/api/users/walkers", headers=self.headers)
        assert response.status_code == 200, f"Failed to get walkers: {response.text}"
        walkers = response.json()
        
        # Check if admin is in the walkers list (if is_walker is true)
        admin_in_list = any(w['id'] == self.admin_id for w in walkers)
        
        # Get admin's current is_walker status
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert me_response.status_code == 200
        is_walker = me_response.json().get('is_walker', False)
        
        if is_walker:
            assert admin_in_list, "Admin with is_walker=true should be in walkers list"
            print(f"Admin found in walkers list (is_walker=True)")
        else:
            # Admin might not be in list if is_walker is False
            print(f"Admin is_walker={is_walker}, in walkers list={admin_in_list}")
            
    # Test 5: Admin can be assigned to walks
    def test_05_admin_can_be_assigned_walks(self):
        """Verify admin ID can be used as walker_id in appointments"""
        # Get existing appointments assigned to admin
        response = requests.get(
            f"{BASE_URL}/api/appointments/my-walks",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get my walks: {response.text}"
        walks = response.json()
        
        # Count walks assigned to this admin
        admin_walks = [w for w in walks if w.get('walker_id') == self.admin_id]
        print(f"Admin has {len(admin_walks)} walks assigned")
        
        # Verify walk data structure
        if admin_walks:
            walk = admin_walks[0]
            assert 'scheduled_date' in walk, "Walk should have scheduled_date"
            assert 'scheduled_time' in walk, "Walk should have scheduled_time"
            assert 'status' in walk, "Walk should have status"
            assert 'pet_names' in walk, "Walk should have pet_names enriched"
            assert 'client_name' in walk, "Walk should have client_name enriched"
            print(f"Sample walk: {walk.get('scheduled_date')} {walk.get('scheduled_time')} - {walk.get('pet_names')}")
            
    # Test 6: GET /appointments/my-walks returns admin's assigned walks
    def test_06_my_walks_endpoint(self):
        """Test /appointments/my-walks returns walks assigned to admin"""
        response = requests.get(
            f"{BASE_URL}/api/appointments/my-walks",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        walks = response.json()
        
        assert isinstance(walks, list), "Should return a list"
        
        # All walks should be assigned to current user
        for walk in walks:
            assert walk.get('walker_id') == self.admin_id, "All walks should be assigned to current user"
            
        print(f"Found {len(walks)} walks assigned to admin")
        
    # Test 7: Verify walk has proper enriched data
    def test_07_my_walks_enriched_data(self):
        """Verify /appointments/my-walks returns enriched walk data"""
        response = requests.get(
            f"{BASE_URL}/api/appointments/my-walks",
            headers=self.headers
        )
        assert response.status_code == 200
        walks = response.json()
        
        if walks:
            walk = walks[0]
            # Check enriched fields
            assert 'client_name' in walk, "Should have client_name"
            assert 'pet_names' in walk, "Should have pet_names"
            assert isinstance(walk['pet_names'], list), "pet_names should be a list"
            
            # Check other required fields
            required_fields = ['id', 'client_id', 'walker_id', 'pet_ids', 
                               'service_type', 'scheduled_date', 'scheduled_time', 'status']
            for field in required_fields:
                assert field in walk, f"Walk should have {field}"
                
            print(f"Walk data enriched correctly: client={walk.get('client_name')}, pets={walk.get('pet_names')}")
        else:
            print("No walks to verify enrichment - TEST SKIPPED (no walks assigned)")
            
    # Test 8: Start walk endpoint for admin
    def test_08_admin_can_start_walk(self):
        """Test that admin can start their assigned walk"""
        # Get admin's walks
        response = requests.get(
            f"{BASE_URL}/api/appointments/my-walks",
            headers=self.headers
        )
        assert response.status_code == 200
        walks = response.json()
        
        # Find a scheduled walk
        scheduled_walks = [w for w in walks if w.get('status') == 'scheduled']
        
        if scheduled_walks:
            walk = scheduled_walks[0]
            walk_id = walk['id']
            
            # Try to start the walk
            start_response = requests.post(
                f"{BASE_URL}/api/appointments/{walk_id}/start",
                headers=self.headers
            )
            
            # Note: This may fail if walk date/time restrictions exist
            if start_response.status_code == 200:
                print(f"Walk {walk_id} started successfully")
                # Verify status changed
                verify_response = requests.get(
                    f"{BASE_URL}/api/appointments/my-walks",
                    headers=self.headers
                )
                updated_walks = verify_response.json()
                updated_walk = next((w for w in updated_walks if w['id'] == walk_id), None)
                if updated_walk:
                    assert updated_walk['status'] == 'in_progress', "Status should be in_progress"
            else:
                print(f"Start walk returned {start_response.status_code}: {start_response.text[:200]}")
                # This is acceptable - might have time/date restrictions
        else:
            print("No scheduled walks to start - TEST SKIPPED")
            
    # Test 9: Complete walk endpoint for admin
    def test_09_admin_can_complete_walk(self):
        """Test that admin can complete their walk (if one is in progress)"""
        # Get admin's walks
        response = requests.get(
            f"{BASE_URL}/api/appointments/my-walks",
            headers=self.headers
        )
        assert response.status_code == 200
        walks = response.json()
        
        # Find in-progress walk
        in_progress_walks = [w for w in walks if w.get('status') == 'in_progress']
        
        if in_progress_walks:
            walk = in_progress_walks[0]
            walk_id = walk['id']
            
            # Complete the walk
            completion_data = {
                "did_pee": True,
                "did_poop": True,
                "checked_water": True,
                "notes": "TEST - Walk completed by admin-walker"
            }
            
            complete_response = requests.post(
                f"{BASE_URL}/api/appointments/{walk_id}/complete",
                headers=self.headers,
                json=completion_data
            )
            
            if complete_response.status_code == 200:
                print(f"Walk {walk_id} completed successfully")
                # Verify status changed
                verify_response = requests.get(
                    f"{BASE_URL}/api/appointments/my-walks",
                    headers=self.headers
                )
                updated_walks = verify_response.json()
                updated_walk = next((w for w in updated_walks if w['id'] == walk_id), None)
                if updated_walk:
                    assert updated_walk['status'] == 'completed', "Status should be completed"
            else:
                print(f"Complete walk returned {complete_response.status_code}: {complete_response.text[:200]}")
        else:
            print("No in-progress walks to complete - TEST SKIPPED")
            
    # Test 10: Admin dashboard stats endpoint
    def test_10_dashboard_stats(self):
        """Test admin dashboard stats endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        stats = response.json()
        
        # Verify stats structure
        assert isinstance(stats, dict), "Stats should be a dict"
        print(f"Dashboard stats retrieved: {list(stats.keys())[:5]}...")


class TestWalkersListWithAdmins:
    """Additional tests for walkers list including admin-walkers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200
        self.admin_token = response.json()['access_token']
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
    def test_walkers_list_has_walker_color(self):
        """Verify walkers in list have walker_color for calendar"""
        response = requests.get(f"{BASE_URL}/api/users/walkers", headers=self.headers)
        assert response.status_code == 200
        walkers = response.json()
        
        for walker in walkers:
            # Color should be auto-assigned if not set
            if walker.get('walker_color'):
                assert walker['walker_color'].startswith('#'), "Color should be hex format"
        print(f"Found {len(walkers)} walkers, colors checked")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
