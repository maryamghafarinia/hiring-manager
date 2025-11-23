import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { Application, CreateApplicationDto, CreateJobDto, Job, Question, QuestionType, ScoreBreakdown } from './types';

const app = express();
app.use(express.json());
const jobsStore = new Map<string, Job>();
const applicationsStore = new Map<string, Application>();

// ============================================================================
// Validation 
// ============================================================================
class ValidationError extends Error {
  constructor(public errors: string[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

const validateQuestion = (question: Omit<Question, 'id'>): string[] => {
  const errors: string[] = [];

  if (!question.text || question.text.trim().length === 0) {
    errors.push('Question text is required');
  }

  if (!question.type || !Object.values(QuestionType).includes(question.type)) {
    errors.push('Invalid question type');
  }

  if (!question.points || question.points <= 0) {
    errors.push('Points must be greater than 0');
  }

  switch (question.type) {
    case QuestionType.SINGLE_CHOICE:
      if (!question.correctOption) {
        errors.push('correctOption is required for single_choice type');
      }
      if (question.options && question.correctOption && 
          !question.options.includes(question.correctOption)) {
        errors.push('correctOption must be in options list');
      }
      break;

    case QuestionType.MULTI_CHOICE:
      if (!question.correctOptions || question.correctOptions.length === 0) {
        errors.push('correctOptions is required for multi_choice type');
      }
      if (question.options && question.correctOptions) {
        const invalidOptions = question.correctOptions.filter(
          opt => !question.options!.includes(opt)
        );
        if (invalidOptions.length > 0) {
          errors.push('All correctOptions must be in options list');
        }
      }
      break;

    case QuestionType.NUMBER:
      if (question.min === undefined || question.min === null) {
        errors.push('min is required for number type');
      }
      if (question.max === undefined || question.max === null) {
        errors.push('max is required for number type');
      }
      if (question.min !== undefined && question.max !== undefined && 
          question.max < question.min) {
        errors.push('max must be greater than or equal to min');
      }
      break;

    case QuestionType.TEXT:
      if (!question.keywords || question.keywords.length === 0) {
        errors.push('keywords are required for text type');
      }
      break;
  }

  return errors;
};

// ============================================================================
// Scoring Logic
// ============================================================================

const calculateScore = (question: Question, answer: any): number => {
  switch (question.type) {
    case QuestionType.SINGLE_CHOICE:
      return answer === question.correctOption ? question.points : 0;

    case QuestionType.MULTI_CHOICE: {
      if (!Array.isArray(answer)) return 0;
      
      const correctSet = new Set(question.correctOptions || []);
      const answerSet = new Set(answer);
      
      if (correctSet.size === 0) return 0;
      
      const intersection = [...correctSet].filter(x => answerSet.has(x)).length;
      return question.points * (intersection / correctSet.size);
    }

    case QuestionType.NUMBER: {
      const numValue = Number(answer);
      if (isNaN(numValue)) return 0;
      
      const min = question.min ?? -Infinity;
      const max = question.max ?? Infinity;
      
      return numValue >= min && numValue <= max ? question.points : 0;
    }

    case QuestionType.TEXT: {
      if (typeof answer !== 'string') return 0;
      
      const answerLower = answer.toLowerCase();
      const matchedKeywords = (question.keywords || []).filter(
        keyword => answerLower.includes(keyword.toLowerCase())
      ).length;
      
      const totalKeywords = question.keywords?.length || 1;
      return question.points * (matchedKeywords / totalKeywords);
    }

    default:
      return 0;
  }
};

// ============================================================================
// Middleware
// ============================================================================
const asyncHandler = (fn: Function) => (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// ============================================================================
// API Routes
// ============================================================================

app.get('/', (_req: Request, res: Response): void => {
  res.json({
    message: 'LoadUp Hiring API',
    version: '1.0.0'
  });
});

// CREATE JOB 
app.post(
  '/api/jobs',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('customer').trim().notEmpty().withMessage('Customer is required'),
    body('jobName').trim().notEmpty().withMessage('Job name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const dto: CreateJobDto = req.body;

    const questionErrors: string[] = [];
    dto.questions.forEach((q, idx) => {
      const errors = validateQuestion(q);
      errors.forEach(err => questionErrors.push(`Question ${idx + 1}: ${err}`));
    });

    if (questionErrors.length > 0) {
      throw new ValidationError(questionErrors);
    }

    const job: Job = {
      id: uuidv4(),
      title: dto.title,
      location: dto.location,
      customer: dto.customer,
      jobName: dto.jobName,
      description: dto.description,
      questions: dto.questions.map(q => ({
        ...q,
        id: uuidv4()
      })),
      createdAt: new Date()
    };

    jobsStore.set(job.id, job);
    res.status(201).json(job);
  })
);

// LIST JOBS 
app.get('/api/jobs', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const jobs = Array.from(jobsStore.values());
  res.json(jobs);
}));

// GET JOB BY ID 
app.get(
  '/api/jobs/:id',
  param('id').isUUID().withMessage('Invalid job ID'),
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const job = jobsStore.get(req.params.id);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(job);
  })
);

// SUBMIT APPLICATION 
app.post(
  '/api/applications',
  [
    body('jobId').isUUID().withMessage('Invalid job ID'),
    body('candidateName').trim().notEmpty().withMessage('Candidate name is required'),
    body('candidateEmail').isEmail().withMessage('Valid email is required'),
    body('answers').exists().withMessage('Answers field is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const dto: CreateApplicationDto = req.body;

    const job = jobsStore.get(dto.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (!Array.isArray(dto.answers) || dto.answers.length === 0) {
      throw new ValidationError(['At least one answer is required']);
    }

    const questionsMap = new Map(job.questions.map(q => [q.id, q]));

    const answeredIds = new Set(dto.answers.map(a => a.questionId));
    const requiredIds = new Set(job.questions.map(q => q.id));

    const missingIds = [...requiredIds].filter(id => !answeredIds.has(id));
    const extraIds = [...answeredIds].filter(id => !requiredIds.has(id));

    if (missingIds.length > 0 || extraIds.length > 0) {
      const errors: string[] = [];
      if (missingIds.length > 0) {
        errors.push(`Missing answers for questions: ${missingIds.join(', ')}`);
      }
      if (extraIds.length > 0) {
        errors.push(`Invalid question IDs: ${extraIds.join(', ')}`);
      }
      throw new ValidationError(errors);
    }

    let totalScore = 0;
    let maxScore = 0;
    const scoreBreakdown: ScoreBreakdown[] = [];

    dto.answers.forEach(answer => {
      const question = questionsMap.get(answer.questionId)!;
      const pointsEarned = calculateScore(question, answer.value);

      scoreBreakdown.push({
        questionId: question.id,
        questionText: question.text,
        pointsEarned: Math.round(pointsEarned * 100) / 100,
        pointsPossible: question.points,
        answer: answer.value
      });

      totalScore += pointsEarned;
      maxScore += question.points;
    });

    const application: Application = {
      id: uuidv4(),
      jobId: dto.jobId,
      candidateName: dto.candidateName,
      candidateEmail: dto.candidateEmail,
      answers: dto.answers,
      totalScore: Math.round(totalScore * 100) / 100,
      maxScore: Math.round(maxScore * 100) / 100,
      scoreBreakdown,
      submittedAt: new Date()
    };

    applicationsStore.set(application.id, application);
    res.status(201).json(application);
  })
);

// LIST APPLICATIONS FOR JOB 
app.get(
  '/api/jobs/:jobId/applications',
  [
    param('jobId').isUUID().withMessage('Invalid job ID'),
    query('sortBy').optional().isIn(['score', 'date']).withMessage('Invalid sort parameter')
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;
    const sortBy = (req.query.sortBy as string) || 'score';

    if (!jobsStore.has(jobId)) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    let applications = Array.from(applicationsStore.values())
      .filter(app => app.jobId === jobId);

    if (sortBy === 'score') {
      applications.sort((a, b) => b.totalScore - a.totalScore);
    } else if (sortBy === 'date') {
      applications.sort((a, b) => 
        b.submittedAt.getTime() - a.submittedAt.getTime()
      );
    }

    res.json(applications);
  })
);

//  GET APPLICATION BY ID 
app.get(
  '/api/applications/:id',
  param('id').isUUID().withMessage('Invalid application ID'),
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const application = applicationsStore.get(req.params.id);

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    res.json(application);
  })
);


app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});


app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
