// If the module uses named exports
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { getLastXMessages } from "../chatLog.js"; // Adjust path as necessary
import getMessageType from "../../helpers/messageType.js"; // Adjust path as necessary

export const ollamaEmbeddings = new OllamaEmbeddings({
  baseUrl: "http://127.0.0.1:11434",
  model: "tinydolphin",
});

export default async function indexMessagesInChroma(interaction) {
  const channelId = interaction.channel.id;
  const messageType = await getMessageType(interaction);
  const collectionName = `messages-${channelId}`;

  // Use a text splitter to handle large messages or aggregate multiple messages
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
    separators: ["\n\n", "\n", " ", ""],
    chunkOverlap: 200,
  });
  const messages = await getLastXMessages(db, channelId, 100, messageType);

  // format the messages to be used as docs
  const docs = messages.map((msg) => {
    return {
      text: msg.clean_content,
      metadata: {
        name: msg.name,
        timestamp: msg.timestamp,
      },
    };
  });

  const output = await splitter.splitDocuments(docs);
  console.log("output" + output);
  const vectorStore = await Chroma.fromDocuments(output, ollamaEmbeddings, {
    collectionName,
    url: "http://localhost:8000",
  });
  console.log(vectorStore);
  return { vectorStore };
}
