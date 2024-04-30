import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { indexMessagesInChroma } from "../memory/rag/index-messages.js";

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
  const messages = await interaction.channel.messages.fetch();
  const channelId = interaction.channel.id;
  const { count } = await indexMessagesInChroma(messages, channelId);

  // Reply with a confirmation
  interaction.reply({
    content: `I added ${count} messages to the database for you!`,
    ephemeral: true,
  });
};

export { create, invoke };
