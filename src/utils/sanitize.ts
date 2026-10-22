/**
 * Sanitizes user prompts from Antigravity transcripts or input buffers.
 * Strips internal CLI wrapper tags like <USER_REQUEST>, <ADDITIONAL_METADATA>,
 * and <SYSTEM_MESSAGE>, hiding metadata contents completely.
 * Extracts any attached file references into structured attachment objects.
 */

export interface SanitizedUserMessage {
  text: string;
  attachments: { name: string; path: string }[];
}

export function sanitizeUserMessage(raw?: string | null): SanitizedUserMessage {
  if (!raw || typeof raw !== 'string') {
    return { text: '(Empty prompt)', attachments: [] };
  }

  let text = raw;

  // 1. If wrapped in <USER_REQUEST>...</USER_REQUEST>, extract inner content
  const requestMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (requestMatch) {
    text = requestMatch[1];
  } else {
    // Strip <ADDITIONAL_METADATA>...</ADDITIONAL_METADATA> and its contents completely
    text = text.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '');
    // Strip <SYSTEM_MESSAGE>...</SYSTEM_MESSAGE>
    text = text.replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/gi, '');
    // Strip stray user request tags if any
    text = text.replace(/<\/?USER_REQUEST>/gi, '');
  }

  // Also ensure any leftover metadata tags inside are stripped
  text = text.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '');
  text = text.replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/gi, '');

  // 2. Extract attached file paths if formatted as:
  // "The user has attached the following files. Use your tools to inspect them:\n- /path/to/file\n\n"
  const attachments: { name: string; path: string }[] = [];
  const attachRegex = /The user has attached the following files(?:\. Use your tools to inspect them)?:?\s*([\s\S]*?)(?:\n\n|$)/i;
  const attachMatch = text.match(attachRegex);

  if (attachMatch) {
    const listBlock = attachMatch[1];
    const fileMatches = listBlock.match(/-\s*([^\n\r]+)/g);
    if (fileMatches) {
      for (const fm of fileMatches) {
        const filePath = fm.replace(/^-\s*/, '').trim();
        if (filePath) {
          const parts = filePath.split(/[/\\]/);
          const fileName = parts.pop() || filePath;
          attachments.push({ name: fileName, path: filePath });
        }
      }
    }
    // Remove the attachment injection prefix from the user message text
    text = text.replace(attachMatch[0], '');
  }

  text = text.trim();

  return {
    text: text || '(Empty prompt)',
    attachments
  };
}
