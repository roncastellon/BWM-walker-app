#!/usr/bin/env python3
"""
BowWowMeow App - New Features Testing
Testing the two new features from the review request:
1. Accounts Receivable Aging Report
2. Freeze/Unfreeze User Functionality Fix
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class BowWowMeowTester:
    def __init__(self, base_url="https://recurringwalk.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}
        self.users = {}
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

    def login_demo_users(self):
        """Login with demo credentials"""
        print("\n🔑 Logging in with demo credentials...")
        
        # Demo admin login
        admin_login = {
            "username": "demo_admin",
            "password": "demo123"
        }
        success, response = self.run_test(
            "Demo Admin Login", "POST", "auth/login", 200,
            data=admin_login, description="Login with demo admin credentials"
        )
        if success:
            self.tokens['admin'] = response.get('access_token')
            self.users['admin'] = response.get('user')
        
        # Demo client login
        client_login = {
            "username": "demo_client",
            "password": "demo123"
        }
        success, response = self.run_test(
            "Demo Client Login", "POST", "auth/login", 200,
            data=client_login, description="Login with demo client credentials"
        )
        if success:
            self.tokens['client'] = response.get('access_token')
            self.users['client'] = response.get('user')

    def test_accounts_receivable_aging_report(self):
        """Test accounts receivable aging report endpoint"""
        print("\n" + "=" * 70)
        print("📊 TESTING ACCOUNTS RECEIVABLE AGING REPORT")
        print("=" * 70)
        
        if not self.tokens.get('admin'):
            print("⚠️  Skipping receivable aging report test - no admin token")
            return
        
        # Test GET /api/reports/receivable-aging
        success, response = self.run_test(
            "Get Receivable Aging Report", "GET", "reports/receivable-aging", 200,
            token=self.tokens['admin'],
            description="Get accounts receivable aging report (admin only)"
        )
        
        if success:
            print("\n📋 AGING REPORT STRUCTURE VALIDATION:")
            
            # Verify response structure
            required_fields = ['generated_at', 'grand_total', 'total_invoices', 'buckets']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Missing fields in aging report: {missing_fields}")
            else:
                print("✅ Aging report contains all required fields")
                
                # Verify buckets structure
                buckets = response.get('buckets', {})
                expected_buckets = ['current', 'thirty', 'sixty', 'ninety_plus']
                missing_buckets = [bucket for bucket in expected_buckets if bucket not in buckets]
                
                if missing_buckets:
                    print(f"❌ Missing buckets in aging report: {missing_buckets}")
                else:
                    print("✅ All aging buckets present (Current, 30 Days, 60 Days, 90+ Days)")
                    
                    # Verify bucket structure
                    all_buckets_valid = True
                    for bucket_name, bucket_data in buckets.items():
                        bucket_fields = ['label', 'total', 'count', 'invoices']
                        missing_bucket_fields = [field for field in bucket_fields if field not in bucket_data]
                        if missing_bucket_fields:
                            print(f"❌ Missing fields in {bucket_name} bucket: {missing_bucket_fields}")
                            all_buckets_valid = False
                        else:
                            print(f"✅ {bucket_name} bucket structure correct")
                    
                    if all_buckets_valid:
                        print("✅ All bucket structures valid")
                
                print("\n📊 AGING REPORT SUMMARY:")
                print(f"   Grand Total: ${response.get('grand_total', 0)}")
                print(f"   Total Invoices: {response.get('total_invoices', 0)}")
                
                # Display bucket summaries with color coding
                bucket_colors = {
                    'current': '🟢',
                    'thirty': '🟡', 
                    'sixty': '🟠',
                    'ninety_plus': '🔴'
                }
                
                for bucket_name, bucket_data in buckets.items():
                    color = bucket_colors.get(bucket_name, '⚪')
                    label = bucket_data.get('label', bucket_name)
                    total = bucket_data.get('total', 0)
                    count = bucket_data.get('count', 0)
                    print(f"   {color} {label}: ${total} ({count} invoices)")
                    
                    # Show invoice details if any
                    invoices = bucket_data.get('invoices', [])
                    if invoices:
                        print(f"      Sample invoices:")
                        for i, invoice in enumerate(invoices[:3]):  # Show first 3
                            client_name = invoice.get('client_name', 'Unknown')
                            amount = invoice.get('amount', 0)
                            days_overdue = invoice.get('days_overdue', 0)
                            print(f"        - {client_name}: ${amount} ({days_overdue} days overdue)")
                        if len(invoices) > 3:
                            print(f"        ... and {len(invoices) - 3} more")
        
        # Test admin-only access control
        if self.tokens.get('client'):
            success, response = self.run_test(
                "Non-Admin Access (Should Fail)", "GET", "reports/receivable-aging", 403,
                token=self.tokens['client'],
                description="Test that non-admin users cannot access aging report"
            )
            
            if success:
                print("✅ Non-admin access properly blocked with 403 Forbidden")

    def test_freeze_unfreeze_user_functionality(self):
        """Test freeze/unfreeze user functionality with include_frozen parameter"""
        print("\n" + "=" * 70)
        print("🧊 TESTING FREEZE/UNFREEZE USER FUNCTIONALITY")
        print("=" * 70)
        
        if not self.tokens.get('admin'):
            print("⚠️  Skipping freeze/unfreeze test - no admin token")
            return
        
        print("\n🔍 TESTING WALKERS ENDPOINT:")
        
        # Test 1: Get walkers without include_frozen (should only show active)
        success, active_walkers = self.run_test(
            "Get Active Walkers Only", "GET", "users/walkers", 200,
            token=self.tokens['admin'],
            description="GET /users/walkers (active only)"
        )
        
        if success:
            active_count = len(active_walkers)
            print(f"✅ Active walkers retrieved: {active_count} walkers")
        
        # Test 2: Get walkers with include_frozen=true (should show all including frozen)
        success, all_walkers = self.run_test(
            "Get All Walkers Including Frozen", "GET", "users/walkers?include_frozen=true", 200,
            token=self.tokens['admin'],
            description="GET /users/walkers?include_frozen=true (all walkers)"
        )
        
        if success:
            all_count = len(all_walkers)
            print(f"✅ All walkers retrieved: {all_count} walkers")
            
            # Check if we have more walkers when including frozen
            if all_count >= active_count:
                print("✅ include_frozen=true returns same or more walkers than active-only")
                if all_count > active_count:
                    frozen_count = all_count - active_count
                    print(f"   Found {frozen_count} frozen walker(s)")
            else:
                print("❌ include_frozen=true returned fewer walkers than active-only")
        
        print("\n🔍 TESTING CLIENTS ENDPOINT:")
        
        # Test 3: Get clients without include_frozen (should only show active)
        success, active_clients = self.run_test(
            "Get Active Clients Only", "GET", "users/clients", 200,
            token=self.tokens['admin'],
            description="GET /users/clients (active only)"
        )
        
        if success:
            active_client_count = len(active_clients)
            print(f"✅ Active clients retrieved: {active_client_count} clients")
        
        # Test 4: Get clients with include_frozen=true (should show all including frozen)
        success, all_clients = self.run_test(
            "Get All Clients Including Frozen", "GET", "users/clients?include_frozen=true", 200,
            token=self.tokens['admin'],
            description="GET /users/clients?include_frozen=true (all clients)"
        )
        
        if success:
            all_client_count = len(all_clients)
            print(f"✅ All clients retrieved: {all_client_count} clients")
            
            # Check if we have more clients when including frozen
            if all_client_count >= active_client_count:
                print("✅ include_frozen=true returns same or more clients than active-only")
                if all_client_count > active_client_count:
                    frozen_client_count = all_client_count - active_client_count
                    print(f"   Found {frozen_client_count} frozen client(s)")
            else:
                print("❌ include_frozen=true returned fewer clients than active-only")
        
        print("\n🔍 TESTING FREEZE/UNFREEZE OPERATIONS:")
        
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
                
                print(f"\n🧊 Testing freeze/unfreeze with walker: {walker_name}")
                
                # Test freezing the walker
                success, freeze_response = self.run_test(
                    "Freeze Walker", "PUT", f"users/{walker_id}/freeze", 200,
                    token=self.tokens['admin'],
                    description=f"Freeze walker {walker_name}"
                )
                
                if success:
                    print(f"✅ Walker {walker_name} frozen successfully")
                    
                    # Verify frozen walker appears in include_frozen=true but not in active-only
                    success, active_after_freeze = self.run_test(
                        "Verify Frozen Walker Not in Active List", "GET", "users/walkers", 200,
                        token=self.tokens['admin'],
                        description="Verify frozen walker not in active-only list"
                    )
                    
                    success, all_after_freeze = self.run_test(
                        "Verify Frozen Walker in All List", "GET", "users/walkers?include_frozen=true", 200,
                        token=self.tokens['admin'],
                        description="Verify frozen walker appears in include_frozen=true list"
                    )
                    
                    if success:
                        # Check if frozen walker is in all list but not active list
                        frozen_in_all = any(w['id'] == walker_id and not w.get('is_active', True) for w in all_after_freeze)
                        frozen_in_active = any(w['id'] == walker_id for w in active_after_freeze)
                        
                        if frozen_in_all and not frozen_in_active:
                            print("✅ Frozen walker correctly appears only in include_frozen=true list")
                        elif frozen_in_all and frozen_in_active:
                            print("❌ Frozen walker incorrectly appears in active list")
                        elif not frozen_in_all:
                            print("❌ Frozen walker not found in include_frozen=true list")
                    
                    # Test unfreezing the walker
                    success, unfreeze_response = self.run_test(
                        "Unfreeze Walker", "PUT", f"users/{walker_id}/unfreeze", 200,
                        token=self.tokens['admin'],
                        description=f"Unfreeze walker {walker_name}"
                    )
                    
                    if success:
                        print(f"✅ Walker {walker_name} unfrozen successfully")
                        
                        # Verify unfrozen walker appears in active list again
                        success, active_after_unfreeze = self.run_test(
                            "Verify Unfrozen Walker in Active List", "GET", "users/walkers", 200,
                            token=self.tokens['admin'],
                            description="Verify unfrozen walker appears in active list"
                        )
                        
                        if success:
                            unfrozen_in_active = any(w['id'] == walker_id and w.get('is_active', True) for w in active_after_unfreeze)
                            if unfrozen_in_active:
                                print("✅ Unfrozen walker correctly appears in active list")
                            else:
                                print("❌ Unfrozen walker not appearing in active list")
            else:
                print("⚠️  No active walkers found to test freeze/unfreeze functionality")

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 70)
        print("📊 BOWWOWMEOW NEW FEATURES TEST RESULTS")
        print("=" * 70)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {len(self.failed_tests)}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success rate: {success_rate:.1f}%")
        else:
            print("Success rate: 0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                print(f"  • {test['test']}: {error_msg}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
        
        return len(self.failed_tests) == 0

def main():
    """Main test runner"""
    print("🐕 BowWowMeow App - New Features Testing")
    print("=" * 50)
    print("Testing two new features:")
    print("1. Accounts Receivable Aging Report")
    print("2. Freeze/Unfreeze User Functionality Fix")
    print("=" * 50)
    
    tester = BowWowMeowTester()
    
    try:
        # Login with demo credentials
        tester.login_demo_users()
        
        # Test the two new features
        tester.test_accounts_receivable_aging_report()
        tester.test_freeze_unfreeze_user_functionality()
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
    
    # Print results and return exit code
    success = tester.print_summary()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())