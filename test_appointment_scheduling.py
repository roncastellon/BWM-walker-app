#!/usr/bin/env python3
"""
Focused test for appointment scheduling functionality
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://woofsched.preview.emergentagent.com"

def login_user(username, password):
    """Login and return access token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    if response.status_code == 200:
        return response.json()['access_token']
    return None

def test_appointment_scheduling():
    print("🗓️  Testing Appointment Scheduling Functionality")
    print("=" * 60)
    
    # Login as demo users
    admin_token = login_user("demo_admin", "demo123")
    walker_token = login_user("demo_walker", "demo123")
    client_token = login_user("demo_client", "demo123")
    
    if not all([admin_token, walker_token, client_token]):
        print("❌ Failed to login with demo credentials")
        return False
    
    print("✅ Successfully logged in as demo users")
    
    # Get client pets for testing
    response = requests.get(f"{BASE_URL}/api/pets", headers={"Authorization": f"Bearer {client_token}"})
    if response.status_code != 200 or not response.json():
        print("❌ No pets found for demo client")
        return False
    
    pet_id = response.json()[0]['id']
    print(f"✅ Found pet for testing: {pet_id}")
    
    # Get walkers for testing
    response = requests.get(f"{BASE_URL}/api/users/walkers", headers={"Authorization": f"Bearer {admin_token}"})
    if response.status_code != 200 or not response.json():
        print("❌ No walkers found")
        return False
    
    walker_id = response.json()[0]['id']
    print(f"✅ Found walker for testing: {walker_id}")
    
    # Test 1: Time Slot Limits (max 3 per slot)
    print("\n🔍 Test 1: Time Slot Limits")
    test_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
    test_time = "09:00"
    
    # Create 3 appointments at same time slot
    created_appointments = []
    for i in range(3):
        appt_data = {
            "pet_ids": [pet_id],
            "service_type": "walk_30",
            "scheduled_date": test_date,
            "scheduled_time": test_time,
            "notes": f"Time slot test {i+1}"
        }
        response = requests.post(f"{BASE_URL}/api/appointments", 
                               json=appt_data, 
                               headers={"Authorization": f"Bearer {client_token}"})
        
        if response.status_code == 200:
            created_appointments.append(response.json()['id'])
            print(f"✅ Created appointment {i+1}/3")
        else:
            print(f"❌ Failed to create appointment {i+1}: {response.json()}")
    
    # Try to create 4th appointment (should fail)
    appt_data = {
        "pet_ids": [pet_id],
        "service_type": "walk_30",
        "scheduled_date": test_date,
        "scheduled_time": test_time,
        "notes": "4th appointment - should fail"
    }
    response = requests.post(f"{BASE_URL}/api/appointments", 
                           json=appt_data, 
                           headers={"Authorization": f"Bearer {client_token}"})
    
    if response.status_code == 400 and "time slot is full" in response.json().get('detail', '').lower():
        print("✅ 4th appointment correctly rejected - time slot limit enforced")
    else:
        print(f"❌ 4th appointment should have failed: {response.status_code} - {response.json()}")
    
    # Test 2: Walker Conflicts
    print("\n🔍 Test 2: Walker Conflicts")
    test_date2 = (datetime.now() + timedelta(days=6)).strftime('%Y-%m-%d')
    test_time2 = "10:00"
    
    # Get demo client ID
    response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {client_token}"})
    client_id = response.json()['id']
    
    # Create appointment with walker assigned (admin endpoint)
    appt_data = {
        "client_id": client_id,
        "pet_ids": [pet_id],
        "service_type": "walk_60",
        "scheduled_date": test_date2,
        "scheduled_time": test_time2,
        "walker_id": walker_id,
        "notes": "First appointment with walker"
    }
    response = requests.post(f"{BASE_URL}/api/appointments/admin", 
                           json=appt_data, 
                           headers={"Authorization": f"Bearer {admin_token}"})
    
    if response.status_code == 200:
        first_appt_id = response.json()['id']
        print("✅ Created first appointment with walker assigned")
        
        # Try to create second appointment with same walker at same time (should fail)
        appt_data2 = {
            "client_id": client_id,
            "pet_ids": [pet_id],
            "service_type": "walk_30",
            "scheduled_date": test_date2,
            "scheduled_time": test_time2,
            "walker_id": walker_id,
            "notes": "Second appointment - should fail"
        }
        response = requests.post(f"{BASE_URL}/api/appointments/admin", 
                               json=appt_data2, 
                               headers={"Authorization": f"Bearer {admin_token}"})
        
        if response.status_code == 400 and "walker is already booked" in response.json().get('detail', '').lower():
            print("✅ Walker conflict correctly detected and rejected")
        else:
            print(f"❌ Walker conflict should have been detected: {response.status_code} - {response.json()}")
    else:
        print(f"❌ Failed to create first appointment: {response.json()}")
    
    # Test 3: Admin Create Appointment
    print("\n🔍 Test 3: Admin Create Appointment")
    test_date3 = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
    test_time3 = "11:00"
    
    appt_data = {
        "client_id": client_id,
        "pet_ids": [pet_id],
        "service_type": "walk_60",
        "scheduled_date": test_date3,
        "scheduled_time": test_time3,
        "walker_id": walker_id,
        "notes": "Admin-created appointment"
    }
    response = requests.post(f"{BASE_URL}/api/appointments/admin", 
                           json=appt_data, 
                           headers={"Authorization": f"Bearer {admin_token}"})
    
    if response.status_code == 200:
        admin_appt_id = response.json()['id']
        if response.json()['client_id'] == client_id:
            print("✅ Admin successfully created appointment for client")
        else:
            print("❌ Admin appointment has wrong client_id")
    else:
        print(f"❌ Admin failed to create appointment: {response.json()}")
    
    # Test 4: Admin Update Appointment
    print("\n🔍 Test 4: Admin Update Appointment")
    if 'admin_appt_id' in locals():
        # Get another walker for reassignment
        walkers = requests.get(f"{BASE_URL}/api/users/walkers", headers={"Authorization": f"Bearer {admin_token}"}).json()
        if len(walkers) > 1:
            new_walker_id = walkers[1]['id']
            
            update_data = {
                "walker_id": new_walker_id,
                "scheduled_time": "12:00",
                "notes": "Updated by admin"
            }
            response = requests.put(f"{BASE_URL}/api/appointments/{admin_appt_id}", 
                                  json=update_data, 
                                  headers={"Authorization": f"Bearer {admin_token}"})
            
            if response.status_code == 200:
                updated_appt = response.json()
                if updated_appt['walker_id'] == new_walker_id and updated_appt['scheduled_time'] == "12:00":
                    print("✅ Admin successfully updated appointment")
                else:
                    print("❌ Admin update didn't apply correctly")
            else:
                print(f"❌ Admin failed to update appointment: {response.json()}")
        else:
            print("⚠️  Need at least 2 walkers for update test")
    
    # Test 5: Available Slots Endpoint
    print("\n🔍 Test 5: Available Slots Endpoint")
    test_date5 = "2026-01-02"
    
    response = requests.get(f"{BASE_URL}/api/appointments/available-slots?date={test_date5}", 
                          headers={"Authorization": f"Bearer {client_token}"})
    
    if response.status_code == 200:
        slots_data = response.json()
        if 'date' in slots_data and 'slots' in slots_data:
            slots = slots_data['slots']
            if slots and all(key in slots[0] for key in ['time', 'booked_count', 'is_full', 'available_walkers']):
                print(f"✅ Available slots endpoint working - found {len(slots)} time slots")
                print(f"   Example: {slots[0]['time']} - Booked: {slots[0]['booked_count']}, Available walkers: {len(slots[0]['available_walkers'])}")
            else:
                print("❌ Available slots missing required fields")
        else:
            print("❌ Available slots response missing date/slots")
    else:
        print(f"❌ Available slots endpoint failed: {response.status_code} - {response.json()}")
    
    # Test 6: Services List (Pet Sitting)
    print("\n🔍 Test 6: Services List - Pet Sitting")
    response = requests.get(f"{BASE_URL}/api/services")
    
    if response.status_code == 200:
        services = response.json()
        pet_sitting_service = None
        for service in services:
            if service.get('service_type') == 'petsit_our_location':
                pet_sitting_service = service
                break
        
        if pet_sitting_service:
            if pet_sitting_service.get('price') == 50.00:
                print("✅ Pet Sitting - Our Location (Boarding) service found at $50.00")
            else:
                print(f"❌ Pet sitting service price wrong: ${pet_sitting_service.get('price')}")
        else:
            print("❌ Pet Sitting - Our Location (Boarding) service not found")
    else:
        print(f"❌ Services endpoint failed: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🎉 Appointment Scheduling Tests Complete!")
    return True

if __name__ == "__main__":
    test_appointment_scheduling()