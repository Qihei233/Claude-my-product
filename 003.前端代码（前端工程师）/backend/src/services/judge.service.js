import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { query } from '../config/db.js';
import { ApiError } from '../utils/http.js';

/**
 * 本地判题执行器。
 *
 * 注意：这里会在后端机器上执行用户提交的 Python 代码。当前实现面向本地课程项目，
 * 只做了超时、输出长度和隔离模式（-I）限制，不是生产级安全沙箱。
 * 正式部署应改用容器/沙箱（如 Docker + seccomp、Judge0 等）隔离运行。
 */
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const RUN_TIMEOUT_MS = 3000;
const MAX_OUTPUT = 20000;
const MAX_CASES = 10;

const PY_PREAMBLE = [
  'import sys',
  'for _stream in (sys.stdin, sys.stdout, sys.stderr):',
  '    try:',
  '        _stream.reconfigure(encoding="utf-8")',
  '    except Exception:',
  '        pass',
  '',
  '',
].join('\n');

async function runPython(code, input) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naiwa-judge-'));
  const file = path.join(dir, 'main.py');

  try {
    await fs.writeFile(file, `${PY_PREAMBLE}${String(code ?? '')}`, 'utf8');

    return await new Promise((resolve) => {
      const startedAt = Date.now();
      let child;
      try {
        child = spawn(PYTHON_BIN, ['-I', file], {
          cwd: dir,
          env: { ...process.env },
          windowsHide: true,
        });
      } catch (error) {
        resolve({
          ok: false,
          output: '',
          error: `无法启动 Python：${error.message}`,
          durationMs: Date.now() - startedAt,
        });
        return;
      }

      let stdout = '';
      let stderr = '';
      let finished = false;

      const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({ ...result, durationMs: Date.now() - startedAt });
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish({
          ok: false,
          output: stdout.slice(0, MAX_OUTPUT),
          error: `运行超时（超过 ${RUN_TIMEOUT_MS / 1000} 秒）`,
        });
      }, RUN_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        if (stdout.length < MAX_OUTPUT) stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length < MAX_OUTPUT) stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        finish({
          ok: false,
          output: stdout.slice(0, MAX_OUTPUT),
          error: String(error.message || error),
        });
      });
      child.on('close', (exitCode) => {
        finish({
          ok: exitCode === 0,
          output: stdout.slice(0, MAX_OUTPUT),
          error: exitCode === 0 ? '' : stderr.trim() || `进程退出码 ${exitCode}`,
          exitCode,
        });
      });

      const inputText =
        typeof input === 'string' && input.length && !input.endsWith('\n')
          ? `${input}\n`
          : input;
      child.stdin.end(typeof inputText === 'string' ? inputText : '');
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function normalize(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

async function getQuestion(questionId) {
  const rows = await query(
    'SELECT id, question_code, title, sample_input, sample_output FROM questions WHERE id = ? LIMIT 1',
    [questionId],
  );
  if (!rows.length) throw new ApiError(404, '题目不存在');
  return rows[0];
}

async function getTestCases(questionId) {
  return query(
    `SELECT input_text, expected_output, is_sample, sort_order
       FROM test_cases
      WHERE question_id = ?
      ORDER BY is_sample DESC, sort_order
      LIMIT ${MAX_CASES}`,
    [questionId],
  );
}

function friendlyPythonError(error) {
  const text = String(error || '');
  if (/SyntaxError/.test(text)) return '代码有语法错误，先检查引号、括号和缩进。';
  if (/IndentationError/.test(text)) return '缩进不正确，请检查每行开头的空格。';
  if (/NameError/.test(text)) return '有一个变量或函数还没有定义。';
  if (/ZeroDivisionError/.test(text)) return '除数不能为 0，检查一下计算过程。';
  if (/EOFError/.test(text)) return '程序在等待输入，但输入已经结束了。';
  if (/Timeout|超时/.test(text)) return '代码运行时间太长，检查是否有死循环。';
  return '';
}

/** 只运行一次（自测），有样例用例就使用样例输入。 */
export async function runQuestion(questionId, code) {
  const testCases = await getTestCases(questionId);
  const sample =
    testCases.find((item) => Number(item.is_sample) === 1) || testCases[0];
  const result = await runPython(String(code || ''), sample?.input_text);
  const expected = sample?.expected_output;
  const passed =
    result.ok && expected !== undefined
      ? normalize(result.output) === normalize(expected)
      : result.ok;

  return {
    status: result.ok ? 'success' : 'error',
    output: result.output || '',
    error: result.error || '',
    expected: expected ?? null,
    passed,
    durationMs: result.durationMs,
    friendlyError: friendlyPythonError(result.error),
  };
}

/** 用全部测试用例判题。 */
export async function judgeQuestion(questionId, code) {
  const testCases = await getTestCases(questionId);
  if (!testCases.length) {
    const result = await runPython(String(code || ''), '');
    return {
      accepted: result.ok,
      passedCases: result.ok ? 1 : 0,
      totalCases: 1,
      results: [],
      output: result.output || '',
      expected: null,
      error: result.error || '',
      friendlyError: friendlyPythonError(result.error),
      durationMs: result.durationMs,
      firstFailed: result.ok ? null : { output: result.output, expected: null, error: result.error },
    };
  }

  const results = [];
  let passedCases = 0;
  let totalMs = 0;

  for (const testCase of testCases) {
    const result = await runPython(String(code || ''), testCase.input_text);
    totalMs += result.durationMs;
    const passed =
      result.ok && normalize(result.output) === normalize(testCase.expected_output);
    if (passed) passedCases += 1;
    results.push({
      input: testCase.input_text,
      expected: testCase.expected_output,
      output: result.output,
      error: result.error,
      passed,
      isSample: Boolean(Number(testCase.is_sample)),
    });
  }

  const accepted = passedCases === testCases.length;
  const failed = results.find((item) => !item.passed);

  return {
    accepted,
    passedCases,
    totalCases: testCases.length,
    results,
    output: failed?.output ?? results[results.length - 1]?.output ?? '',
    expected: failed?.expected ?? null,
    error: failed?.error ?? '',
    friendlyError: friendlyPythonError(failed?.error),
    durationMs: totalMs,
    firstFailed: failed || null,
  };
}

/** 课时提交：有关联题目就按测试用例判题；没有题目则只执行一次。 */
export async function judgeLesson(lessonId, code) {
  const rows = await query(
    'SELECT id, question_id FROM lessons WHERE id = ? LIMIT 1',
    [lessonId],
  );
  if (!rows.length) throw new ApiError(404, '课时不存在');
  const questionId = rows[0].question_id;
  if (questionId) {
    return judgeQuestion(questionId, code);
  }
  const result = await runPython(String(code || ''), '');
  return {
    accepted: result.ok,
    passedCases: result.ok ? 1 : 0,
    totalCases: 1,
    results: [],
    output: result.output || '',
    expected: null,
    error: result.error || '',
    friendlyError: friendlyPythonError(result.error),
    durationMs: result.durationMs,
    firstFailed: result.ok
      ? null
      : { output: result.output, expected: null, error: result.error },
  };
}

export async function findQuestionByCode(code) {
  const rows = await query(
    'SELECT id FROM questions WHERE question_code = ? AND status = \'published\' LIMIT 1',
    [code],
  );
  if (!rows.length) throw new ApiError(404, '题目不存在');
  return rows[0];
}
