const express = require('express');
const PORT = 3000;
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// Replace with your channel IDs
const CONFESSION_CHANNEL_ID = '1253727210083319909';
const CONFESSION_LOG_CHANNEL_ID = '1238077008370597938';
const REPLY_LOG_CHANNEL_ID = '1238077008370597938';

// Load confessions file
let confessions = JSON.parse(fs.readFileSync("confessions.json", "utf8") || '{"lastConfession":0,"confessions":{}}');

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || message.guild) return;

  const content = message.content.trim();

  // 🔁 Handle replies: /confess reply #ID message
  if (content.toLowerCase().startsWith("/confess reply")) {
    const parts = content.split(" ");
    const parentId = parts[2]?.replace("#", "");
    const replyText = parts.slice(3).join(" ");

    if (!parentId || !replyText) {
      return message.reply("❗ Usage: `/confess reply #1 your reply here`");
    }

    const parent = confessions.confessions[parentId];
    if (!parent) return message.reply(`❌ Confession #${parentId} not found.`);

    try {
      const confessionChannel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
      const logChannel = await client.channels.fetch(REPLY_LOG_CHANNEL_ID);
      const parentMessage = await confessionChannel.messages.fetch(parent.messageId);

      confessions.lastConfession += 1;
      const newId = confessions.lastConfession;

      const embed = new EmbedBuilder()
        .setTitle(`📝 Confession #${newId}`)
        .setDescription(replyText)
        .setColor(0xFFFFFF)
        .setFooter({ text: `Use /confess to send your own confession anonymously!` })
        .setTimestamp();

      const sent = await parentMessage.reply({ embeds: [embed] });

      confessions.confessions[newId] = {
        messageId: sent.id,
        channelId: confessionChannel.id,
        replyTo: parentId,
        user: {
          username: message.author.tag,
          id: message.author.id,
          message: replyText,
          time: new Date().toISOString()
        }
      };

      fs.writeFileSync("confessions.json", JSON.stringify(confessions, null, 2));
      message.reply(`✅ Replied as Confession #${newId}.`);

      const replyLogEmbed = new EmbedBuilder()
      .setTitle(`📨 Reply #${newId} to Confession #${parentId}`)
      .setDescription(replyText)
      .addFields(
        { name: "Replied by", value: `\`${message.author.tag}\` | \`${message.author.id}\``, inline: false }
      )
      .setColor(0xFFFFFF)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

      logChannel.send({ embeds: [replyLogEmbed] });
    } catch (err) {
      console.error(err);
      message.reply("❌ Failed to reply. Original message might have been deleted.");
    }

    return;
  }

  // 📨 Handle normal confession: /confess your message
  if (content.toLowerCase().startsWith("/confess ")) {
    const confessionText = content.slice(9).trim();
    if (!confessionText) return message.reply("❗ Please enter your confession.");

    try {
      const confessionChannel = await client.channels.fetch(CONFESSION_CHANNEL_ID);
      const logChannel = await client.channels.fetch(CONFESSION_LOG_CHANNEL_ID);

      confessions.lastConfession += 1;
      const id = confessions.lastConfession;

      const embed = new EmbedBuilder()
        .setTitle(`📝 Confession #${id}`)
        .setDescription(confessionText)
        .setColor(0xFFFFFF)
        .setFooter({ text: "Use /confess to send your own confession anonymously!" })
        .setTimestamp();

      const sent = await confessionChannel.send({ embeds: [embed] });

      confessions.confessions[id] = {
        messageId: sent.id,
        channelId: confessionChannel.id,
        user: {
          username: message.author.tag,
          id: message.author.id,
          message: confessionText,
          time: new Date().toISOString()
        }
      };

      fs.writeFileSync("confessions.json", JSON.stringify(confessions, null, 2));
      message.reply(`✅ Your confession has been submitted as #${id}.`);

      const logEmbed = new EmbedBuilder()
      .setTitle(`📝 Confession #${id}`)
      .setDescription(confessionText)
      .addFields(
        { name: "Sent by", value: `\`${message.author.tag}\` | \`${message.author.id}\``, inline: false }
      )
      .setColor(0xFFFFFF)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

      logChannel.send({ embeds: [logEmbed] });
    } catch (err) {
      console.error(err);
      message.reply("❌ Failed to submit your confession.");
    }
  }
});

// Keep-alive server
express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

client.login(process.env.TOKEN);
