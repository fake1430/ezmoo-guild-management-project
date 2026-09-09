import { REST, Routes } from 'discord.js';
import { statCommand } from './commands/stat.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
}

const rest = new REST().setToken(token);
const body = [statCommand.toJSON()];
const guildId = process.env.DISCORD_GUILD_ID;

if (guildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`Registered /stat in guild ${guildId}`);
} else {
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log('Registered /stat globally');
}
