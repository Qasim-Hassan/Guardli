import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import type { CommentCreate, PostCreate } from '@devvit/protos/json/devvit/events/v1alpha/events.js';
import type { T1, T3 } from '@devvit/shared-types/tid.js';

const MODERATION_API_URL =
  process.env.MODERATION_API_URL ||
  'https://your-backend-server.example.com/moderate';

type ModerationAction = 'approve' | 'remove';

type ModerationResponse = {
  action: ModerationAction;
  spam?: boolean;
  reason?: string;
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
      return { action: 'approve' as ModerationAction };
    }

    const body = (await response.json()) as Partial<ModerationResponse>;
    if (body.action !== 'approve' && body.action !== 'remove') {
      console.warn(
        'Moderation API returned invalid action, defaulting to approve',
        body
      );
      return { action: 'approve' as ModerationAction };
    }

    return {
      action: body.action,
      spam: Boolean(body.spam),
      reason: body.reason,
    };
  } catch (error: unknown) {
    console.error('Moderation API request failed', error);
    return { action: 'approve' as ModerationAction };
  }
};

const moderateThing = async (
  id: string,
  type: 'comment' | 'post',
  action: ModerationAction,
  spam = false
) => {
  const thingId = normalizeThingId(id, type);

  try {
    if (action === 'remove') {
      await reddit.remove(thingId, spam);
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
      eventType: type,
      id: thingId,
      subredditId: commentEvent.subreddit?.id,
      authorId: commentEvent.author?.id,
      body: commentEvent.comment?.body,
      title: undefined,
      permalink: commentEvent.comment?.permalink,
      event: commentEvent,
    };

    const decision = await sendModerationRequest(payload);
    const moderationResult = await moderateThing(
      thingId,
      type,
      decision.action,
      Boolean(decision.spam)
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
    eventType: type,
    id: thingId,
    subredditId: postEvent.subreddit?.id,
    authorId: postEvent.author?.id,
    body: postEvent.post?.selftext,
    title: postEvent.post?.title,
    permalink: postEvent.post?.permalink,
    event: postEvent,
  };

  const decision = await sendModerationRequest(payload);
  const moderationResult = await moderateThing(
    thingId,
    type,
    decision.action,
    Boolean(decision.spam)
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
