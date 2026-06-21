# test_api.py
import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    
    req_data = None
    if data:
        req_data = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as res:
            res_data = res.read().decode("utf-8")
            return res.status, json.loads(res_data)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code} on {method} {path}: {e.read().decode('utf-8')}")
        return e.code, None
    except Exception as e:
        print(f"Error connecting to {method} {path}: {e}")
        return None, None

def run_tests():
    print("Waiting 2 seconds for server to boot...")
    time.sleep(2)
    
    print("\n==============================================")
    print("      EIDON BACKEND DETAILED VERIFICATION")
    print("==============================================")
    
    # --------------------------------------------------------
    # Test 1: Root endpoint
    # --------------------------------------------------------
    status, body = test_endpoint("/")
    assert status == 200, "Root failed"
    assert "message" in body
    print("Test 1: Verify Root endpoint ......................................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 2: Projects pre-populated check
    # --------------------------------------------------------
    status, body = test_endpoint("/api/projects")
    assert status == 200, "Get projects failed"
    assert len(body) >= 4, "Default projects should exist"
    print("Test 2: Retrieve Pre-populated Projects .............................. COMPLETED")
    
    # --------------------------------------------------------
    # Test 3: Settings retrieve
    # --------------------------------------------------------
    status, body = test_endpoint("/api/settings")
    assert status == 200, "Get settings failed"
    assert "settings" in body
    print("Test 3: Fetch Default settings ....................................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 4: Tasks fetch
    # --------------------------------------------------------
    status, body = test_endpoint("/api/tasks")
    assert status == 200, "Get tasks failed"
    tasks = body.get("tasks", [])
    assert len(tasks) >= 24, "Seeded tasks should be 24 or more"
    print("Test 4: Verify Initial task listing .................................. COMPLETED")
    
    # --------------------------------------------------------
    # Test 5: Create a new Task
    # --------------------------------------------------------
    test_task_id = f"t_test_{int(time.time())}"
    test_task = {
        "id": test_task_id,
        "title": "Modular Restructuring Test Task",
        "project": "Inbox",
        "due": "2026-08-30",
        "est": "3h",
        "notes": "Testing modular backend routing structures",
        "done": False,
        "target": "today",
        "createdAt": int(time.time() * 1000)
    }
    status, body = test_endpoint("/api/tasks", method="POST", data=test_task)
    assert status == 200, "Create task failed"
    print("Test 5: Create a new Task ............................................ COMPLETED")
    
    # --------------------------------------------------------
    # Test 6: Verify newly created task list
    # --------------------------------------------------------
    status, body = test_endpoint("/api/tasks")
    tasks = body.get("tasks", [])
    found = any(t["id"] == test_task_id for t in tasks)
    assert found, "Created task not returned in tasks list"
    print("Test 6: Retrieve created task from listing ........................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 7: Add subtask
    # --------------------------------------------------------
    subtask_id = f"s_test_{int(time.time())}"
    subtask = {
        "id": subtask_id,
        "title": "Subtask to check tasks module routing",
        "done": False
    }
    status, body = test_endpoint(f"/api/tasks/{test_task_id}/subtasks", method="POST", data=subtask)
    assert status == 200, "Create subtask failed"
    print("Test 7: Add a Subtask to task ........................................ COMPLETED")
    
    # --------------------------------------------------------
    # Test 8: Toggle subtask completion status
    # --------------------------------------------------------
    status, body = test_endpoint(f"/api/tasks/{test_task_id}/subtasks/{subtask_id}", method="PUT", data={"done": True})
    assert status == 200, "Toggle subtask failed"
    print("Test 8: Complete Subtask ............................................. COMPLETED")
    
    # --------------------------------------------------------
    # Test 9: Verify subtask status persists
    # --------------------------------------------------------
    status, body = test_endpoint("/api/tasks")
    tasks = body.get("tasks", [])
    db_task = next(t for t in tasks if t["id"] == test_task_id)
    assert len(db_task["subtasks"]) == 1, "Subtask missing"
    assert db_task["subtasks"][0]["done"] == True, "Subtask status not saved"
    print("Test 9: Verify Subtask status persists ............................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 10: Create Timer session
    # --------------------------------------------------------
    session_id = f"sess_test_{int(time.time())}"
    session = {
        "id": session_id,
        "start": int(time.time() * 1000) - 1800000,
        "end": int(time.time() * 1000),
        "note": "Modular code verification timer run",
        "subtasksCompleted": [{"id": subtask_id, "title": "Subtask to check tasks module routing", "timestamp": int(time.time() * 1000)}]
    }
    status, body = test_endpoint(f"/api/tasks/{test_task_id}/sessions", method="POST", data=session)
    assert status == 200, "Create timer session failed"
    print("Test 10: Create Timer Session ........................................ COMPLETED")
    
    # --------------------------------------------------------
    # Test 11: Add Audit Log
    # --------------------------------------------------------
    audit_id = f"audit_test_{int(time.time())}"
    audit_log = {
        "id": audit_id,
        "timestamp": int(time.time() * 1000),
        "action": "timer_stopped",
        "details": {"duration": 1800, "note": "Modular code verification timer run"}
    }
    status, body = test_endpoint(f"/api/tasks/{test_task_id}/audit_logs", method="POST", data=audit_log)
    assert status == 200, "Create audit log failed"
    print("Test 11: Add Audit Log ............................................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 12: Verify Task attribute update
    # --------------------------------------------------------
    status, body = test_endpoint(f"/api/tasks/{test_task_id}", method="PUT", data={"notes": "Updated note during test 12"})
    assert status == 200, "Update task note failed"
    status, body = test_endpoint("/api/tasks")
    db_task = next(t for t in body.get("tasks", []) if t["id"] == test_task_id)
    assert db_task["notes"] == "Updated note during test 12", "Task note update failed"
    print("Test 12: Verify Task update endpoints (updating task details) ......... COMPLETED")
    
    # --------------------------------------------------------
    # Test 13: Create project dynamically
    # --------------------------------------------------------
    test_project_name = f"Project_{int(time.time())}"
    new_project = {
        "name": test_project_name,
        "color": "#e056fd"
    }
    status, body = test_endpoint("/api/projects", method="POST", data=new_project)
    assert status == 200, "Create project failed"
    print("Test 13: Create a new Project dynamically ............................ COMPLETED")
    
    # --------------------------------------------------------
    # Test 14: Assign task to project and delete project
    # --------------------------------------------------------
    # Update task to point to the new project
    status, body = test_endpoint(f"/api/tasks/{test_task_id}", method="PUT", data={"project": test_project_name})
    assert status == 200
    # Delete project
    status, body = test_endpoint(f"/api/projects/{test_project_name}", method="DELETE")
    assert status == 200, "Delete project failed"
    # Verify task fallback to 'Inbox'
    status, body = test_endpoint("/api/tasks")
    db_task = next(t for t in body.get("tasks", []) if t["id"] == test_task_id)
    assert db_task["project"] == "Inbox", "Deleted project didn't reassign task to Inbox"
    print("Test 14: Delete project & check tasks moved to Inbox ................. COMPLETED")
    
    # --------------------------------------------------------
    # Test 15: Save dynamic application settings
    # --------------------------------------------------------
    settings_payload = {
        "settings": {
            "appSize": 120,
            "showCompleted": False,
            "sleepStart": "23:00",
            "sleepEnd": "08:00"
        },
        "isSleeping": True,
        "sleepStartTime": int(time.time() * 1000)
    }
    status, body = test_endpoint("/api/settings", method="PUT", data=settings_payload)
    assert status == 200, "Update settings failed"
    print("Test 15: Update application settings dynamically ..................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 16: Verify settings persisted
    # --------------------------------------------------------
    status, body = test_endpoint("/api/settings")
    assert status == 200
    assert body["settings"]["appSize"] == 120, "Settings appSize update not persisted"
    assert body["isSleeping"] == True, "Settings isSleeping status not persisted"
    print("Test 16: Verify updated settings ..................................... COMPLETED")
    
    # --------------------------------------------------------
    # Test 17: Clean up (Delete test task)
    # --------------------------------------------------------
    status, body = test_endpoint(f"/api/tasks/{test_task_id}", method="DELETE")
    assert status == 200, "Delete task failed"
    print("Test 17: Clean up (Delete test task) ................................. COMPLETED")
    
    # --------------------------------------------------------
    # Test 18: Verify final task listing is clean of test task
    # --------------------------------------------------------
    status, body = test_endpoint("/api/tasks")
    tasks = body.get("tasks", [])
    found = any(t["id"] == test_task_id for t in tasks)
    assert not found, "Test task remains in database after deletion"
    print("Test 18: Verify final clean task state ............................... COMPLETED")
    
    print("\n==============================================")
    print("      ALL API TESTS EXECUTED SUCCESSFULLY!")
    print("==============================================")

if __name__ == "__main__":
    run_tests()
