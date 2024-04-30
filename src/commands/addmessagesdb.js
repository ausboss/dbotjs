import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import indexMessagesInChroma from "../memory/rag/index-messages.js";

// slash command from user to add messages to the database for that channel
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("addmessagesdb")
    .setDescription(
      "Adds the messages from the channel to the vector database!"
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  await indexMessagesInChroma(interaction);

  // Reply with a confirmation
  interaction.reply({
    content: `I added messages to the database for you!`,
    ephemeral: true,
  });
};

export { create, invoke };
