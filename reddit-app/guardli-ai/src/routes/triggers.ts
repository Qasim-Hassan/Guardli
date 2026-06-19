import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import type { CommentCreate, PostCreate } from '@devvit/protos/json/devvit/events/v1alpha/events.js';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { settings } from '@devvit/web/server';

type ModerationAction = 'approve' | 'remove' | 'none';

type ModerationResponse = {
  decision: string;
  rule?: string;
  confidence: number;
  reason: string;
};

const systemPrompt = `
You are an expert Reddit moderator.

Your task is to determine whether content violates community rules.

Rules:

1. No harassment
2. No hate speech
3. No NSFW content
4. No personal attacks
5. No misinformation
6. Posts should be related to International Olympiads and Academics (and topics somewhat related to them). Allow normal greetings or routine discussions, but not anything off-topic.

Return ONLY JSON.

Do not explain.
Do not reason.
Do not analyze.
Do not use markdown.
Do not use code blocks.
Return raw JSON only, strictly following this format: 
{
  "decision":"APPROVE|REMOVE",
  "rule":"RULE_NAME_OR_NULL",
  "confidence":0.0 - 1.0,
  "reason":"short explanation"
}

Here is the content to moderate:
`

const normalizeThingId = (
  id: string,
  type: 'comment' | 'post'
): T1 | T3 => {
  if (id.startsWith('t1_') || id.startsWith('t3_')) {
    return id as T1 | T3;
  }

  return (type === 'comment' ? `t1_${id}` : `t3_${id}`) as T1 | T3;
};

const sendModerationRequest = async (payload: string, apiKey?: string) => {
  if (!apiKey) {
    console.error('Missing Google API key');
    return { action: 'none' as ModerationAction, reason: 'Missing API key' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: systemPrompt + payload,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                decision: {
                  type: "STRING"
                },
                rule: {
                  type: "STRING"
                },
                confidence: {
                  type: "NUMBER"
                },
                reason: {
                  type: "STRING"
                }
              },
              required: [
                "decision",
                "confidence",
                "reason"
              ]
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        'Moderation API returned an error',
        response.status,
        text
      );
      return { action: 'none' as ModerationAction, reason: 'API error' };
    }

    const body = JSON.parse((await response.json()).candidates?.[0]?.content?.parts?.[0]?.text) as Partial<ModerationResponse>;
    if (!body.decision) {
      console.warn(
        'Moderation API returned missing decision, leaving content unchanged',
        body
      );
      return { action: 'none' as ModerationAction, reason: 'Missing decision' };
    }

    const decision = body.decision.toLowerCase();
    const action: ModerationAction =
      decision === 'remove' || decision === 'block' || decision === 'spam'
        ? 'remove'
        : 'approve';

    return {
      action,
      rule: body.rule,
      confidence: body.confidence,
      reason: body.reason,
    };
  } catch (error: unknown) {
    console.error('Moderation API request failed', error);
    return { action: 'none' as ModerationAction, reason: 'Request failed' };
  }
};

const moderateThing = async (
  id: string,
  type: 'comment' | 'post',
  action: ModerationAction
) => {
  const thingId = normalizeThingId(id, type);

  try {
    if (action === 'remove') {
      await reddit.remove(thingId, false);
      return { success: true, action: 'removed' };
    }

    await reddit.approve(thingId);
    return { success: true, action: 'approved' };
  } catch (error: unknown) {
    console.error(`Failed to ${action} ${thingId}`, error);
    return { success: false, action };
  }
};

const handleCreateEvent = async (
  type: 'comment' | 'post',
  event: CommentCreate | PostCreate
) => {
  if (type === 'comment') {
    const commentEvent = event as CommentCreate;
    const thingId = commentEvent.comment?.id;
    if (!thingId) {
      console.error('Comment create event missing id', commentEvent);
      return { status: 'error', error: 'missing content id' };
    }

    const payload = commentEvent.comment?.body || '';

    const apiKey = await settings.get<string>('googleApi');
    const decision = await sendModerationRequest(payload, apiKey);

    if (decision.action === 'none') {
      console.warn('Moderation request failed, not altering content');
      return {
        status: 'success',
        action: 'none',
        reason: decision.reason,
      };
    }

    const moderationResult = await moderateThing(
      thingId,
      type,
      decision.action
    );

    if (!moderationResult.success) {
      return {
        status: 'error',
        message: `Failed to ${decision.action} ${type}`,
      };
    }

    return {
      status: 'success',
      action: decision.action,
      reason: decision.reason,
    };
  }

  const postEvent = event as PostCreate;
  const thingId = postEvent.post?.id;
  if (!thingId) {
    console.error('Post create event missing id', postEvent);
    return { status: 'error', error: 'missing content id' };
  }

  const payload = [postEvent.post?.title, postEvent.post?.selftext]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');

  const apiKey = await settings.get<string>('googleApi');
  const decision = await sendModerationRequest(payload, apiKey);

  if (decision.action === 'none') {
    console.warn('Moderation request failed, not altering content');
    return {
      status: 'success',
      action: 'none',
      reason: decision.reason,
    };
  }

  const moderationResult = await moderateThing(
    thingId,
    type,
    decision.action
  );

  if (!moderationResult.success) {
    return {
      status: 'error',
      message: `Failed to ${decision.action} ${type}`,
    };
  }

  return {
    status: 'success',
    action: decision.action,
    reason: decision.reason,
  };
};

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});

triggers.post('/on-comment-create', async (c) => {
  const event = await c.req.json<CommentCreate>();
  console.log('Comment create event', { subredditId: event.subreddit?.id });

  const result = await handleCreateEvent('comment', event);
  return c.json(result, 200);
});

triggers.post('/on-post-create', async (c) => {
  const event = await c.req.json<PostCreate>();
  console.log('Post create event', { subredditId: event.subreddit?.id });

  const result = await handleCreateEvent('post', event);
  
  return c.json(result, 200);
});
