import { reddit } from '@devvit/web/server';
import type { Comment, Post } from '@devvit/web/server';
import type { T1, T3, T5 } from '@devvit/shared-types/tid.js';

export type NukeProps = {
  remove: boolean;
  lock: boolean;
  skipDistinguished: boolean;
  commentId: T1;
  subredditId: T5;
};

export type NukePostProps = {
  remove: boolean;
  lock: boolean;
  skipDistinguished: boolean;
  postId: T3;
  subredditId: T5;
};

const shouldIncludeComment = (comment: Comment, skipDistinguished: boolean) =>
  !skipDistinguished || !comment.isDistinguished();

async function* getAllCommentsInThread(
  comment: Comment,
  skipDistinguished: boolean
): AsyncGenerator<Comment> {
  if (shouldIncludeComment(comment, skipDistinguished)) {
    yield comment;
  }

  const replies = await comment.replies.all();
  for (const reply of replies) {
    yield* getAllCommentsInThread(reply, skipDistinguished);
  }
}

async function* getAllCommentsInPost(
  post: Post,
  skipDistinguished: boolean
): AsyncGenerator<Comment> {
  const comments = await post.comments.all();
  for (const comment of comments) {
    yield* getAllCommentsInThread(comment, skipDistinguished);
  }
}

export async function handleNukePost(props: NukePostProps) {
  const startTime = Date.now();
  let success = true;
  let message: string;

  const shouldLock = props.lock;
  const shouldRemove = props.remove;
  const skipDistinguished = props.skipDistinguished;

  try {
    const [user, post] = await Promise.all([
      reddit.getCurrentUser(),
      reddit.getPostById(props.postId),
    ]);

    if (!user) {
      return { success: false, message: "Can't get user" };
    }

    const modPermissions = await user.getModPermissionsForSubreddit(
      post.subredditName
    );
    const canManagePosts =
      modPermissions.includes('all') || modPermissions.includes('posts');

    console.log(
      `Mod Info: r/${post.subredditName} u/${
        user.username
      } permissions:${modPermissions}: ${
        canManagePosts ? 'Can mod' : 'Cannot mod'
      }`
    );

    if (!canManagePosts) {
      console.info(
        'A user without the correct mod permissions tried to nuke all comments of a post.'
      );
      return {
        message: 'You do not have the correct mod permissions to do this.',
        success: false,
      };
    }

    const comments: Comment[] = [];
    for await (const eachComment of getAllCommentsInPost(
      post,
      skipDistinguished
    )) {
      comments.push(eachComment);
    }

    if (shouldLock) {
      await Promise.all(
        comments.map((comment) => comment.locked || comment.lock())
      );
    }

    if (shouldRemove) {
      await Promise.all(
        comments.map((comment) => comment.removed || comment.remove())
      );
    }

    const verbage =
      shouldLock && shouldRemove
        ? 'removed and locked'
        : shouldLock
          ? 'locked'
          : 'removed';

    success = true;
    message = `Comments ${verbage}! Refresh the page to see the cleanup.`;
    const finishTime = Date.now();
    const timeElapsed = (finishTime - startTime) / 1000;
    console.info(
      `${comments.length} comment(s) handled in ${timeElapsed} seconds.`
    );
  } catch (err: unknown) {
    success = false;
    message = 'Mop failed! Please try again later.';
    console.error(err);
  }

  return { success, message };
}

export async function handleNuke(props: NukeProps) {
  const startTime = Date.now();
  let success = true;
  let message: string;

  const shouldLock = props.lock;
  const shouldRemove = props.remove;
  const skipDistinguished = props.skipDistinguished;

  try {
    const comment = await reddit.getCommentById(props.commentId);
    const user = await reddit.getCurrentUser();

    if (!user) {
      return { success: false, message: "Can't get user" };
    }

    const modPermissions = await user.getModPermissionsForSubreddit(
      comment.subredditName
    );
    const canManagePosts =
      modPermissions.includes('all') || modPermissions.includes('posts');

    console.log(
      `Mod Info: r/${comment.subredditName} u/${
        user.username
      } permissions:${modPermissions}: ${
        canManagePosts ? 'Can mod' : 'Cannot mod'
      }`
    );

    if (!canManagePosts) {
      console.info(
        'A user without the correct mod permissions tried to comment mop.'
      );
      return {
        message: 'You do not have the correct mod permissions to do this.',
        success: false,
      };
    }

    const comments: Comment[] = [];
    for await (const eachComment of getAllCommentsInThread(
      comment,
      skipDistinguished
    )) {
      comments.push(eachComment);
    }

    if (shouldLock) {
      await Promise.all(
        comments.map((comment) => comment.locked || comment.lock())
      );
    }

    if (shouldRemove) {
      await Promise.all(
        comments.map((comment) => comment.removed || comment.remove())
      );
    }

    const verbage =
      shouldLock && shouldRemove
        ? 'removed and locked'
        : shouldLock
          ? 'locked'
          : 'removed';

    success = true;
    message = `Comments ${verbage}! Refresh the page to see the cleanup.`;
    const finishTime = Date.now();
    const timeElapsed = (finishTime - startTime) / 1000;
    console.info(
      `${comments.length} comment(s) handled in ${timeElapsed} seconds.`
    );
  } catch (err: unknown) {
    success = false;
    message = 'Mop failed! Please try again later.';
    console.error(err);
  }

  return { success, message };
}
