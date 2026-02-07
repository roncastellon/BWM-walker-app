"""
Test suite for Admin Password Change functionality
Tests the ability for admin to change user passwords via PUT /users/{user_id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"username": "demo_admin", "password": "demo123"}
CLIENT_CREDENTIALS = {"username": "demo_client", "password": "demo123"}
WALKER_CREDENTIALS = {"username": "demo_walker", "password": "demo123"}

# Test password
TEST_PASSWORD = "testpass123"

class TestAdminPasswordChange:
    """Test admin password change functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get admin token and client user_id"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.admin_token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
        # Get client user_id
        self.client_id = "7dc6c426-7aed-499e-9b93-457731581a43"  # demo_client ID from context
        
        yield
        
        # Cleanup - reset password back to original
        self._reset_password_to_original()
    
    def _reset_password_to_original(self):
        """Reset demo_client password back to demo123"""
        try:
            response = self.session.put(
                f"{BASE_URL}/api/users/{self.client_id}",
                json={"password": "demo123"}
            )
            print(f"Password reset response: {response.status_code}")
        except Exception as e:
            print(f"Password reset error: {e}")
    
    def test_01_admin_login(self):
        """TEST 1: Verify admin can login with demo_admin/demo123"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("TEST 1 PASSED: Admin login successful")
    
    def test_02_client_login_original_password(self):
        """TEST 2: Verify client can login with original password demo123"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=CLIENT_CREDENTIALS
        )
        assert response.status_code == 200, f"Client login failed: {response.text}"
        data = response.json()
        assert data["user"]["username"] == "demo_client"
        print("TEST 2 PASSED: Client login with original password successful")
    
    def test_03_admin_change_client_password(self):
        """TEST 3: Admin changes client password to testpass123"""
        response = self.session.put(
            f"{BASE_URL}/api/users/{self.client_id}",
            json={"password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Password change failed: {response.text}"
        print(f"TEST 3 PASSED: Admin changed client password. Response: {response.json()}")
    
    def test_04_client_login_new_password(self):
        """TEST 4: Verify client can login with new password testpass123"""
        # First change the password
        change_response = self.session.put(
            f"{BASE_URL}/api/users/{self.client_id}",
            json={"password": TEST_PASSWORD}
        )
        assert change_response.status_code == 200, f"Password change failed: {change_response.text}"
        
        # Now try to login with new password
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "demo_client", "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login with new password failed: {response.text}"
        data = response.json()
        assert data["user"]["username"] == "demo_client"
        print("TEST 4 PASSED: Client login with new password successful")
    
    def test_05_old_password_fails(self):
        """TEST 5: Verify old password demo123 fails after password change"""
        # First change the password
        change_response = self.session.put(
            f"{BASE_URL}/api/users/{self.client_id}",
            json={"password": TEST_PASSWORD}
        )
        assert change_response.status_code == 200, f"Password change failed: {change_response.text}"
        
        # Now try to login with old password - should fail
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "demo_client", "password": "demo123"}
        )
        assert response.status_code == 401, f"Old password should fail but got: {response.status_code}"
        print("TEST 5 PASSED: Old password correctly rejected")
    
    def test_06_reset_password_back(self):
        """TEST 6: Reset password back to demo123 and verify login"""
        # First change to test password
        self.session.put(
            f"{BASE_URL}/api/users/{self.client_id}",
            json={"password": TEST_PASSWORD}
        )
        
        # Reset back to original
        reset_response = self.session.put(
            f"{BASE_URL}/api/users/{self.client_id}",
            json={"password": "demo123"}
        )
        assert reset_response.status_code == 200, f"Password reset failed: {reset_response.text}"
        
        # Verify login with original password works again
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=CLIENT_CREDENTIALS
        )
        assert response.status_code == 200, f"Login with reset password failed: {response.text}"
        print("TEST 6 PASSED: Password reset to original and login successful")
    
    def test_07_walker_password_change(self):
        """TEST 7: Admin changes walker password and verifies login"""
        # Get walker user_id first
        response = self.session.get(f"{BASE_URL}/api/users/walkers?include_frozen=true")
        assert response.status_code == 200
        walkers = response.json()
        
        walker = next((w for w in walkers if w.get("username") == "demo_walker"), None)
        if not walker:
            pytest.skip("demo_walker not found")
        
        walker_id = walker["id"]
        
        # Change walker password
        change_response = self.session.put(
            f"{BASE_URL}/api/users/{walker_id}",
            json={"password": TEST_PASSWORD}
        )
        assert change_response.status_code == 200, f"Walker password change failed: {change_response.text}"
        
        # Verify login with new password
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "demo_walker", "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Walker login with new password failed: {login_response.text}"
        
        # Reset walker password back to original
        self.session.put(
            f"{BASE_URL}/api/users/{walker_id}",
            json={"password": "demo123"}
        )
        
        print("TEST 7 PASSED: Walker password change and login successful")


class TestPasswordChangeEdgeCases:
    """Test edge cases for password change"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.admin_token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        self.client_id = "7dc6c426-7aed-499e-9b93-457731581a43"
        
        yield
        
        # Cleanup - reset password
        try:
            self.session.put(
                f"{BASE_URL}/api/users/{self.client_id}",
                json={"password": "demo123"}
            )
        except:
            pass
    
    def test_empty_password_no_change(self):
        """TEST: Empty password should not change existing password"""
        # Send empty password
        response = self.session.put(
            f"{BASE_URL}/api/users/{self.client_id}",
            json={"password": ""}
        )
        assert response.status_code == 200
        
        # Verify original password still works
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=CLIENT_CREDENTIALS
        )
        assert login_response.status_code == 200, "Original password should still work after empty password update"
        print("TEST PASSED: Empty password does not change existing password")
    
    def test_non_admin_cannot_change_others_password(self):
        """TEST: Non-admin user cannot change another user's password"""
        # Login as client
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=CLIENT_CREDENTIALS
        )
        assert login_response.status_code == 200
        client_token = login_response.json()["access_token"]
        
        # Get walker ID
        admin_session = requests.Session()
        admin_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        })
        walkers_response = admin_session.get(f"{BASE_URL}/api/users/walkers")
        walkers = walkers_response.json()
        if not walkers:
            pytest.skip("No walkers found")
        walker_id = walkers[0]["id"]
        
        # Try to change walker password as client - should fail
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {client_token}"
        })
        response = session.put(
            f"{BASE_URL}/api/users/{walker_id}",
            json={"password": "hackedpassword"}
        )
        assert response.status_code == 403, f"Non-admin should not be able to change others' password: {response.status_code}"
        print("TEST PASSED: Non-admin cannot change other users' passwords")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
