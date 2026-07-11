export const positions = [
  "Animation",
  "Design",
  "Illustration",
  "Story and Writing",
  "Production",
  "AI Creative",
  "Marketing and Content",
  "Position Not Clear",
] as const;

export const statuses = [
  "New Application",
  "First Reply Sent",
  "Waiting for Applicant Reply",
  "Applicant Replied",
  "Waiting for Team Review",
  "Additional Information Requested",
  "Interview",
  "Rejected",
  "Keep for Future",
  "Closed",
] as const;

export const decisions = [
  "Proceed",
  "Request more information",
  "Keep for future consideration",
  "Reject",
  "Invite for interview",
] as const;

export const templates = [
  {
    id: "acknowledgement",
    name: "Application received",
    status: "First Reply Sent",
    subject: "Thank you for your application",
    body:
      "Thank you for applying. We have received your application and will review it carefully. We may contact you if additional information is required.",
  },
  {
    id: "portfolio",
    name: "Request for portfolio",
    status: "Additional Information Requested",
    subject: "Portfolio request",
    body:
      "Thank you for your application. Could you please send a portfolio or showreel so the team can review your work?",
  },
  {
    id: "interview",
    name: "Interview invitation",
    status: "Interview",
    subject: "Interview invitation",
    body:
      "We enjoyed reviewing your application and would like to invite you to interview with our team. Please share your availability.",
  },
  {
    id: "under-review",
    name: "Application under review",
    status: "Waiting for Team Review",
    subject: "Your application is under review",
    body:
      "Your application has been shared with the relevant team for review. We will follow up when there is an update.",
  },
  {
    id: "not-selected",
    name: "Not selected",
    status: "Rejected",
    subject: "Application update",
    body:
      "Thank you for your interest. After review, we will not be moving forward with your application at this time.",
  },
  {
    id: "future",
    name: "Keep in database",
    status: "Keep for Future",
    subject: "Future opportunities",
    body:
      "Thank you for applying. We are keeping your details on file and may contact you about future opportunities that match your profile.",
  },
] as const;

export type RecruitmentStatus = (typeof statuses)[number];

export type Application = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  position: string;
  status: RecruitmentStatus;
  subject: string;
  message: string;
  has_resume: boolean;
  has_portfolio: boolean;
  first_reply_sent: boolean;
  applicant_replied: boolean;
  assigned_to: string;
  review_decision: string;
  internal_comments: string;
  last_email_subject: string;
  last_email_body: string;
  created_at: string;
  updated_at: string;
};

export type ApplicationInput = Omit<Application, "id" | "created_at" | "updated_at">;

export function statusForTemplate(templateId: string): RecruitmentStatus {
  return (templates.find((template) => template.id === templateId)?.status ??
    "First Reply Sent") as RecruitmentStatus;
}
