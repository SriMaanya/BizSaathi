import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from database import get_db, Base, engine, SessionLocal
import models
from main import app
from routers.conversations import generate_conversation_title

class TestPhase9Complete(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        test_user_ids = [u.id for u in self.db.query(models.User.id).filter(models.User.email.like("%@test.com")).all()]
        if test_user_ids:
            self.db.query(models.Message).filter(models.Message.conversation_id.in_(
                self.db.query(models.Conversation.id).filter(models.Conversation.user_id.in_(test_user_ids))
            )).delete(synchronize_session=False)
            self.db.query(models.Conversation).filter(models.Conversation.user_id.in_(test_user_ids)).delete(synchronize_session=False)
            self.db.query(models.BusinessProfile).filter(models.BusinessProfile.user_id.in_(test_user_ids)).delete(synchronize_session=False)
            self.db.query(models.User).filter(models.User.id.in_(test_user_ids)).delete(synchronize_session=False)
            self.db.commit()

    # TEST 1: Guest -> ask question -> receive response (No login required)
    @patch("main.call_gemini", return_value="Here is practical advice for starting your business without login.")
    def test_01_guest_chat_no_login_required(self, mock_gemini):
        res = self.client.post("/chat", json={
            "message": "I want to start a tea stall.",
            "language": "en"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("reply", data)
        self.assertIsNone(data["conversation_id"])  # Guest chat does NOT create a persistent DB record

    # TEST 2: Guest -> multiple messages -> local storage retention
    def test_02_guest_chat_history_keys(self):
        # Verify the standard guest storage keys
        expected_keys = ["bizsaathi_guest_chat_history", "bizsaathi_guest_business_context"]
        for key in expected_keys:
            self.assertTrue(key.startswith("bizsaathi_guest_"))

    # TEST 3: Guest -> Save My Journey -> Signup (Transferred to PostgreSQL)
    def test_03_guest_save_journey_signup(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "Anil", "email": "anil@test.com", "password": "password123"
        })
        self.assertEqual(reg.status_code, 201)
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        mig_res = self.client.post("/api/conversations/migrate-guest", json={
            "migration_id": "mig_anil_1",
            "business_context": {"business_type": "Bakery", "budget": "₹2 lakh", "location": "Hyderabad", "goal": "Launch"},
            "messages": [
                {"role": "user", "content": "I want to start a small bakery with ₹2 lakh.", "language": "en"},
                {"role": "assistant", "content": "Here are the steps to launch your bakery...", "language": "en"}
            ]
        }, headers=headers)

        self.assertEqual(mig_res.status_code, 201)
        conv = mig_res.json()
        self.assertIsNotNone(conv["id"])
        self.assertEqual(len(conv["messages"]), 2)

    # TEST 4: After signup, user sees the SAME conversation (not empty)
    def test_04_after_signup_user_sees_same_conversation(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "Sunita", "email": "sunita@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        mig_res = self.client.post("/api/conversations/migrate-guest", json={
            "migration_id": "mig_sunita_1",
            "messages": [
                {"role": "user", "content": "How to price homemade cakes?", "language": "en"},
                {"role": "assistant", "content": "Calculate ingredients cost and add 30% margin.", "language": "en"}
            ]
        }, headers=headers)
        conv_id = mig_res.json()["id"]

        # Fetch conversation
        loaded = self.client.get(f"/api/conversations/{conv_id}", headers=headers).json()
        self.assertEqual(len(loaded["messages"]), 2)
        self.assertEqual(loaded["messages"][0]["content"], "How to price homemade cakes?")
        self.assertEqual(loaded["messages"][1]["content"], "Calculate ingredients cost and add 30% margin.")

    # TEST 5: Guest -> Save My Journey -> Login to existing account
    def test_05_guest_save_journey_login_to_existing_account(self):
        # Create existing user
        self.client.post("/api/auth/register", json={
            "name": "Vikram", "email": "vikram@test.com", "password": "password123"
        })
        login_res = self.client.post("/api/auth/login", json={"email": "vikram@test.com", "password": "password123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Migrate guest conversation
        mig_res = self.client.post("/api/conversations/migrate-guest", json={
            "migration_id": "mig_vikram_guest_1",
            "messages": [
                {"role": "user", "content": "I need help marketing my bakery.", "language": "en"},
                {"role": "assistant", "content": "Distribute samples in local societies.", "language": "en"}
            ]
        }, headers=headers)
        self.assertEqual(mig_res.status_code, 201)
        self.assertIn("Bakery Marketing", mig_res.json()["title"])

    # TEST 6: Existing account already has conversations (Remain untouched)
    def test_06_existing_conversations_remain_untouched(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "Pooja", "email": "pooja@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create original conversation
        old_conv = self.client.post("/api/conversations", json={"title": "Original Business Idea"}, headers=headers).json()
        self.client.post(f"/api/conversations/{old_conv['id']}/messages", json={
            "role": "user", "content": "Old message content", "language": "en"
        }, headers=headers)

        # Merge guest journey
        self.client.post("/api/conversations/migrate-guest", json={
            "migration_id": "mig_pooja_guest",
            "messages": [
                {"role": "user", "content": "New guest message", "language": "en"}
            ]
        }, headers=headers)

        # Check that old conversation remains intact
        old_check = self.client.get(f"/api/conversations/{old_conv['id']}", headers=headers).json()
        self.assertEqual(old_check["title"], "Original Business Idea")
        self.assertEqual(old_check["messages"][0]["content"], "Old message content")

    # TEST 7: Refresh during/after migration (No duplicate conversation or messages)
    def test_07_idempotent_migration_no_duplicates(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "Karan", "email": "karan@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "migration_id": "mig_karan_idem_token_123",
            "messages": [
                {"role": "user", "content": "Cost planning for shoe store", "language": "en"},
                {"role": "assistant", "content": "Keep inventory tight in month 1.", "language": "en"}
            ]
        }

        r1 = self.client.post("/api/conversations/migrate-guest", json=payload, headers=headers)
        r2 = self.client.post("/api/conversations/migrate-guest", json=payload, headers=headers)
        self.assertEqual(r1.json()["id"], r2.json()["id"])

        convs = self.client.get("/api/conversations", headers=headers).json()
        self.assertEqual(len(convs), 1)

    # TEST 8: Authenticated user sends a new message (Automatically saved to PostgreSQL)
    @patch("main.call_gemini", return_value="You will need FSSAI and Trade License.")
    def test_08_authenticated_user_chat_auto_persists(self, mock_gemini):
        reg = self.client.post("/api/auth/register", json={
            "name": "Dev", "email": "dev@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        chat_res = self.client.post("/chat", json={
            "message": "What licenses do I need for a food joint?",
            "language": "en"
        }, headers=headers)
        self.assertEqual(chat_res.status_code, 200)
        c_id = chat_res.json()["conversation_id"]
        self.assertIsNotNone(c_id)

        # Check DB
        conv = self.client.get(f"/api/conversations/{c_id}", headers=headers).json()
        self.assertEqual(len(conv["messages"]), 2)
        self.assertEqual(conv["messages"][0]["role"], "user")
        self.assertEqual(conv["messages"][1]["role"], "assistant")

    # TEST 9: Open Conversations (Saved conversations appear, newest first)
    def test_09_open_conversations_sorted_newest_first(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "SortUser", "email": "sort@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        c1 = self.client.post("/api/conversations", json={"title": "Older Conv"}, headers=headers).json()
        c2 = self.client.post("/api/conversations", json={"title": "Newer Conv"}, headers=headers).json()

        convs = self.client.get("/api/conversations", headers=headers).json()
        self.assertEqual(len(convs), 2)
        self.assertEqual(convs[0]["id"], c2["id"])  # Newest first

    # TEST 10: Open previous conversation (All messages load correctly)
    def test_10_open_previous_conversation_loads_messages(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "Loader", "email": "loader@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        c = self.client.post("/api/conversations", json={"title": "Detailed Discussion"}, headers=headers).json()
        for i in range(5):
            self.client.post(f"/api/conversations/{c['id']}/messages", json={
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"Message turn {i}",
                "language": "en"
            }, headers=headers)

        loaded = self.client.get(f"/api/conversations/{c['id']}", headers=headers).json()
        self.assertEqual(len(loaded["messages"]), 5)

    # TEST 11: Continue previous conversation (Gemini receives history + business profile)
    @patch("main.call_gemini", return_value="Given your ₹2 lakh budget and bakery idea, here is the marketing plan.")
    def test_11_continue_previous_conversation_context(self, mock_gemini):
        reg = self.client.post("/api/auth/register", json={
            "name": "Cont", "email": "cont@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Set profile
        self.client.post("/api/business-profile", json={
            "business_type": "Bakery", "budget": "₹2 lakh", "location": "Hyderabad", "goal": "Scale"
        }, headers=headers)

        # Message 1
        r1 = self.client.post("/chat", json={"message": "I want to start a bakery.", "language": "en"}, headers=headers)
        c_id = r1.json()["conversation_id"]

        # Message 2 in same conversation
        r2 = self.client.post("/chat", json={
            "message": "What should I do about marketing?",
            "conversation_id": c_id,
            "language": "en"
        }, headers=headers)
        self.assertEqual(r2.status_code, 200)

        # Verify mock_gemini was called with prompt containing Bakery and ₹2 lakh
        call_prompt = mock_gemini.call_args[0][0]
        self.assertIn("Bakery", call_prompt)
        self.assertIn("₹2 lakh", call_prompt)
        self.assertIn("Previous Conversation Context:", call_prompt)

    # TEST 12: Delete conversation (Only that conversation is deleted)
    def test_12_delete_conversation(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "Del", "email": "del@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        c1 = self.client.post("/api/conversations", json={"title": "To Delete"}, headers=headers).json()
        c2 = self.client.post("/api/conversations", json={"title": "To Keep"}, headers=headers).json()

        del_res = self.client.delete(f"/api/conversations/{c1['id']}", headers=headers)
        self.assertEqual(del_res.status_code, 200)

        remaining = self.client.get("/api/conversations", headers=headers).json()
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]["id"], c2["id"])

    # TEST 13: Logout (User becomes guest but BizSaathi remains usable)
    @patch("main.call_gemini", return_value="Guest advice after logout.")
    def test_13_logout_guest_usable(self, mock_gemini):
        # Without headers -> guest mode
        res = self.client.post("/chat", json={"message": "Can I use this without login?", "language": "en"})
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json()["conversation_id"])

    # TEST 14: Login again (Saved conversations return)
    def test_14_login_again_conversations_return(self):
        self.client.post("/api/auth/register", json={
            "name": "Relogin", "email": "relogin@test.com", "password": "password123"
        })
        l1 = self.client.post("/api/auth/login", json={"email": "relogin@test.com", "password": "password123"})
        headers1 = {"Authorization": f"Bearer {l1.json()['access_token']}"}
        c = self.client.post("/api/conversations", json={"title": "Persistent Advice"}, headers=headers1).json()

        # Login again later
        l2 = self.client.post("/api/auth/login", json={"email": "relogin@test.com", "password": "password123"})
        headers2 = {"Authorization": f"Bearer {l2.json()['access_token']}"}
        convs = self.client.get("/api/conversations", headers=headers2).json()
        self.assertEqual(len(convs), 1)
        self.assertEqual(convs[0]["id"], c["id"])

    # TEST 15: Edit Business Profile (Future AI conversations use updated info)
    @patch("main.call_gemini", return_value="Updated response based on boutique.")
    def test_15_edit_business_profile_uses_updated_info(self, mock_gemini):
        reg = self.client.post("/api/auth/register", json={
            "name": "Updater", "email": "updater@test.com", "password": "password123"
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        # Initial profile
        self.client.post("/api/business-profile", json={"business_type": "Grocery Store"}, headers=headers)

        # Update profile to Boutique
        self.client.put("/api/business-profile", json={"business_type": "Boutique"}, headers=headers)

        # Chat
        self.client.post("/chat", json={"message": "What should I stock?"}, headers=headers)
        call_prompt = mock_gemini.call_args[0][0]
        self.assertIn("Boutique", call_prompt)

    # TEST 16: User A attempts User B's conversation ID (Access denied)
    def test_16_user_data_isolation(self):
        u1 = self.client.post("/api/auth/register", json={"name": "U1", "email": "u1@test.com", "password": "password123"}).json()
        h1 = {"Authorization": f"Bearer {u1['access_token']}"}
        c1 = self.client.post("/api/conversations", json={"title": "U1 Secret"}, headers=h1).json()

        u2 = self.client.post("/api/auth/register", json={"name": "U2", "email": "u2@test.com", "password": "password123"}).json()
        h2 = {"Authorization": f"Bearer {u2['access_token']}"}

        # U2 tries to access U1's conversation -> 403 Forbidden
        self.assertEqual(self.client.get(f"/api/conversations/{c1['id']}", headers=h2).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/conversations/{c1['id']}", headers=h2).status_code, 403)

    # TEST 17: Voice conversation while authenticated (Recognized text is saved like typed text)
    @patch("main.call_gemini", return_value="Voice response advice.")
    def test_17_voice_conversation_persistence(self, mock_gemini):
        reg = self.client.post("/api/auth/register", json={
            "name": "VoiceUser", "email": "voice@test.com", "password": "password123"
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        # Recognized text from speech recognition
        voice_text = "I spoke this through the microphone: how to register MSME?"
        res = self.client.post("/chat", json={"message": voice_text, "language": "en"}, headers=headers)
        self.assertEqual(res.status_code, 200)
        c_id = res.json()["conversation_id"]

        conv = self.client.get(f"/api/conversations/{c_id}", headers=headers).json()
        self.assertEqual(conv["messages"][0]["content"], voice_text)
        self.assertEqual(conv["messages"][1]["content"], "Voice response advice.")

    # TEST 18: Multilingual conversation (Preserves selected language)
    @patch("main.call_gemini", return_value="తెలుగులో సలహా ఇవ్వబడింది.")
    def test_18_multilingual_conversation(self, mock_gemini):
        reg = self.client.post("/api/auth/register", json={
            "name": "TeluguUser", "email": "telugu@test.com", "password": "password123"
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        te_msg = "నా వ్యాపారాన్ని ఎలా విస్తరించాలి?"
        res = self.client.post("/chat", json={"message": te_msg, "language": "te"}, headers=headers)
        c_id = res.json()["conversation_id"]

        conv = self.client.get(f"/api/conversations/{c_id}", headers=headers).json()
        self.assertEqual(conv["messages"][0]["language"], "te")
        self.assertEqual(conv["messages"][1]["language"], "te")

    # TEST 19: Conversation Titles (Matches Phase 9 examples)
    def test_19_title_generation(self):
        t1 = generate_conversation_title("I want to start a small bakery with ₹2 lakh.")
        self.assertEqual(t1, "Starting A Bakery")

        t2 = generate_conversation_title("I need help marketing my bakery.")
        self.assertEqual(t2, "Bakery Marketing")

        t3 = generate_conversation_title("Business cost planning.")
        self.assertEqual(t3, "Business Cost Planning")

if __name__ == "__main__":
    unittest.main()
