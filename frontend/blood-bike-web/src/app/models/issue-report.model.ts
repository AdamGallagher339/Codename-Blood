export interface IssueReport {
  issueId: string;
  bikeId: string;
  riderId: string;
  type: IssueType;
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export type IssueType = 'Minor' | 'Major';

export interface CreateIssueReportDto {
  bikeId: string;
  riderId: string;
  type: IssueType;
  description: string;
}
