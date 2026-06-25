import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ResumeBuilderService } from '../resume-builder.service';
import { ToastrService } from 'ngx-toastr';
import { catchError, concatMap, of, tap } from 'rxjs';
import { JobService } from '../../job/job.service';
import { EncryptedCookieService } from 'src/app/services/encrypted-cookie.service';
type Stage =
  | 'upload'
  | 'uploading'
  | 'parsing'
  | 'step1'
  | 'step2'
  | 'scoring'
  | 'score'
  | 'tailoring'
  | 'success'
  | 'error';

export interface ScoreBreakdownItem {
  score: number;
  matched?: string[];
  missing?: string[];
  note?: string;
}

export interface ScoreResult {
  overall: number;
  predictedScore: number;
  breakdown: {
    skills: ScoreBreakdownItem;
    experience: ScoreBreakdownItem;
    keywords: ScoreBreakdownItem;
    education: ScoreBreakdownItem;
  };
  topSuggestions: string[];
}

@Component({
  selector: 'app-resume-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './ai-resume-generator.component.html',
  styleUrls: ['./ai-resume-generator.component.scss'],
})
export class AiResumeGeneratorComponent {

  stage: Stage = 'upload';
  uploadProgress = 0;
  errorMsg = '';
  parsedName = '';
  dragOver = false;
  parsedResume: any = null;

  jobTitle = '';
  jobDescription = '';
  customNote = '';

  jobTitleFocused = false;
  jdFocused = false;
  noteFocused = false;

  jobSuggestions: any[] = [];

  scoreData: ScoreResult | null = null;
  showNoteInput = false;


   isDisabled = false;
  isAiFeatureActive: boolean;

  aiModalData: Array<{ label: string; used: string; available: string }> = [];
  aiModalOpen = false;
  private aiModalTimer: any = null;
  orgid: string | null;
  orgdiv: string | null;
  recruiterid: string | null;

  ngOnInit(): void {
     this.fetchAiAccess();
  }
  fetchAiAccess(): void {
    const payload = {
      orgId: this.orgid,
      recruiterId: this.recruiterid,
      button_id: 11,
      button_name: 'resume_builder_ai'
    };

    this.Service.GetAIaccess(payload).subscribe({
      next: (res: any) => {
        if (res.ok && res.button) {
          this.aiButton = res.button;
          this.updateButtonState();
        } else {
          this.isDisabled = true;
          this.toastr.error('AI Access unavailable', 'Error');
        }
      },
      error: (err: any) => {
        console.error('Error fetching AI access:', err);
        this.isDisabled = true;
        this.toastr.error('Unable to check AI quota', 'Error');
      }
    });
  }

  private updateButtonState(): void {
    if (!this.aiButton) {
      this.isDisabled = true;
      this.isAiFeatureActive = false;
      return;
    }

    const active = this.aiButton.is_active !== false;
    const dailyEnabled = !!this.aiButton.daily_reset_enabled;
    const weeklyEnabled = !!this.aiButton.weekly_reset_enabled;
    const monthlyEnabled = !!this.aiButton.monthly_reset_enabled;

    const dailyAvail = this.getNum(this.aiButton.available_today, 0);
    const weeklyAvail = this.getNum(this.aiButton.available_thisweek, 0);
    const monthlyAvail = this.getNum(this.aiButton.available_monthly, 0);

    this.isAiFeatureActive = active;
    this.isDisabled =
      !active ||
      (dailyEnabled && dailyAvail <= 0) ||
      (weeklyEnabled && weeklyAvail <= 0) ||
      (monthlyEnabled && monthlyAvail <= 0);
  }

   private aiButton?: {
    is_active?: boolean;
    daily_reset_enabled?: boolean;
    weekly_reset_enabled?: boolean;
    monthly_reset_enabled?: boolean;
    available_today?: number;
    available_thisweek?: number;
    available_monthly?: number;
  };
  private getNum(v: any, fallback = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  scoringSteps = [
    { label: 'Parsing job requirements', done: false, active: false },
    { label: 'Matching skills & keywords', done: false, active: false },
    { label: 'Evaluating experience fit', done: false, active: false },
    { label: 'Calculating ATS score', done: false, active: false },
  ];

  readonly ACCEPTED = '.pdf,.docx,.doc,.jpg,.jpeg,.png';
  readonly MAX_SIZE = 10 * 1024 * 1024;

  steps = [
    { num: 1, label: 'Job Title', icon: 'work_outline' },
    { num: 2, label: 'Job Description', icon: 'description' },
    { num: 3, label: 'Match Score', icon: 'analytics' },
  ];

  fileTypes = [
    { ext: 'PDF', icon: 'picture_as_pdf', color: '#dc2626' },
    { ext: 'DOCX', icon: 'article', color: '#2563eb' },
    { ext: 'JPG', icon: 'image', color: '#d97706' },
    { ext: 'PNG', icon: 'image', color: '#059669' },
  ];

  readonly NOTE_HINTS = [
    'e.g. Focus on leadership and team management',
    'e.g. Highlight React and TypeScript skills',
    'e.g. Make it more concise and ATS-friendly',
    'e.g. Emphasize client-facing experience',
  ];
  noteHint = this.NOTE_HINTS[0];

  noteExamples = [
    'Focus on leadership skills',
    'Highlight React & TypeScript',
    'Make it ATS-friendly',
    'Emphasize client-facing roles',
    'Keep it concise (1 page)',
  ];

  constructor(
    private resumeService: ResumeBuilderService,
    private router: Router,
    private snack: MatSnackBar,
    private toastr: ToastrService,
    private Service: JobService,
    private encryptedCookieService: EncryptedCookieService
  ) { 
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.orgdiv = this.encryptedCookieService.getCookie('divisionId');
    this.recruiterid = this.encryptedCookieService.getCookie('userId');
  }

  get currentStep(): number {
    if (this.stage === 'step1') return 1;
    if (this.stage === 'step2') return 2;
    if (this.stage === 'scoring' || this.stage === 'score') return 3;
    return 0;
  }

  get jdLength(): number { return this.jobDescription.length; }
  get noteLength(): number { return this.customNote.length; }


  scoreArcPath(score: number): string {
    const r = 54, cx = 64, cy = 64;
    const angle = (Math.min(score, 99.9) / 100) * 360;
    const rad = (angle - 90) * (Math.PI / 180);
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const large = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
  }

  scoreColor(score: number): string {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  scoreLabel(score: number): string {
    if (score >= 85) return 'Excellent Match';
    if (score >= 70) return 'Good Match';
    if (score >= 50) return 'Moderate Match';
    return 'Low Match';
  }

  readonly breakdownCategories: Array<{
    key: keyof ScoreResult['breakdown'];
    label: string;
    icon: string;
  }> = [
      { key: 'skills', label: 'Skills Match', icon: 'psychology' },
      { key: 'experience', label: 'Experience Fit', icon: 'work' },
      { key: 'keywords', label: 'Keyword Coverage', icon: 'sell' },
      { key: 'education', label: 'Education Match', icon: 'school' },
    ];

  getBreakdown(key: keyof ScoreResult['breakdown']): ScoreBreakdownItem {
    return this.scoreData!.breakdown[key];
  }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver = true; }
  onDragLeave(e: DragEvent): void { this.dragOver = false; }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  onFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
    (e.target as HTMLInputElement).value = '';
  }

  private processFile(file: File): void {
    if (file.size > this.MAX_SIZE) {
      this.toastr.error('File too large. Max 10MB allowed.'); return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'jpg', 'jpeg', 'png'].includes(ext)) {
      this.toastr.warning('Invalid file type. Upload PDF, DOCX or Image.'); return;
    }
    this.uploadAndParse(file);
  }


  //start of the main flow: upload → parse → analyze → score → tailor
  private uploadAndParse(file: File): void {



       if (!this.aiButton) {
      this.toastr.error('Unable to load AI access info', 'Error');
      return;
    }
    const active = this.aiButton.is_active !== false;
    const dailyEnabled = !!this.aiButton.daily_reset_enabled;
    const weeklyEnabled = !!this.aiButton.weekly_reset_enabled;
    const monthlyEnabled = !!this.aiButton.monthly_reset_enabled;

    const dailyAvail = this.getNum(this.aiButton.available_today, 0);
    const weeklyAvail = this.getNum(this.aiButton.available_thisweek, 0);
    const monthlyAvail = this.getNum(this.aiButton.available_monthly, 0);

    if (!active) {
      this.toastr.error('This AI feature is currently inactive for your account.', 'Feature Inactive');
      return;
    }

    if (dailyEnabled && dailyAvail <= 0) {
      this.toastr.warning('Your daily AI quota has been used up. Please try again tomorrow.', 'Quota Exceeded');
      return;
    }
    if (weeklyEnabled && weeklyAvail <= 0) {
      this.toastr.warning('Your weekly AI quota has been used up. Please try again next week.', 'Quota Exceeded');
      return;
    }
    if (monthlyEnabled && monthlyAvail <= 0) {
      this.toastr.warning('Your monthly AI quota has been exhausted.', 'Quota Exceeded');
      return;
    }
    this.stage = 'uploading';
    this.uploadProgress = 0;
    this.errorMsg = '';

    const form = new FormData();
    form.append('resume', file);

    this.resumeService.parseResume(form).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round(100 * event.loaded / event.total);
          if (this.uploadProgress >= 100) this.stage = 'parsing';
        }
        if (event.type === HttpEventType.Response) {
          const body = event.body;
          if (body?.success) {
            this.parsedResume = body.data;
            this.parsedName = body.data?.basics?.name || 'Resume';
            this.jobTitle = body.data?.basics?.headline || '';
            this.resumeService.analyzeJobs(this.parsedResume).subscribe((res: any) => {
              this.jobSuggestions = res?.data || [];
              this.stage = 'step1';
            });
          } else {
            this.toastr.error(body?.message || 'Parsing failed');
          }
        }
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Upload failed. Try again.'),
    });
  }

  goStep2(): void {
    if (!this.jobTitle.trim()) {
      this.toastr.warning('Please enter the Job Title'); return;
    }
    this.stage = 'step2';
  }

  analyzeScore(): void {
    if (!this.jobDescription.trim()) {
      this.toastr.warning('Please enter the Job Description'); return;
    }

    this.stage = 'scoring';
    this.scoreData = null;
    this.runScoringAnimation();

    const payload = {
      resume: this.parsedResume,
      jobTitle: this.jobTitle.trim(),
      jobDescription: this.jobDescription.trim(),
    };

    this.resumeService.scoreResume(payload).subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) {
          this.scoreData = res.data as ScoreResult;
          this.stage = 'score';
        } else {
          this.startTailoring();
        }
      },
      error: () => this.startTailoring(),
    });
  }

  private runScoringAnimation(): void {
    this.scoringSteps.forEach(s => { s.done = false; s.active = false; });
    let i = 0;
    const tick = () => {
      if (i > 0) { this.scoringSteps[i - 1].active = false; this.scoringSteps[i - 1].done = true; }
      if (i < this.scoringSteps.length) {
        this.scoringSteps[i].active = true;
        i++;
        setTimeout(tick, 900);
      }
    };
    tick();
  }

  generateImprovedResume(): void {
    this.startTailoring();
  }

  private startTailoring(): void {
    this.stage = 'tailoring';

    const payload = {
      resume: this.parsedResume,
      jobTitle: this.jobTitle.trim(),
      jobDescription: this.jobDescription.trim(),
      customNote: this.customNote.trim(),
    };
this.resumeService.tailorResume(payload).pipe(

  concatMap((res: any) => {
    if (!res?.success) {
      return of(res);
    }

    const body = {
      userId: String(this.recruiterid),
      orgId: this.orgid,
      button_id: 11, 
      usedAmount: 1,
      div_id: this.orgdiv,
      extraData: JSON.stringify({
        source: 'ResumeBuilder',
        action: 'TailorResume'
      })
    };

    return this.Service.LogAiButtonUsage(body).pipe(
      tap((logRes: any) => {
        const btn = logRes?.button ?? logRes;
        if (btn) {
          this.toastr.info(`AI Usage logged. Remaining - Today: ${btn.available_today}, This Week: ${btn.available_thisweek}, This Month: ${btn.available_monthly}`, 'AI Usage');
        }
      }),
      catchError((err) => {
        console.error('AI usage log failed:', err);
        return of(null);
      }),
      // pass original response forward
      concatMap(() => of(res))
    );
  })

).subscribe({
  next: (res: any) => {
    if (res?.success) {
      this.stage = 'success';

      sessionStorage.setItem('uploadedResume', JSON.stringify(res.data));

      setTimeout(() => {
        this.router.navigate(['/ats/resume-editor'], {
          queryParams: { source: 'tailored', template: 'classic' },
        });
      }, 1200);
    } else {
      this.useParsedDirect();
    }
  },
  error: () => this.useParsedDirect(),
});
    // this.resumeService.tailorResume(payload).subscribe({
    //   next: (res: any) => {
    //     if (res?.success) {
    //       this.stage = 'success';
    //       sessionStorage.setItem('uploadedResume', JSON.stringify(res.data));
    //       setTimeout(() => {
    //         this.router.navigate(['/ats/resume-editor'], {
    //           queryParams: { source: 'tailored', template: 'classic' },
    //         });
    //       }, 1200);
    //     } else {
    //       this.useParsedDirect();
    //     }
    //   },
    //   error: () => this.useParsedDirect(),
    // });
  }

  skipTailoring(): void {
    this.useParsedDirect();
  }

  private useParsedDirect(): void {
    if (this.parsedResume?.basics) {
      this.parsedResume.basics.headline = this.jobTitle || this.parsedResume.basics.headline;
    }
    sessionStorage.setItem('uploadedResume', JSON.stringify(this.parsedResume));
    this.router.navigate(['/ats/resume-editor'], {
      queryParams: { source: 'upload', template: 'classic' },
    });
  }

  goBack(): void {
    if (this.stage === 'step2') this.stage = 'step1';
    else if (this.stage === 'score') this.stage = 'step2';
    else if (this.stage === 'step1') this.stage = 'upload';
    else this.retry();
  }

  retry(): void {
    this.stage = 'upload';
    this.uploadProgress = 0;
    this.errorMsg = '';
    this.parsedResume = null;
    this.jobTitle = '';
    this.jobDescription = '';
    this.customNote = '';
    this.scoreData = null;
    this.showNoteInput = false;
    this.scoringSteps.forEach(s => { s.done = false; s.active = false; });
  }


}