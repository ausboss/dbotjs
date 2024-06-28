import { shouldReply } from "../helpers/shouldReply.js";
import { forcedInteractionPromptFormatter } from "../memory/promptFormatter.js";
import { llmChatCall, llmCall } from "../chatlogic/llmCall.js";
import { sendInteractionMessageInParts } from "../helpers/splitMessages.js";
import { getLastXMessages } from "../memory/chatlogFunctions.js";
import {
  summarizeAndStore,
  getLastSummaryAndCheck,
  getRelevantSummaries,
} from "../memory/summaryMemory.js";
import config from "../config.js";
import getMessageType from "../helpers/message-type.js";

const INACTIVITY_PERIOD = config.inactivityPeriod || 10 * 1 * 1000; // 10 seconds by default
const SUMMARY_PERIOD = config.summaryPeriod || 20 * 1 * 1000; // 20 seconds by default

const inactivityTimers = {}; // Object to store inactivity timers for each channel
const summaryTimers = {}; // Object to store summary timers for each channel

async function isLastMessageFromBot(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 1 });
    const lastMessage = messages.first();
    return lastMessage ? lastMessage.author.bot : false;
  } catch (error) {
    console.error("Error fetching last message:", error);
    return false; // Assume it's not from a bot if there's an error
  }
}

async function generateSummaryIfNeeded(message) {
  const messageType = await getMessageType(message);
  const channelId = String(message.channelId);
  const guildId = String(message.guildId);

  try {
    const { needsNewSummary, lastEndMessageId } = await getLastSummaryAndCheck(
      channelId
    );

    if (needsNewSummary) {
      const messagesToSummarize = await getLastXMessages(
        channelId,
        config.summaryThreshold,
        messageType
      );

      if (lastEndMessageId) {
        // Only summarize messages after the last summary
        const newMessages = messagesToSummarize.filter(
          (msg) => msg.id > lastEndMessageId
        );
        if (newMessages.length >= config.summaryThreshold) {
          await summarizeAndStore(newMessages, channelId, guildId);
          console.log(`New summary generated for channel ${channelId}`);
        }
      } else {
        // No previous summary, summarize all messages
        await summarizeAndStore(messagesToSummarize, channelId, guildId);
        console.log(`Initial summary generated for channel ${channelId}`);
      }
    }
  } catch (error) {
    console.error("Error generating summary:", error);
  }
}

async function performInactivityTasks(client, message, channel) {
  const lastMessageFromBot = await isLastMessageFromBot(channel);
  if (lastMessageFromBot) {
    console.log("Last message was from a bot. Skipping response.");
    return;
  }

  const replyTaskBool = await shouldReply(client, message);
  console.log("Should bot reply next?", replyTaskBool);

  if (replyTaskBool) {
    let typing = true;

    // Function to keep sending typing indicator
    const keepTyping = async () => {
      while (typing) {
        await message.channel.sendTyping();
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Discord typing status lasts for 10 seconds, refresh every 5 seconds
      }
    };

    // Start showing typing indicator
    keepTyping();

    // Retrieve relevant summaries
    const relevantSummaries = await getRelevantSummaries(message.channelId);

    // Call the language model to generate a response
    const { promptTemplate, messageObjects } =
      await forcedInteractionPromptFormatter(message);

    // Ensure promptTemplate is correctly formatted
    const summariesText = relevantSummaries.map((s) => s.summary).join("\n\n");

    let formattedPrompt;
    if (typeof promptTemplate === "string") {
      formattedPrompt = promptTemplate.replace(
        "{{summaries}}",
        `Recent conversation summaries:\n${summariesText}\n\nCurrent conversation:`
      );
    } else if (
      typeof promptTemplate === "object" &&
      "format" in promptTemplate
    ) {
      formattedPrompt = promptTemplate.format({
        summaries: `Recent conversation summaries:\n${summariesText}\n\nCurrent conversation:`,
      });
    } else {
      throw new Error("Unsupported promptTemplate format");
    }

    // Ensure formattedPrompt is a string before passing to llmChatCall
    const finalPrompt = formattedPrompt.toString();

    console.log("Final prompt before calling llmChatCall:", finalPrompt);

    // Pass the correctly formatted prompt to llmChatCall
    const chainResponse = await llmChatCall(finalPrompt, messageObjects, []);

    if (chainResponse && chainResponse.content) {
      const finalLastMessageFromBot = await isLastMessageFromBot(channel);
      if (!finalLastMessageFromBot) {
        await sendInteractionMessageInParts(message, chainResponse.content);
      } else {
        console.log("Last message was from a bot. Skipping response.");
      }
    } else {
      console.error(
        "Error: chainResponse or chainResponse.content is undefined."
      );
    }

    typing = false;
  }
}

export function resetTimers(client, message) {
  const channelId = message.channelId;
  const guildId = message.guildId;

  // Reset inactivity timer
  if (inactivityTimers[channelId]) {
    clearTimeout(inactivityTimers[channelId]);
  }

  inactivityTimers[channelId] = setTimeout(async () => {
    console.log(
      `No activity detected for ${INACTIVITY_PERIOD}ms in channel ${channelId}. Performing inactivity tasks...`
    );
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) {
        await performInactivityTasks(client, message, channel);
      }
    } catch (error) {
      console.error("Error in inactivity timer task:", error);
    }
  }, INACTIVITY_PERIOD);

  // Reset summary timer
  if (summaryTimers[channelId]) {
    clearTimeout(summaryTimers[channelId]);
  }

  summaryTimers[channelId] = setTimeout(async () => {
    console.log(
      `No activity detected for ${SUMMARY_PERIOD}ms in channel ${channelId}. Generating summary...`
    );
    try {
      await generateSummaryIfNeeded(message);
    } catch (error) {
      console.error("Error in summary timer task:", error);
    }
  }, SUMMARY_PERIOD);

  console.log(`Set timers for channel ${channelId}`);
}

export function clearTimers(channelId) {
  if (inactivityTimers[channelId]) {
    clearTimeout(inactivityTimers[channelId]);
    delete inactivityTimers[channelId];
  }
  if (summaryTimers[channelId]) {
    clearTimeout(summaryTimers[channelId]);
    delete summaryTimers[channelId];
  }
  console.log(`Cleared all timers for channel ${channelId}`);
}
