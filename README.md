# AI Resume Builder

An **AI-powered Resume Builder and Resume Optimizer** built with **Angular**, **Node.js**, and **SQL Server** that helps users upload resumes, analyze them against a target job description, calculate ATS-style match scores, generate AI suggestions, and create improved resumes with live editing and export options.

This project combines **resume parsing**, **job-description matching**, **AI-powered resume enhancement**, and a **modern resume editor** into one workflow.

---

# 🚀 Overview

The **AI Resume Builder** is designed to help candidates create stronger resumes tailored to a specific job role.

It supports two major use cases:

- **Resume Creation** – create and edit resumes from scratch using professional templates
- **AI Resume Optimization** – upload an existing resume, paste a target job description, get an AI match score, identify missing keywords, and generate an improved version

This module is useful for:
- ATS platforms
- recruitment products
- career tools
- resume optimization products
- job application assistant workflows

---

# ✨ Core Features

## 1) Resume Dashboard
The dashboard provides a central place to manage resumes and start new resume workflows.

### Available actions:
- **Create Resume** – build a resume from a template
- **AI Generate** – upload resume and improve it with AI
- **Offer Letter** – generate resume-related output for internal workflows
- **Upload Resume** – parse and edit an existing resume

### Dashboard also shows:
- recent resumes
- resume cards
- template labels
- download options
- edit/delete actions

---

## 2) AI Resume Upload Flow
Users can upload their resume in multiple formats before starting AI optimization.

### Supported upload formats:
- PDF
- DOCX
- JPG
- PNG

### Upload flow:
1. Upload resume
2. Get match score
3. AI improves resume
4. Download improved output

---

## 3) Job Title Matching Step
After upload, the system asks the user which role they are applying for.

### Example job titles:
- Software Developer
- Angular Developer
- Node.js Backend Engineer
- Full Stack Developer
- API Security Specialist
- AI Integration Developer

This helps AI tailor the scoring and improvement suggestions for the selected role.

---

## 4) Job Description Analysis
Users paste the target **Job Description (JD)** so the system can compare the uploaded resume against job requirements.

The system then evaluates:
- required skills
- keywords
- experience fit
- education match
- role alignment
- missing resume content

---

## 5) ATS / Match Score Engine
The platform calculates a resume match score against the provided job description.

### Score output includes:
- overall resume score
- predicted improved score after AI optimization
- skill match %
- keyword coverage %
- experience fit %
- education match %

This helps users understand how closely their resume matches the target role.

---

## 6) Missing Keywords Detection
The AI identifies missing or weak areas in the resume.

### Example output:
- missing technical keywords
- missing domain skills
- missing cloud/platform/tool experience
- weak phrasing in summary or experience sections

This is useful for improving ATS compatibility and recruiter relevance.

---

## 7) AI Suggestions Engine
The system provides improvement recommendations such as:
- add missing skills from the JD
- improve summary section
- strengthen impact statements
- highlight domain-specific tools
- improve project phrasing
- align experience wording with the job role

---

## 8) Generate Improved Resume
Once the score is analyzed, users can generate an improved version of the resume.

The improved version can:
- rewrite summary
- improve bullet points
- inject relevant keywords
- align the resume with the target job description
- increase ATS compatibility
- produce a better structured output

---

## 9) Resume Editor
After generation, users can open the resume in an advanced editor.

### Editor features:
- live resume preview
- editable resume sections
- personal details editing
- experience / education / skills / certifications / languages management
- profile image upload
- multiple visual templates
- section-based editing tabs
- save resume
- export to **PDF**
- export to **DOCX**

---

## 10) Multiple Resume Templates
The editor supports multiple resume styles such as:
- Classic
- Modern
- Minimal
- Executive
- Corporate
- Creative
- Elegant
- Tech
- Bold
- Clean
- Navy Pro
- Teal Fresh
- Rose Gold
- Slate Edge
- Forest
- Midnight
- Amber
- Arctic
- Crimson
- Graphite
- Simple
- Vivid
- Academic

---

## 11) Resume Card Management
Recent resumes are shown as cards with:
- candidate name
- role / title
- template label
- created date
- skill count
- edit option
- delete option
- PDF / PNG export buttons

---

# 🛠️ Tech Stack

## Frontend
- Angular
- TypeScript
- HTML5
- SCSS / CSS
- Angular Material

## Backend
- Node.js
- Express.js

## Database
- Microsoft SQL Server / SQL-based storage

## AI / Processing
- Resume parsing logic
- JD keyword extraction
- AI scoring / suggestion generation
- Resume improvement pipeline
- export generation (PDF / DOCX)

---

# 📂 Project Structure

```bash
ai-resume-builder/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── resume-dashboard/
│   │   │   │   ├── ai-resume-upload/
│   │   │   │   ├── job-title-step/
│   │   │   │   ├── jd-analysis-step/
│   │   │   │   ├── resume-score-view/
│   │   │   │   ├── resume-editor/
│   │   │   │   └── recent-resume-card/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── shared/
│   │   ├── assets/
│   │   └── environments/
│   └── angular.json
│
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── utils/
│   ├── db/
│   └── server.js
│
├── database/
│   └── schema.sql
│
├── screenshots/
│   ├── resume-dashboard.png
│   ├── ai-upload-screen.png
│   ├── job-title-step.png
│   ├── jd-analysis-step.png
│   ├── resume-score-screen.png
│   └── resume-editor.png
│
└── README.md
