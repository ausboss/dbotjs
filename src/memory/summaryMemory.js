import { db } from "./index.js";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "langchain/schema";
import config from "../config.js";

// Function to generate a summary from messages
async function generateSummary(messages) {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
  });

  const formattedMessages = messages
    .map((msg) => `${msg.name}: ${msg.clean_content}`)
    .join("\n");

  const prompt = `Please summarize the following conversation, focusing on the main topics, key points, and any decisions or actions discussed:

${formattedMessages}

Summary:`;

  const response = await chat.call([new HumanMessage(prompt)]);
  return response.text;
}

// Function to store summaries in the database
async function storeSummary(
  channelId,
  guildId,
  summary,
  startMessageId,
  endMessageId,
  context
) {
  try {
    await db.run(
      `
      INSERT INTO message_summaries (channel_id, guild_id, summary, start_message_id, end_message_id, context)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        String(channelId),
        String(guildId),
        summary,
        String(startMessageId),
        String(endMessageId),
        JSON.stringify(context),
      ]
    );
  } catch (error) {
    console.error("Error storing summary:", error);
    throw error;
  }
}

// Function to retrieve relevant summaries
async function getRelevantSummaries(channelId, limit = 5) {
  try {
    const summaries = await db.all(
      `
      SELECT * FROM message_summaries
      WHERE channel_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [String(channelId), Number(limit)]
    );

    return summaries.map((summary) => ({
      ...summary,
      context: JSON.parse(summary.context),
    }));
  } catch (error) {
    console.error("Error retrieving relevant summaries:", error);
    throw error;
  }
}

// Main function to summarize messages and store the summary
async function summarizeAndStore(messages, channelId, guildId) {
  if (messages.length < config.summaryThreshold) {
    return null; // Not enough messages to summarize
  }

  const summary = await generateSummary(messages);
  const startMessageId = messages[0].id;
  const endMessageId = messages[messages.length - 1].id;
  const context = {
    totalMessages: messages.length,
    timespan: {
      start: messages[0].created_timestamp,
      end: messages[messages.length - 1].created_timestamp,
    },
    // Add any other relevant context here
  };

  await storeSummary(
    String(channelId),
    String(guildId),
    summary,
    String(startMessageId),
    String(endMessageId),
    context
  );
  return summary;
}

// Function to get the last summary and determine if a new one is needed
async function getLastSummaryAndCheck(channelId) {
  try {
    const lastSummary = await db.get(
      `
      SELECT * FROM message_summaries
      WHERE channel_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [String(channelId)]
    );

    console.log("Last summary:", lastSummary);

    if (!lastSummary) {
      return { needsNewSummary: true, lastEndMessageId: null };
    }

    const messagesSinceLastSummary = await db.get(
      `
      SELECT COUNT(*) as count
      FROM messages
      WHERE channel_id = ? AND id > ?
    `,
      [String(channelId), String(lastSummary.end_message_id)]
    );

    console.log("Messages since last summary:", messagesSinceLastSummary);

    return {
      needsNewSummary:
        messagesSinceLastSummary.count >= config.summaryThreshold,
      lastEndMessageId: lastSummary.end_message_id,
    };
  } catch (error) {
    console.error("Error checking last summary:", error);
    throw error;
  }
}

export { summarizeAndStore, getRelevantSummaries, getLastSummaryAndCheck };
