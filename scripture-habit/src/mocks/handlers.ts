import { http, HttpResponse } from 'msw';
import type {
  UpdateKickThresholdRequest,
  UpdateKickThresholdResponse,
  GroupListItem,
  JoinGroupRequest,
  TranslateRequest,
  TranslateResponse
} from '../../api_internal/lib/schemas.js';

export const handlers = [
  http.post<never, UpdateKickThresholdRequest, UpdateKickThresholdResponse>('/api/groups/update-kick-threshold', async () => {
    return HttpResponse.json({ success: true, cleanedUpGroups: [] });
  }),
  http.get<never, never, GroupListItem[]>('/api/groups', () => {
    return HttpResponse.json([
      { id: 'group-1', name: 'Group 1', isPublic: true, members: ['test-user'] },
      { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
    ]);
  }),
  http.post<never, JoinGroupRequest, string>('/api/groups/join-group', () => {
    return new HttpResponse('OK', { status: 200 });
  }),
  http.post<never, TranslateRequest, TranslateResponse>('/api/ai/translate', () => {
    return HttpResponse.json({ translatedText: 'Translated Text' });
  }),
];

