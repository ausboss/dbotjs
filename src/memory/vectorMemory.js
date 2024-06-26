import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Document } from "langchain/document";
import { contentCleaner } from "../helpers/utilities.js";

export async function logDetailedMessageVector(
  message,
  client,
  formattedMessage
) {
  const botName = client.user.username;

  const type = "message";

  const displayName = message.member
    ? message.member.displayName
    : message.author.globalName;

  const { id: userId, username, discriminator, avatar } = message.author;

  // Message information
  const {
    id: messageId,
    channelId,
    guildId, // This property distinguishes between DMs and server channel messages
    createdTimestamp,
    cleanContent: cleanContentOriginal,
    tts,
    attachments,
  } = message;

  // Clean the message content
  const cleanContent = contentCleaner(formattedMessage, botName);

  const doc = new Document({
    pageContent: cleanContent,
    metadata: {
      id: messageId,
      source: "discord",
      createdTimestamp: createdTimestamp,
      type: type,
      tts: tts,
      attachments: attachments,
      userId: userId,
      username: displayName || username,
      discriminator: discriminator,
      avatar: avatar,
      channelId: channelId,
      guildId: guildId,
    },
  });
  const docs = [doc];
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(
    docs,
    new OllamaEmbeddings({
      baseUrl: "http://localhost:11434",
      model: "tinydolphin",
    }),
    {
      collectionName: "dbot",
      url: "http://localhost:8000",
      collectionMetadata: {
        "hnsw:space": "cosine",
      },
    }
  );
}
