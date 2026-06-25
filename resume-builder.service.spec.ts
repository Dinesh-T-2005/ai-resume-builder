import { TestBed } from '@angular/core/testing';

import { ResumeBuilderService } from './resume-builder.service';

describe('ResumeBuilderService', () => {
  let service: ResumeBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResumeBuilderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
