import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import type { CommentCreate, PostCreate } from '@devvit/protos/json/devvit/events/v1alpha/events.js';
import type { T1, T3 } from '@devvit/shared-types/tid.js';

const MODERATION_API_URL =
  process.env.MODERATION_API_URL ||
  'https://guardli-peach.vercel.app/moderate';

type ModerationAction = 'approve' | 'remove' | 'none';

type ModerationResponse = {
  decision: string;
  rule?: string;
  confidence: number;
  reason: string;
};

const normalizeThingId = (
  id: string,
  type: 'comment' | 'post'
): T1 | T3 => {
  if (id.startsWith('t1_') || id.startsWith('t3_')) {
    return id as T1 | T3;
  }

  return (type === 'comment' ? `t1_${id}` : `t3_${id}`) as T1 | T3;
};

const sendModerationRequest = async (payload: unknown) => {
  try {
    const response = await fetch(MODERATION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        'Moderation API returned an error',
        response.status,
        text
      );
      return { action: 'none' as ModerationAction, reason: 'API error' };
    }

    const body = (await response.json()) as Partial<ModerationResponse>;
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

    const payload = {
      title: '',
      body: commentEvent.comment?.body || '',
    };

    const decision = await sendModerationRequest(payload);

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

  const payload = {
    title: postEvent.post?.title || '',
    body: postEvent.post?.selftext || '',
  };

  const decision = await sendModerationRequest(payload);
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
