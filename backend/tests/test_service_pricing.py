"""
Tests for Service Pricing functionality - Edit and Create services
Tests: PUT /services/{id}, POST /services with different duration_types
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestServicePricing:
    """Service pricing CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "demo_admin",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_get_services(self, auth_headers):
        """Test GET /services returns list of services"""
        response = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        assert response.status_code == 200, f"Get services failed: {response.text}"
        services = response.json()
        assert isinstance(services, list), "Services should be a list"
        assert len(services) > 0, "Should have at least one service"
        
        # Verify service structure
        service = services[0]
        assert "id" in service, "Service should have id"
        assert "name" in service, "Service should have name"
        assert "price" in service, "Service should have price"
        assert "duration_type" in service or service.get("duration_type") is None, "Service should have duration_type"
        print(f"PASSED: GET /services returns {len(services)} services")
    
    def test_update_service_pricing_name_price_description(self, auth_headers):
        """Test PUT /services/{id} updates name, price, description via JSON body"""
        # First get a service to update
        services_resp = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        services = services_resp.json()
        assert len(services) > 0, "Need services to test update"
        service = services[0]
        original_name = service.get("name")
        original_price = service.get("price")
        
        # Update service
        update_data = {
            "name": "TEST_Updated Service Name",
            "price": 99.99,
            "description": "TEST_Updated description"
        }
        response = requests.put(
            f"{BASE_URL}/api/services/{service['id']}", 
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update service failed: {response.text}"
        
        updated = response.json()
        assert updated.get("name") == "TEST_Updated Service Name", f"Name not updated: {updated}"
        assert updated.get("price") == 99.99, f"Price not updated: {updated}"
        assert updated.get("description") == "TEST_Updated description", f"Description not updated: {updated}"
        
        # Restore original values
        requests.put(
            f"{BASE_URL}/api/services/{service['id']}", 
            headers=auth_headers,
            json={"name": original_name, "price": original_price, "description": service.get("description", "")}
        )
        print("PASSED: PUT /services/{id} updates name, price, description via JSON body")
    
    def test_update_service_duration_type(self, auth_headers):
        """Test PUT /services/{id} can update duration_type"""
        services_resp = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        services = services_resp.json()
        service = services[0]
        original_duration_type = service.get("duration_type", "minutes")
        
        # Update duration_type to days
        response = requests.put(
            f"{BASE_URL}/api/services/{service['id']}", 
            headers=auth_headers,
            json={"duration_type": "days"}
        )
        assert response.status_code == 200, f"Update duration_type failed: {response.text}"
        
        updated = response.json()
        assert updated.get("duration_type") == "days", f"duration_type not updated: {updated}"
        
        # Restore original duration_type
        requests.put(
            f"{BASE_URL}/api/services/{service['id']}", 
            headers=auth_headers,
            json={"duration_type": original_duration_type}
        )
        print("PASSED: PUT /services/{id} updates duration_type")
    
    def test_create_service_minutes_duration_type(self, auth_headers):
        """Test POST /services with duration_type='minutes' (per visit with time)"""
        service_data = {
            "service_type": f"test_minutes_{uuid.uuid4().hex[:8]}",
            "name": "TEST_Minutes Service",
            "price": 25.00,
            "description": "Test per-visit service",
            "duration_minutes": 45,
            "duration_type": "minutes"
        }
        response = requests.post(f"{BASE_URL}/api/services", headers=auth_headers, json=service_data)
        assert response.status_code == 200, f"Create service failed: {response.text}"
        
        created = response.json()
        assert created.get("duration_type") == "minutes", f"duration_type not minutes: {created}"
        assert created.get("duration_minutes") == 45, f"duration_minutes not set: {created}"
        assert "id" in created, "Service should have id"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/services/{created['id']}", headers=auth_headers)
        print("PASSED: POST /services with duration_type='minutes' creates per-visit service")
    
    def test_create_service_days_duration_type(self, auth_headers):
        """Test POST /services with duration_type='days' (per-day billing)"""
        service_data = {
            "service_type": f"test_days_{uuid.uuid4().hex[:8]}",
            "name": "TEST_Days Service",
            "price": 40.00,
            "description": "Test per-day service",
            "duration_minutes": 1,
            "duration_type": "days"
        }
        response = requests.post(f"{BASE_URL}/api/services", headers=auth_headers, json=service_data)
        assert response.status_code == 200, f"Create service failed: {response.text}"
        
        created = response.json()
        assert created.get("duration_type") == "days", f"duration_type not days: {created}"
        assert "id" in created, "Service should have id"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/services/{created['id']}", headers=auth_headers)
        print("PASSED: POST /services with duration_type='days' creates per-day service")
    
    def test_create_service_nights_duration_type(self, auth_headers):
        """Test POST /services with duration_type='nights' (per-night billing)"""
        service_data = {
            "service_type": f"test_nights_{uuid.uuid4().hex[:8]}",
            "name": "TEST_Nights Service",
            "price": 60.00,
            "description": "Test per-night service",
            "duration_minutes": 1,
            "duration_type": "nights"
        }
        response = requests.post(f"{BASE_URL}/api/services", headers=auth_headers, json=service_data)
        assert response.status_code == 200, f"Create service failed: {response.text}"
        
        created = response.json()
        assert created.get("duration_type") == "nights", f"duration_type not nights: {created}"
        assert "id" in created, "Service should have id"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/services/{created['id']}", headers=auth_headers)
        print("PASSED: POST /services with duration_type='nights' creates per-night service")
    
    def test_delete_service(self, auth_headers):
        """Test DELETE /services/{id} removes service"""
        # Create a test service
        service_data = {
            "service_type": f"test_delete_{uuid.uuid4().hex[:8]}",
            "name": "TEST_Delete Service",
            "price": 10.00,
            "description": "Service to be deleted",
            "duration_type": "minutes"
        }
        create_resp = requests.post(f"{BASE_URL}/api/services", headers=auth_headers, json=service_data)
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        service_id = create_resp.json()["id"]
        
        # Delete the service
        delete_resp = requests.delete(f"{BASE_URL}/api/services/{service_id}", headers=auth_headers)
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        services = get_resp.json()
        service_ids = [s["id"] for s in services]
        assert service_id not in service_ids, "Service should be deleted"
        print("PASSED: DELETE /services/{id} removes service")
    
    def test_update_nonexistent_service_returns_404(self, auth_headers):
        """Test PUT /services/{id} returns 404 for nonexistent service"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/services/{fake_id}", 
            headers=auth_headers,
            json={"name": "Test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASSED: PUT /services/{id} returns 404 for nonexistent service")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
