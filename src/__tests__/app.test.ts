import request from 'supertest';
import app from '../app';

describe('LoadUp Hiring API', () => {
  
  describe('Scoring Logic', () => {
    let jobId: string;
    let questionIds: string[] = [];

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'test-job',
          description: 'Test job for scoring',
          questions: [
            {
              text: 'What is 2+2?',
              type: 'single_choice',
              points: 10,
              options: ['3', '4', '5'],
              correctOption: '4'
            },
            {
              text: 'Select all even numbers',
              type: 'multi_choice',
              points: 10,
              options: ['1', '2', '3', '4'],
              correctOptions: ['2', '4']
            },
            {
              text: 'Years of experience?',
              type: 'number',
              points: 10,
              min: 0,
              max: 20
            },
            {
              text: 'Describe your skills',
              type: 'text',
              points: 10,
              keywords: ['typescript', 'node', 'testing']
            }
          ]
        });

      jobId = response.body.id;
      questionIds = response.body.questions.map((q: any) => q.id);
    });

    test('Single choice - correct answer gives full points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });

      expect(response.status).toBe(201);
      const singleChoiceScore = response.body.scoreBreakdown[0];
      expect(singleChoiceScore.pointsEarned).toBe(10);
    });

    test('Single choice - incorrect answer gives zero points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '3' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });

      expect(response.status).toBe(201);
      const singleChoiceScore = response.body.scoreBreakdown[0];
      expect(singleChoiceScore.pointsEarned).toBe(0);
    });

    test('Multi choice - full match gives full points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2', '4'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });

      expect(response.status).toBe(201);
      const multiChoiceScore = response.body.scoreBreakdown[1];
      expect(multiChoiceScore.pointsEarned).toBe(10);
    });

    test('Multi choice - partial match gives partial points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });

      const multiChoiceScore = response.body.scoreBreakdown[1];
      expect(multiChoiceScore.pointsEarned).toBe(5);
    });

    test('Number - value in range gives full points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 10 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });

      const numberScore = response.body.scoreBreakdown[2];
      expect(numberScore.pointsEarned).toBe(10);
    });

    test('Number - value outside range gives zero points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 25 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });

      const numberScore = response.body.scoreBreakdown[2];
      expect(numberScore.pointsEarned).toBe(0);
    });

    test('Number - boundary values are inclusive', async () => {
      const response1 = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 0 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });
      expect(response1.body.scoreBreakdown[2].pointsEarned).toBe(10);

      const response2 = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 20 },
            { questionId: questionIds[3], value: 'I know Node' }
          ]
        });
      expect(response2.body.scoreBreakdown[2].pointsEarned).toBe(10);
    });

    test('Text - all keywords present gives full points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know TypeScript, Node.js, and testing frameworks' }
          ]
        });

      const textScore = response.body.scoreBreakdown[3];
      expect(textScore.pointsEarned).toBe(10);
    });

    test('Text - partial keywords gives partial points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know TypeScript and Node.js' }
          ]
        });

      const textScore = response.body.scoreBreakdown[3];
      expect(textScore.pointsEarned).toBeCloseTo(6.67, 1);
    });

    test('Text - case insensitive matching', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know TYPESCRIPT, NODE, and TESTING' }
          ]
        });

      const textScore = response.body.scoreBreakdown[3];
      expect(textScore.pointsEarned).toBe(10);
    });

    test('Text - no matching keywords gives zero points', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: questionIds[0], value: '4' },
            { questionId: questionIds[1], value: ['2'] },
            { questionId: questionIds[2], value: 5 },
            { questionId: questionIds[3], value: 'I know Java and Spring' }
          ]
        });

      const textScore = response.body.scoreBreakdown[3];
      expect(textScore.pointsEarned).toBe(0);
    });
  });

  describe('Job Creation Validation', () => {
    test('Rejects job without questions', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'test',
          description: 'Test',
          questions: []
        });

      expect(response.status).toBe(400);
    });

    test('Rejects single_choice without correctOption', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'test',
          description: 'Test',
          questions: [{
            text: 'Pick one',
            type: 'single_choice',
            points: 10,
            options: ['A', 'B']
          }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    test('Rejects multi_choice without correctOptions', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'test',
          description: 'Test',
          questions: [{
            text: 'Pick multiple',
            type: 'multi_choice',
            points: 10,
            options: ['A', 'B']
          }]
        });

      expect(response.status).toBe(400);
    });

    test('Rejects number question without min/max', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'test',
          description: 'Test',
          questions: [{
            text: 'Enter number',
            type: 'number',
            points: 10
          }]
        });

      expect(response.status).toBe(400);
    });

    test('Rejects text question without keywords', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'test',
          description: 'Test',
          questions: [{
            text: 'Describe yourself',
            type: 'text',
            points: 10
          }]
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Application Submission Validation', () => {
    let testJobId: string;
    let testQuestionIds: string[];

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Validation Test Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'validation-test',
          description: 'For testing validation',
          questions: [
            {
              text: 'Question 1',
              type: 'single_choice',
              points: 10,
              options: ['A', 'B'],
              correctOption: 'A'
            },
            {
              text: 'Question 2',
              type: 'number',
              points: 10,
              min: 0,
              max: 10
            }
          ]
        });

      testJobId = response.body.id;
      testQuestionIds = response.body.questions.map((q: any) => q.id);
    });

    test('Rejects application with missing answers', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId: testJobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: testQuestionIds[0], value: 'A' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.details[0]).toContain('Missing answers');
    });

    test('Rejects application with invalid question IDs', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId: testJobId,
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: [
            { questionId: testQuestionIds[0], value: 'A' },
            { questionId: 'invalid-id', value: 5 }
          ]
        });

      expect(response.status).toBe(400);
    });

    test('Rejects application for non-existent job', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId: '00000000-0000-0000-0000-000000000000',
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          answers: []
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    test('Rejects application with invalid email', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          jobId: testJobId,
          candidateName: 'Test User',
          candidateEmail: 'invalid-email',
          answers: [
            { questionId: testQuestionIds[0], value: 'A' },
            { questionId: testQuestionIds[1], value: 5 }
          ]
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Full Workflow Integration', () => {
    test('Complete job posting and application workflow', async () => {
      const jobResponse = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Full Stack Developer',
          location: 'Berlin, Germany',
          customer: 'LoadUp',
          jobName: 'fullstack-dev',
          description: 'Looking for a full stack developer',
          questions: [
            {
              text: 'Years of TypeScript experience?',
              type: 'number',
              points: 25,
              min: 0,
              max: 20
            },
            {
              text: 'Which framework do you prefer?',
              type: 'single_choice',
              points: 25,
              options: ['React', 'Angular', 'Vue'],
              correctOption: 'React'
            },
            {
              text: 'Select all databases you know:',
              type: 'multi_choice',
              points: 25,
              options: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis'],
              correctOptions: ['PostgreSQL', 'MongoDB']
            },
            {
              text: 'Describe your backend experience:',
              type: 'text',
              points: 25,
              keywords: ['node', 'express', 'api', 'microservices']
            }
          ]
        });

      expect(jobResponse.status).toBe(201);
      expect(jobResponse.body.id).toBeDefined();
      const jobId = jobResponse.body.id;

      const listResponse = await request(app).get('/api/jobs');
      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.body)).toBe(true);

      const getJobResponse = await request(app).get(`/api/jobs/${jobId}`);
      expect(getJobResponse.status).toBe(200);
      expect(getJobResponse.body.title).toBe('Full Stack Developer');

      const questionIds = jobResponse.body.questions.map((q: any) => q.id);
      const appResponse = await request(app)
        .post('/api/applications')
        .send({
          jobId,
          candidateName: 'Maryam Ghafarinia',
          candidateEmail: 'maryam@example.com',
          answers: [
            { questionId: questionIds[0], value: 6 },
            { questionId: questionIds[1], value: 'React' },
            { questionId: questionIds[2], value: ['PostgreSQL', 'MongoDB', 'Redis'] },
            { questionId: questionIds[3], value: 'Extensive experience with Node.js, Express, building RESTful APIs and microservices architecture' }
          ]
        });

      expect(appResponse.status).toBe(201);
      expect(appResponse.body.totalScore).toBeGreaterThan(0);
      expect(appResponse.body.scoreBreakdown).toHaveLength(4);

      const appListResponse = await request(app)
        .get(`/api/jobs/${jobId}/applications?sortBy=score`);
      expect(appListResponse.status).toBe(200);
      expect(appListResponse.body.length).toBeGreaterThan(0);

      const appId = appResponse.body.id;
      const getAppResponse = await request(app)
        .get(`/api/applications/${appId}`);
      expect(getAppResponse.status).toBe(200);
      expect(getAppResponse.body.id).toBe(appId);
    });
  });

  describe('Edge Cases', () => {
    test('Returns 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/00000000-0000-0000-0000-000000000000');
      expect(response.status).toBe(404);
    });

    test('Returns 404 for non-existent application', async () => {
      const response = await request(app)
        .get('/api/applications/00000000-0000-0000-0000-000000000000');
      expect(response.status).toBe(404);
    });

    test('Returns empty array for job with no applications', async () => {
      const jobResponse = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Empty Job',
          location: 'Berlin',
          customer: 'LoadUp',
          jobName: 'empty',
          description: 'Test',
          questions: [{
            text: 'Test',
            type: 'single_choice',
            points: 10,
            options: ['A'],
            correctOption: 'A'
          }]
        });

      const response = await request(app)
        .get(`/api/jobs/${jobResponse.body.id}/applications`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
