const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Gives detailed descriptions of all commands.')
        .addStringOption(option =>
			option
				.setName('command')
				.setDescription('Command you would like to know more detail about.')),
	async execute(interaction) {
        var helpStr = "";
        const descArray = {
            "availability": "/availability: If you would like to host a poker night, start with this command. This command will ask you for two dates, a start date, and an end date. Then, all Fridays and Saturdays found in between the two dates are found and displayed to you. Then, you can trim the dates found this way if you cannot host on those days. Once you have the dates listed that you can host, click the Confirm button. This will send an availability form to all users in the channel so they can select the dates they are available to attend. Once one of the days looks good to host, you can use the /choose command to select a date to host.",
            "choose": "/choose: Once you have sent availability forms to everyone and they have had enough time to respond, this command will let you choose which night to host. This command will ask for a number, which is the minimum amount of players you need to host your event. For example, if you will only host if at least 4 people are attending, put 4 for this number. Then, all dates that have at least the number of people you input will appear. You can click one of them to select that night to host. Once clicked, availability forms are closed, and an event night is created in the system with the date and your name.",
            "close": "/close: Using this command by itself will close out all availability forms, allowing you to make a new one. If you instead give this command a name afterwards, that name will be recorded as the winner of the event. Afterwards, this will close out the event, allowing you to make a new one. ",
            "info": "/info: This command gives info including host name and date for the next scheduled event.",
        };

		if(interaction.options.getString('command') === null) {
            helpStr = `This bot will help you keep track of availability to find the best night to host an event. Type '/help NameOfCommand' to get more info on what a certain command does.`
        } else {
            helpStr = descArray[interaction.options.getString('command')];
        }

        await interaction.reply({content:helpStr, ephemeral: true});
	},
};
