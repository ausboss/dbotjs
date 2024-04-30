import { RecursiveCharacterTextSplitter } from "@langchain/text_splitter";
import { ollamaEmbeddings } from "langchain/embeddings/ollama";

export async function indexMessagesInChroma(
  messages,
  channelId,
  chunkSize = 1000
) {
  const collectionName = `messages-${channelId}`;
  const vectorStore = await Chroma.fromExistingOrNewCollection(
    ollamaEmbeddings,
    {
      collectionName,
      url: "http://localhost:8000",
    }
  );

  // Use a text splitter to handle large messages or aggregate multiple messages
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
    separators: ["\n\n", "\n", " ", ""],
    chunkOverlap: 200,
  });

  // Prepare documents from messages
  const docs = messages.map((msg) => ({
    pageContent: `${msg.name}: ${msg.clean_content}`,
  }));
  const output = await splitter.splitDocuments(docs);

  // Index the chunks into Chroma
  await vectorStore.addDocuments(output);
  return { count: output.length };
}
