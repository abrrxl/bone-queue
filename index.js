const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, ActionRowBuilder, EmbedBuilder,
  PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');

require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const QUEUE_CH  = '1499550807522021528';
const GUILD_ID  = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

const queueEntries = new Map(); // messageId → { userId, bought, position }

// ─────────────────────────────────────────────
//  REGISTRO DE COMANDOS
// ─────────────────────────────────────────────
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Add a new queue entry')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(o => o.setName('user').setDescription('The user').setRequired(true))
      .addStringOption(o => o.setName('bought').setDescription('What they bought').setRequired(true))
      .addStringOption(o => o.setName('position').setDescription('Queue position').setRequired(true))
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands.map(c => c.toJSON()) });
    console.log('✅ Commands registered.');
  } catch (err) { console.error('Error registering commands:', err); }
}

client.once('clientReady', () => {
  console.log(`✅ Bone queue bot connected as ${client.user.tag}`);
  registerCommands();
});

// ─────────────────────────────────────────────
//  INTERACTIONS
// ─────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // /queue
  if (interaction.isChatInputCommand() && interaction.commandName === 'queue') {
    const user     = interaction.options.getUser('user');
    const bought   = interaction.options.getString('bought');
    const position = interaction.options.getString('position');

    const text =
      `_ _\n` +
      `_ _ \`new queue ﹕ ♡\` **__ongoing__**\n` +
      `_ _ \`bought ﹕✧\` ${bought}\n` +
      `_ _ \`position ﹕✦\` ${position}\n` +
      `_ _ \`user ﹕✧\` <@${user.id}>\n` +
      `_ _`;

    try {
      const ch  = await client.channels.fetch(QUEUE_CH);
      const msg = await ch.send(text);

      const select = new StringSelectMenuBuilder()
        .setCustomId(`queue_${msg.id}`)
        .setPlaceholder('Change status')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Ongoing').setValue('ongoing'),
          new StringSelectMenuOptionBuilder().setLabel('Noted').setValue('noted'),
          new StringSelectMenuOptionBuilder().setLabel('Done').setValue('done')
        );

      await msg.edit({ components: [new ActionRowBuilder().addComponents(select)] });
      queueEntries.set(msg.id, { userId: user.id, bought, position });
      await interaction.reply({ content: '✅ Queue entry added.', ephemeral: true });
    } catch (err) {
      console.error('Queue error:', err);
      await interaction.reply({ content: '⚠️ Could not send queue entry.', ephemeral: true });
    }
    return;
  }

  // Dropdown status change
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('queue_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '⚠️ You do not have permission to change the status.', ephemeral: true });
      return;
    }

    const msgId    = interaction.customId.replace('queue_', '');
    const status   = interaction.values[0];
    const entry    = queueEntries.get(msgId);
    if (!entry) { await interaction.reply({ content: '⚠️ Queue entry not found.', ephemeral: true }); return; }

    const text =
      `_ _\n` +
      `_ _ \`new queue ﹕ ♡\` **__${status}__**\n` +
      `_ _ \`bought ﹕✧\` ${entry.bought}\n` +
      `_ _ \`position ﹕✦\` ${entry.position}\n` +
      `_ _ \`user ﹕✧\` <@${entry.userId}>\n` +
      `_ _`;

    const select = new StringSelectMenuBuilder()
      .setCustomId(`queue_${msgId}`)
      .setPlaceholder('Change status')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Ongoing').setValue('ongoing'),
        new StringSelectMenuOptionBuilder().setLabel('Noted').setValue('noted'),
        new StringSelectMenuOptionBuilder().setLabel('Done').setValue('done')
      );

    try {
      const ch  = await client.channels.fetch(QUEUE_CH);
      const msg = await ch.messages.fetch(msgId);
      await msg.edit({ content: text, components: [new ActionRowBuilder().addComponents(select)] });
      await interaction.reply({ content: `✅ Status updated to **${status}**.`, ephemeral: true });
    } catch { await interaction.reply({ content: '⚠️ Could not update.', ephemeral: true }); }
  }
});

client.login(process.env.TOKEN);
