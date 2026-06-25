import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ResumeBuilderService } from '../resume-builder.service';
import { EncryptedCookieService } from 'src/app/services/encrypted-cookie.service';
import DOMPurify from 'dompurify';
import { ToastrService } from 'ngx-toastr';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';


const TEMPLATE_COLORS: Record<string, string> = {
  classic: '#1a3c5e', modern: '#6c3483', minimal: '#1e8449',
  executive: '#7b241c', corporate: '#1a5276', creative: '#d35400',
  elegant: '#4a235a', tech: '#0d3349', bold: '#1b2631', clean: '#2e4053',
  navy: '#0a2342', teal: '#0e7490', rose: '#9f1239', slate: '#334155',
  forest: '#14532d', midnight: '#1e1b4b', amber: '#92400e',
  arctic: '#0c4a6e', crimson: '#7f1d1d', graphite: '#111827'
};

@Component({
  selector: 'app-resume-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatIconModule, MatButtonModule, MatSnackBarModule, MatDialogModule],
  templateUrl: './resume-dashboard.component.html',
  styleUrls: ['./resume-dashboard.component.scss']
})
export class ResumeDashboardComponent implements OnInit {
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  myResumes: any[] = [];
  isLoading = false;
  downloadingId: number | null = null;
  orgid: any;
  userId: any;
  accesstype: any;
  divisionId: any;
  showDeleteModal = false;
  selectedResumeId!: number;
  dialogRef!: MatDialogRef<any>;
  selectedResume: any;


  quickActions = [
    { id: 'create', icon: 'add_circle', title: 'Create Resume', subtitle: 'Start from a template', color: '#2563eb' },
    { id: 'ai', icon: 'auto_awesome', title: 'AI Generate', subtitle: 'Let AI build your resume', color: '#7c3aed' },
    { id: 'cover', icon: 'mail_outline', title: 'Offer Letter', subtitle: 'Generate with AI', color: '#0891b2' },
    { id: 'upload', icon: 'upload_file', title: 'Upload Resume', subtitle: 'Parse & edit existing', color: '#059669' },
  ];

  constructor(
    private router: Router,
    private http: HttpClient,
    private snack: MatSnackBar,
    private resumeService: ResumeBuilderService,
    private encryptedCookieService: EncryptedCookieService,
    private toatr: ToastrService,
    private dialog: MatDialog
  ) {
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.userId = this.encryptedCookieService.getCookie('userId');
    this.accesstype = this.encryptedCookieService.getCookie('AccessType');
    this.divisionId = this.encryptedCookieService.getCookie('divisionId');
  }

  ngOnInit(): void { this.loadMyResumes(); }

  loadMyResumes(): void {
    this.isLoading = true;

    this.resumeService.getMyResumes(this.orgid, this.divisionId, this.userId).subscribe({
      next: (res) => {
        this.myResumes = (res.data || []).map((r: any) => {

          const rd = typeof r.resume_data === 'string'
            ? (() => {
              try {
                return JSON.parse(r.resume_data);
              } catch {
                return {};
              }
            })()
            : (r.resume_data || {});

          return {
            ...r,
            resume_data: rd,
            templateColor: TEMPLATE_COLORS[r.template] || '#1a3c5e'
          };
        });

        this.isLoading = false;
      },

      error: () => {
        this.isLoading = false;
      }
    });
  }

  onAction(id: string): void {
    if (id === 'create') this.router.navigate(['/ats/resume-templates']);
    else if (id === 'ai') this.router.navigate(['/ats/ai-resume-generator']);
    else if (id === 'upload') this.router.navigate(['/ats/resume-score']);
    else if (id === 'cover') this.router.navigate(['/ats/resume-coverlatter']);
    else this.snack.open('Coming soon!', 'OK', { duration: 2000 });
  }

  editResume(resume: any): void {
    this.router.navigate(['/ats/resume-editor'], {
      queryParams: {
        resumeId: resume.id,
        template: resume.template
      }
    });
  }

  openDeleteModal(resume: any): void {
    this.selectedResumeId = resume.id;
    this.selectedResume = resume;


    this.dialogRef = this.dialog.open(this.deleteDialog, {
      width: '450px'
    });
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  confirmDelete(): void {
    this.resumeService.deleteResume(this.selectedResumeId).subscribe({
      next: () => {
        this.myResumes = this.myResumes.filter(r => r.id !== this.selectedResumeId);
        this.toatr.success('Resume deleted');
        this.dialogRef.close();
      },
      error: () => {
        this.toatr.error('Delete failed');
        this.dialogRef.close();
      }
    });
  }

  private async renderResumeCanvas(resume: any): Promise<HTMLCanvasElement> {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'width:794px',
      'min-height:1123px',
      'background:#fff',
      'z-index:-9999',
      'transform:translateX(-9999px)',
      'overflow:visible',
      'font-family:"Helvetica Neue",Arial,sans-serif',
    ].join(';');

    wrapper.innerHTML = DOMPurify.sanitize(this.buildResumeHTML(resume));
    document.body.appendChild(wrapper);

    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: wrapper.scrollHeight,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
    });

    document.body.removeChild(wrapper);
    return canvas;
  }

  async downloadPDF(resume: any): Promise<void> {
    this.downloadingId = resume.id;
    try {
      const canvas = await this.renderResumeCanvas(resume);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const a4W = 210;
      const a4H = 297;
      const imgH = (canvas.height * a4W) / canvas.width;

      if (imgH <= a4H) {
        pdf.addImage(imgData, 'PNG', 0, 0, a4W, imgH);
      } else {
        let y = 0;
        while (y < imgH) {
          if (y > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -y, a4W, imgH);
          y += a4H;
        }
      }
      pdf.save(`${resume.resume_data?.basics?.name || 'resume'}.pdf`);
      this.snack.open('PDF downloaded!', '', { duration: 2000 });
    } catch (e) {
      console.error(e);
      this.snack.open('PDF failed. Try again.', 'OK', { duration: 3000 });
    }
    this.downloadingId = null;
  }

  async downloadPNG(resume: any): Promise<void> {
    this.downloadingId = resume.id;
    try {
      const canvas = await this.renderResumeCanvas(resume);
      const link = document.createElement('a');
      link.download = `${resume.resume_data?.basics?.name || 'resume'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.snack.open('PNG downloaded!', '', { duration: 2000 });
    } catch (e) {
      console.error(e);
      this.snack.open('PNG failed. Try again.', 'OK', { duration: 3000 });
    }
    this.downloadingId = null;
  }


  private buildResumeHTML(resume: any): string {
    const d = resume.resume_data || {};
    const color = resume.templateColor || '#1a3c5e';
    const b = d.basics || {};

    const sec = (title: string, content: string) => `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;
                   color:${color};border-bottom:2px solid ${color};padding-bottom:4px;margin:0 0 8px;">
          ${title}
        </h2>
        ${content}
      </div>`;

    const expHTML = (d.experience || []).map((e: any) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <strong style="font-size:10px;color:#111;">${e.position || ''}</strong>
          <span style="font-size:8.5px;color:#fff;background:${color};padding:2px 8px;border-radius:10px;white-space:nowrap;">
            ${e.startDate || ''} – ${e.current ? 'Present' : (e.endDate || '')}
          </span>
        </div>
        <div style="font-size:9px;color:#6b7280;font-style:italic;margin:2px 0 4px;">${e.company || ''}</div>
        <p style="font-size:9.5px;color:#374151;line-height:1.6;margin:0;">${(e.description || '').replace(/\n/g, '<br>')}</p>
      </div>`).join('');

    const eduHTML = (d.education || []).map((e: any) => `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <strong style="font-size:10px;color:#111;">${e.degree || ''} in ${e.field || ''}</strong>
          <span style="font-size:8.5px;color:#6b7280;white-space:nowrap;">${e.startDate || ''} – ${e.endDate || ''}</span>
        </div>
        <div style="font-size:9px;color:#6b7280;font-style:italic;">${e.institution || ''}${e.gpa ? ' | ' + e.gpa : ''}</div>
      </div>`).join('');

    const skillsHTML = `<div style="display:flex;flex-wrap:wrap;gap:5px;">
      ${(d.skills || []).map((s: string) =>
      `<span style="padding:2px 9px;border:1.5px solid ${color};color:${color};border-radius:10px;font-size:9px;font-weight:600;">${s}</span>`
    ).join('')}
    </div>`;

    const langsHTML = `<p style="font-size:9.5px;color:#374151;margin:0;">${(d.languages || []).join(' · ')}</p>`;

    const certsHTML = `<ul style="margin:0;padding-left:16px;">
      ${(d.certifications || []).map((c: string) =>
      `<li style="font-size:9.5px;color:#374151;margin-bottom:3px;">${c}</li>`
    ).join('')}
    </ul>`;

    return `
      <div style="padding:0;background:#fff;width:794px;">
        <!-- Header -->
        <div style="background:${color};color:#fff;padding:28px 40px 20px;">
          <h1 style="font-size:26px;font-weight:700;margin:0 0 4px;letter-spacing:1px;">${b.name || 'Your Name'}</h1>
          <p style="font-size:12px;margin:0 0 10px;opacity:.85;">${b.headline || ''}</p>
          <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:9px;opacity:.9;">
            ${b.email ? `<span>✉ ${b.email}</span>` : ''}
            ${b.phone ? `<span>☎ ${b.phone}</span>` : ''}
            ${b.location ? `<span>⊙ ${b.location}</span>` : ''}
            ${b.linkedin ? `<span>in ${b.linkedin}</span>` : ''}
          </div>
        </div>
        <!-- Body -->
        <div style="padding:28px 40px;">
          ${d.summary ? sec('Summary', `<p style="font-size:9.5px;color:#374151;line-height:1.6;margin:0;">${d.summary}</p>`) : ''}
          ${(d.experience || []).length ? sec('Experience', expHTML) : ''}
          ${(d.education || []).length ? sec('Education', eduHTML) : ''}
          ${(d.skills || []).length ? sec('Skills', skillsHTML) : ''}
          ${(d.languages || []).length ? sec('Languages', langsHTML) : ''}
          ${(d.certifications || []).length ? sec('Certifications', certsHTML) : ''}
        </div>
      </div>`;
  }

  templateColor(t: string): string { return TEMPLATE_COLORS[t] || '#1a3c5e'; }
  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  capitalize(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
}