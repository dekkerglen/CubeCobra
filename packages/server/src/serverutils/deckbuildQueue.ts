// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

/**
 * Publisher for the bot-deckbuild pipeline. When a draft is finished/published its bot
 * seats hold a cheap naive layout; we emit the draft id to an SNS topic which fans out to
 * an SQS queue consumed by the bot-deckbuild Lambda. The Lambda loads the draft, builds
 * the bot decks against the ML service, and writes them back — keeping the slow ML work
 * off the request path.
 *
 * The message body is just the draft id; the Lambda reconstructs everything else from the
 * persisted draft (bot seats, picks, cards, basics).
 */

const sns = new SNSClient({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

export interface BotDeckBuildMessage {
  draftId: string;
}

/**
 * Enqueue a draft for async bot-deck building. No-op (with a log) when the topic ARN is
 * unset — e.g. local development — so finishing a draft still works without the infra.
 */
export const publishBotDeckBuild = async (draftId: string): Promise<void> => {
  const topicArn = process.env.BOT_DECKBUILD_TOPIC_ARN;
  if (!topicArn) {
    console.info(`BOT_DECKBUILD_TOPIC_ARN not set; skipping bot-deckbuild enqueue for draft ${draftId}`);
    return;
  }

  const message: BotDeckBuildMessage = { draftId };
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
    }),
  );
};
