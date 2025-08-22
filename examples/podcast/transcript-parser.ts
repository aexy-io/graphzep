/**
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SpeakerSchema = z.object({
  index: z.number(),
  name: z.string(),
  role: z.string(),
});

export const ParsedMessageSchema = z.object({
  speakerIndex: z.number(),
  speakerName: z.string(),
  role: z.string(),
  relativeTimestamp: z.string(),
  actualTimestamp: z.date(),
  content: z.string(),
});

export type Speaker = z.infer<typeof SpeakerSchema>;
export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;

export function parseTimestamp(timestamp: string): number {
  // Returns duration in milliseconds
  if (timestamp.includes('m')) {
    const match = timestamp.match(/(\d+)m(?:\s*(\d+)s)?/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = match[2] ? parseInt(match[2]) : 0;
      return (minutes * 60 + seconds) * 1000;
    }
  } else if (timestamp.includes('s')) {
    const match = timestamp.match(/(\d+)s/);
    if (match) {
      const seconds = parseInt(match[1]);
      return seconds * 1000;
    }
  }
  return 0; // Return 0 duration if parsing fails
}

export function parseConversationFile(filePath: string, speakers: Speaker[]): ParsedMessage[] {
  const content = readFileSync(filePath, 'utf-8');
  const messages = content.split('\n\n');
  const speakerDict = new Map<number, Speaker>();
  
  for (const speaker of speakers) {
    speakerDict.set(speaker.index, speaker);
  }

  const parsedMessages: ParsedMessage[] = [];

  // Find the last timestamp to determine podcast duration
  let lastTimestamp = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const lines = message.trim().split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0];
      const parts = firstLine.split(':', 1);
      if (parts.length === 2) {
        const header = parts[0];
        const headerParts = header.split(/\s+/);
        if (headerParts.length >= 2) {
          const timestamp = headerParts[1].replace(/[()]/g, '');
          lastTimestamp = parseTimestamp(timestamp);
          break;
        }
      }
    }
  }

  // Calculate the start time
  const now = new Date();
  const podcastStartTime = new Date(now.getTime() - lastTimestamp);

  for (const message of messages) {
    const lines = message.trim().split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0];
      const parts = firstLine.split(':', 2);
      if (parts.length === 2) {
        const header = parts[0];
        let content = parts[1];
        const headerParts = header.split(/\s+/);
        
        if (headerParts.length >= 2) {
          const speakerIndex = parseInt(headerParts[0]);
          const timestamp = headerParts[1].replace(/[()]/g, '');

          if (lines.length > 1) {
            content += '\n' + lines.slice(1).join('\n');
          }

          const delta = parseTimestamp(timestamp);
          const actualTime = new Date(podcastStartTime.getTime() + delta);

          const speaker = speakerDict.get(speakerIndex);
          const speakerName = speaker ? speaker.name : `Unknown Speaker ${speakerIndex}`;
          const role = speaker ? speaker.role : 'Unknown';

          parsedMessages.push({
            speakerIndex,
            speakerName,
            role,
            relativeTimestamp: timestamp,
            actualTimestamp: actualTime,
            content: content.trim(),
          });
        }
      }
    }
  }

  return parsedMessages;
}

export function parsePodcastMessages(): ParsedMessage[] {
  const filePath = join(__dirname, 'podcast_transcript.txt');

  const speakers: Speaker[] = [
    { index: 0, name: 'Stephen DUBNER', role: 'Host' },
    { index: 1, name: 'Tania Tetlow', role: 'Guest' },
    { index: 4, name: 'Narrator', role: 'Narrator' },
    { index: 5, name: 'Kamala Harris', role: 'Quoted' },
    { index: 6, name: 'Unknown Speaker', role: 'Unknown' },
    { index: 7, name: 'Unknown Speaker', role: 'Unknown' },
    { index: 8, name: 'Unknown Speaker', role: 'Unknown' },
    { index: 10, name: 'Unknown Speaker', role: 'Unknown' },
  ];

  const parsedConversation = parseConversationFile(filePath, speakers);
  console.log(`Number of messages: ${parsedConversation.length}`);
  return parsedConversation;
}