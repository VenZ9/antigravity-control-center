import path from 'node:path';
import fs from 'node:fs';
import { CONFIG } from '../config.js';
import { listConversationSummaries } from '../db/antigravityReader.js';

export function getTokenAnalytics() {
  const brainDir = path.join(CONFIG.AGY_DIR, 'brain');
  if (!fs.existsSync(brainDir)) {
    return {
      grandTotal: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, total_tokens: 0 },
      dailyUsage: [],
      conversationRankings: [],
      modelsUsed: {},
      recordedEventsCount: 0
    };
  }

  const conversationFolders = fs.readdirSync(brainDir);
  const conversationRankings = [];
  const dailyMap = {};
  const modelsMap = {};
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalEvents = 0;

  // Map of conversation summaries for quick title lookup
  const summaries = listConversationSummaries();
  const summaryMap = new Map(summaries.map(s => [s.conversation_id, s]));

  for (const convId of conversationFolders) {
    const transcriptPath = path.join(brainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(transcriptPath)) continue;

    let convInput = 0;
    let convOutput = 0;
    let convCacheRead = 0;
    let stepCount = 0;

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (typeof obj.input_tokens === 'number' || typeof obj.output_tokens === 'number') {
            const input = obj.input_tokens || 0;
            const output = obj.output_tokens || 0;
            const cache = obj.cache_read_tokens || 0;

            convInput += input;
            convOutput += output;
            convCacheRead += cache;
            totalEvents++;

            // Date aggregation
            const dateStr = obj.created_at ? obj.created_at.substring(0, 10) : 'unknown';
            if (!dailyMap[dateStr]) {
              dailyMap[dateStr] = { date: dateStr, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, total_tokens: 0 };
            }
            dailyMap[dateStr].input_tokens += input;
            dailyMap[dateStr].output_tokens += output;
            dailyMap[dateStr].cache_read_tokens += cache;
            dailyMap[dateStr].total_tokens += (input + output);
          }
          stepCount++;
        } catch {}
      }
    } catch {}

    totalInput += convInput;
    totalOutput += convOutput;
    totalCacheRead += convCacheRead;

    const summary = summaryMap.get(convId);
    if (convInput > 0 || convOutput > 0 || stepCount > 0) {
      conversationRankings.push({
        conversationId: convId,
        title: summary?.title || convId.substring(0, 8),
        stepCount: summary?.step_count || stepCount,
        lastModified: summary?.last_modified_time || null,
        input_tokens: convInput,
        output_tokens: convOutput,
        cache_read_tokens: convCacheRead,
        total_tokens: convInput + convOutput
      });
    }
  }

  // Sort rankings by total tokens descending
  conversationRankings.sort((a, b) => b.total_tokens - a.total_tokens);

  // Convert dailyMap to sorted array
  const dailyUsage = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    source: 'local_transcripts',
    disclaimer: 'Calculated strictly from local transcript JSONL records. Does not represent external account quota billing.',
    grandTotal: {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cache_read_tokens: totalCacheRead,
      total_tokens: totalInput + totalOutput
    },
    recordedEventsCount: totalEvents,
    conversationRankings: conversationRankings.slice(0, 20),
    dailyUsage
  };
}
