import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { getApiErrorMessage } from '../api-error-parser';

describe('getApiErrorMessage', () => {
  const mockTranslations: Record<string, string> = {
    'apiErrors.NETWORK_ERROR': 'ネットワークエラーが発生しました。接続を確認してください。',
    'apiErrors.GROUP_NOT_FOUND': 'グループが見つかりません。',
    'groupChat.errorLeaveGroup': 'グループの退出に失敗しました。',
    'common.defaultError': 'エラーが発生しました。'
  };

  const mockT = (key: string): string => mockTranslations[key] || key;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects offline state and returns localized network error', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const error = new Error('Some error');
    const result = getApiErrorMessage(error, 'common.defaultError', mockT);

    expect(result).toBe('ネットワークエラーが発生しました。接続を確認してください。');
  });

  it('detects Axios network error and returns localized network error', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const axiosError = new AxiosError(
      'Network Error',
      'ERR_NETWORK',
      { headers: new AxiosHeaders() }
    );

    const result = getApiErrorMessage(axiosError, 'common.defaultError', mockT);
    expect(result).toBe('ネットワークエラーが発生しました。接続を確認してください。');
  });

  it('resolves localized translation from API error response code', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const axiosError = new AxiosError(
      'Request failed with status code 404',
      'ERR_BAD_REQUEST',
      { headers: new AxiosHeaders() },
      {},
      {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { code: 'GROUP_NOT_FOUND' }
      }
    );

    const result = getApiErrorMessage(axiosError, 'common.defaultError', mockT);
    expect(result).toBe('グループが見つかりません。');
  });

  it('falls back to raw error string from API response data if code translation is missing', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const axiosError = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      { headers: new AxiosHeaders() },
      {},
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { error: 'Custom backend error description' }
      }
    );

    const result = getApiErrorMessage(axiosError, 'common.defaultError', mockT);
    expect(result).toBe('Custom backend error description');
  });

  it('returns standard Error message for generic Error instances without Axios or offline signals', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const error = new Error('Database connection failed locally');
    const result = getApiErrorMessage(error, 'common.defaultError', mockT);
    expect(result).toBe('Database connection failed locally');
  });

  it('falls back to translated fallback key for non-Error unknown values', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const result = getApiErrorMessage('unknown string error', 'groupChat.errorLeaveGroup', mockT);
    expect(result).toBe('グループの退出に失敗しました。');
  });
});
