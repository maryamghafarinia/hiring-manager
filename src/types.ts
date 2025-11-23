
export enum QuestionType {
    SINGLE_CHOICE = 'single_choice',
    MULTI_CHOICE = 'multi_choice',
    NUMBER = 'number',
    TEXT = 'text',
}

export interface Question {
    id: string;
    text: string;
    type: QuestionType;
    points: number;
    options?: string[];
    correctOption?: string;
    correctOptions?: string[];
    min?: number;
    max?: number;
    keywords?: string[];
}

export interface Job {
    id: string;
    title: string;
    location: string;
    customer: string;
    jobName: string;
    description: string;
    questions: Question[];
    createdAt: Date;
}

export interface Answer {
    questionId: string;
    value: string | number | string[];
}

export interface ScoreBreakdown {
    questionId: string;
    questionText: string;
    pointsEarned: number;
    pointsPossible: number;
    answer: any;
}

export interface Application {
    id: string;
    jobId: string;
    candidateName: string;
    candidateEmail: string;
    answers: Answer[];
    totalScore: number;
    maxScore: number;
    scoreBreakdown: ScoreBreakdown[];
    submittedAt: Date;
}

export interface CreateJobDto {
    title: string;
    location: string;
    customer: string;
    jobName: string;
    description: string;
    questions: Omit<Question, 'id'>[];
}

export interface CreateApplicationDto {
    jobId: string;
    candidateName: string;
    candidateEmail: string;
    answers: Answer[];
}