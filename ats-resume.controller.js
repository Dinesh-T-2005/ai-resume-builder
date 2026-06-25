const express = require('express');
const router = express.Router();
require('dotenv').config();
const { sql, config } = require("../config/db");
const { runAI } = require("../services/ai");
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const { fromBuffer } = require("pdf2pic");
const officeParser = require('officeparser');


router.post('/save', async (req, res) => {
  const { candidate_id, job_id, template, resume_data, org_id, userId, division_id } = req.body;
  if (!org_id || !resume_data || !division_id)
    return res.status(400).json({ success: false, message: 'org_id, resume_data, and division_id are required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('candidate_id', sql.Int, candidate_id || null)
      .input('job_id', sql.Int, job_id || null)
      .input('template', sql.NVarChar, template || 'classic')
      .input('resume_data', sql.NVarChar(sql.MAX), JSON.stringify(resume_data))
      .input('org_id', sql.Int, org_id || null)
      .input('userId', sql.Int, userId || null)
      .input('division_id', sql.Int, division_id || null)
      .query(`INSERT INTO ats_resume (candidate_id, job_id, template, resume_data, created_at, updated_at , orgId, userId, orgDiv)
              OUTPUT INSERTED.id
              VALUES (@candidate_id, @job_id, @template, @resume_data, GETDATE(), GETDATE(), @org_id, @userId, @division_id)`);
    res.json({ success: true, data: { id: result.recordset[0]?.id } });
  } catch (err) {
    console.error('save error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save' });
  }
});



router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { template, resume_data } = req.body;
  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input('id', sql.Int, id)
      .input('template', sql.NVarChar, template || 'classic')
      .input('resume_data', sql.NVarChar(sql.MAX), JSON.stringify(resume_data))
      .query(`UPDATE ats_resume SET template=@template, resume_data=@resume_data, updated_at=GETDATE() WHERE id=@id`);
    res.json({ success: true, data: { id: +id } });
  } catch (err) {
    console.error('update error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
});

router.get('/:resumeId', async (req, res) => {

  const resumeId = parseInt(req.params.resumeId);

  if (isNaN(resumeId)) {
    return res.status(400).json({ success: false, message: 'Invalid resume id' });
  }

  const pool = await sql.connect(config);

  const result = await pool.request()
    .input('id', sql.Int, resumeId)
    .query(`SELECT * FROM ats_resume WHERE id=@id AND active = 1`);

  if (!result.recordset.length)
    return res.json({ success: false });

  const r = result.recordset[0];

  res.json({
    success: true,
    data: {
      id: r.id,
      template: r.template,
      resume_data: JSON.parse(r.resume_data)
    }
  });

});

router.put('/resume-delete/:resumeId', async (req, res) => {
  const { resumeId } = req.params;

  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input('resumeId', sql.Int, resumeId)
      .query(`
      update ats_resume set active = 0 where id = @resumeId
      `);

    res.json({ success: true, data: { id: + resumeId } });
  }
  catch (err) {
    res.status(500).json({ success: false, message: 'Error delete resumes' });
  }
})

router.get('/list/:org_id/:division_id', async (req, res) => {
  const { org_id, division_id } = req.params;

  try {
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('division_id', sql.Int, division_id)
      .query(`
        SELECT * FROM ats_resume
        WHERE orgId=@org_id AND orgDiv=@division_id
        ORDER BY updated_at DESC
      `);

    res.json({ success: true, data: result.recordset });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error loading resumes' });
  }
});


router.get('/resume-lists/:orgid/:divisionId/:userId', async (req, res) => {
  const { orgid, divisionId, userId } = req.params;
  if (!orgid || !divisionId)
    return res.status(400).json({ success: false, message: 'orgid, divisionId are required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('orgId', sql.Int, parseInt(orgid))
      .input('divisionId', sql.Int, parseInt(divisionId))
      .input('userId', sql.Int, userId)
      .query(
        `SELECT * FROM ats_resume WHERE orgId=@orgId AND orgDiv=@divisionId AND userId = @userId AND active = 1 ORDER BY updated_at DESC`
      );
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list' });
  }
});


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});


router.post("/parse", upload.single("resume"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let rawText = "";

    if (ext === ".pdf") {
      
      const pdfResult = await pdfParse(req.file.buffer).catch(() => null);
      rawText = pdfResult?.text || "";

      if (rawText && rawText.trim().length > 20) {
          const data = await parseResumeAI(rawText, req);
          return res.json({ success: true, data });
      }

        const convert = fromBuffer(req.file.buffer, {
          density: 300,
          format: "png",
          width: 1200,
          height: 1600
        });

        const page = await convert(1);

        const base64 = page.base64;

        const data = await parseResumeFromImageAI(base64, "image/png", req);

        return res.json({ success: true, data });
    }

    if (ext === ".docx") {

      try {

        const docxResult = await mammoth.extractRawText({
          buffer: req.file.buffer
        });

        rawText = docxResult.value;

      } catch (err) {
        console.warn("DOCX parsing failed");
      }

      if (rawText && rawText.trim().length > 20) {

          const data = await parseResumeAI(rawText, req);
          return res.json({ success: true, data });

      }
    }

    // if (ext === ".doc") {

    //   try {

    //     rawText = await officeParser.parseOfficeAsync(req.file.buffer);

    //   } catch (err) {
    //     console.warn("DOC parsing failed");
    //   }

    //   if (rawText && rawText.trim().length > 20) {

    //     const data = await parseResumeAI(rawText, req);
    //     return res.json({ success: true, data });

    //   }
    // }

    if (ext === ".doc") {
      return res.status(400).json({
        success: false,
        message: "DOC files are not supported. Please upload PDF or DOCX."
      });
    }


    if ([".jpg", ".jpeg", ".png"].includes(ext)) {

        const base64 = req.file.buffer.toString("base64");

        const data = await parseResumeFromImageAI(
          base64,
          req.file.mimetype,
          req
        );

        return res.json({ success: true, data });
    }

    return res.status(400).json({
      success: false,
      message: "Unsupported file type"
    });

  } catch (err) {

    console.error("Parse error:", err);

    res.status(500).json({
      success: false,
      message: "Resume parsing failed"
    });
  }
});

function extractSmartResumeText(text) {
  const MAX_CHARS = 12000;

  if (text.length <= MAX_CHARS) return text;

  const upper = text.toUpperCase();

  const WORK_SECTION_KEYWORDS = [
    'WORK EXPERIENCE',
    'PROFESSIONAL EXPERIENCE',
    'EMPLOYMENT HISTORY',
    'WORK HISTORY',
    'CAREER HISTORY',
    'EXPERIENCE\n',
  ];

  let workSectionStart = -1;
  for (const kw of WORK_SECTION_KEYWORDS) {
    const idx = upper.indexOf(kw.trim());
    if (idx > 1000 && idx < text.length - 500) {
      workSectionStart = idx;
      console.log(`[PARSE] Found work section "${kw.trim()}" at char ${idx}`);
      break;
    }
  }

  if (workSectionStart > 5000) {
    const head = text.substring(0, 4000);
    const body = text.substring(workSectionStart, workSectionStart + 8000);
    console.log(`[PARSE] Smart split: head(0-4000) + work(${workSectionStart}-${workSectionStart + 8000}), total=${head.length + body.length}`);
    return head + '\n\n[...middle section omitted...]\n\n' + body;
  }

  return text.substring(0, MAX_CHARS);
}


async function parseResumeFromImageAI(base64, mimeType, req) {
  const isPdfOcr = mimeType === 'application/pdf';
  const prompt = `
You are a resume parser with OCR capability. This is ${isPdfOcr ? 'a scanned PDF resume (provided as base64)' : 'an image of a resume'}.

Extract ALL visible information from the resume.

STRICT RULES:
- Extract ONLY what you can actually read in the image
- Return ONLY raw JSON — no markdown fences, no explanation

JSON structure:
{
  "basics": {
    "name": "candidate name from image",
    "headline": "job title from image",
    "email": "email from image",
    "phone": "phone from image",
    "location": "location from image",
    "website": "website from image if any",
    "linkedin": "linkedin from image if any",
    "photo": "photo from image if any"
  },
  "summary": "summary text or empty string",
  "experience": [
    {
      "company": "company name",
      "position": "job title",
      "startDate": "start date",
      "endDate": "end date",
      "current": false,
      "description": "responsibilities"
    }
  ],
  "education": [
    {
      "institution": "institution name",
      "degree": "degree",
      "field": "field",
      "startDate": "year",
      "endDate": "year",
      "gpa": ""
    }
  ],
  "skills": ["skill1", "skill2"],
  "strengths": [],
  "languages": ["English"],
  "certifications": [],
  "attachments": []
}
`;

  let res2;
  try {
    const effectiveMime = mimeType === 'application/pdf' ? 'image/jpeg' : mimeType;
    res2 = await runAI("resume_ai", prompt, req.app.locals.db, {
      image: { base64, mimeType: effectiveMime }
    });
  } catch (imgErr) {
    console.warn('[PARSE] Image AI call failed, trying text-only fallback:', imgErr.message);
    res2 = await runAI("resume_ai",
      prompt + '\n\n[NOTE: Image could not be processed. Return empty JSON structure with all empty fields.]',
      req.app.locals.db
    );
  }
  const aiText = (res2.text || res2).trim();
  const cleaned = extractJSON(aiText);
  return sanitizeResume(JSON.parse(cleaned));
}

async function parseResumeAI(text, req) {
  const resumeText = extractSmartResumeText(text);
  console.log(resumeText.substring(0, 500).replace(/\s+/g, ' '));

  const prompt = `
You are a resume parser. Extract ALL information that is ACTUALLY present in the resume below.

STRICT RULES:
- Extract ONLY real data from the text — do NOT invent or generate any content
- Extract EVERY SINGLE work experience entry (company, position, dates, description)
- Extract every education entry (institution, degree, field, dates)
- If a section does not exist in the resume, use an empty array []
- Return ONLY raw JSON — no markdown fences, no explanation
- For experience: look for patterns like "Client:", "Company:", role names with dates, "Jan 20XX – Present", etc.

JSON structure to return:
{
  "basics": {
    "name": "candidate's actual name",
    "headline": "their current job title or professional title",
    "email": "their email",
    "phone": "their phone",
    "location": "their location",
    "website": "their website URL if any",
    "linkedin": "their LinkedIn URL if any",
    "photo": "their photo URL if any"
  },
  "summary": "their summary or objective — if not present write empty string",
  "experience": [
    {
      "company": "actual company name",
      "position": "actual job title",
      "startDate": "actual start date",
      "endDate": "actual end date or empty if current",
      "current": false,
      "description": "actual responsibilities and achievements"
    }
  ],
  "education": [
    {
      "institution": "actual institution name",
      "degree": "actual degree",
      "field": "actual field",
      "startDate": "year",
      "endDate": "year",
      "gpa": ""
    }
  ],
  "skills": ["skill1", "skill2"],
  "strengths": [],
  "languages": ["English"],
  "certifications": [],
  "attachments": []
}

RESUME TEXT:
${resumeText}
`;

  const res2 = await runAI("resume_ai", prompt, req.app.locals.db);
  const aiText = (res2.text || res2).trim();
  const cleaned = extractJSON(aiText);
  return sanitizeResume(JSON.parse(cleaned));
}


router.post('/tailor', async (req, res) => {
  try {
    const { resume, jobTitle, jobDescription, customNote } = req.body;
    if (!resume || !jobTitle || !jobDescription)
      return res.status(400).json({ success: false, message: 'resume, jobTitle, jobDescription required' });

    const tailored = await tailorResumeAI(resume, jobTitle, jobDescription, customNote || '', req);
    res.json({ success: true, data: tailored });

  } catch (err) {
    console.error('[TAILOR] error:', err);
    res.status(500).json({ success: false, message: err.message || 'Tailoring failed' });
  }
});

async function tailorResumeAI(resume, jobTitle, jobDescription, customNote, req) {

  const hasRealExp = hasRealContent(resume.experience, ['company', 'position']);
  const hasRealEdu = hasRealContent(resume.education, ['institution']);

  let yearsExp = '5';
  const yearsFromSummary = (resume.summary || '').match(/(\d+)\s*(?:\+\s*)?year/i);
  if (yearsFromSummary) {
    yearsExp = yearsFromSummary[1];
  } else if (hasRealExp && resume.experience.length > 0) {
    const firstExp = resume.experience[resume.experience.length - 1];
    const startYear = parseInt((firstExp.startDate || '').match(/\d{4}/)?.[0] || '0');
    if (startYear > 2000) {
      yearsExp = String(new Date().getFullYear() - startYear);
    }
  }

  const skillsList = (resume.skills || []).join(', ') || 'various technical skills';
  const name = resume.basics?.name || '';
  const email = resume.basics?.email || '';
  const phone = resume.basics?.phone || '';
  const location = resume.basics?.location || '';
  const headline = resume.basics?.headline || '';

  let expInstruction = '';
  if (hasRealExp) {
    expInstruction = `
EXISTING EXPERIENCE (candidate's REAL data — keep company names and dates, only improve descriptions):
${JSON.stringify(resume.experience, null, 2)}

For each experience entry above:
- Keep company name, position title, startDate, endDate, current EXACTLY as-is
- Rewrite "description" with strong action verbs, quantified results, and keywords from the job description
- Make each description 3-4 sentences long`;
  } else {
    expInstruction = `
The candidate has ${yearsExp}+ years of experience as "${headline}" but their resume did not parse with detailed experience entries.

Generate 3 realistic professional work experience entries:
- Use REAL company names common in Indian IT industry: TCS, Infosys, Wipro, Cognizant, Tech Mahindra, HCL, Capgemini, Accenture, IBM, Oracle, etc.
- Make positions match their skill level (e.g. if ${yearsExp} years: Senior role for last 2 years, mid roles before that)
- Dates must be realistic and continuous, ending around 2024-2025
- Descriptions must use their actual skills: ${skillsList}
- Each description must be 3-4 sentences with specific technical achievements`;
  }

  let eduInstruction = '';
  if (hasRealEdu) {
    eduInstruction = `
EXISTING EDUCATION (keep EXACTLY as-is — do not change):
${JSON.stringify(resume.education, null, 2)}`;
  } else {
    eduInstruction = `
Generate 1 realistic education entry:
- Degree: B.Tech or B.Sc in Computer Science or Information Technology
- University: use a real Indian university (e.g. Anna University, VTU, JNTU, Pune University, Osmania University, etc.)
- Graduation year: appropriate for ${yearsExp} years of experience`;
  }

  const prompt = `
You are a senior professional resume writer. Create a COMPLETE, ATS-optimized resume.

━━━ CANDIDATE PERSONAL INFO (use EXACTLY as given — never change name/email/phone) ━━━
Name:     ${name}
Email:    ${email}
Phone:    ${phone}
Location: ${location}
Current Headline: ${headline}
Years of Experience: ${yearsExp}+ years
All Skills: ${skillsList}
Current Summary: ${resume.summary || 'Not provided'}

━━━ TARGET JOB ━━━
Job Title: ${jobTitle}
Job Description:
${jobDescription.substring(0, 2500)}

${customNote ? `━━━ CANDIDATE INSTRUCTIONS ━━━\n${customNote}\n` : ''}

━━━ EXPERIENCE ━━━
${expInstruction}

━━━ EDUCATION ━━━
${eduInstruction}

━━━ WHAT TO GENERATE ━━━

1. headline → Set to: "${jobTitle}"

2. summary → Write a powerful 3-sentence professional summary:
   - Sentence 1: ${yearsExp}+ years of experience + headline + top strengths
   - Sentence 2: Key technical skills relevant to "${jobTitle}"
   - Sentence 3: Value proposition / career achievement tailored to this job

3. experience → As instructed above

4. education → As instructed above

5. skills → Combine ALL existing skills with 4-5 new skills from job description:
   Current skills: ${skillsList}
   Add relevant ones from JD that match "${jobTitle}"

6. certifications → List 2-3 relevant industry certifications for "${jobTitle}"

7. languages → ["English"] minimum, add others if mentioned in original

 CRITICAL: The "name" field in basics MUST be "${name}" — never change it.
 CRITICAL: Tailor ALL content specifically for the job title "${jobTitle}"

RETURN ONLY THIS JSON — no markdown, no explanation:
{
  "basics": {
    "name": "${name}",
    "headline": "${jobTitle}",
    "email": "${email}",
    "phone": "${phone}",
    "location": "${location}",
    "website": "${resume.basics?.website || ''}",
    "linkedin": "${resume.basics?.linkedin || ''}",
    "photo": "${resume.basics?.photo || ''}"
  },
  "summary": "3 sentence professional summary tailored to ${jobTitle}",
  "experience": [...],
  "education": [...],
  "skills": ["skill1", "skill2"],
  "strengths": [],
  "languages": ["English"],
  "certifications": ["cert1", "cert2"],
  "attachments": []
}
`;

  const res2 = await runAI("resume_ai", prompt, req.app.locals.db);
  const aiText = (res2.text || res2).trim();
  const cleaned = extractJSON(aiText);
  const tailored = JSON.parse(cleaned);

  tailored.basics = tailored.basics || {};
  tailored.basics.name = name || tailored.basics.name;
  tailored.basics.email = email || tailored.basics.email;
  tailored.basics.phone = phone || tailored.basics.phone;
  tailored.basics.photo = resume.basics?.photo || '';
  if (location) tailored.basics.location = location;

  if (hasRealExp && !tailored.experience?.length) tailored.experience = resume.experience;
  if (hasRealEdu && !tailored.education?.length) tailored.education = resume.education;

  tailored.attachments = resume.attachments || [];

  return sanitizeResume(tailored);
}


function hasRealContent(arr, checkFields) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const PLACEHOLDERS = [
    'company name', 'institution name', 'your company', 'employer',
    'organization', 'university name', 'college name', 'n/a', 'unknown', ''
  ];
  return arr.some(item =>
    checkFields.some(field => {
      const v = (item[field] || '').toLowerCase().trim();
      return v.length > 2 && !PLACEHOLDERS.includes(v);
    })
  );
}

function extractJSON(text) {
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b > a) s = s.substring(a, b + 1);
  return s;
}

function sanitizeResume(p) {
  return {
    basics: {
      name: p.basics?.name || '',
      headline: p.basics?.headline || '',
      email: p.basics?.email || '',
      phone: p.basics?.phone || '',
      location: p.basics?.location || '',
      website: p.basics?.website || '',
      linkedin: p.basics?.linkedin || '',
      photo: p.basics?.photo || '',
    },
    summary: p.summary || '',
    experience: Array.isArray(p.experience) ? p.experience : [],
    education: Array.isArray(p.education) ? p.education : [],
    skills: Array.isArray(p.skills) ? p.skills : [],
    strengths: Array.isArray(p.strengths) ? p.strengths : [],
    languages: Array.isArray(p.languages) ? p.languages : [],
    certifications: Array.isArray(p.certifications) ? p.certifications : [],
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
  };
}


router.post('/analyze-jobs', async (req, res) => {
  try {
    const { resume } = req.body;

    if (!resume)
      return res.status(400).json({ success: false, message: 'resume required' });

    const prompt = `
You are a career advisor AI.

Analyze this candidate resume and suggest the BEST matching job titles.

Rules:
- Suggest 6 relevant job titles BASED ON THIS SPECIFIC CANDIDATE'S skills and experience
- The candidate's name is: ${resume.basics?.name || 'Unknown'}
- Their current headline: ${resume.basics?.headline || ''}
- Their skills: ${(resume.skills || []).join(', ')}
- Base suggestions STRICTLY on their actual skills — do NOT use generic titles
- Keep titles concise and industry-specific

Return ONLY JSON:
{
 "jobs": [
   "Job Title 1",
   "Job Title 2",
   "Job Title 3",
   "Job Title 4",
   "Job Title 5",
   "Job Title 6"
 ]
}

RESUME:
${JSON.stringify(resume).substring(0, 3000)}
`;

    const ai = await runAI("resume_ai", prompt, req.app.locals.db);
    const cleaned = extractJSON(ai.text || ai);
    const parsed = JSON.parse(cleaned);

    res.json({ success: true, data: parsed.jobs });

  } catch (err) {
    console.error("job analyze error", err);
    res.status(500).json({ success: false, message: "AI job analysis failed" });
  }
});




router.post('/score', async (req, res) => {
  try {
    const { resume, jobTitle, jobDescription } = req.body;

    if (!resume || !jobTitle || !jobDescription)
      return res.status(400).json({
        success: false,
        message: 'resume, jobTitle, and jobDescription are required',
      });

    const result = await scoreResumeAI(resume, jobTitle, jobDescription, req);
    res.json({ success: true, data: result });

  } catch (err) {
    console.error('[SCORE] error:', err);
    res.status(500).json({ success: false, message: err.message || 'Scoring failed' });
  }
});


async function scoreResumeAI(resume, jobTitle, jobDescription, req) {

  const name = resume.basics?.name || 'Candidate';
  const skills = (resume.skills || []).join(', ') || 'none listed';
  const summary = resume.summary || '';

  const expStr = (resume.experience || [])
    .map(e => `${e.position} at ${e.company} (${e.startDate}–${e.current ? 'Present' : e.endDate})`)
    .join('\n') || 'none listed';

  const eduStr = (resume.education || [])
    .map(e => `${e.degree} in ${e.field} – ${e.institution}`)
    .join('\n') || 'none listed';

  const prompt = `
You are an expert ATS (Applicant Tracking System) resume analyst.
Analyse the candidate resume against the job and return a match score.

━━━ CANDIDATE RESUME ━━━
Name:       ${name}
Summary:    ${summary}
Skills:     ${skills}
Experience:
${expStr}
Education:
${eduStr}

━━━ TARGET JOB ━━━
Job Title: ${jobTitle}
Job Description:
${jobDescription.substring(0, 2500)}

━━━ SCORING RULES ━━━

Calculate a score 0-100 for each of these 4 categories:

1. skills
   - Compare every skill in the resume against skills/tools mentioned in the JD
   - matched: skills present in BOTH resume AND JD
   - missing: important skills in JD that are NOT in resume (pick top 5-8)

2. experience
   - Does the candidate's seniority, years of experience, and domain match the JD?
   - Provide a short 1-sentence note

3. keywords
   - ATS keyword coverage: how many technical/domain terms from the JD appear in the resume?
   - matched: keywords present in resume (pick top 5-8)
   - missing: important JD keywords absent from resume (pick top 5-8)

4. education
   - Does the candidate's education meet the JD requirement?
   - Provide a short 1-sentence note

5. overall  = weighted average: skills*0.30 + experience*0.30 + keywords*0.25 + education*0.15
              Round to nearest integer.

6. predictedScore = score after AI improvement (overall + 15 to 28 points, max 97)

7. topSuggestions = 3 specific, actionable improvements (NOT generic advice)

RETURN ONLY RAW JSON — no markdown, no explanation:
{
  "overall": 65,
  "predictedScore": 88,
  "breakdown": {
    "skills": {
      "score": 70,
      "matched": ["React", "TypeScript", "REST API"],
      "missing": ["AWS", "Docker", "GraphQL"]
    },
    "experience": {
      "score": 72,
      "note": "5 years aligns with the senior-level requirement"
    },
    "keywords": {
      "score": 58,
      "matched": ["frontend", "agile", "CI/CD"],
      "missing": ["microservices", "Kubernetes", "unit testing"]
    },
    "education": {
      "score": 80,
      "note": "B.Tech in Computer Science meets the qualification requirement"
    }
  },
  "topSuggestions": [
    "Add AWS or Azure experience — mentioned 4 times in the JD",
    "Include specific metrics in your experience (e.g. 'reduced load time by 40%')",
    "Add Docker and containerization skills — required for this DevOps-heavy role"
  ]
}
`;

  const aiResult = await runAI('resume_ai', prompt, req.app.locals.db);
  const aiText = (aiResult.text || aiResult).trim();
  const cleaned = extractJSON(aiText);
  const parsed = JSON.parse(cleaned);

  return sanitizeScoreResult(parsed);
}


function sanitizeScoreResult(p) {
  const clamp = (v) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));

  const bd = p.breakdown || {};
  const sk = bd.skills || {};
  const ex = bd.experience || {};
  const kw = bd.keywords || {};
  const edu = bd.education || {};

  const skillScore = clamp(sk.score);
  const expScore = clamp(ex.score);
  const kwScore = clamp(kw.score);
  const eduScore = clamp(edu.score);

  const overall = clamp(
    Math.round(skillScore * 0.30 + expScore * 0.30 + kwScore * 0.25 + eduScore * 0.15)
  );

  const predicted = Math.min(97, Math.max(overall + 10, clamp(p.predictedScore || overall + 20)));

  return {
    overall,
    predictedScore: predicted,
    breakdown: {
      skills: {
        score: skillScore,
        matched: Array.isArray(sk.matched) ? sk.matched.slice(0, 10) : [],
        missing: Array.isArray(sk.missing) ? sk.missing.slice(0, 8) : [],
      },
      experience: {
        score: expScore,
        note: ex.note || '',
      },
      keywords: {
        score: kwScore,
        matched: Array.isArray(kw.matched) ? kw.matched.slice(0, 10) : [],
        missing: Array.isArray(kw.missing) ? kw.missing.slice(0, 8) : [],
      },
      education: {
        score: eduScore,
        note: edu.note || '',
      },
    },
    topSuggestions: Array.isArray(p.topSuggestions)
      ? p.topSuggestions.slice(0, 5)
      : [],
  };
}



router.post('/generate', async (req, res) => {
  try {
    const { form } = req.body;

    if (!form?.companyName || !form?.candidateName || !form?.jobTitle) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: companyName, candidateName, jobTitle',
      });
    }

    const html = await generateOfferLetterAI(form, req);
    res.json({ success: true, data: html });

  } catch (err) {
    console.error('[OFFER-LETTER] error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Generation failed',
    });
  }
});


async function generateOfferLetterAI(f, req) {

  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    }) : '';

  const hasLogo = f.companyLogo === '[LOGO_PRESENT]';
  const template = f.template || 'formal';
  const lastName = (f.candidateName || '').trim().split(' ').pop() || f.candidateName;

  const salutation = template === 'formal'
    ? `Dear Mr./Ms. ${lastName},`
    : `Dear ${(f.candidateName || '').split(' ')[0]},`;

  const signoff = template === 'formal'
    ? 'Yours faithfully,'
    : template === 'modern'
      ? 'Warm regards,'
      : 'Sincerely,';

  const logoHtml = hasLogo ? `<!--LOGO_PLACEHOLDER-->` : '';

  const todayFmt = fmt(new Date().toISOString());
  const letterDateFmt = fmt(f.letterDate) || todayFmt;

  const addrLines = (str) => (str || '').replace(/\n/g, '<br>');
  const contactLine = [f.companyEmail, f.companyPhone].filter(Boolean).join(' &nbsp;|&nbsp; ');


  const formalSkeleton = `<div class="ol-comp-header">
  ${hasLogo
      ? `<div class="ol-header-logo-row">${logoHtml}<div><div class="ol-comp-name-header">${f.companyName}</div><div class="ol-comp-addr">${f.companyAddress || ''}</div><div class="ol-comp-addr">${contactLine}</div></div></div>`
      : `<div class="ol-comp-name-header">${f.companyName}</div><div class="ol-comp-addr">${f.companyAddress || ''}</div><div class="ol-comp-addr">${contactLine}</div>`
    }
</div>
<hr class="ol-comp-divider">

<div class="ol-letter-date">Date: ${letterDateFmt}</div>

<div class="ol-letter-to">
  <strong>${f.candidateName}</strong><br>
  ${addrLines(f.candidateAddress)}<br>
  ${f.candidateEmail || ''}
</div>

<div class="ol-subject">SUBJECT: OFFER OF EMPLOYMENT &ndash; ${(f.jobTitle || '').toUpperCase()}</div>

<div class="ol-salutation">${salutation}</div>

<p class="ol-body-para">[OPENING_PARA: Write 3-4 warm professional sentences confirming the offer of employment for the position of ${f.jobTitle} at ${f.companyName}. Reference the successful interview and selection process. Express genuine pleasure in making this offer.]</p>

<p class="ol-body-para">[ROLE_PARA: Write 2-3 sentences describing the role. Mention that ${f.candidateName} will be working in the ${f.department || 'relevant'} department, reporting to ${f.reportingTo || 'the Reporting Manager'}, at ${f.workLocation || 'the company office'}, with the date of joining being ${fmt(f.joiningDate)}.]</p>

<div class="ol-highlight-box">
  <strong>Designation:</strong> ${f.jobTitle} &nbsp;&nbsp;&nbsp; <strong>Department:</strong> ${f.department || 'As discussed'}<br>
  <strong>Reporting To:</strong> ${f.reportingTo || 'Reporting Manager'} &nbsp;&nbsp;&nbsp; <strong>Location:</strong> ${f.workLocation || 'Company Office'}<br>
  <strong>Date of Joining:</strong> ${fmt(f.joiningDate)}
</div>

<p class="ol-body-para">Your compensation package, as mutually agreed, is structured as follows:</p>

<table class="ol-salary-table">
  <thead>
    <tr><th>Compensation Component</th><th>Amount</th></tr>
  </thead>
  <tbody>
    ${f.basicSalary ? `<tr><td>Basic Salary</td><td>${f.basicSalary} per month</td></tr>` : ''}
    ${f.hra ? `<tr><td>House Rent Allowance (HRA)</td><td>${f.hra} per month</td></tr>` : ''}
    ${f.otherAllowances ? `<tr><td>Special / Other Allowances</td><td>${f.otherAllowances} per month</td></tr>` : ''}
    <tr><td><strong>Total Annual CTC</strong></td><td><strong>${f.ctcAnnual || 'As discussed'}</strong></td></tr>
  </tbody>
</table>

<p class="ol-body-para">[BENEFITS_PARA: Write 2-3 sentences about the benefits package: ${f.benefits || 'Health Insurance, Provident Fund, Paid Leave as per company policy'}. Make it sound attractive and supportive.]</p>

<p class="ol-body-para">[JOINING_PARA: Write 2-3 sentences instructing ${f.candidateName} to report to the HR department at 9:00 AM on the joining date. List the documents to bring: original educational certificates, previous employment relieving letter, last 3 months salary slips, government-issued photo ID, and 2 passport-size photographs.]</p>

<p class="ol-body-para">[PROBATION_PARA: Write 2-3 sentences stating this appointment is subject to a probationary period of six (6) months from the date of joining. Either party may terminate by giving one week's written notice during this period. Appointment is also subject to satisfactory background verification and reference checks. After probation, the candidate will be confirmed as a permanent employee.]</p>

<p class="ol-body-para">[ACCEPTANCE_PARA: Write 2 sentences requesting ${f.candidateName} to sign and return one copy of this letter as formal acceptance ${f.offerExpiry ? `by ${fmt(f.offerExpiry)}` : 'within 7 working days'}. Mention that two copies need to be signed, one to be retained by the candidate and one returned to HR.]</p>

<p class="ol-body-para">[CLOSING_PARA: Write 2 warm sentences expressing genuine excitement about ${f.candidateName} joining the team at ${f.companyName}. Welcome them to the family and wish them a fulfilling career.]</p>

<div class="ol-sign-block">
  <p>${signoff}</p>
  <div class="ol-sign-line"></div>
  <div class="ol-sign-name">${f.signatoryName}</div>
  <div class="ol-sign-title">${f.signatoryTitle || 'HR Manager'}</div>
  <div class="ol-sign-name" style="margin-top:3px;">${f.companyName}</div>
</div>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:40px 0 24px;">

<p class="ol-body-para" style="font-weight:700;text-transform:uppercase;letter-spacing:.4px;">Acknowledgement of Offer</p>
<p class="ol-body-para">I, ${f.candidateName}, hereby accept the above offer of employment on the terms and conditions stated herein and confirm my date of joining as ${fmt(f.joiningDate)}.</p>

<div style="display:flex;gap:52px;margin-top:30px;">
  <div>
    <div style="border-bottom:1px solid #1e293b;width:160px;height:30px;"></div>
    <div style="font-size:9px;color:#64748b;margin-top:5px;font-family:Georgia,serif;">Candidate Signature</div>
  </div>
  <div>
    <div style="border-bottom:1px solid #1e293b;width:160px;height:30px;"></div>
    <div style="font-size:9px;color:#64748b;margin-top:5px;font-family:Georgia,serif;">Date</div>
  </div>
</div>

<div class="ol-footer">
  This offer letter is private and confidential, intended solely for ${f.candidateName}.
  Unauthorised disclosure or reproduction of this document is strictly prohibited.
</div>`;



  const modernSkeleton = `<div class="ol-accent-bar" style="background:#2563eb;height:5px;margin-bottom:24px;display:block;"></div>

<div class="ol-header-logo-row">
  ${logoHtml}
  <div>
    <div class="ol-comp-name-header" style="color:#2563eb;">${f.companyName}</div>
    <div class="ol-comp-addr">${f.companyAddress || ''}</div>
    <div class="ol-comp-addr">${contactLine}</div>
  </div>
</div>
<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:16px 0 22px;">

<div class="ol-letter-date">Date: ${letterDateFmt}</div>

<div class="ol-letter-to">
  <strong>${f.candidateName}</strong><br>
  ${addrLines(f.candidateAddress)}<br>
  ${f.candidateEmail || ''}
</div>

<div class="ol-subject" style="color:#1d4ed8;">Offer of Employment &ndash; ${f.jobTitle}</div>

<div class="ol-salutation">${salutation}</div>

<p class="ol-body-para">[OPENING_PARA: Write 3 warm sentences. Express that you are thrilled to offer the position of ${f.jobTitle}. Acknowledge that ${f.candidateName}'s skills and experience stood out. Say you are excited about the value they will bring.]</p>

<div class="ol-highlight-box">
  <strong>Role:</strong> ${f.jobTitle} &nbsp;&nbsp;&nbsp; <strong>Department:</strong> ${f.department || 'As discussed'}<br>
  <strong>Reports To:</strong> ${f.reportingTo || 'Reporting Manager'} &nbsp;&nbsp;&nbsp; <strong>Location:</strong> ${f.workLocation || 'Company Office'}<br>
  <strong>Date of Joining:</strong> ${fmt(f.joiningDate)}
</div>

<p class="ol-body-para">Your total annual compensation is <strong>${f.ctcAnnual || 'As discussed'}</strong>, structured as follows:</p>

<table class="ol-salary-table">
  <thead>
    <tr><th>Component</th><th>Amount</th></tr>
  </thead>
  <tbody>
    ${f.basicSalary ? `<tr><td>Basic Salary</td><td>${f.basicSalary} / month</td></tr>` : ''}
    ${f.hra ? `<tr><td>House Rent Allowance (HRA)</td><td>${f.hra} / month</td></tr>` : ''}
    ${f.otherAllowances ? `<tr><td>Other Allowances</td><td>${f.otherAllowances} / month</td></tr>` : ''}
    <tr><td><strong>Annual CTC</strong></td><td><strong>${f.ctcAnnual || 'As discussed'}</strong></td></tr>
  </tbody>
</table>

<p class="ol-body-para">[BENEFITS_PARA: Write 2 upbeat sentences about the benefits: ${f.benefits || 'Health Insurance, Provident Fund, Paid Leave'}. Frame it as the company genuinely caring about employee wellbeing.]</p>

<p class="ol-body-para">[JOINING_PARA: Write 2 sentences. Ask ${f.candidateName} to report to HR at 9:00 AM on their joining date with original documents: educational certificates, previous employment relieving letter, salary slips, and government photo ID.]</p>

<p class="ol-body-para">[PROBATION_PARA: Write 2 sentences about the 6-month probationary period and that this offer is subject to satisfactory background verification.]</p>

<p class="ol-body-para">[ACCEPTANCE_PARA: Write 2 sentences requesting acceptance ${f.offerExpiry ? `by ${fmt(f.offerExpiry)}` : 'within 7 working days'} by signing and returning one copy.]</p>

<p class="ol-body-para">[CLOSING_PARA: Write 2 warm, enthusiastic sentences welcoming ${f.candidateName} to the ${f.companyName} team. This is the beginning of an exciting journey together.]</p>

<div class="ol-sign-block">
  <p>${signoff}</p>
  <div class="ol-sign-line" style="border-bottom:2px solid #2563eb;width:160px;margin:30px 0 6px;"></div>
  <div class="ol-sign-name" style="color:#2563eb;">${f.signatoryName}</div>
  <div class="ol-sign-title">${f.signatoryTitle || 'HR Manager'}</div>
  <div class="ol-sign-name" style="color:#2563eb;margin-top:3px;">${f.companyName}</div>
</div>

<hr style="border:none;border-top:1px solid #dbeafe;margin:36px 0 20px;">

<p class="ol-body-para" style="font-weight:700;color:#1d4ed8;">Acknowledgement of Offer</p>
<p class="ol-body-para">I, ${f.candidateName}, hereby accept this offer of employment on the terms stated herein.</p>

<div style="display:flex;gap:52px;margin-top:26px;">
  <div>
    <div style="border-bottom:2px solid #3b82f6;width:160px;height:30px;"></div>
    <div style="font-size:9px;color:#64748b;margin-top:5px;">Signature</div>
  </div>
  <div>
    <div style="border-bottom:2px solid #3b82f6;width:160px;height:30px;"></div>
    <div style="font-size:9px;color:#64748b;margin-top:5px;">Date</div>
  </div>
</div>

<div class="ol-footer">
  This offer letter is private and confidential — intended solely for ${f.candidateName}.
</div>`;



  const simpleSkeleton = `<div class="ol-comp-header">
  <div class="ol-comp-name-header">${f.companyName}</div>
  <div class="ol-comp-addr">${f.companyAddress || ''}</div>
  <div class="ol-comp-addr">${[f.companyEmail, f.companyPhone].filter(Boolean).join(' | ')}</div>
</div>
<hr class="ol-comp-divider">

<div class="ol-letter-date">Date: ${letterDateFmt}</div>

<div class="ol-letter-to">
  ${f.candidateName}<br>
  ${addrLines(f.candidateAddress)}<br>
  ${f.candidateEmail || ''}
</div>

<div class="ol-subject">Subject: Offer of Employment &ndash; ${f.jobTitle}</div>

<div class="ol-salutation">${salutation}</div>

<p class="ol-body-para">[OPENING_PARA: Write 2-3 straightforward sentences confirming the offer of the position of ${f.jobTitle} at ${f.companyName}.]</p>

<p class="ol-body-para">You will be working as <strong>${f.jobTitle}</strong> in the ${f.department || 'relevant'} department, reporting to ${f.reportingTo || 'the Reporting Manager'}, at ${f.workLocation || 'the company office'}. Your date of joining will be <strong>${fmt(f.joiningDate)}</strong>.</p>

<p class="ol-body-para">Your compensation package is as follows:</p>

<div class="ol-highlight-box">
  ${f.basicSalary ? `Basic Salary: <strong>${f.basicSalary}</strong> per month<br>` : ''}
  ${f.hra ? `House Rent Allowance (HRA): <strong>${f.hra}</strong> per month<br>` : ''}
  ${f.otherAllowances ? `Other Allowances: <strong>${f.otherAllowances}</strong> per month<br>` : ''}
  Total Annual CTC: <strong>${f.ctcAnnual || 'As discussed'}</strong>
</div>

<p class="ol-body-para">[BENEFITS_PARA: Write 1-2 plain sentences listing benefits: ${f.benefits || 'Health Insurance, Provident Fund, Paid Leave'}.]</p>

<p class="ol-body-para">[JOINING_PARA: Write 1-2 sentences asking ${f.candidateName} to report on the joining date with their original documents.]</p>

<p class="ol-body-para">This offer is subject to a probationary period of six (6) months from the date of joining and a satisfactory background verification check.</p>

<p class="ol-body-para">[ACCEPTANCE_PARA: Write 1-2 sentences asking to sign and return ${f.offerExpiry ? `by ${fmt(f.offerExpiry)}` : 'within 7 working days'}.]</p>

<p class="ol-body-para">[CLOSING_PARA: Write 1 sentence — simple and warm, looking forward to ${f.candidateName} joining.]</p>

<div class="ol-sign-block">
  <p>${signoff}</p>
  <div class="ol-sign-line"></div>
  <div class="ol-sign-name">${f.signatoryName}</div>
  <div class="ol-sign-title">${f.signatoryTitle || 'HR Manager'}, ${f.companyName}</div>
</div>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:34px 0 18px;">

<p class="ol-body-para"><strong>Acknowledgement</strong></p>
<p class="ol-body-para">I, ${f.candidateName}, accept this offer of employment on the terms stated above.</p>

<div style="display:flex;gap:52px;margin-top:22px;">
  <div>
    <div style="border-bottom:1px solid #374151;width:150px;height:28px;"></div>
    <div style="font-size:9px;color:#6b7280;margin-top:5px;">Signature</div>
  </div>
  <div>
    <div style="border-bottom:1px solid #374151;width:150px;height:28px;"></div>
    <div style="font-size:9px;color:#6b7280;margin-top:5px;">Date</div>
  </div>
</div>

<div class="ol-footer">Private and confidential — for ${f.candidateName} only.</div>`;


  const skeletons = { formal: formalSkeleton, modern: modernSkeleton, simple: simpleSkeleton };
  const skeleton = skeletons[template] || formalSkeleton;

  const prompt = `You are a professional HR document writer. Complete the offer letter below by replacing ONLY the [PLACEHOLDER] tokens with real, professional content. Do NOT change, remove, or reorder any HTML tags, classes, or hardcoded content — only replace the bracketed instructions with actual sentences.

STRICT RULES:
1. Replace every [PLACEHOLDER] with proper professional English sentences
2. Keep ALL existing HTML tags and class names EXACTLY as they are
3. Do NOT add any new HTML tags, classes, or wrapper elements
4. Do NOT remove any existing HTML elements
5. Do NOT add <html>, <head>, <body>, or <style> tags
6. Return ONLY the completed raw HTML — no markdown fences, no \`\`\`html, no explanation text
7. All salary and CTC figures are already in the HTML — do not invent or change them
8. Write warm, professional, legally appropriate language throughout

CONTEXT:
Company: ${f.companyName}
Candidate: ${f.candidateName}
Job Title: ${f.jobTitle}
Department: ${f.department || 'Not specified'}
Location: ${f.workLocation || 'Company Office'}
Joining Date: ${fmt(f.joiningDate)}
Annual CTC: ${f.ctcAnnual || 'As discussed'}
Benefits: ${f.benefits || 'As per company policy'}
Signatory: ${f.signatoryName}, ${f.signatoryTitle || 'HR Manager'}
${f.offerExpiry ? `Offer Expiry: ${fmt(f.offerExpiry)}` : ''}

COMPLETE THIS HTML (replace only the [PLACEHOLDER] instructions):

${skeleton}`;

  const result = await runAI('resume_ai', prompt, req.app.locals.db);
  const rawText = (result.text || result).trim();

  return rawText
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

module.exports = router;