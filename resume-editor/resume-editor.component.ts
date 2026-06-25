import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
// import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ResumeBuilderService } from '../resume-builder.service';
import { EncryptedCookieService } from 'src/app/services/encrypted-cookie.service';
import { ToastrService } from 'ngx-toastr';
import { AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';


export interface ResumeData {
  basics: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin: string;
    photo: string;
  };
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  strengths: StrengthItem[];
  languages: string[];
  certifications: string[];
  attachments: AttachmentItem[];
}

export interface ExperienceItem {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

export interface StrengthItem {
  name: string;
  level: number;
}

export interface AttachmentItem {
  name: string;
  type: string;
  url: string;
  size: string;
}

@Component({
  selector: 'app-resume-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './resume-editor.component.html',
  styleUrls: ['./resume-editor.component.scss'],
})
export class ResumeEditorComponent implements OnInit, AfterViewChecked {

  candidateId = 0;
  jobId = 0;
  jobTitle = '';
  resumeId: number | null = null;
  saving = false;
  loading = false;

  orgid: any;
  recruiterid: any;
  accesstype: any;
  divisionId: any;

  selectedTemplate = 'classic';
  customAccentColor = '';
  activeSection = 'basics';

  skillInput = '';
  languageInput = '';
  certInput = '';
  strengthInput = '';
  strengthLevel = 3;
  previewPageCount = 1;
  readonly A4_PX = 1123


  templates = [
    { id: 'classic', label: 'Classic', color: '#1a3c5e', category: 'Professional' },
    { id: 'modern', label: 'Modern', color: '#6c3483', category: 'Modern' },
    { id: 'minimal', label: 'Minimal', color: '#1e8449', category: 'Minimal' },
    { id: 'executive', label: 'Executive', color: '#7b241c', category: 'Professional' },
    { id: 'corporate', label: 'Corporate', color: '#1a5276', category: 'Professional' },
    { id: 'creative', label: 'Creative', color: '#d35400', category: 'Creative' },
    { id: 'elegant', label: 'Elegant', color: '#4a235a', category: 'Professional' },
    { id: 'tech', label: 'Tech', color: '#0d3349', category: 'Tech' },
    { id: 'bold', label: 'Bold', color: '#1b2631', category: 'Modern' },
    { id: 'clean', label: 'Clean', color: '#2e4053', category: 'Minimal' },
    { id: 'navy', label: 'Navy Pro', color: '#0a2342', category: 'Professional' },
    { id: 'teal', label: 'Teal Fresh', color: '#0e7490', category: 'Modern' },
    { id: 'rose', label: 'Rose Gold', color: '#9f1239', category: 'Creative' },
    { id: 'slate', label: 'Slate Edge', color: '#334155', category: 'Minimal' },
    { id: 'forest', label: 'Forest', color: '#14532d', category: 'Creative' },
    { id: 'midnight', label: 'Midnight', color: '#1e1b4b', category: 'Tech' },
    { id: 'amber', label: 'Amber', color: '#92400e', category: 'Creative' },
    { id: 'arctic', label: 'Arctic', color: '#0c4a6e', category: 'Minimal' },
    { id: 'crimson', label: 'Crimson', color: '#7f1d1d', category: 'Professional' },
    { id: 'graphite', label: 'Graphite', color: '#111827', category: 'Modern' },
    { id: 'simple', label: 'Simple', color: '#2d3748', category: 'Plain' },
    { id: 'vivid', label: 'Vivid', color: '#7c3aed', category: 'Modern' },
    { id: 'pillar', label: 'Pillar', color: '#0369a1', category: 'Professional' },
    { id: 'card', label: 'Card', color: '#059669', category: 'Modern' },
    { id: 'academic', label: 'Academic', color: '#44403c', category: 'Plain' },
  ];


  sections = [
    { id: 'basics', label: 'Personal', icon: 'person' },
    { id: 'summary', label: 'Summary', icon: 'notes' },
    { id: 'experience', label: 'Experience', icon: 'work' },
    { id: 'education', label: 'Education', icon: 'school' },
    { id: 'skills', label: 'Skills', icon: 'psychology' },
    { id: 'strengths', label: 'Strengths', icon: 'star' },
    { id: 'languages', label: 'Languages', icon: 'translate' },
    { id: 'certifications', label: 'Certs', icon: 'verified' },
    { id: 'attachments', label: 'Files', icon: 'attach_file' },
    { id: 'design', label: 'Design', icon: 'palette' },
  ];


  colorPresets = [
    '#1a3c5e', '#6c3483', '#1e8449', '#7b241c', '#1a5276',
    '#d35400', '#4a235a', '#0d3349', '#1b2631', '#2e4053',
    '#0a2342', '#0e7490', '#9f1239', '#334155', '#14532d',
    '#1e1b4b', '#92400e', '#0c4a6e', '#7f1d1d', '#111827',
    '#2d3748', '#7c3aed', '#0369a1', '#059669', '#44403c',
  ];

  resume: ResumeData = this.defaultResume();


  constructor(
    private route: ActivatedRoute,
    private resumeService: ResumeBuilderService,
    private encryptedCookieService: EncryptedCookieService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.recruiterid = this.encryptedCookieService.getCookie('userId');
    this.accesstype = this.encryptedCookieService.getCookie('AccessType');
    this.divisionId = this.encryptedCookieService.getCookie('divisionId');
  }


  ngOnInit(): void {
    const data = sessionStorage.getItem('uploadedResume');
    if (data) {
      this.resume = JSON.parse(data);
      sessionStorage.removeItem('uploadedResume');
    }

    this.route.queryParams.subscribe(params => {
      this.candidateId = +params['candidateId'] || 0;
      this.jobId = +params['jobId'] || 0;
      this.jobTitle = params['jobTitle'] || '';

      const rid = params['resumeId'];
      this.resumeId = rid ? Number(rid) : null;

      const tp = params['template'] || '';
      if (tp) this.selectedTemplate = tp;

      if (params['candidateName']) this.resume.basics.name = params['candidateName'];
      if (params['candidateEmail']) this.resume.basics.email = params['candidateEmail'];
      if (params['candidatePhone']) this.resume.basics.phone = params['candidatePhone'];
      if (this.jobTitle) this.resume.basics.headline = this.jobTitle;

      if (this.resumeId) this.loadSavedResume();
    });

  }



  loadSavedResume(): void {
    if (!this.resumeId || isNaN(this.resumeId)) {
      console.warn('Invalid resumeId');
      return;
    }

    this.loading = true;

    this.resumeService.getResumeById(this.resumeId).subscribe({
      next: (res: any) => {
        this.loading = false;

        if (res?.success) {
          const rd = res.data.resume_data;

          this.resume = {
            ...this.defaultResume(),
            ...rd,
            basics: {
              ...this.defaultResume().basics,
              ...(rd.basics || {}),
            },
          };

          this.selectedTemplate = res.data.template || 'classic';
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }


  private defaultResume(): ResumeData {
    return {
      basics: {
        name: '', headline: '', email: '', phone: '',
        location: '', website: '', linkedin: '', photo: '',
      },
      summary: '',
      experience: [],
      education: [],
      skills: [],
      strengths: [],
      languages: [],
      certifications: [],
      attachments: [],
    };
  }


  addExperience(): void {
    this.resume.experience.push({
      company: '', position: '', startDate: '',
      endDate: '', current: false, description: '',
    });
  }

  removeExperience(index: number): void {
    this.resume.experience.splice(index, 1);
  }


  addEducation(): void {
    this.resume.education.push({
      institution: '', degree: '', field: '',
      startDate: '', endDate: '', gpa: '',
    });
  }

  removeEducation(index: number): void {
    this.resume.education.splice(index, 1);
  }


  addSkill(): void {
    const s = this.skillInput.trim();
    if (s && !this.resume.skills.includes(s)) {
      this.resume.skills.push(s);
    }
    this.skillInput = '';
  }

  removeSkill(index: number): void {
    this.resume.skills.splice(index, 1);
  }


  addStrength(): void {
    const name = this.strengthInput.trim();
    if (!name) return;
    if (!this.resume.strengths) this.resume.strengths = [];
    this.resume.strengths.push({ name, level: this.strengthLevel });
    this.strengthInput = '';
    this.strengthLevel = 3;
  }

  removeStrength(index: number): void {
    this.resume.strengths.splice(index, 1);
  }

  strengthLevelLabel(level: number): string {
    const labels = ['', 'Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Expert'];
    return labels[level] || '';
  }

  starRange(): number[] {
    return [1, 2, 3, 4, 5];
  }

  hasBuiltInStrengths(_template: string): boolean {
    return true;
  }


  addLanguage(): void {
    const l = this.languageInput.trim();
    if (l && !this.resume.languages.includes(l)) {
      this.resume.languages.push(l);
    }
    this.languageInput = '';
  }

  removeLanguage(index: number): void {
    this.resume.languages.splice(index, 1);
  }


  addCert(): void {
    const c = this.certInput.trim();
    if (c && !this.resume.certifications.includes(c)) {
      this.resume.certifications.push(c);
    }
    this.certInput = '';
  }

  removeCert(index: number): void {
    this.resume.certifications.splice(index, 1);
  }


  onPhotoUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.toastr.error('Photo must be under 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.resume.basics.photo = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.resume.basics.photo = '';
  }


  onFileAttach(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    if (!this.resume.attachments) this.resume.attachments = [];

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        this.toastr.error(`${file.name} is too large (max 10 MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.resume.attachments.push({
          name: file.name,
          type: this.guessAttachmentType(file.name),
          url: e.target?.result as string,
          size: this.formatFileSize(file.size),
        });
      };
      reader.readAsDataURL(file);
    });
  }

  removeAttachment(index: number): void {
    this.resume.attachments.splice(index, 1);
  }

  downloadAttachment(att: AttachmentItem): void {
    try {
      const parts = att.url.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const binary = atob(parts[1]);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = blobUrl;
      link.download = att.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15_000);

    } catch (err) {
      console.error('Attachment download failed:', err);
      this.toastr.error('Could not open file. Try re-uploading.');
    }
  }

  private guessAttachmentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'certificate';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'portfolio';
    return 'other';
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }


  get accentColor(): string {
    return (
      this.customAccentColor ||
      this.templates.find(t => t.id === this.selectedTemplate)?.color ||
      '#1a3c5e'
    );
  }

  resetColor(): void {
    this.customAccentColor = '';
  }


  saveResume(): void {
    this.saving = true;

    const payload = {
      candidate_id: this.candidateId,
      job_id: this.jobId,
      template: this.selectedTemplate,
      resume_data: this.resume,
      org_id: this.orgid,
      userId: this.recruiterid,
      division_id: this.divisionId,
    };

    const req$ = this.resumeId
      ? this.resumeService.updateATSResume(this.resumeId, payload)
      : this.resumeService.saveATSResume(payload);

    req$.subscribe({
      next: (res) => {
        if (res?.data?.id) this.resumeId = res.data.id;
        this.saving = false;
        const snack = this.snackBar.open(
          ` resume saved successfully!. see the dashboard?`,
          'View Dashboard',
          {
            duration: 12000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['retry-snackbar']
          }
        );

        snack.onAction().subscribe(() => {
          this.router.navigate(['/ats/resume-dashboard']);
        });
        // this.toastr.success('Resume saved!');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Save failed. Please try again.');
      },
    });
  }


async downloadPDF() {
  const element = document.getElementById('resumePreview');
  if (!element) return;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = '794px';
  clone.style.zIndex = '-1';
  clone.style.background = '#fff';

  document.body.appendChild(clone);

  const canvas = await html2canvas(clone, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  document.body.removeChild(clone);

  const pdf = new jsPDF('p', 'mm', 'a4');

  const imgWidth = 210;
  const pageHeight = 297;

  const pxPageHeight = canvas.width * (pageHeight / imgWidth);

  const totalPages = Math.ceil(canvas.height / pxPageHeight);

  const topMargin = 5; 

  for (let i = 0; i < totalPages; i++) {

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = pxPageHeight;

    const ctx = pageCanvas.getContext('2d')!;

    ctx.drawImage(
      canvas,
      0,
      i * pxPageHeight,
      canvas.width,
      pxPageHeight,
      0,
      0,
      canvas.width,
      pxPageHeight
    );

    const imgData = pageCanvas.toDataURL('image/png');

    if (i !== 0) pdf.addPage();

    pdf.addImage(
      imgData,
      'PNG',
      0,
      i === 0 ? 0 : topMargin,
      imgWidth,
      pageHeight
    );
  }

  pdf.save('resume.pdf');
}

  async downloadDOCX(): Promise<void> {
    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        AlignmentType,
        BorderStyle,
        LevelFormat
      } = await import('docx');

      const r = this.resume;
      const hex = this.accentColor.replace('#', '').toUpperCase();
      const gray = '555555';
      const lite = '999999';

      const children: any[] = [];

      const hrPara = () => new Paragraph({
        text: '',
        spacing: { before: 60, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex, space: 1 } },
      });

      const sectionTitle = (title: string) => new Paragraph({
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: hex, font: 'Arial' })],
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex, space: 1 } },
      });

      children.push(new Paragraph({
        children: [new TextRun({ text: r.basics.name || 'Your Name', bold: true, size: 48, font: 'Arial', color: hex })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
      }));

      if (r.basics.headline) {
        children.push(new Paragraph({
          children: [new TextRun({ text: r.basics.headline, size: 24, font: 'Arial', color: gray, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }));
      }

      const contactParts = [
        r.basics.email, r.basics.phone, r.basics.location,
        r.basics.linkedin, r.basics.website,
      ].filter(Boolean);

      if (contactParts.length) {
        children.push(new Paragraph({
          children: [new TextRun({ text: contactParts.join(' | '), size: 18, font: 'Arial', color: gray })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }));
      }

      children.push(hrPara());

      if (r.summary) {
        children.push(sectionTitle('Summary'));
        children.push(new Paragraph({
          children: [new TextRun({ text: r.summary, size: 20, font: 'Arial', color: '374151' })],
          spacing: { after: 80 },
        }));
      }

      if (r.experience.length > 0) {
        children.push(sectionTitle('Experience'));

        r.experience.forEach(exp => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: exp.position, bold: true, size: 22, font: 'Arial', color: '111111' }),
              new TextRun({ text: ` · ${exp.company}`, size: 20, font: 'Arial', color: gray, italics: true }),
            ],
            spacing: { before: 120, after: 30 },
          }));

          children.push(new Paragraph({
            children: [new TextRun({
              text: `${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}`,
              size: 17, font: 'Arial', color: lite,
            })],
            spacing: { after: 40 },
          }));

          if (exp.description) {
            exp.description
              .split('\n')
              .filter((l: string) => l.trim())
              .forEach((line: string) => {
                children.push(new Paragraph({
                  children: [new TextRun({ text: line.trim(), size: 20, font: 'Arial', color: '374151' })],
                  spacing: { after: 30 },
                  indent: { left: 240 },
                }));
              });
          }
        });
      }

      if (r.education.length > 0) {
        children.push(sectionTitle('Education'));

        r.education.forEach(edu => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${edu.degree} in ${edu.field}`, bold: true, size: 22, font: 'Arial', color: '111111' }),
              new TextRun({ text: ` · ${edu.institution}`, size: 20, font: 'Arial', color: gray, italics: true }),
              ...(edu.gpa
                ? [new TextRun({ text: ` · GPA: ${edu.gpa}`, size: 18, font: 'Arial', color: lite })]
                : []),
            ],
            spacing: { before: 120, after: 30 },
          }));

          children.push(new Paragraph({
            children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 17, font: 'Arial', color: lite })],
            spacing: { after: 60 },
          }));
        });
      }

      if (r.skills.length > 0) {
        children.push(sectionTitle('Skills'));
        children.push(new Paragraph({
          children: [new TextRun({ text: r.skills.join(' · '), size: 20, font: 'Arial', color: '374151' })],
          spacing: { after: 80 },
        }));
      }

      if (r.strengths?.length) {
        children.push(sectionTitle('Strengths'));

        r.strengths.forEach((s: StrengthItem) => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: s.name, bold: true, size: 21, font: 'Arial', color: '111111' }),
              new TextRun({ text: ` ${'★'.repeat(s.level)}${'☆'.repeat(5 - s.level)} `, size: 18, font: 'Arial', color: hex }),
              new TextRun({ text: this.strengthLevelLabel(s.level), italics: true, size: 17, font: 'Arial', color: lite }),
            ],
            spacing: { after: 50 },
          }));
        });
      }

      if (r.languages.length > 0) {
        children.push(sectionTitle('Languages'));
        children.push(new Paragraph({
          children: [new TextRun({ text: r.languages.join(' · '), size: 20, font: 'Arial', color: '374151' })],
          spacing: { after: 80 },
        }));
      }

      if (r.certifications.length > 0) {
        children.push(sectionTitle('Certifications'));

        r.certifications.forEach((c: string) => {
          children.push(new Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            children: [new TextRun({ text: c, size: 20, font: 'Arial', color: '374151' })],
            spacing: { after: 40 },
          }));
        });
      }

      if (r.attachments?.length) {
        children.push(sectionTitle('Attachments'));

        r.attachments.forEach((a: AttachmentItem) => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: a.name, size: 20, font: 'Arial', color: '1e40af' }),
              new TextRun({ text: ` (${a.size})`, size: 17, font: 'Arial', color: lite }),
            ],
            spacing: { after: 40 },
          }));
        });
      }

      const doc = new Document({
        numbering: {
          config: [{
            reference: 'bullets',
            levels: [{
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            }],
          }],
        },
        sections: [{
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
            },
          },
          children,
        }],
      });



      const blob = await Packer.toBlob(doc);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `${r.basics.name || 'resume'}.docx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      this.toastr.success('DOCX downloaded! (US Letter)');

    } catch (err) {
      console.error('DOCX generation error:', err);
      this.toastr.error('Failed to generate DOCX. Please try again.'
      );
    }
  }

  safeDesc(desc: string): string {
    return (desc || '').replace(/\n/g, '<br>');
  }

  private lastPageCount = 0;
private lastHeight = 0;

ngAfterViewChecked(): void {
  const el = document.getElementById('resumePreview');
  if (!el) return;

  const height = el.scrollHeight;

  if (height !== this.lastHeight) {
    this.lastHeight = height;
    this.previewPageCount = Math.ceil(height / this.A4_PX);
    this.cdr.detectChanges();
  }
}
get pageViewArray(): number[] {
  return Array.from({ length: this.previewPageCount }, (_, i) => i);
}

getPageTopOffset(i: number): number {
  return -(i * this.A4_PX);
}


}