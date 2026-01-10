#!/usr/bin/env python3
"""
Simple test script for recurring schedule functionality
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://woofsched.preview.emergentagent.com"

def test_recurring_schedules():
    print("🔄 Testing Recurring Schedule Functionality")
    print("=" * 50)
    
    # Login with new_onboard_client
    login_data = {
        "username": "new_onboard_client",
        "password": "demo123"
    }
    
    print("1. Logging in as new_onboard_client...")
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return
    
    token = response.json()['access_token']
    user = response.json()['user']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    print(f"✅ Logged in as {user['full_name']} (ID: {user['id']})")
    
    # Create a test pet first
    print("\n2. Creating a test pet...")
    pet_data = {
        "name": "Test Dog",
        "species": "dog",
        "breed": "Golden Retriever",
        "age": "3",  # String as expected
        "weight": 65.5,
        "notes": "Test pet for recurring schedule"
    }
    
    response = requests.post(f"{BASE_URL}/api/pets", json=pet_data, headers=headers)
    if response.status_code != 200:
        print(f"❌ Pet creation failed: {response.status_code} - {response.text}")
        return
    
    pet = response.json()
    pet_id = pet['id']
    print(f"✅ Created test pet: {pet['name']} (ID: {pet_id})")
    
    # Test 1: Create recurring schedule
    print("\n3. Creating recurring schedule...")
    recurring_data = {
        "pet_ids": [pet_id],
        "service_type": "walk_30",
        "scheduled_time": "10:00",
        "day_of_week": 1,  # Tuesday
        "notes": "Weekly recurring walk test"
    }
    
    response = requests.post(f"{BASE_URL}/api/recurring-schedules", json=recurring_data, headers=headers)
    if response.status_code != 200:
        print(f"❌ Recurring schedule creation failed: {response.status_code} - {response.text}")
        return
    
    schedule = response.json()
    schedule_id = schedule['id']
    print(f"✅ Created recurring schedule: {schedule_id}")
    print(f"   Service: {schedule['service_type']}")
    print(f"   Day: {schedule['day_of_week']} (Tuesday)")
    print(f"   Time: {schedule['scheduled_time']}")
    print(f"   Status: {schedule['status']}")
    
    # Test 2: Get recurring schedules
    print("\n4. Getting recurring schedules...")
    response = requests.get(f"{BASE_URL}/api/recurring-schedules", headers=headers)
    if response.status_code != 200:
        print(f"❌ Get recurring schedules failed: {response.status_code} - {response.text}")
        return
    
    schedules = response.json()
    print(f"✅ Retrieved {len(schedules)} recurring schedules")
    
    # Find our schedule
    found_schedule = None
    for s in schedules:
        if s['id'] == schedule_id:
            found_schedule = s
            break
    
    if found_schedule:
        print(f"✅ Our schedule found in list with status: {found_schedule['status']}")
    else:
        print("⚠️  Our schedule not found in list")
    
    # Test 3: Pause recurring schedule
    print("\n5. Pausing recurring schedule...")
    response = requests.put(f"{BASE_URL}/api/recurring-schedules/{schedule_id}/pause", headers=headers)
    if response.status_code != 200:
        print(f"❌ Pause failed: {response.status_code} - {response.text}")
    else:
        print("✅ Schedule paused successfully")
    
    # Test 4: Resume recurring schedule
    print("\n6. Resuming recurring schedule...")
    response = requests.put(f"{BASE_URL}/api/recurring-schedules/{schedule_id}/resume", headers=headers)
    if response.status_code != 200:
        print(f"❌ Resume failed: {response.status_code} - {response.text}")
    else:
        print("✅ Schedule resumed successfully")
    
    # Test 5: Stop recurring schedule
    print("\n7. Stopping recurring schedule...")
    response = requests.put(f"{BASE_URL}/api/recurring-schedules/{schedule_id}/stop", headers=headers)
    if response.status_code != 200:
        print(f"❌ Stop failed: {response.status_code} - {response.text}")
    else:
        print("✅ Schedule stopped successfully")
    
    # Test 6: Verify final status
    print("\n8. Verifying final status...")
    response = requests.get(f"{BASE_URL}/api/recurring-schedules", headers=headers)
    if response.status_code == 200:
        schedules = response.json()
        for s in schedules:
            if s['id'] == schedule_id:
                print(f"✅ Final status: {s['status']}")
                break
    
    # Test 7: Create walk_60 recurring schedule
    print("\n9. Creating walk_60 recurring schedule...")
    recurring_data_60 = {
        "pet_ids": [pet_id],
        "service_type": "walk_60",
        "scheduled_time": "14:00",
        "day_of_week": 3,  # Thursday
        "notes": "Weekly 60-minute walk test"
    }
    
    response = requests.post(f"{BASE_URL}/api/recurring-schedules", json=recurring_data_60, headers=headers)
    if response.status_code != 200:
        print(f"❌ Walk_60 schedule creation failed: {response.status_code} - {response.text}")
    else:
        schedule_60 = response.json()
        schedule_60_id = schedule_60['id']
        print(f"✅ Created walk_60 recurring schedule: {schedule_60_id}")
        
        # Clean up
        requests.put(f"{BASE_URL}/api/recurring-schedules/{schedule_60_id}/stop", headers=headers)
        print("✅ Cleaned up walk_60 schedule")
    
    # Clean up test pet
    print("\n10. Cleaning up test pet...")
    response = requests.delete(f"{BASE_URL}/api/pets/{pet_id}", headers=headers)
    if response.status_code == 200:
        print("✅ Test pet cleaned up")
    
    print("\n🎉 Recurring schedule functionality testing completed!")

if __name__ == "__main__":
    test_recurring_schedules()