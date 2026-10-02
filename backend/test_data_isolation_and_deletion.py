import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from database import Base, engine, SessionLocal
import models
from main import app

class TestDataIsolationAndDeletion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        # Clean up test users created during test runs
        test_emails = ["isolation_user_a@test.com", "isolation_user_b@test.com"]
        test_user_ids = [u.id for u in self.db.query(models.User.id).filter(models.User.email.in_(test_emails)).all()]
        if test_user_ids:
            conv_ids = [c.id for c in self.db.query(models.Conversation.id).filter(models.Conversation.user_id.in_(test_user_ids)).all()]
            if conv_ids:
                self.db.query(models.Message).filter(models.Message.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
                self.db.query(models.Conversation).filter(models.Conversation.id.in_(conv_ids)).delete(synchronize_session=False)
            self.db.query(models.BusinessProfile).filter(models.BusinessProfile.user_id.in_(test_user_ids)).delete(synchronize_session=False)
            self.db.query(models.User).filter(models.User.id.in_(test_user_ids)).delete(synchronize_session=False)
            self.db.commit()

    # TEST 1 — GUEST DATA ISOLATION
    @patch("main.call_gemini", return_value="Guest advice response.")
    def test_01_guest_chat_does_not_create_db_records(self, mock_gemini):
        # Guest sends message without JWT
        res = self.client.post("/chat", json={
            "message": "I want to start a grocery store as a guest.",
            "language": "en"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("reply", data)
        # Guest chat must NOT assign or return a database conversation_id
        self.assertIsNone(data["conversation_id"])

    # TEST 2 — USER A REGISTRATION & CONVERSATIONS
    @patch("main.call_gemini", return_value="User A advice response.")
    def test_02_user_a_and_user_b_isolation(self, mock_gemini):
        # Register User A
        reg_a = self.client.post("/api/auth/register", json={
            "name": "User A", "email": "isolation_user_a@test.com", "password": "password123"
        })
        self.assertEqual(reg_a.status_code, 201)
        token_a = reg_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # User A creates Conversation A1
        chat_a1 = self.client.post("/chat", json={
            "message": "User A Question 1",
            "language": "en"
        }, headers=headers_a)
        self.assertEqual(chat_a1.status_code, 200)
        conv_a1_id = chat_a1.json()["conversation_id"]
        self.assertIsNotNone(conv_a1_id)

        # User A creates Conversation A2
        chat_a2 = self.client.post("/chat", json={
            "message": "User A Question 2",
            "language": "en"
        }, headers=headers_a)
        self.assertEqual(chat_a2.status_code, 200)
        conv_a2_id = chat_a2.json()["conversation_id"]
        self.assertIsNotNone(conv_a2_id)
        self.assertNotEqual(conv_a1_id, conv_a2_id)

        # Register User B
        reg_b = self.client.post("/api/auth/register", json={
            "name": "User B", "email": "isolation_user_b@test.com", "password": "password123"
        })
        self.assertEqual(reg_b.status_code, 201)
        token_b = reg_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User B creates Conversation B1
        chat_b1 = self.client.post("/chat", json={
            "message": "User B Question 1",
            "language": "en"
        }, headers=headers_b)
        self.assertEqual(chat_b1.status_code, 200)
        conv_b1_id = chat_b1.json()["conversation_id"]
        self.assertIsNotNone(conv_b1_id)

        # User A lists conversations -> only A1 and A2 appear
        list_a = self.client.get("/api/conversations", headers=headers_a)
        self.assertEqual(list_a.status_code, 200)
        a_ids = [c["id"] for c in list_a.json()]
        self.assertIn(conv_a1_id, a_ids)
        self.assertIn(conv_a2_id, a_ids)
        self.assertNotIn(conv_b1_id, a_ids)

        # User B lists conversations -> only B1 appears
        list_b = self.client.get("/api/conversations", headers=headers_b)
        self.assertEqual(list_b.status_code, 200)
        b_ids = [c["id"] for c in list_b.json()]
        self.assertIn(conv_b1_id, b_ids)
        self.assertNotIn(conv_a1_id, b_ids)
        self.assertNotIn(conv_a2_id, b_ids)

    # TEST 3 — CONVERSATION DELETION & ORPHANED MESSAGE REMOVAL
    @patch("main.call_gemini", return_value="User A delete test.")
    def test_03_conversation_deletion_and_cascade(self, mock_gemini):
        reg_a = self.client.post("/api/auth/register", json={
            "name": "User A", "email": "isolation_user_a@test.com", "password": "password123"
        })
        token_a = reg_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        chat_res = self.client.post("/chat", json={
            "message": "Conversation to be deleted",
            "language": "en"
        }, headers=headers_a)
        conv_id = chat_res.json()["conversation_id"]

        # Verify messages exist in DB
        msgs_before = self.db.query(models.Message).filter(models.Message.conversation_id == conv_id).all()
        self.assertGreater(len(msgs_before), 0)

        # Delete conversation
        del_res = self.client.delete(f"/api/conversations/{conv_id}", headers=headers_a)
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["message"], "Conversation deleted successfully.")

        # Verify conversation is gone from DB
        conv_in_db = self.db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
        self.assertIsNone(conv_in_db)

        # Verify associated messages are also completely deleted (zero orphans)
        msgs_after = self.db.query(models.Message).filter(models.Message.conversation_id == conv_id).all()
        self.assertEqual(len(msgs_after), 0)

        # Verify calling GET on deleted conversation returns 404
        get_deleted = self.client.get(f"/api/conversations/{conv_id}", headers=headers_a)
        self.assertEqual(get_deleted.status_code, 404)

    # TEST 4 — SECURITY: 403 FORBIDDEN WHEN ACCESSING ANOTHER USER'S CONVERSATION
    @patch("main.call_gemini", return_value="Security test response.")
    def test_04_cross_user_forbidden_access(self, mock_gemini):
        # Register User A
        reg_a = self.client.post("/api/auth/register", json={
            "name": "User A", "email": "isolation_user_a@test.com", "password": "password123"
        })
        headers_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}

        # User A creates a conversation
        chat_a = self.client.post("/chat", json={
            "message": "User A confidential chat",
            "language": "en"
        }, headers=headers_a)
        conv_a_id = chat_a.json()["conversation_id"]

        # Register User B
        reg_b = self.client.post("/api/auth/register", json={
            "name": "User B", "email": "isolation_user_b@test.com", "password": "password123"
        })
        headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

        # 1. User B attempts to GET User A's conversation -> MUST return 403 Forbidden
        cross_get = self.client.get(f"/api/conversations/{conv_a_id}", headers=headers_b)
        self.assertEqual(cross_get.status_code, 403)
        self.assertIn("Access denied", cross_get.json()["detail"])

        # 2. User B attempts to POST a message into User A's conversation -> MUST return 403 Forbidden
        cross_post = self.client.post(f"/api/conversations/{conv_a_id}/messages", json={
            "role": "user",
            "content": "Malicious injected message"
        }, headers=headers_b)
        self.assertEqual(cross_post.status_code, 403)
        self.assertIn("Access denied", cross_post.json()["detail"])

        # 3. User B attempts to send chat into User A's conversation -> MUST return 403 Forbidden
        cross_chat = self.client.post("/chat", json={
            "message": "Malicious chat",
            "conversation_id": conv_a_id
        }, headers=headers_b)
        self.assertEqual(cross_chat.status_code, 403)
        self.assertIn("Access denied", cross_chat.json()["detail"])

        # 4. User B attempts to DELETE User A's conversation -> MUST return 403 Forbidden
        cross_del = self.client.delete(f"/api/conversations/{conv_a_id}", headers=headers_b)
        self.assertEqual(cross_del.status_code, 403)
        self.assertIn("Access denied", cross_del.json()["detail"])

        # 5. Verify User A's conversation was NOT deleted and messages were NOT corrupted
        verify_a = self.client.get(f"/api/conversations/{conv_a_id}", headers=headers_a)
        self.assertEqual(verify_a.status_code, 200)
        self.assertEqual(len(verify_a.json()["messages"]), 2)

    # TEST 5 — EXPLICIT SAVE MY JOURNEY MIGRATION & IDEMPOTENCY
    def test_05_explicit_save_journey_migration_and_idempotency(self):
        reg = self.client.post("/api/auth/register", json={
            "name": "User A", "email": "isolation_user_a@test.com", "password": "password123"
        })
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        transfer_payload = {
            "migration_id": "mig_unique_test_123",
            "business_context": {
                "business_type": "Handmade Crafts",
                "budget": "₹30,000",
                "location": "Jaipur",
                "goal": "Scale online"
            },
            "messages": [
                {"role": "user", "content": "How do I sell handmade crafts online?", "language": "en"},
                {"role": "assistant", "content": "Start by listing on local marketplaces...", "language": "en"}
            ]
        }

        # First migration request
        res1 = self.client.post("/api/conversations/transfer", json=transfer_payload, headers=headers)
        self.assertEqual(res1.status_code, 201)
        conv1 = res1.json()
        self.assertIsNotNone(conv1["id"])
        self.assertEqual(len(conv1["messages"]), 2)

        # Verify business context was created in database
        prof = self.client.get("/api/business-profile", headers=headers).json()
        self.assertEqual(prof["business_type"], "Handmade Crafts")
        self.assertEqual(prof["budget"], "₹30,000")

        # Second migration request with identical migration_id (Idempotency test)
        res2 = self.client.post("/api/conversations/transfer", json=transfer_payload, headers=headers)
        self.assertEqual(res2.status_code, 201)
        conv2 = res2.json()
        # Must return the SAME conversation, not create a duplicate
        self.assertEqual(conv1["id"], conv2["id"])

        # Verify user has only 1 conversation total in DB
        user_convs = self.client.get("/api/conversations", headers=headers).json()
        self.assertEqual(len(user_convs), 1)

if __name__ == "__main__":
    unittest.main()
