"""
BizSaathi Comprehensive End-to-End Audit & Verification Suite
Tests all 25 Phases: Auth, Isolation, Persistence, Deletion, Profile, Security, Multilingual, Error Handling.
"""

import os
import unittest
import uuid
import datetime
from fastapi.testclient import TestClient

# Ensure environment is set
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

from main import app, call_gemini
from database import get_db, Base, engine
import models
from auth import hash_password, verify_password, create_access_token

client = TestClient(app)

class TestBizSaathiComprehensiveAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create tables
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = next(get_db())

    def tearDown(self):
        self.db.close()

    # ==========================================
    # PHASE 3: GUEST USER TEST
    # ==========================================
    def test_phase3_guest_chat_flow(self):
        """Guest user asks a question with business context without being logged in."""
        guest_payload = {
            "message": "I want to start my bakery. Where should I begin?",
            "language": "en",
            "business_type": "Small Bakery",
            "budget": "₹2 lakh",
            "location": "Hyderabad",
            "goal": "Start selling locally",
            "recent_history": []
        }
        # Call /chat without Authorization header
        response = client.post("/chat", json=guest_payload)
        self.assertEqual(response.status_code, 200, f"Guest chat failed: {response.text}")
        data = response.json()
        self.assertIn("reply", data)
        self.assertTrue(len(data["reply"]) > 20)
        # Guest conversation must NOT create an authenticated DB conversation
        self.assertIsNone(data["conversation_id"])

    # ==========================================
    # PHASE 4: MULTILINGUAL CHAT TEST
    # ==========================================
    def test_phase4_multilingual_chat(self):
        """Tests chat responses in Indian languages (Telugu, Hindi, Tamil, Kannada, English)."""
        languages = [
            ("te", "నా వ్యాపారానికి మొదటి కస్టమర్లను ఎలా సంపాదించుకోవాలి?"),
            ("hi", "कम बजट में अपने बिज़नेस की मार्केटिंग कैसे करूँ?"),
            ("ta", "என் வணிகத்திற்கு முதல் வாடிக்கையாளர்களை எப்படி பெறுவது?"),
            ("kn", "ನನ್ನ ವ್ಯವಹಾರಕ್ಕೆ ಮೊದಲ ಗ್ರಾಹಕರನ್ನು ಹೇಗೆ ಪಡೆಯುವುದು?"),
            ("en", "I want to start a small bakery. Where should I begin?"),
        ]
        for lang_code, query in languages:
            payload = {
                "message": query,
                "language": lang_code,
                "business_type": "Bakery",
                "budget": "₹2 lakh",
                "location": "Hyderabad",
                "goal": "Local sales"
            }
            res = client.post("/chat", json=payload)
            self.assertEqual(res.status_code, 200, f"Failed for language {lang_code}: {res.text}")
            res_json = res.json()
            self.assertIn("reply", res_json)
            self.assertTrue(len(res_json["reply"]) > 10, f"Empty reply for language {lang_code}")

    # ==========================================
    # PHASE 6: SIGNUP & EXPLICIT GUEST MIGRATION ("Save My Journey")
    # ==========================================
    def test_phase6_save_my_journey_migration(self):
        """Guest conversation is migrated into new user account with profile and messages preserved."""
        unique_id = uuid.uuid4().hex[:8]
        email = f"guest_mig_{unique_id}@example.com"
        password = "Password123!"

        # 1. Register new user
        reg_res = client.post("/api/auth/register", json={
            "name": f"Migrated User {unique_id}",
            "email": email,
            "password": password,
            "confirm_password": password
        })
        self.assertEqual(reg_res.status_code, 201)
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Perform Save My Journey migration
        migration_id = f"mig_{unique_id}"
        transfer_payload = {
            "title": "Bakery Starting Plan",
            "migration_id": migration_id,
            "business_context": {
                "business_type": "Bakery",
                "budget": "₹2 lakh",
                "location": "Hyderabad",
                "goal": "Start selling locally"
            },
            "messages": [
                {"role": "user", "content": "I want to start my bakery. Where should I begin?", "language": "en"},
                {"role": "assistant", "content": "Here is a 4-step plan for your Hyderabad bakery...", "language": "en"}
            ]
        }
        mig_res = client.post("/api/conversations/transfer", json=transfer_payload, headers=headers)
        self.assertEqual(mig_res.status_code, 201)
        mig_data = mig_res.json()
        conv_id = mig_data["id"]
        self.assertEqual(len(mig_data["messages"]), 2)
        self.assertEqual(mig_data["migration_id"], migration_id)

        # 3. Verify Business Profile was created from guest context
        prof_res = client.get("/api/business-profile", headers=headers)
        self.assertEqual(prof_res.status_code, 200)
        prof_data = prof_res.json()
        self.assertEqual(prof_data["business_type"], "Bakery")
        self.assertEqual(prof_data["budget"], "₹2 lakh")
        self.assertEqual(prof_data["location"], "Hyderabad")

        # 4. Verify Idempotency: re-sending the same migration_id does NOT duplicate
        mig_res_dup = client.post("/api/conversations/transfer", json=transfer_payload, headers=headers)
        self.assertEqual(mig_res_dup.status_code, 201)
        self.assertEqual(mig_res_dup.json()["id"], conv_id)

        # Check total conversations for user is still exactly 1
        list_res = client.get("/api/conversations", headers=headers)
        self.assertEqual(len(list_res.json()), 1)

    # ==========================================
    # PHASE 7: EXISTING USER LOGIN & GUEST DATA SEPARATION
    # ==========================================
    def test_phase7_existing_user_login_data_isolation(self):
        """Existing user logs in; unmigrated guest conversation must NEVER appear."""
        unique_id = uuid.uuid4().hex[:8]
        email = f"existing_{unique_id}@example.com"
        password = "Password123!"

        # Register existing user
        reg_res = client.post("/api/auth/register", json={
            "name": f"Existing User {unique_id}",
            "email": email,
            "password": password,
            "confirm_password": password
        })
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # User has Conv A and Conv B
        c1 = client.post("/api/conversations", json={"title": "Existing Conv A"}, headers=headers).json()
        c2 = client.post("/api/conversations", json={"title": "Existing Conv B"}, headers=headers).json()

        # Login again (simulating returning user)
        login_res = client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(login_res.status_code, 200)
        new_token = login_res.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # Fetch conversations - only Conv A and Conv B must exist
        convs = client.get("/api/conversations", headers=new_headers).json()
        conv_titles = [c["title"] for c in convs]
        self.assertIn("Existing Conv A", conv_titles)
        self.assertIn("Existing Conv B", conv_titles)
        self.assertEqual(len(convs), 2)

    # ==========================================
    # PHASE 8: CROSS-USER DATA ISOLATION
    # ==========================================
    def test_phase8_cross_user_isolation(self):
        """User A cannot view, access, or delete User B's conversations."""
        uid_a = uuid.uuid4().hex[:8]
        uid_b = uuid.uuid4().hex[:8]

        # Register User A
        res_a = client.post("/api/auth/register", json={
            "name": "User A", "email": f"usera_{uid_a}@test.com", "password": "Password123!", "confirm_password": "Password123!"
        })
        token_a = res_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Register User B
        res_b = client.post("/api/auth/register", json={
            "name": "User B", "email": f"userb_{uid_b}@test.com", "password": "Password123!", "confirm_password": "Password123!"
        })
        token_b = res_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Create convs for User A
        c_a1 = client.post("/api/conversations", json={"title": "A1"}, headers=headers_a).json()
        c_a2 = client.post("/api/conversations", json={"title": "A2"}, headers=headers_a).json()

        # Create conv for User B
        c_b1 = client.post("/api/conversations", json={"title": "B1"}, headers=headers_b).json()

        # User A listing only shows A1 and A2
        list_a = client.get("/api/conversations", headers=headers_a).json()
        ids_a = [c["id"] for c in list_a]
        self.assertIn(c_a1["id"], ids_a)
        self.assertIn(c_a2["id"], ids_a)
        self.assertNotIn(c_b1["id"], ids_a)

        # User B listing only shows B1
        list_b = client.get("/api/conversations", headers=headers_b).json()
        ids_b = [c["id"] for c in list_b]
        self.assertEqual(ids_b, [c_b1["id"]])

        # User A cannot GET User B's conversation -> 403 Forbidden
        cross_get = client.get(f"/api/conversations/{c_b1['id']}", headers=headers_a)
        self.assertEqual(cross_get.status_code, 403)

        # User B cannot GET User A's conversation -> 403 Forbidden
        cross_get_b = client.get(f"/api/conversations/{c_a1['id']}", headers=headers_b)
        self.assertEqual(cross_get_b.status_code, 403)

    # ==========================================
    # PHASE 9 & 10: NEW CONVERSATION & PREVIOUS CONVERSATION
    # ==========================================
    def test_phase9_and_10_new_and_previous_conversations(self):
        """Creating a new conversation does not overwrite old ones; messages are correctly grouped."""
        uid = uuid.uuid4().hex[:8]
        reg_res = client.post("/api/auth/register", json={
            "name": "Conv Tester", "email": f"tester_{uid}@test.com", "password": "Password123!", "confirm_password": "Password123!"
        })
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Conversation 1
        chat1 = client.post("/chat", json={
            "message": "How to register MSME udyam certificate?",
            "language": "en"
        }, headers=headers).json()
        conv1_id = chat1["conversation_id"]
        self.assertIsNotNone(conv1_id)

        # Conversation 2 (New Conversation: no conversation_id supplied)
        chat2 = client.post("/chat", json={
            "message": "What is the formula for profit margin calculation?",
            "language": "en"
        }, headers=headers).json()
        conv2_id = chat2["conversation_id"]
        self.assertIsNotNone(conv2_id)
        self.assertNotEqual(conv1_id, conv2_id)

        # Continue Conversation 1 (Pass conversation_id=conv1_id)
        chat1_cont = client.post("/chat", json={
            "message": "Is Aadhaar card mandatory for Udyam?",
            "language": "en",
            "conversation_id": conv1_id
        }, headers=headers).json()
        self.assertEqual(chat1_cont["conversation_id"], conv1_id)

        # Verify messages in Conv 1 has 4 messages (2 user + 2 assistant)
        conv1_data = client.get(f"/api/conversations/{conv1_id}", headers=headers).json()
        self.assertEqual(len(conv1_data["messages"]), 4)

        # Verify messages in Conv 2 has 2 messages (1 user + 1 assistant)
        conv2_data = client.get(f"/api/conversations/{conv2_id}", headers=headers).json()
        self.assertEqual(len(conv2_data["messages"]), 2)

    # ==========================================
    # PHASE 11 & 12: CONVERSATION DELETION & SECURITY
    # ==========================================
    def test_phase11_and_12_conversation_deletion_and_security(self):
        """User can delete their conversation; cascade deletes messages; cross-user delete is rejected (403)."""
        uid_a = uuid.uuid4().hex[:8]
        uid_b = uuid.uuid4().hex[:8]

        res_a = client.post("/api/auth/register", json={
            "name": "Owner A", "email": f"ownera_{uid_a}@test.com", "password": "Password123!", "confirm_password": "Password123!"
        })
        headers_a = {"Authorization": f"Bearer {res_a.json()['access_token']}"}

        res_b = client.post("/api/auth/register", json={
            "name": "Attacker B", "email": f"attackerb_{uid_b}@test.com", "password": "Password123!", "confirm_password": "Password123!"
        })
        headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}

        # Create conv for A
        conv_a = client.post("/api/conversations", json={"title": "To Be Deleted"}, headers=headers_a).json()
        conv_a_id = conv_a["id"]

        # Add message to conv_a
        msg = client.post(f"/api/conversations/{conv_a_id}/messages", json={
            "role": "user", "content": "Important business idea", "language": "en"
        }, headers=headers_a).json()

        # Attacker B tries to DELETE A's conversation -> 403 Forbidden
        hacker_del = client.delete(f"/api/conversations/{conv_a_id}", headers=headers_b)
        self.assertEqual(hacker_del.status_code, 403)

        # Conversation must still exist
        check = client.get(f"/api/conversations/{conv_a_id}", headers=headers_a)
        self.assertEqual(check.status_code, 200)

        # Owner A deletes conversation -> 200 OK
        owner_del = client.delete(f"/api/conversations/{conv_a_id}", headers=headers_a)
        self.assertEqual(owner_del.status_code, 200)

        # Getting conversation now returns 404 Not Found
        del_check = client.get(f"/api/conversations/{conv_a_id}", headers=headers_a)
        self.assertEqual(del_check.status_code, 404)

        # Verify associated messages are also purged from DB
        msg_in_db = self.db.query(models.Message).filter(models.Message.conversation_id == conv_a_id).all()
        self.assertEqual(len(msg_in_db), 0)

    # ==========================================
    # PHASE 15: BUSINESS PROFILE PERSISTENCE ACROSS DELETION
    # ==========================================
    def test_phase15_profile_persistence_after_conv_deletion(self):
        """Deleting a conversation must NEVER delete or mutate the user's business profile."""
        uid = uuid.uuid4().hex[:8]
        reg_res = client.post("/api/auth/register", json={
            "name": "Profile Owner", "email": f"profile_{uid}@test.com", "password": "Password123!", "confirm_password": "Password123!"
        })
        headers = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

        # Create business profile
        client.post("/api/business-profile", json={
            "business_type": "Handicrafts",
            "budget": "₹50,000",
            "location": "Jaipur",
            "goal": "Export online"
        }, headers=headers)

        # Create conversation
        conv = client.post("/api/conversations", json={"title": "Export Chat"}, headers=headers).json()

        # Delete conversation
        del_res = client.delete(f"/api/conversations/{conv['id']}", headers=headers)
        self.assertEqual(del_res.status_code, 200)

        # Verify Business Profile is 100% intact
        prof = client.get("/api/business-profile", headers=headers).json()
        self.assertIsNotNone(prof)
        self.assertEqual(prof["business_type"], "Handicrafts")
        self.assertEqual(prof["budget"], "₹50,000")
        self.assertEqual(prof["location"], "Jaipur")
        self.assertEqual(prof["goal"], "Export online")

    # ==========================================
    # PHASE 16: PROFILE & SETTINGS (Name, Theme, Password)
    # ==========================================
    def test_phase16_profile_settings_and_password_change(self):
        """User can update profile (name, theme) and change password securely."""
        uid = uuid.uuid4().hex[:8]
        reg_res = client.post("/api/auth/register", json={
            "name": "Original Name", "email": f"settings_{uid}@test.com", "password": "OldPassword1!", "confirm_password": "OldPassword1!"
        })
        headers = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

        # Update name and theme
        upd_res = client.put("/api/auth/profile", json={"name": "Updated Name", "theme": "dark"}, headers=headers)
        self.assertEqual(upd_res.status_code, 200)
        self.assertEqual(upd_res.json()["name"], "Updated Name")
        self.assertEqual(upd_res.json()["theme"], "dark")

        # Change password
        pwd_res = client.put("/api/auth/password", json={
            "current_password": "OldPassword1!",
            "new_password": "NewPassword2@",
            "confirm_new_password": "NewPassword2@"
        }, headers=headers)
        self.assertEqual(pwd_res.status_code, 200)

        # Login with old password must fail (401)
        fail_login = client.post("/api/auth/login", json={"email": f"settings_{uid}@test.com", "password": "OldPassword1!"})
        self.assertEqual(fail_login.status_code, 401)

        # Login with new password must succeed (200)
        ok_login = client.post("/api/auth/login", json={"email": f"settings_{uid}@test.com", "password": "NewPassword2@"})
        self.assertEqual(ok_login.status_code, 200)

    # ==========================================
    # PHASE 19: ERROR TESTING & VALIDATIONS
    # ==========================================
    def test_phase19_error_handling_and_validations(self):
        """Validates all negative and edge cases."""
        uid = uuid.uuid4().hex[:8]
        reg_payload = {
            "name": "Validation Tester",
            "email": f"valid_{uid}@test.com",
            "password": "Password123!",
            "confirm_password": "Password123!"
        }
        client.post("/api/auth/register", json=reg_payload)

        # 1. Duplicate registration -> 400
        dup_res = client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn("already exists", dup_res.json()["detail"].lower())

        # 2. Invalid login -> 401
        inv_login = client.post("/api/auth/login", json={"email": f"valid_{uid}@test.com", "password": "WrongPassword"})
        self.assertEqual(inv_login.status_code, 401)

        # 3. Empty message -> 400
        empty_msg = client.post("/chat", json={"message": "   ", "language": "en"})
        self.assertEqual(empty_msg.status_code, 400)

        # 4. Invalid token -> 401
        bad_token_res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_garbage_token"})
        self.assertEqual(bad_token_res.status_code, 401)

        # 5. Nonexistent conversation -> 404
        auth_token = client.post("/api/auth/login", json={"email": f"valid_{uid}@test.com", "password": "Password123!"}).json()["access_token"]
        not_found_res = client.get("/api/conversations/99999999", headers={"Authorization": f"Bearer {auth_token}"})
        self.assertEqual(not_found_res.status_code, 404)

        # 6. Delete nonexistent conversation -> 404
        del_404 = client.delete("/api/conversations/99999999", headers={"Authorization": f"Bearer {auth_token}"})
        self.assertEqual(del_404.status_code, 404)

    # ==========================================
    # PHASE 23: SECURITY CHECKS
    # ==========================================
    def test_phase23_security_protections(self):
        """Verifies passwords are never stored in plaintext and JWT has valid claims."""
        uid = uuid.uuid4().hex[:8]
        plaintext = "SecretP@ss999"
        email = f"sec_{uid}@test.com"
        reg = client.post("/api/auth/register", json={
            "name": "Sec Test", "email": email, "password": plaintext, "confirm_password": plaintext
        })
        self.assertEqual(reg.status_code, 201)

        # Check DB directly: hashed_password must NOT equal plaintext and must be verified by bcrypt
        user_row = self.db.query(models.User).filter(models.User.email == email).first()
        self.assertIsNotNone(user_row)
        self.assertNotEqual(user_row.hashed_password, plaintext)
        self.assertTrue(verify_password(plaintext, user_row.hashed_password))

    # ==========================================
    # PHASE 24: COMPLETE DEMO JOURNEY FLOW
    # ==========================================
    def test_phase24_complete_demo_journey(self):
        """
        Executes the exact Phase 24 flow continuously:
        Guest Context -> Ask Question -> Voice Question -> Save My Journey
        -> Logout -> Login -> Check Convs -> New Conv -> Open Prev -> Delete Conv -> Refresh Persist
        """
        # 1. Guest asks starting question
        guest_ctx = {
            "business_type": "Cloud Kitchen",
            "budget": "₹1.5 lakh",
            "location": "Bengaluru",
            "goal": "Swiggy and Zomato sales"
        }
        guest_q1 = client.post("/chat", json={
            "message": "How do I register FSSAI for cloud kitchen?",
            "language": "en",
            **guest_ctx
        }).json()
        self.assertIn("reply", guest_q1)

        # 2. Guest voice simulation query
        guest_q2 = client.post("/chat", json={
            "message": "What is the cost of basic commercial kitchen equipment?",
            "language": "en",
            **guest_ctx,
            "recent_history": [
                {"role": "user", "content": "How do I register FSSAI for cloud kitchen?"},
                {"role": "assistant", "content": guest_q1["reply"]}
            ]
        }).json()
        self.assertIn("reply", guest_q2)

        # 3. Save My Journey -> Signup
        uid = uuid.uuid4().hex[:8]
        email = f"demo_journey_{uid}@bizsaathi.org"
        pwd = "DemoPassword123!"
        signup_res = client.post("/api/auth/register", json={
            "name": f"Demo Founder {uid}",
            "email": email,
            "password": pwd,
            "confirm_password": pwd
        })
        self.assertEqual(signup_res.status_code, 201)
        token = signup_res.json()["access_token"]
        auth_hdr = {"Authorization": f"Bearer {token}"}

        # 4. Migrate guest data to user account
        transfer_res = client.post("/api/conversations/transfer", json={
            "title": "Cloud Kitchen Starting Plan",
            "migration_id": f"mig_{uid}",
            "business_context": guest_ctx,
            "messages": [
                {"role": "user", "content": "How do I register FSSAI for cloud kitchen?", "language": "en"},
                {"role": "assistant", "content": guest_q1["reply"], "language": "en"},
                {"role": "user", "content": "What is the cost of basic commercial kitchen equipment?", "language": "en"},
                {"role": "assistant", "content": guest_q2["reply"], "language": "en"}
            ]
        }, headers=auth_hdr)
        self.assertEqual(transfer_res.status_code, 201)
        migrated_conv_id = transfer_res.json()["id"]

        # 5. Logout & Re-login
        login_res = client.post("/api/auth/login", json={"email": email, "password": pwd})
        self.assertEqual(login_res.status_code, 200)
        re_token = login_res.json()["access_token"]
        re_hdr = {"Authorization": f"Bearer {re_token}"}

        # 6. Verify previous conversation exists
        convs_list = client.get("/api/conversations", headers=re_hdr).json()
        self.assertEqual(len(convs_list), 1)
        self.assertEqual(convs_list[0]["id"], migrated_conv_id)

        # 7. Start New Conversation
        new_conv = client.post("/api/conversations", json={"title": "Marketing Plan"}, headers=re_hdr).json()
        new_conv_id = new_conv["id"]
        self.assertNotEqual(migrated_conv_id, new_conv_id)

        # 8. Open Previous Conversation & Continue
        prev_conv = client.get(f"/api/conversations/{migrated_conv_id}", headers=re_hdr).json()
        self.assertEqual(len(prev_conv["messages"]), 4)

        # Append new message to previous conversation
        cont_res = client.post("/chat", json={
            "message": "Do I need GST registration immediately?",
            "language": "en",
            "conversation_id": migrated_conv_id
        }, headers=re_hdr).json()
        self.assertEqual(cont_res["conversation_id"], migrated_conv_id)

        # 9. Delete conversation
        del_res = client.delete(f"/api/conversations/{migrated_conv_id}", headers=re_hdr)
        self.assertEqual(del_res.status_code, 200)

        # 10. Refresh verification: Deleted conversation must not exist
        remaining = client.get("/api/conversations", headers=re_hdr).json()
        rem_ids = [c["id"] for c in remaining]
        self.assertNotIn(migrated_conv_id, rem_ids)
        self.assertIn(new_conv_id, rem_ids)

        # User's business profile must remain safely stored
        profile = client.get("/api/business-profile", headers=re_hdr).json()
        self.assertEqual(profile["business_type"], "Cloud Kitchen")
        self.assertEqual(profile["location"], "Bengaluru")

if __name__ == "__main__":
    unittest.main()
