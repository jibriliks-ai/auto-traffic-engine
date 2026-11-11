/**
 * Apache Answer posting client — STUB.
 *
 * To swap in the real client:
 *   1. Set ANSWER_BASE_URL and ANSWER_TOKEN env vars
 *   2. Replace stub body with:
 *        POST ${ANSWER_BASE_URL}/answer/api/v1/question
 *        POST ${ANSWER_BASE_URL}/answer/api/v1/answer
 *        POST ${ANSWER_BASE_URL}/answer/api/v1/answer/accept
 *      All with Authorization header
 *   3. Return { questionId, answerId, questionUrl }
 */

export interface AnswerPostResult {
  questionId: string;
  answerId: string;
  questionUrl: string;
}

const ANSWER_BASE_URL = process.env.ANSWER_BASE_URL ?? "";
const ANSWER_TOKEN = process.env.ANSWER_TOKEN ?? "";

export async function postToAnswer(
  questionTitle: string,
  answerBody: string,
  shortUrl: string
): Promise<AnswerPostResult> {
  if (!ANSWER_BASE_URL || !ANSWER_TOKEN) {
    // STUB MODE
    const qId = `stub-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const aId = `stub-a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[answer-stub] Would post Q: "${questionTitle.slice(0, 60)}..."`);
    return {
      questionId: qId,
      answerId: aId,
      questionUrl: `https://answer.example.com/questions/${qId}`,
    };
  }

  // Real client — implement when Answer instance ready
  throw new Error(
    "Real Apache Answer client not implemented — set ANSWER_BASE_URL + ANSWER_TOKEN to activate"
  );
}