const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Gives info of next confirmed event'),
	async execute(interaction) {
        const checkForConfirmedEvents = await db.query(`SELECT unique_id, event_date, host_id FROM public.confirmed_event where is_active = true order by event_date desc limit 1;`);

        if(checkForConfirmedEvents.rowCount) {
            const guild = interaction.guild;
            const host = await guild.members.fetch(checkForConfirmedEvents.rows[0].host_id);
            const hostsName = host.user.username;

            await interaction.reply({content: `The next poker night is on ${checkForConfirmedEvents.rows[0].event_date}, hosted by ${capitalizeFirstLetter(hostsName)}`, ephemeral: true});
        } else {
            await interaction.reply({content: `There are currently no active events. Use /availability to start the process, or if you already have availability forms sent out, use /choose to select a date for the event.`, ephemeral: true});
        }
	},
};

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}