# 🚀 BizSaathi

## Multilingual AI Business Advisor for First-Time & Small-Business Entrepreneurs

BizSaathi is an AI-powered, multilingual business advisory platform designed to help first-time and small-business entrepreneurs in India understand their business needs, make informed decisions, and take practical next steps.

Instead of providing generic business advice, BizSaathi uses the entrepreneur's business context — such as business type, budget, location, goals, and experience — to generate personalized and actionable guidance.

Live Demo: https://biz-saathi-eight.vercel.app/

---

## 🌟 Why BizSaathi?

Starting or managing a small business can be challenging, especially for first-time entrepreneurs.

Many entrepreneurs face questions such as:

- What business should I start?
- How much budget do I need?
- What should I do first?
- How can I attract customers?
- How should I price my products?
- How can I manage my expenses?
- What should I focus on to grow my business?

BizSaathi aims to make business guidance:

- Simple
- Personalized
- Accessible
- Multilingual
- Action-oriented

The platform is designed especially for users who may not have access to professional business consultants or extensive business knowledge.

---

# 🎯 Problem Statement

First-time and small-business entrepreneurs often struggle to access personalized business guidance.

Existing online resources can be:

- Too complicated
- Generic
- Difficult to understand
- Available primarily in English
- Not tailored to an individual's business situation

BizSaathi addresses this problem by providing an AI-powered conversational business advisor that understands the user's business context and provides practical guidance.

---

# 💡 Solution

BizSaathi collects important business information during onboarding and uses that context to personalize AI-generated responses.

### Example Business Context

The platform can consider information such as:

- Business type
- Budget
- Location
- Business goal
- Entrepreneur experience
- Current business stage

The AI then uses this context when generating responses.

### Example

Instead of:

> "You should market your business on social media."

BizSaathi can provide guidance such as:

> "Since you are starting a small home-based food business with a limited budget, begin with WhatsApp Business and Instagram before spending money on paid advertisements."

This makes the guidance more practical and relevant.

---

# ✨ Key Features

## 🤖 AI Business Advisor

Users can interact with BizSaathi through a conversational interface and ask questions related to their business.

The AI provides:

- Business guidance
- Suggestions
- Explanations
- Actionable next steps
- Personalized recommendations

---

## 🌐 Multilingual Support

BizSaathi is designed to support entrepreneurs in multiple languages.

Users can select their preferred language and receive responses in that language.

This helps reduce the language barrier for entrepreneurs who may be more comfortable communicating in regional Indian languages.

---

## 🧑‍💼 Personalized Business Context

During onboarding, users can provide information such as:

- Business type
- Available budget
- Location
- Business goal
- Current business stage

This context is used to make AI responses more relevant.

---

## 👤 New & Returning Users

BizSaathi supports different onboarding experiences.

### First-Time Entrepreneurs

New users can provide their business details and receive an initial business plan and guidance.

### Existing Business Owners

Returning users can access their saved business context and continue receiving personalized guidance.

Users can also update their business context when their situation changes.

---

## 💬 AI Chat

Users can interact with the AI advisor through a conversational interface.

The chat experience allows users to:

- Ask business questions
- Receive AI responses
- Continue conversations
- Ask follow-up questions
- Get actionable suggestions

---

## 🎙️ Voice Interaction

BizSaathi includes voice-related functionality to make interaction more accessible.

Users can use speech-related features to interact with the platform and listen to AI-generated responses where supported.

---

## 🔐 Authentication

BizSaathi includes user authentication for features that require a persistent user account.

Authentication allows users to:

- Create an account
- Log in
- Access their profile
- Save their business journey
- Access saved information

---

## 💾 Business Context Storage

The platform stores relevant business information so that returning users do not have to repeatedly provide the same details.

This enables more personalized conversations across sessions.

---

## 🗂️ Conversation History

Users can access their previous conversations and continue their business journey instead of starting from scratch every time.

---

## ⚙️ Settings & Profile

Users have access to a settings/profile area where they can manage their account and application preferences.

---

# 🏗️ System Architecture

```text
                         ┌─────────────────────┐
                         │       User          │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ React + Vite        │
                         │ Frontend            │
                         └──────────┬──────────┘
                                    │
                              API Requests
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ FastAPI Backend     │
                         │                     │
                         │ Authentication      │
                         │ Business Logic      │
                         │ API Endpoints       │
                         └──────┬─────────┬────┘
                                │         │
                                ▼         ▼
                     ┌──────────────┐  ┌──────────────┐
                     │ PostgreSQL   │  │ Gemini API   │
                     │ Database     │  │              │
                     └──────────────┘  └──────────────┘
                            
                            User
                              │
                              ▼
                            Landing Page
                              │
                              ▼
                            Register / Login
                              │
                              ▼
                            Business Onboarding
                              │
                              ├── Business Type
                              ├── Budget
                              ├── Location
                              ├── Goal
                              └── Business Stage
                              │
                              ▼
                            Business Context
                              │
                              ▼
                            AI Business Advisor
                              │
                              ├── User Query
                              ├── Business Context
                              └── Selected Language
                              │
                              ▼
                            Gemini AI
                              │
                              ▼
                            Personalized Response
                              │
                              ▼
                            Conversation History

Output:
🏠 Landing Page
<img width="1917" height="968" alt="image" src="https://github.com/user-attachments/assets/5eadc6bd-4fbf-44ef-a4d7-ba012fe1dfe8" />
💼 Business Dashboard
<img width="1917" height="911" alt="image" src="https://github.com/user-attachments/assets/0f1d1bf9-6302-4f11-b842-644c999dab26" />
🤖 AI Business Advisor
<img width="1917" height="972" alt="image" src="https://github.com/user-attachments/assets/b4fe4fe8-a1c5-442d-a66a-5c58d35c435c" />

🛠️ Technology Stack
Frontend
React
Vite
JavaScript
CSS
Axios
React Icons
Backend
Python
FastAPI
Pydantic
SQLAlchemy
JWT Authentication
Database
PostgreSQL
AI
Google Gemini API
Deployment
Vercel — Frontend
Render — Backend
PostgreSQL — Database
Development
Git
GitHub
VS Code

🌐 Deployment

BizSaathi is deployed as a full-stack application.

Frontend

Vercel

Live application:

https://biz-saathi-eight.vercel.app/

Backend

Render

The FastAPI backend is deployed separately and communicates with the React frontend through REST APIs.

Database

PostgreSQL is used for persistent application data.

AI Service

Google Gemini API powers the AI business advisory functionality.

🧪 Testing

The application was tested across the following areas:

Authentication
User registration
User login
JWT authentication
Logout
Protected routes
Business Context
New user onboarding
Existing user context
Context updates
Persistent business information
AI Features
Business questions
Personalized responses
Suggested questions
Multilingual responses
Follow-up conversations
User Experience
Responsive interface
Navigation
Settings
Conversation history
Voice interaction
📊 Project Goals

BizSaathi was designed around the following target metrics:

Metric	Target
Response Time	< 3 seconds
Language Accuracy	> 90%
Actionability	80%+
Personalization	100%
User Clarity	90%

These values represent project targets and should be validated through formal testing before being presented as measured results.

🚀 Future Enhancements
📱 Mobile application
🗣️ Improved voice-first interaction
🌐 Support for additional Indian languages
📊 Business analytics dashboard
📈 Business growth tracking
💰 Budget and expense planning
🔎 Local market insights
🧾 Business document generation
🏛️ Verified government scheme information
🤝 Entrepreneur community features
📚 Business learning resources
🎯 Target Users

BizSaathi is designed for:

First-time entrepreneurs
Small-business owners
Local business owners
Home-based businesses
Students exploring entrepreneurship
Individuals planning to start a business
Entrepreneurs who prefer regional languages
