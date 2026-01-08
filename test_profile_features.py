#!/usr/bin/env python3
"""
Focused test for client profile and pet management features with image upload
"""
import requests
import sys
import json
import io
from datetime import datetime

class ProfileFeatureTester:
    def __init__(self, base_url="https://petapp-dashboard.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def login_demo_client(self):
        """Login with demo client credentials"""
        print("🔐 Logging in as demo_client...")
        
        login_data = {
            "username": "demo_client",
            "password": "demo123"
        }
        
        url = f"{self.base_url}/api/auth/login"
        response = requests.post(url, json=login_data, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('access_token')
            self.user_id = data.get('user', {}).get('id')
            print(f"✅ Login successful - User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Login failed - Status: {response.status_code}")
            return False

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

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

    def test_user_profile_update(self):
        """Test PUT /api/users/{user_id} - Update profile with new data"""
        print("\n" + "="*50)
        print("1. TESTING USER PROFILE UPDATE")
        print("="*50)
        
        update_data = {
            "full_name": "Sarah Johnson Updated",
            "phone": "555-0199",
            "address": "456 Oak Street, Springfield, IL 62701",
            "email": "sarah.updated@example.com",
            "bio": "Dog lover and outdoor enthusiast. Looking forward to professional pet care services."
        }
        
        success, response = self.run_test(
            "User Profile Update", "PUT", f"users/{self.user_id}", 200,
            data=update_data, description="Update profile with new data: full_name, phone, address, email, bio"
        )
        
        if success:
            # Verify the response returns updated user data
            print("✅ Verifying updated data...")
            if response.get('full_name') == update_data['full_name']:
                print(f"   ✅ full_name: {response.get('full_name')}")
            else:
                print(f"   ❌ full_name not updated correctly")
            
            if response.get('address') == update_data['address']:
                print(f"   ✅ address: {response.get('address')}")
            else:
                print(f"   ❌ address not updated correctly")
                
            if response.get('bio') == update_data['bio']:
                print(f"   ✅ bio: {response.get('bio')}")
            else:
                print(f"   ❌ bio not updated correctly")

    def test_profile_image_upload(self):
        """Test POST /api/upload/profile - Upload profile image"""
        print("\n" + "="*50)
        print("2. TESTING PROFILE IMAGE UPLOAD")
        print("="*50)
        
        # Create a test image file (1x1 pixel PNG)
        test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x12IDATx\x9cc```bPPP\x00\x02\xac\xea\x05\x1b\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_profile.png', io.BytesIO(test_image_data), 'image/png')}
        
        success, response = self.run_test(
            "Profile Image Upload", "POST", "upload/profile", 200,
            files=files, description="Upload an image file and verify URL is returned"
        )
        
        if success and 'url' in response:
            print(f"✅ Image URL returned: {response['url']}")
            self.profile_image_url = response['url']
            
            # Verify user profile_image is updated by getting user info
            success, user_data = self.run_test(
                "Verify Profile Image Updated", "GET", "auth/me", 200,
                description="Check if user profile_image field was updated"
            )
            
            if success and user_data.get('profile_image') == response['url']:
                print("✅ User profile_image field updated correctly")
            else:
                print("❌ User profile_image field not updated")

    def test_pet_update(self):
        """Test PUT /api/pets/{pet_id} - Update pet with new data"""
        print("\n" + "="*50)
        print("3. TESTING PET UPDATE")
        print("="*50)
        
        # First get list of pets to find a pet ID
        success, pets = self.run_test(
            "Get Pets List", "GET", "pets", 200,
            description="Get list of pets first to find a pet ID"
        )
        
        if not success or not pets:
            print("❌ No pets found for update test")
            return
        
        pet_id = pets[0]['id']
        print(f"✅ Found pet to update: {pet_id}")
        
        # Update pet with new data
        update_data = {
            "name": "Buddy Updated",
            "breed": "Golden Retriever Mix",
            "age": 4,
            "weight": 68.5,
            "notes": "Very friendly dog, loves treats and belly rubs. Updated information."
        }
        
        success, response = self.run_test(
            "Pet Update", "PUT", f"pets/{pet_id}", 200,
            data=update_data, description="Update pet with new data: name, breed, age, weight, notes"
        )
        
        if success:
            print("✅ Verifying updated pet data...")
            if response.get('name') == update_data['name']:
                print(f"   ✅ name: {response.get('name')}")
            else:
                print(f"   ❌ name not updated correctly")
            
            if response.get('weight') == update_data['weight']:
                print(f"   ✅ weight: {response.get('weight')}")
            else:
                print(f"   ❌ weight not updated correctly")
            
            self.pet_id = pet_id  # Store for image upload test

    def test_pet_image_upload(self):
        """Test POST /api/upload/pet/{pet_id} - Upload pet image"""
        print("\n" + "="*50)
        print("4. TESTING PET IMAGE UPLOAD")
        print("="*50)
        
        if not hasattr(self, 'pet_id'):
            print("❌ No pet ID available from previous test")
            return
        
        # Create a test image file (1x1 pixel PNG)
        test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x12IDATx\x9cc```bPPP\x00\x02\xac\xea\x05\x1b\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_pet.png', io.BytesIO(test_image_data), 'image/png')}
        
        success, response = self.run_test(
            "Pet Image Upload", "POST", f"upload/pet/{self.pet_id}", 200,
            files=files, description="Upload an image for a pet and verify URL is returned"
        )
        
        if success and 'url' in response:
            print(f"✅ Pet image URL returned: {response['url']}")
            self.pet_image_url = response['url']
            
            # Verify pet photo_url is updated
            success, pet_data = self.run_test(
                "Verify Pet Image Updated", "GET", f"pets/{self.pet_id}", 200,
                description="Check if pet photo_url field was updated"
            )
            
            if success and pet_data.get('photo_url') == response['url']:
                print("✅ Pet photo_url field updated correctly")
            else:
                print("❌ Pet photo_url field not updated")

    def test_serve_uploaded_images(self):
        """Test GET /api/uploads/profiles/{filename} and GET /api/uploads/pets/{filename}"""
        print("\n" + "="*50)
        print("5. TESTING SERVE UPLOADED IMAGES")
        print("="*50)
        
        # Test serving profile image if we have one
        if hasattr(self, 'profile_image_url'):
            filename = self.profile_image_url.split('/api/uploads/profiles/')[-1]
            success, response = self.run_test(
                "Serve Profile Image", "GET", f"uploads/profiles/{filename}", 200,
                description=f"Test GET /api/uploads/profiles/{filename}"
            )
        
        # Test serving pet image if we have one
        if hasattr(self, 'pet_image_url'):
            filename = self.pet_image_url.split('/api/uploads/pets/')[-1]
            success, response = self.run_test(
                "Serve Pet Image", "GET", f"uploads/pets/{filename}", 200,
                description=f"Test GET /api/uploads/pets/{filename}"
            )

    def run_all_tests(self):
        """Run all profile and pet management tests"""
        print("🐕 Testing Client Profile and Pet Management Features")
        print("=" * 60)
        print("Test Credentials: demo_client / demo123")
        print("=" * 60)
        
        if not self.login_demo_client():
            print("❌ Cannot proceed without login")
            return False
        
        # Run all tests in order
        self.test_user_profile_update()
        self.test_profile_image_upload()
        self.test_pet_update()
        self.test_pet_image_upload()
        self.test_serve_uploaded_images()
        
        # Print results
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                print(f"  • {test['test']}: {error_msg}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return len(self.failed_tests) == 0

def main():
    tester = ProfileFeatureTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())