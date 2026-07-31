import { describe, expect, it } from 'vitest';
import {
  ApiError,
  chainError,
  errorMessage,
  notFound,
  toApiError,
  validationError,
} from '../src/lib/errors.js';

describe('ApiError', () => {
  it('maps codes to status codes', () => {
    expect(new ApiError('NOT_FOUND', 'x').statusCode).toBe(404);
    expect(new ApiError('VALIDATION_ERROR', 'x').statusCode).toBe(400);
    expect(new ApiError('CHAIN_ERROR', 'x').statusCode).toBe(502);
    expect(new ApiError('DB_NOT_CONFIGURED', 'x').statusCode).toBe(503);
    expect(new ApiError('INTERNAL_ERROR', 'x').statusCode).toBe(500);
  });

  it('constructor helpers set the right code', () => {
    expect(validationError('v').code).toBe('VALIDATION_ERROR');
    expect(notFound('n').code).toBe('NOT_FOUND');
    expect(chainError('c').code).toBe('CHAIN_ERROR');
  });
});

describe('toApiError', () => {
  it('passes through an ApiError unchanged', () => {
    const e = notFound('missing');
    expect(toApiError(e)).toBe(e);
  });

  it('wraps an Error as INTERNAL_ERROR without leaking the message to the client field', () => {
    const wrapped = toApiError(new Error('db password is hunter2'));
    expect(wrapped.code).toBe('INTERNAL_ERROR');
    expect(wrapped.message).toBe('Internal server error');
    expect(wrapped.details).toEqual({ cause: 'db password is hunter2' });
  });

  it('wraps a non-Error throw', () => {
    const wrapped = toApiError('boom');
    expect(wrapped.code).toBe('INTERNAL_ERROR');
    expect(wrapped.details).toEqual({ cause: 'boom' });
  });
});

describe('errorMessage', () => {
  it('extracts a message from Error and stringifies otherwise', () => {
    expect(errorMessage(new Error('hi'))).toBe('hi');
    expect(errorMessage(42)).toBe('42');
  });
});
