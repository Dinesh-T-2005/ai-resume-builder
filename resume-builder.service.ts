import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ResumeBuilderService {

  api = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getMyResumes(orgid: number, divisionId: number, userId: number): Observable<any> {
    return this.http.get(`${this.api}ats-resume/resume-lists/${orgid}/${divisionId}/${userId}`);
  }

  deleteResume(resumeId: number): Observable<any> {
    return this.http.put(`${this.api}ats-resume/resume-delete/${resumeId}`, {});
  }
  saveFile(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  createResume(payload: {
    candidateId: number;
    candidateName: string;
    jobTitle?: string;
  }): Observable<any> {
    return this.http.post(`${environment.apiUrl}ats-resume/create`, payload);
  }

  saveATSResume(payload: {
    candidate_id: number;
    job_id: number;
    template: string;
    resume_data: any;
  }): Observable<any> {
    return this.http.post(`${this.api}ats-resume/save`, payload);
  }

  updateATSResume(resumeId: number, payload: any): Observable<any> {
    return this.http.put(`${this.api}ats-resume/${resumeId}`, payload);
  }

  getATSResume(org_id: number, division_id: number): Observable<any> {
    return this.http.get(`${this.api}ats-resume/list/${org_id}/${division_id}`);
  }

  getResumeById(resumeId: number) {
    return this.http.get(`${this.api}ats-resume/${resumeId}`);
  }

  parseResume(formData: FormData): Observable<HttpEvent<any>> {
    return this.http.post<any>(
      `${environment.apiUrl}ats-resume/parse`,
      formData,
      {
        observe: 'events',
        reportProgress: true
      }
    );
  }

  analyzeJobs(resume: any) {
    return this.http.post<any>(
      `${environment.apiUrl}ats-resume/analyze-jobs`,
      { resume }
    );
  }

  tailorResume(payload: any) {
    return this.http.post<any>(
      `${environment.apiUrl}ats-resume/tailor`,
      payload
    );
  }

  scoreResume(payload: {
    resume: any;
    jobTitle: string;
    jobDescription: string;
  }): Observable<any> {
    return this.http.post(`${environment.apiUrl}ats-resume/score`, payload);
  }
  generateOfferLetter(payload: any): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}ats-resume/generate`,
      { form: payload }
    );
  }
}
