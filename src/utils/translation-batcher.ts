import apiClient from './api-client';

export interface TranslationRequest {
  id: string;
  text: string;
  targetLanguage: string;
  groupId?: string;
}

interface PendingItem {
  request: TranslationRequest;
  resolve: (translatedText: string) => void;
  reject: (err: unknown) => void;
}

interface LanguageBatchQueue {
  items: PendingItem[];
  timer: ReturnType<typeof setTimeout> | null;
}

const BATCH_DELAY_MS = 50;
const queues = new Map<string, LanguageBatchQueue>();
const inFlightPromises = new Map<string, Promise<string>>();

const getDeduplicationKey = (id: string, targetLanguage: string, text: string): string => {
  return `${id}_${targetLanguage}_${text}`;
};

const processQueue = async (targetLanguage: string) => {
  const queue = queues.get(targetLanguage);
  if (!queue || queue.items.length === 0) return;

  const currentBatch = [...queue.items];
  queue.items = [];
  queue.timer = null;

  // Deduplicate items in the same batch by ID
  const uniqueItemsMap = new Map<string, PendingItem[]>();
  for (const item of currentBatch) {
    const list = uniqueItemsMap.get(item.request.id) || [];
    list.push(item);
    uniqueItemsMap.set(item.request.id, list);
  }

  const messagesToTranslate = Array.from(uniqueItemsMap.entries()).map(([id, items]) => ({
    id,
    text: items[0].request.text,
  }));

  try {
    const res = await apiClient.post('/api/ai/translate-batch', {
      messages: messagesToTranslate,
      targetLanguage,
    });

    const translations: Record<string, string> = res.data?.translations || {};

    for (const [id, items] of uniqueItemsMap.entries()) {
      const translated = translations[id] || items[0].request.text;
      for (const item of items) {
        item.resolve(translated);
      }
    }
  } catch (error) {
    console.error('[TranslationBatcher] Batch translation failed for targetLanguage:', targetLanguage, error);
    // Graceful fallback to original text on failure
    for (const [, items] of uniqueItemsMap.entries()) {
      for (const item of items) {
        item.resolve(item.request.text);
      }
    }
  } finally {
    for (const item of currentBatch) {
      const key = getDeduplicationKey(item.request.id, item.request.targetLanguage, item.request.text);
      inFlightPromises.delete(key);
    }
  }
};

/**
 * Universal batched translation function (DataLoader pattern).
 * Batches multiple concurrent translation requests within 50ms into a single /api/ai/translate-batch call.
 */
export const requestTranslation = (request: TranslationRequest): Promise<string> => {
  const { id, text, targetLanguage } = request;
  if (!text || !targetLanguage) {
    return Promise.resolve(text || '');
  }

  const dedupKey = getDeduplicationKey(id, targetLanguage, text);
  const inFlight = inFlightPromises.get(dedupKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = new Promise<string>((resolve, reject) => {
    let queue = queues.get(targetLanguage);
    if (!queue) {
      queue = { items: [], timer: null };
      queues.set(targetLanguage, queue);
    }

    queue.items.push({ request, resolve, reject });

    if (!queue.timer) {
      queue.timer = setTimeout(() => {
        processQueue(targetLanguage);
      }, BATCH_DELAY_MS);
    }
  });

  inFlightPromises.set(dedupKey, promise);
  return promise;
};

/**
 * Utility for tests to clean up state
 */
export const _resetBatcherForTesting = () => {
  for (const queue of queues.values()) {
    if (queue.timer) clearTimeout(queue.timer);
  }
  queues.clear();
  inFlightPromises.clear();
};
