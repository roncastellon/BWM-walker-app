#!/usr/bin/env python3
"""
Test just the GET recurring schedules endpoint
"""
import requests

BASE_URL = "https://admin-timeoff-ui.preview.emergentagent.com"

def test_get_recurring_schedules():
    # Login with new_onboard_client
    login_data = {
        "username": "new_onboard_client",
        "password": "demo123"
    }
    
    print("Logging in...")
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return
    
    token = response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    print("Testing GET /api/recurring-schedules...")
    response = requests.get(f"{BASE_URL}/api/recurring-schedules", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        schedules = response.json()
        print(f"Found {len(schedules)} schedules")
        for schedule in schedules:
            print(f"  - ID: {schedule['id']}")
            print(f"    Service: {schedule['service_type']}")
            print(f"    Status: {schedule['status']}")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    test_get_recurring_schedules()