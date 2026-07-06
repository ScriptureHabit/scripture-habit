import { vi } from 'vitest';

export default {
  get: vi.fn().mockImplementation(async (url: string, config?: any) => {
    const resp = await global.fetch(url, config);
    if (!resp.ok) {
      throw {
        isAxiosError: true,
        response: { data: { code: 'ERROR', error: 'Axios Mocked Error' } }
      };
    }
    let data: any = {};
    try {
      const text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } catch {
      /* empty */
    }
    return { data };
  }),
  post: vi.fn().mockImplementation(async (url: string, body?: any, config?: any) => {
    const resp = await global.fetch(url, { ...config, method: 'POST', body: JSON.stringify(body) });
    if (!resp.ok) {
      let errText = 'Error';
      try { errText = await resp.text(); } catch { /* empty */ }
      throw {
        isAxiosError: true,
        response: { data: { code: errText || 'ERROR', error: errText || 'Axios Mocked Error' } }
      };
    }
    let data: any = {};
    try {
      const text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } catch {
      /* empty */
    }
    return { data };
  })
};
